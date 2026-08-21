// Real-CLI verification for the cli-workers adapter (WPC4). NOT part of the
// published payload or the prepack smoke suite: it spends real model tokens
// and requires agy / grok installed and authenticated on the machine.
//
//   GROK_HOME=/tmp/wpc4-grok-home node scripts/verify-cli-workers.mjs
//
// (GROK_HOME is optional in production; it exists here so the run can write
// grok session files into a writable dir inside a restricted sandbox.)
//
// Tests:
//   1. agy  real dispatch: "Reply with exactly the word: ok"
//   2. grok real dispatch: "Reply with exactly the word: ok"
//   3. timeout (agy):  long generation task, 20 s timeout  -> failed/timeout
//   4. cancel  (grok): long generation task, cancel at 8 s -> cancelled
// Each test also verifies the process group is gone afterwards (no orphans).

import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { startCliJob } from '../src/cli-workers.mjs';
import { cancelJob, getJob, jobView, waitJob } from '../src/jobs.mjs';
import { listProfiles } from '../src/worker-profiles.mjs';

const BASE = '/tmp/wpc4-verify';
mkdirSync(BASE, { recursive: true });

const LONG_TASK = 'Print the integers from 1 to 4000 inclusive, one per line, and nothing else.';

function groupAlive(pgid) {
  try { process.kill(pgid, 0); return true; } catch (e) { return e.code !== 'ESRCH'; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function report(job, label, extra = {}) {
  const j = getJob(job.id);
  const v = jobView(j, { withResult: true });
  console.log(`\n===== ${label} =====`);
  console.log(JSON.stringify(v, null, 2));
  console.log('rawLines:', j._rawLines.length, 'stderrTail:', JSON.stringify(j._stderrTail.trim().slice(-300)));
  console.log('groupAlive after settle:', groupAlive(job.pgid), '(pgid', job.pgid + ')');
  console.log('child exit:', JSON.stringify({ code: job.harness?.child?.exitCode, signal: job.harness?.child?.signalCode }));
  for (const [k, val] of Object.entries(extra)) console.log(k + ':', val);
  return { view: v, job: j };
}

// waitJob returns early once the status flips (cancel/timeout set it before
// the process is fully dead), so wait for the actual settle marker instead.
async function waitSettled(id, maxMs = 15_000) {
  const deadline = Date.now() + maxMs;
  for (;;) {
    const j = getJob(id);
    if (!j) throw new Error(`job ${id} vanished`);
    if (j.endedAt) return j;
    if (Date.now() > deadline) throw new Error(`job ${id} did not settle within ${maxMs}ms (status=${j.status}, groupAlive=${groupAlive(j.pgid)})`);
    await sleep(250);
  }
}

async function testRealDispatch(profileName, label) {
  const cwd = resolve(BASE, profileName);
  mkdirSync(cwd, { recursive: true });
  const t0 = Date.now();
  const job = await startCliJob({
    worker: profileName,
    task: 'Reply with exactly the word: ok',
    cwd,
    timeoutMs: 180_000,
    source: 'verify-script',
  });
  const r = await waitJob(job.id, 185_000);
  const wall = ((Date.now() - t0) / 1000).toFixed(1);
  const rep = report(job, label, { wallSeconds: wall });
  if (rep.view.status !== 'done') throw new Error(`${label}: expected done, got ${rep.view.status}`);
  return rep;
}

async function testTimeout() {
  const cwd = resolve(BASE, 'agy-timeout');
  mkdirSync(cwd, { recursive: true });
  const t0 = Date.now();
  const job = await startCliJob({ worker: 'agy', task: LONG_TASK, cwd, timeoutMs: 20_000, source: 'verify-script' });
  const seen = [];
  const sampleTimer = setInterval(() => {
    const j = getJob(job.id);
    if (j) seen.push({ at: ((Date.now() - t0) / 1000).toFixed(0) + 's', status: j.status, liveness: j.liveness, events: j.activity.events, lastEventAt: j.activity.lastEventAt });
  }, 3000);
  const r = await waitJob(job.id, 40_000);
  clearInterval(sampleTimer);
  const rep = report(job, 'timeout (agy, 20s deadline)', { wallSeconds: ((Date.now() - t0) / 1000).toFixed(1), livenessSamples: seen });
  if (rep.view.status !== 'failed' || rep.view.stopReason !== 'timeout') {
    throw new Error(`timeout test: expected failed/timeout, got ${rep.view.status}/${rep.view.stopReason} (result: ${String(rep.view.result).slice(0, 60)})`);
  }
  if (rep.job._settled !== true || groupAlive(job.pgid)) throw new Error('timeout test: process group still alive after settle');
  return rep;
}

async function testCancel() {
  const cwd = resolve(BASE, 'grok-cancel');
  mkdirSync(cwd, { recursive: true });
  const t0 = Date.now();
  const job = await startCliJob({ worker: 'grok', task: LONG_TASK, cwd, timeoutMs: 300_000, source: 'verify-script' });
  const seen = [];
  const sampleTimer = setInterval(() => {
    const j = getJob(job.id);
    if (j) seen.push({ at: ((Date.now() - t0) / 1000).toFixed(0) + 's', status: j.status, liveness: j.liveness, events: j.activity.events });
  }, 2000);
  await new Promise((res) => setTimeout(res, 8000));
  const cancelled = await cancelJob(job.id);
  clearInterval(sampleTimer);
  const settled = await waitSettled(job.id, 15_000); // status flips before the kill lands
  const rep = report(job, 'cancel (grok, cancel at ~8s)', { wallSeconds: ((Date.now() - t0) / 1000).toFixed(1), livenessSamples: seen, cancelReturned: cancelled.status, settleWallSeconds: ((Date.now() - t0) / 1000).toFixed(1) });
  if (rep.view.status !== 'cancelled' || settled.stopReason !== 'cancelled') throw new Error(`cancel test: expected cancelled, got ${rep.view.status}/${settled.stopReason}`);
  if (groupAlive(job.pgid)) throw new Error('cancel test: process group still alive after settle');
  return rep;
}

console.log('worker_profiles (registry):');
console.log(JSON.stringify(listProfiles(), null, 2));

const results = {};
results.agyOk = await testRealDispatch('agy', 'REAL DISPATCH agy (profile=agy)');
results.grokOk = await testRealDispatch('grok', 'REAL DISPATCH grok (profile=grok)');
results.timeout = await testTimeout();
results.cancel = await testCancel();

console.log('\n===== VERIFICATION SUMMARY =====');
for (const [k, r] of Object.entries(results)) {
  const v = r.view;
  console.log(`${k}: status=${v.status} stopReason=${v.stopReason} backend=${v.backend} profile=${v.profile} model=${v.model} result=${JSON.stringify(String(v.result ?? v.error ?? '').slice(0, 80))}`);
}
console.log('ALL_TESTS_PASSED');
