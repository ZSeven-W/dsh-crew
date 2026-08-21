// Advisory per-cwd concurrency lock (WPC9 guardrail 2).
//
// Real incident (2026-08-2x): two workers writing the same repo at once left
// another process reading a half-written file (939 lines, unparseable). As
// the backend matrix (hub / standalone / agy / grok / ...) grows, concurrent
// same-repo workers stop being an edge case, so the dispatcher now REFUSES a
// second running job for one cwd instead of queueing it: queueing would hide
// the caller bug ("you should not have dispatched two writers at one repo")
// behind a silent wait, and a second writer usually corrupts whatever the
// first one is doing anyway.
//
// Scope and lifetime:
//   - Keyed by the canonical absolute path of the cwd — realpath when the
//     directory exists (symlink aliases like macOS's /tmp -> /private/tmp
//     then share one lock), resolve() otherwise.
//   - Process memory only, on purpose: no file locks, so a crashed dispatch
//     process can never leave a permanent deadlock behind — its locks die
//     with it. Locks therefore coordinate dispatches within one crew MCP
//     session (one per host session).
//   - Advisory: allow_concurrent_cwd: true skips acquisition entirely
//     (read-only fan-out over one repo is legitimate).
//   - Released on every terminal path (done / failed / cancelled / timeout)
//     through the job settle hooks: jobs.mjs startJob finally (standalone)
//     and cli-workers settle (CLI). Hub jobs have no settle callback on the
//     client, so their locks are released when a settled state is observed
//     (hub.get after wait, dsh_worker_status purge, stale-check on acquire).

import { resolve } from 'node:path';
import { realpathSync } from 'node:fs';

const locks = new Map(); // canonical cwd -> holder

/** Canonical absolute path of a workspace cwd (realpath when it exists). */
export function normalizeCwd(cwd) {
  try { return realpathSync.native(String(cwd)); } catch { return resolve(String(cwd)); }
}

/** Thrown by acquireCwdLock when another running job holds the cwd. */
export class CwdLockError extends Error {
  constructor(holder) {
    super(
      `workspace "${holder.cwd}" is already held by a running worker (job ${holder.jobId}, backend ${holder.backend}, mode ${holder.mode}, started at ${holder.startedAt}). ` +
      'Refusing this dispatch instead of queueing it: two workers writing the same repo concurrently corrupt files. ' +
      'Wait for that job to settle, cancel it, or pass allow_concurrent_cwd: true if this task is read-only.',
    );
    this.name = 'CwdLockError';
    this.holder = { ...holder };
  }
}

/**
 * Acquire the advisory lock for one cwd. Returns { holder, release } where
 * release() is idempotent and safe to call from any settle path. With
 * allowConcurrent: true this is a deliberate no-op (the lock stays advisory).
 */
export function acquireCwdLock({ cwd, jobId, backend, mode, startedAt, allowConcurrent = false }) {
  if (allowConcurrent) return { holder: null, release() {} };
  const key = normalizeCwd(cwd);
  const existing = locks.get(key);
  if (existing) throw new CwdLockError(existing);
  const holder = { jobId, backend, mode, startedAt, cwd: key };
  locks.set(key, holder);
  let released = false;
  return {
    holder,
    release() {
      if (released) return;
      released = true;
      if (locks.get(key) === holder) locks.delete(key);
    },
  };
}

/** Backfill the real job id after a spawn whose id was unknown at acquire time (hub path). */
export function updateCwdLockHolder({ cwd, jobId }) {
  const holder = locks.get(normalizeCwd(cwd));
  if (holder) holder.jobId = jobId;
}

/** Release whichever lock the given job holds (idempotent). */
export function releaseCwdLockByJobId(jobId) {
  for (const [key, holder] of locks) {
    if (holder.jobId === jobId) { locks.delete(key); return true; }
  }
  return false;
}

/** Current lock table for dsh_worker_status: which cwd is held by whom. */
export function getCwdLocks() {
  return [...locks.entries()].map(([cwd, holder]) => ({ cwd, holder: { ...holder } }));
}
