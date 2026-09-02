// MCP stdio server exposing the DSH worker pool to Claude Code / Codex.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { startJob, waitJob, cancelJob, listJobs, getJob, jobView } from './jobs.mjs';
import { hubAvailable, hub } from './hub-client.mjs';
import { startCliJob } from './cli-workers.mjs';
import { listProfiles, resolveProfile } from './worker-profiles.mjs';
import { readInheritedOrigin, extendOrigin, DEFAULT_ORIGIN_DEPTH_LIMIT } from './origin-guard.mjs';
import { acquireCwdLock, releaseCwdLockByJobId, updateCwdLockHolder, getCwdLocks, CwdLockError } from './cwd-lock.mjs';
import { resolveWorkerCwd } from './paths.mjs';

const server = new McpServer({ name: 'dsh-crew', version: '0.1.0-rc.7' });

const tierSchema = z.enum(['flash', 'pro']).optional().describe('Worker model tier. flash = mechanical, well-scoped work (single-file edits, lookups, formatting); pro = multi-file changes, debugging, design judgment. Omit to use the session default. Ignored when worker= is set.');
const effortSchema = z.enum(['off', 'high', 'max']).optional().describe('Reasoning effort for the worker. Omit to use the session default. With worker= it only applies when passed explicitly and the profile supports it (agy maps to low/medium/high).');
const workerSchema = z.string().optional().describe('Named CLI worker profile (e.g. "agy" or "grok"). Explicit opt-in only: set it when the user explicitly asks for that external coding CLI, never as a default. When set, dispatch bypasses tier/mode and runs the task through that CLI; the profile pins backend×model×effort. See dsh_worker_config output, worker_profiles field, for the available profiles.');
const allowConcurrentCwdSchema = z.boolean().optional().describe('Allow this dispatch even though another running worker already holds the same cwd (workspace) lock. Default false: concurrent writers corrupt a shared repo, so the second dispatch is refused with the holder info instead of queueing. Set true only for read-only tasks.');

// Session-level configuration. This MCP server process lives exactly as long
// as one Claude Code / Codex session, so plain memory IS session scope.
// Initial values come from the global config (~/.config/dsh-crew/config.json,
// edited on the DSH settings page); dsh_worker_config overrides per session.
import { readGlobalConfig } from './install/install.mjs';
const globalDefaults = readGlobalConfig();
const sessionConfig = {
  enabled: true,
  default_tier: globalDefaults.default_tier,
  default_effort: globalDefaults.default_effort,
  mode: globalDefaults.mode, // auto | hub | standalone
  default_timeout_seconds: globalDefaults.default_timeout_seconds,
  tier_policy: globalDefaults.tier_policy, // auto | flash-only | pro-only
  escalate_on_failure: globalDefaults.escalate_on_failure,
  preset_flash: globalDefaults.preset_flash ?? 'default',
  preset_pro: globalDefaults.preset_pro ?? 'default',
  // WPC9: max worker→worker nesting depth before a dispatch is refused.
  origin_depth_limit: DEFAULT_ORIGIN_DEPTH_LIMIT,
};

function presetForTier(tier) {
  const p = tier === 'flash' ? sessionConfig.preset_flash : sessionConfig.preset_pro;
  return !p || p === 'default' ? undefined : p;
}

/** Tool-layer tier enforcement: the policy overrides whatever was requested. */
function applyTierPolicy(tier) {
  if (sessionConfig.tier_policy === 'flash-only') return 'flash';
  if (sessionConfig.tier_policy === 'pro-only') return 'pro';
  return tier ?? sessionConfig.default_tier;
}

function text(obj) {
  return { content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }] };
}

// Which orchestrator spawned this MCP server — stamped on every job so the
// panel can show where a dispatch came from.
function detectOrchestrator() {
  if (process.env.CLAUDECODE || process.env.CLAUDE_CODE_ENTRYPOINT) return 'claude-code';
  try {
    const { execSync } = require('node:child_process');
    const comm = execSync(`ps -o comm= -p ${process.ppid}`, { encoding: 'utf8' }).trim().toLowerCase();
    if (comm.includes('claude')) return 'claude-code';
    if (comm.includes('codex')) return 'codex';
    return comm.split('/').pop() || 'unknown';
  } catch { return 'unknown'; }
}
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ORCHESTRATOR = detectOrchestrator();

// ---------- WPC9 guardrails ----------

// Origin chain this crew instance inherited from whoever spawned it (read at
// startup from the env written by the dispatching crew — origin-guard.mjs).
// Every dispatch appends its own hop and refuses loops / over-deep chains
// BEFORE anything is spawned, so recursion can never start burning quota.
const INHERITED_ORIGIN = readInheritedOrigin(process.env);
const depthLimitNow = () => sessionConfig.origin_depth_limit ?? DEFAULT_ORIGIN_DEPTH_LIMIT;

// Hub jobs run inside the DSH host and have no settle callback on this side,
// so the origin recorded at spawn time is kept here and re-attached to every
// hub view this session returns (the hub itself ignores the extra spawn
// fields until the hub side adopts them).
const hubOrigins = new Map();

function attachOrigin(view, jobId) {
  if (!view || typeof view !== 'object') return view;
  const o = hubOrigins.get(jobId);
  if (o && view.origin_depth === undefined) {
    view.origin_depth = o.depth;
    view.origin_chain = o.chain;
  }
  return view;
}

/** Readable refusal payload for the two origin guard checks. */
function originRefusal(res) {
  return text({ error: `dispatch refused by origin guard: ${res.error.reason}`, ...res.error });
}

/**
 * Acquire the cwd advisory lock for a hub dispatch (job id is unknown until
 * the hub answers, so it is backfilled by updateCwdLockHolder). A conflict
 * against a hub-held lock is re-checked once against the hub: a hub job can
 * settle without this side ever hearing about it, and a stale lock must not
 * permanently block the cwd.
 */
async function acquireDispatchLock({ cwd, backend, mode, allowConcurrent }) {
  for (let attempt = 0; ; attempt++) {
    try {
      return acquireCwdLock({ cwd, jobId: null, backend, mode, startedAt: new Date().toISOString(), allowConcurrent });
    } catch (err) {
      if (!(err instanceof CwdLockError) || attempt > 0 || err.holder.mode !== 'hub') throw err;
      let settled = false;
      try { settled = (await hub.get(err.holder.jobId, 0)).status !== 'running'; }
      catch (e) { if (String(e?.message ?? e).includes('no such job')) settled = true; }
      if (!settled) throw err;
      releaseCwdLockByJobId(err.holder.jobId);
    }
  }
}

function dispatchDisabled() {
  return text({
    error: 'worker dispatch is disabled for this session (set via dsh_worker_config). Report this to the user instead of doing the task yourself.',
  });
}

async function resolveMode() {
  if (sessionConfig.mode === 'standalone') return 'standalone';
  const up = await hubAvailable();
  if (sessionConfig.mode === 'hub' && !up) throw new Error('session mode is "hub" but the DSH workers hub is not reachable');
  return up ? 'hub' : 'standalone';
}

server.registerTool('dsh_run_worker', {
  title: 'Run DSH worker (blocking)',
  description: 'Run one DSH (DeepSeek Harness) coding agent task and block until it finishes. Tier guidance: flash for mechanical, well-scoped work (single-file edits, lookups, formatting); pro for multi-file changes, debugging, and design judgment. The task string must be self-contained: the worker has zero conversation context, so include absolute paths, exact acceptance criteria, and constraints. Set worker="agy" or "grok" only when the user explicitly asks for that CLI, never as a default. Guardrails refuse (never queue) worker→worker recursion beyond the origin-chain depth cap and a second writer on the same cwd; allow_concurrent_cwd: true only for read-only tasks.',
  inputSchema: {
    task: z.string().describe('Full task description for the worker, self-contained'),
    tier: tierSchema,
    effort: effortSchema,
    worker: workerSchema,
    cwd: z.string().optional().describe('Workspace directory for the worker. Relative paths resolve against the caller\'s current workspace; "." or "current" mean the current workspace. Omit for the current workspace.'),
    timeout_seconds: z.number().int().positive().max(7200).optional(),
    allow_concurrent_cwd: allowConcurrentCwdSchema,
  },
}, async ({ task, tier, effort, worker, cwd, timeout_seconds, allow_concurrent_cwd }) => {
  if (!sessionConfig.enabled) return dispatchDisabled();
  const workDir = resolveWorkerCwd(cwd);
  const e = effort ?? sessionConfig.default_effort;
  const timeout = timeout_seconds ?? sessionConfig.default_timeout_seconds;
  const depthLimit = depthLimitNow();

  // CLI profile dispatch: worker= names a profile and bypasses the
  // hub/standalone tier logic entirely (no tier policy, no escalation — the
  // profile pins backend×model×effort). Calls without worker= are untouched.
  if (worker) {
    const profile = resolveProfile(worker); // throws listing the available profile names
    const origin = extendOrigin({ inherited: INHERITED_ORIGIN, backend: profile.backend, cwd: workDir, source: ORCHESTRATOR, depthLimit });
    if (!origin.ok) return originRefusal(origin);
    let job;
    try {
      job = await startCliJob({ worker, task, cwd: workDir, timeoutMs: timeout * 1000, source: ORCHESTRATOR, effort, origin: origin.origin, allowConcurrentCwd: !!allow_concurrent_cwd });
    } catch (err) {
      if (err instanceof CwdLockError) return text({ error: err.message, rejected_by: 'cwd-lock', holder: err.holder });
      throw err;
    }
    await waitJob(job.id, timeout * 1000);
    const view = jobView(job, { withResult: true });
    if (view.status === 'running') return text({ ...view, note: `still running after ${timeout}s; poll with dsh_worker_result` });
    return text(view);
  }

  const runOnce = async (t) => {
    if ((await resolveMode()) === 'hub') {
      const origin = extendOrigin({ inherited: INHERITED_ORIGIN, backend: 'hub', cwd: workDir, source: ORCHESTRATOR, depthLimit });
      if (!origin.ok) return { refusal: originRefusal(origin) };
      let lock;
      try {
        lock = await acquireDispatchLock({ cwd: workDir, backend: 'hub', mode: 'hub', allowConcurrent: !!allow_concurrent_cwd });
      } catch (err) {
        if (err instanceof CwdLockError) return { refusal: text({ error: err.message, rejected_by: 'cwd-lock', holder: err.holder }) };
        throw err;
      }
      let spawned;
      try {
        spawned = await hub.spawn({ task, tier: t, effort: e, cwd: workDir, source: ORCHESTRATOR, preset: presetForTier(t), origin_chain: origin.origin.chain, origin_depth: origin.origin.depth });
        updateCwdLockHolder({ cwd: workDir, jobId: spawned.id });
        hubOrigins.set(spawned.id, origin.origin);
      } catch (err) {
        lock.release();
        throw err;
      }
      // The hub client slices this wait internally; a single request that
      // waits minutes would be cut by undici's 300 s header timeout and
      // reported as a bare "fetch failed" while the job kept running.
      const got = await hub.get(spawned.id, timeout);
      attachOrigin(got, spawned.id);
      if (got.status !== 'running') releaseCwdLockByJobId(spawned.id);
      return { view: got };
    }
    const origin = extendOrigin({ inherited: INHERITED_ORIGIN, backend: 'standalone', cwd: workDir, source: ORCHESTRATOR, depthLimit });
    if (!origin.ok) return { refusal: originRefusal(origin) };
    let job;
    try {
      job = await startJob({ task, tier: t, effort: e, cwd: workDir, timeoutMs: timeout * 1000, source: ORCHESTRATOR, origin: origin.origin, allowConcurrentCwd: !!allow_concurrent_cwd });
    } catch (err) {
      if (err instanceof CwdLockError) return { refusal: text({ error: err.message, rejected_by: 'cwd-lock', holder: err.holder }) };
      throw err;
    }
    await waitJob(job.id, timeout * 1000);
    return { view: jobView(job, { withResult: true }) };
  };

  const firstTier = applyTierPolicy(tier);
  let res = await runOnce(firstTier);
  if (res.refusal) return res.refusal;
  let job = res.view;
  if (job.status === 'running') return text({ ...job, note: `still running after ${timeout}s; poll with dsh_worker_result` });

  // Escalate on evidence, not prediction: a failed flash run retries once on
  // pro — unless the policy pins the tier to flash.
  if (job.status === 'failed' && sessionConfig.escalate_on_failure
      && firstTier === 'flash' && sessionConfig.tier_policy !== 'flash-only') {
    const firstError = job.error ?? job.stopReason ?? 'unknown failure';
    res = await runOnce('pro');
    if (res.refusal) return res.refusal;
    job = res.view;
    if (job.status === 'running') return text({ ...job, escalated: true, note: `escalated to pro, still running after ${timeout}s; poll with dsh_worker_result` });
    return text({ ...job, escalated: true, flash_failure: String(firstError).slice(0, 200) });
  }
  return text(job);
});

server.registerTool('dsh_worker_config', {
  title: 'Session worker configuration',
  description: 'Read or update session-level worker settings: enable/disable dispatch, default tier/effort/timeout, execution mode (auto = prefer hub, hub = require the DSH hub, standalone = never use it), tier policy and failure escalation. Call with no arguments to read. The output includes worker_profiles — the external-CLI backends (agy, grok) usable via the worker= parameter of dsh_run_worker / dsh_spawn_worker — and origin, the inherited worker→worker dispatch chain with its depth limit. Session-only.',
  inputSchema: {
    enabled: z.boolean().optional().describe('false = refuse all worker dispatch this session'),
    default_tier: z.enum(['flash', 'pro']).optional(),
    default_effort: z.enum(['off', 'high', 'max']).optional(),
    mode: z.enum(['auto', 'hub', 'standalone']).optional(),
    default_timeout_seconds: z.number().int().positive().max(7200).optional(),
    tier_policy: z.enum(['auto', 'flash-only', 'pro-only']).optional().describe('flash-only / pro-only clamp every dispatch to one tier'),
    escalate_on_failure: z.boolean().optional().describe('retry a failed blocking flash run once on pro'),
    preset_flash: z.string().optional().describe('hub-mode agent preset for flash workers (preset id, or "default")'),
    preset_pro: z.string().optional().describe('hub-mode agent preset for pro workers (preset id, or "default")'),
    origin_depth_limit: z.number().int().min(1).max(32).optional().describe('Max worker→worker origin-chain depth (default 3). Deeper dispatches are refused to stop recursive self-amplification; raise only for deliberate deep delegation.'),
    reset: z.boolean().optional().describe('true = restore all defaults first'),
  },
}, async ({ reset, ...patch }) => {
  if (reset) {
    Object.assign(sessionConfig, { enabled: true, ...globalDefaults });
    sessionConfig.origin_depth_limit = DEFAULT_ORIGIN_DEPTH_LIMIT;
  }
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) sessionConfig[k] = v;
  return text({
    ...sessionConfig,
    hub_reachable: await hubAvailable(),
    worker_profiles: listProfiles(),
    origin: { chain: INHERITED_ORIGIN.chain, depth: INHERITED_ORIGIN.depth, depth_limit: depthLimitNow() },
  });
});

server.registerTool('dsh_spawn_worker', {
  title: 'Spawn DSH worker (async)',
  description: 'Start a DSH (DeepSeek Harness) coding agent in the background and return immediately with a job id — use it to fan out several workers in parallel. The spawn response carries claims, not results: always fetch each job\'s final result later with dsh_worker_result. Same tier guidance as dsh_run_worker: flash for mechanical, well-scoped work, pro for multi-file changes and debugging. The task string must be self-contained (absolute paths, acceptance criteria, constraints) — the worker sees nothing of your conversation. worker="agy" or "grok" only when the user explicitly asks for that CLI, never a default. Guardrails refuse (never queue) origin-chain recursion and a second writer on the same cwd; allow_concurrent_cwd: true only for read-only fan-out.',
  inputSchema: {
    task: z.string().describe('Full task description for the worker, self-contained — the worker has no conversation context, so include absolute paths, acceptance criteria and constraints'),
    tier: tierSchema,
    effort: effortSchema,
    worker: workerSchema,
    cwd: z.string().optional().describe('Workspace directory for the worker. Relative paths resolve against the caller\'s current workspace; "." or "current" mean the current workspace. Omit for the current workspace.'),
    allow_concurrent_cwd: allowConcurrentCwdSchema,
  },
}, async ({ task, tier, effort, worker, cwd, allow_concurrent_cwd }) => {
  if (!sessionConfig.enabled) return dispatchDisabled();
  const workDir = resolveWorkerCwd(cwd);
  const depthLimit = depthLimitNow();
  if (worker) {
    // CLI profile dispatch; no hub/standalone involvement, no tier policy.
    const profile = resolveProfile(worker);
    const origin = extendOrigin({ inherited: INHERITED_ORIGIN, backend: profile.backend, cwd: workDir, source: ORCHESTRATOR, depthLimit });
    if (!origin.ok) return originRefusal(origin);
    try {
      const job = await startCliJob({ worker, task, cwd: workDir, source: ORCHESTRATOR, effort, origin: origin.origin, allowConcurrentCwd: !!allow_concurrent_cwd });
      return text(jobView(job));
    } catch (err) {
      if (err instanceof CwdLockError) return text({ error: err.message, rejected_by: 'cwd-lock', holder: err.holder });
      throw err;
    }
  }
  const t = applyTierPolicy(tier);
  const e = effort ?? sessionConfig.default_effort;
  if ((await resolveMode()) === 'hub') {
    const origin = extendOrigin({ inherited: INHERITED_ORIGIN, backend: 'hub', cwd: workDir, source: ORCHESTRATOR, depthLimit });
    if (!origin.ok) return originRefusal(origin);
    let lock;
    try {
      lock = await acquireDispatchLock({ cwd: workDir, backend: 'hub', mode: 'hub', allowConcurrent: !!allow_concurrent_cwd });
    } catch (err) {
      if (err instanceof CwdLockError) return text({ error: err.message, rejected_by: 'cwd-lock', holder: err.holder });
      throw err;
    }
    let spawned;
    try {
      spawned = await hub.spawn({ task, tier: t, effort: e, cwd: workDir, source: ORCHESTRATOR, preset: presetForTier(t), origin_chain: origin.origin.chain, origin_depth: origin.origin.depth });
      updateCwdLockHolder({ cwd: workDir, jobId: spawned.id });
      hubOrigins.set(spawned.id, origin.origin);
    } catch (err) {
      lock.release();
      throw err;
    }
    attachOrigin(spawned, spawned.id);
    return text(spawned);
  }
  const origin = extendOrigin({ inherited: INHERITED_ORIGIN, backend: 'standalone', cwd: workDir, source: ORCHESTRATOR, depthLimit });
  if (!origin.ok) return originRefusal(origin);
  try {
    const job = await startJob({ task, tier: t, effort: e, cwd: workDir, source: ORCHESTRATOR, origin: origin.origin, allowConcurrentCwd: !!allow_concurrent_cwd });
    return text(jobView(job));
  } catch (err) {
    if (err instanceof CwdLockError) return text({ error: err.message, rejected_by: 'cwd-lock', holder: err.holder });
    throw err;
  }
});

server.registerTool('dsh_worker_status', {
  title: 'DSH worker status',
  description: 'List all DSH worker jobs in this session with live progress (turn/step, current tool, token usage) plus the cwd advisory locks (kind: "cwd-lock" entries show which workspace is held by which running job). Use it before dispatching into a busy workspace and to see whether spawned jobs are still running.',
  inputSchema: {},
}, async () => {
  const hubUp = await hubAvailable();
  const remote = hubUp ? await hub.list().catch(() => null) : [];
  const remoteJobs = remote ?? [];
  if (remote !== null) {
    // The list actually arrived: hub-held locks whose job is settled or gone
    // release now. A failed fetch (remote === null) must NOT release locks —
    // a down hub says nothing about whether its jobs still run.
    const byId = new Map(remoteJobs.map((j) => [j.id, j]));
    for (const l of getCwdLocks()) {
      if (l.holder.mode !== 'hub') continue;
      const j = byId.get(l.holder.jobId);
      if (j === undefined || j.status !== 'running') releaseCwdLockByJobId(l.holder.jobId);
    }
  }
  for (const j of remoteJobs) attachOrigin(j, j.id);
  const local = listJobs().map((j) => jobView(j));
  const locks = getCwdLocks().map((l, i) => ({
    kind: 'cwd-lock',
    id: `cwd-lock-${i + 1}`,
    cwd: l.cwd,
    holder: l.holder,
    note: 'advisory workspace lock: a running worker holds this cwd, so a new dispatch to it is refused (unless allow_concurrent_cwd is set)',
  }));
  return text([...remoteJobs, ...local, ...locks]);
});

server.registerTool('dsh_worker_result', {
  title: 'DSH worker result',
  description: 'Fetch the final result of a worker job, optionally waiting up to wait_seconds. Always call this for spawned jobs: the dsh_spawn_worker response returns only the job id and status claims, never the result. If a result seems missing or stale (for example after a hub restart orphaned the job), verify against the working tree and dsh_worker_status instead of trusting the summary.',
  inputSchema: {
    job_id: z.string(),
    wait_seconds: z.number().int().min(0).max(7200).default(0).describe('0 = return current state immediately'),
  },
}, async ({ job_id, wait_seconds }) => {
  if (job_id.startsWith('hub-')) {
    if (!(await hubAvailable())) return text({ error: 'hub not reachable' });
    const view = await hub.get(job_id, wait_seconds).catch((e) => ({ error: e.message }));
    if (view && view.id) {
      attachOrigin(view, view.id);
      if (view.status !== 'running') releaseCwdLockByJobId(job_id);
    }
    return text(view);
  }
  if (!getJob(job_id)) return text({ error: `no such job: ${job_id}` });
  const job = await waitJob(job_id, wait_seconds > 0 ? wait_seconds * 1000 : 1);
  return text(jobView(job, { withResult: true }));
});

server.registerTool('dsh_worker_cancel', {
  title: 'Cancel DSH worker',
  description: 'Cancel a running worker job: terminates its runtime process and releases its cwd lock. Use it when a workspace lock is held by a job that is stuck or no longer needed, so a new dispatch to that cwd can proceed.',
  inputSchema: { job_id: z.string() },
}, async ({ job_id }) => {
  if (job_id.startsWith('hub-')) {
    if (!(await hubAvailable())) return text({ error: 'hub not reachable' });
    const view = await hub.cancel(job_id).catch((e) => ({ error: e.message }));
    if (view && view.id) {
      attachOrigin(view, view.id);
      releaseCwdLockByJobId(job_id); // cancelled = holder being disposed
    }
    return text(view);
  }
  if (!getJob(job_id)) return text({ error: `no such job: ${job_id}` });
  return text(jobView(await cancelJob(job_id), { withResult: true }));
});

await server.connect(new StdioServerTransport());
