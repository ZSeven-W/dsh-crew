// WPC9 guardrail verification: recursion guard + same-repo concurrency lock.
// House rule: fixture passing is not the same as really working — so every
// check here drives the REAL bundled MCP server (lib/server.mjs) over stdio,
// with the only stub being the external agy binary itself (a PATH shim that
// speaks agy's stream-json protocol). No real CLI tokens are spent and no
// live hub is contacted (DSH_CREW_HUB points at a dead port, or at an
// in-process mock hub for the hub-path tests). scripts/smoke.mjs is
// deliberately NOT run.
//
// Phases:
//   A: adapter-level unit checks (origin-guard + cwd-lock + startJob refusal)
//   B: end-to-end through the bundled server with a fake agy:
//        B1 depth-exceeded refusal, B2 loop refusal, B3 dispatch + origin
//        record + env propagation, B4 concurrent reject + holder info +
//        status lock entry, B5 allow_concurrent_cwd, B6 release on completion,
//        B7 release on cancel, B8 release on timeout
//   C: hub path with an in-process mock hub (origin in spawn spec, cwd lock,
//      stale-lock purge, origin re-attachment to hub views)

import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, chmodSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORK = mkdtempSync(join(tmpdir(), 'wpc9-verify-'));
const FAKE_HOME = join(WORK, 'home');
const BIN = join(WORK, 'bin');
mkdirSync(FAKE_HOME, { recursive: true });
mkdirSync(BIN, { recursive: true });
const DEAD_HUB = 'http://127.0.0.1:9';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(cond, label, detail) {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label);
  if (detail !== undefined) console.log('      ' + String(detail).split(String.fromCharCode(10)).join(String.fromCharCode(10) + '      '));
  if (!cond) failures++;
}
function sec(label) { console.log(String.fromCharCode(10) + '===== ' + label + ' ====='); }

// ---------- fake agy CLI (stream-json double, controlled via env/files) ----------
copyFileSync(join(REPO, 'scripts', 'fake-agy.sh'), join(BIN, 'agy'));
chmodSync(join(BIN, 'agy'), 0o755);

// ---------- MCP stdio client ----------
function makeClient(child) {
  const pending = new Map();
  let nextId = 1;
  let buf = '';
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d.toString(); });
  child.stdout.on('data', (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf(String.fromCharCode(10))) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let msg; try { msg = JSON.parse(line); } catch { continue; }
      if (msg.id !== undefined && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        clearTimeout(p.timer);
        if (msg.error) p.reject(new Error(msg.error.code + ': ' + msg.error.message));
        else p.resolve(msg.result);
      }
    }
  });
  function request(method, params) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => reject(new Error('timeout waiting for ' + method + ' — server stderr: ' + stderr.slice(-800))), 40000);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + String.fromCharCode(10));
    });
  }
  return { request, stderr: () => stderr };
}

async function startServer(envExtra = {}) {
  const child = spawn(process.execPath, [join(REPO, 'lib', 'server.mjs')], {
    cwd: REPO,
    env: { ...process.env, HOME: FAKE_HOME, DSH_CREW_HUB: DEAD_HUB, PATH: BIN + ':' + process.env.PATH, ...envExtra },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const client = makeClient(child);
  await client.request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'wpc9-verify', version: '0.0.0' } });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + String.fromCharCode(10));
  return {
    child, client,
    call: async (name, args) => {
      const result = await client.request('tools/call', { name, arguments: args });
      const text = (result?.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join(String.fromCharCode(10));
      let json = null;
      try { json = JSON.parse(text); } catch {}
      return { result, text, json, isError: !!result?.isError };
    },
    stop: () => { try { child.kill('SIGTERM'); } catch {} },
  };
}

// ================= PHASE A: adapter-level =================
sec('Phase A — adapter-level unit checks');
const originMod = await import('../src/origin-guard.mjs');
const lockMod = await import('../src/cwd-lock.mjs');
const { extendOrigin, readInheritedOrigin, DEFAULT_ORIGIN_DEPTH_LIMIT } = originMod;
const { acquireCwdLock, getCwdLocks, releaseCwdLockByJobId, normalizeCwd, CwdLockError } = lockMod;

const dirA = join(WORK, 'repoA'); mkdirSync(dirA, { recursive: true });
const dirB = join(WORK, 'repoB'); mkdirSync(dirB, { recursive: true });
const dirC = join(WORK, 'repoC'); mkdirSync(dirC, { recursive: true });
const dirD = join(WORK, 'repoD'); mkdirSync(dirD, { recursive: true });
const dirE = join(WORK, 'repoE'); mkdirSync(dirE, { recursive: true });
const dirF = join(WORK, 'repoF'); mkdirSync(dirF, { recursive: true });
const canonA = normalizeCwd(dirA);

check(DEFAULT_ORIGIN_DEPTH_LIMIT === 3, 'A0 depth limit default is 3', 'DEFAULT_ORIGIN_DEPTH_LIMIT=' + DEFAULT_ORIGIN_DEPTH_LIMIT);

// A1: depth-exceeded refusal
{
  const inherited3 = { chain: [1, 2, 3].map((i) => ({ backend: 'standalone', cwd: join(WORK, 'hop' + i), source: 'claude-code' })), depth: 3 };
  const r = extendOrigin({ inherited: inherited3, backend: 'agy', cwd: dirB, source: 'codex', depthLimit: 3 });
  check(!r.ok && r.error.code === 'origin-depth-exceeded' && r.error.depth === 4 && r.error.limit === 3,
    'A1 depth-exceeded refusal (chain 3 + 1 hop > limit 3)', r.error?.message);
  const r2 = extendOrigin({ inherited: { chain: [inherited3.chain[0]], depth: 1 }, backend: 'agy', cwd: dirB, source: 'codex', depthLimit: 3 });
  check(r2.ok && r2.origin.depth === 2, 'A1b depth 2 still allowed');
}

// A2: loop refusal
{
  const inheritedLoop = { chain: [{ backend: 'agy', cwd: canonA, source: 'claude-code' }], depth: 1 };
  const r = extendOrigin({ inherited: inheritedLoop, backend: 'agy', cwd: dirA, source: 'codex', depthLimit: 3 });
  check(!r.ok && r.error.code === 'origin-loop', 'A2 loop refusal (same backend+cwd repeats)', r.error?.message);
  const r2 = extendOrigin({ inherited: inheritedLoop, backend: 'grok', cwd: dirA, source: 'codex', depthLimit: 3 });
  check(r2.ok && r2.origin.depth === 2, 'A2b same cwd, different backend is NOT a loop');
}

// A4: env round-trip + garbage
{
  const chain = [{ backend: 'standalone', cwd: dirA, source: 'claude-code' }, { backend: 'agy', cwd: dirB, source: 'codex' }];
  const parsed = readInheritedOrigin({ DSH_CREW_ORIGIN_CHAIN: JSON.stringify(chain) });
  check(parsed.depth === 2 && parsed.chain.length === 2 && parsed.chain[1].backend === 'agy',
    'A4 inherited chain parsed from env');
  check(readInheritedOrigin({ DSH_CREW_ORIGIN_CHAIN: '{not json' }).depth === 0, 'A4b garbage env ignored');
  check(readInheritedOrigin({}).depth === 0, 'A4c no env = empty chain');
}

// A5: lock conflict + holder info + release + bypass
{
  const startedAt = new Date().toISOString();
  const l1 = acquireCwdLock({ cwd: dirC, jobId: 'job-1', backend: 'standalone', mode: 'standalone', startedAt });
  let err = null;
  try { acquireCwdLock({ cwd: dirC, jobId: 'job-2', backend: 'agy', mode: 'cli', startedAt }); } catch (e) { err = e; }
  check(err instanceof CwdLockError, 'A5 second acquire throws CwdLockError');
  check(err?.message.includes('job-1') && err?.message.includes('standalone') && err?.message.includes(startedAt) && err?.message.includes('allow_concurrent_cwd'),
    'A5 refusal names holder job id, backend, start time', err?.message);
  l1.release();
  const l2 = acquireCwdLock({ cwd: dirC, jobId: 'job-3', backend: 'grok', mode: 'cli', startedAt });
  check(!!l2, 'A5 release allows re-acquire'); l2.release();
  acquireCwdLock({ cwd: dirC, jobId: 'job-4', backend: 'x', mode: 'm', startedAt, allowConcurrent: true });
  const l4 = acquireCwdLock({ cwd: dirC, jobId: 'job-5', backend: 'y', mode: 'm', startedAt });
  check(!!l4, 'A5 allow_concurrent_cwd bypasses the lock'); l4.release();
  check(getCwdLocks().length === 0, 'A5 lock table empty after releases');
}

// A6: symlink/canonical alias shares one lock
{
  const alias = join(tmpdir(), 'wpc9-alias-' + Date.now()); mkdirSync(alias, { recursive: true });
  const startedAt = new Date().toISOString();
  const l5 = acquireCwdLock({ cwd: alias, jobId: 'job-6', backend: 'x', mode: 'm', startedAt });
  let aliased = false;
  try { acquireCwdLock({ cwd: normalizeCwd(alias), jobId: 'job-7', backend: 'y', mode: 'm', startedAt }); } catch (e) { aliased = true; }
  check(aliased, 'A6 canonical-path alias shares one lock (' + alias + ' vs ' + normalizeCwd(alias) + ')');
  l5.release();
  rmSync(alias, { recursive: true, force: true });
}

// A7: standalone startJob refuses under a held lock — before any SDK/key/runtime work
{
  process.env.HOME = FAKE_HOME;
  process.env.DEEPSEEK_API_KEY = 'wpc9-dummy-key'; // never read: refusal fires first
  const jobsMod = await import('../src/jobs.mjs');
  const startedAt = new Date().toISOString();
  const lk = acquireCwdLock({ cwd: dirB, jobId: 'job-holder', backend: 'standalone', mode: 'standalone', startedAt });
  let err = null;
  try { await jobsMod.startJob({ task: 'must never run', cwd: dirB, source: 'verify' }); } catch (e) { err = e; }
  const refused = err instanceof CwdLockError;
  check(refused, 'A7 standalone startJob refused before any runtime launch', err?.message);
  if (!refused) { console.error('A7: guard did not fire — a real runtime may have launched; aborting.'); process.exit(1); }
  check(err?.message.includes('job-holder'), 'A7 standalone refusal names the holder');
  check(jobsMod.listJobs().length === 0, 'A7 no phantom job registered after refusal');
  lk.release();
}

// ================= PHASE B: bundled server end-to-end (fake agy) =================
sec('Phase B — bundled MCP server end-to-end with fake agy');

// B1: depth-exceeded through the real tool, with a 3-hop inherited chain
{
  const chain = [1, 2, 3].map((i) => ({ backend: i === 3 ? 'agy' : 'standalone', cwd: join(WORK, 'b1hop' + i), source: 'claude-code' }));
  const capture = join(WORK, 'b1-capture');
  const srv = await startServer({ DSH_CREW_ORIGIN_CHAIN: JSON.stringify(chain), DSH_CREW_DEPTH: '3', FAKE_AGY_CAPTURE: capture });
  const r = await srv.call('dsh_run_worker', { task: 'say ok', worker: 'agy', cwd: dirB, timeout_seconds: 30 });
  console.log('      B1 tool response: ' + r.text.slice(0, 900));
  check(r.json?.error?.includes('origin guard') === true && r.json?.code === 'origin-depth-exceeded' && r.json?.depth === 4,
    'B1 real server refuses over-deep dispatch with readable error');
  check(!existsSync(capture), 'B1 refused BEFORE spawning the CLI (no capture file)');
  const st = await srv.call('dsh_worker_status', {});
  check(Array.isArray(st.json) && st.json.length === 0, 'B1 no job was created');
  srv.stop();
}

// B2: loop through the real tool (agy@dirA already in the inherited chain)
{
  const capture = join(WORK, 'b2-capture');
  const srv = await startServer({
    DSH_CREW_ORIGIN_CHAIN: JSON.stringify([{ backend: 'agy', cwd: canonA, source: 'claude-code' }]), DSH_CREW_DEPTH: '1',
    FAKE_AGY_CAPTURE: capture,
  });
  const r = await srv.call('dsh_run_worker', { task: 'say ok', worker: 'agy', cwd: dirA, timeout_seconds: 30 });
  console.log('      B2 tool response: ' + r.text.slice(0, 900));
  check(r.json?.error?.includes('origin guard') === true && r.json?.code === 'origin-loop' && (r.json?.message ?? '').includes(canonA),
    'B2 real server refuses the (backend,cwd) loop with readable error');
  check(!existsSync(capture), 'B2 refused BEFORE spawning the CLI (no capture file)');
  srv.stop();
}

// B3: clean dispatch — job record carries the origin; the child inherits it via env
{
  const capture = join(WORK, 'b3-capture');
  const srv = await startServer({ FAKE_AGY_CAPTURE: capture, FAKE_AGY_DELAY_MS: '150' });
  const r = await srv.call('dsh_run_worker', { task: 'say ok', worker: 'agy', cwd: dirB, timeout_seconds: 60 });
  console.log('      B3 tool response: ' + r.text.slice(0, 700));
  const v = r.json;
  check(v?.status === 'done' && v?.result === 'ok', 'B3 fake-agy dispatch completes (done, result "ok")');
  check(v?.origin_depth === 1 && Array.isArray(v?.origin_chain) && v?.origin_chain.length === 1
      && v?.origin_chain[0]?.backend === 'agy' && v?.origin_chain[0]?.cwd === normalizeCwd(dirB),
    'B3 job record carries origin_depth + origin_chain', JSON.stringify({ origin_depth: v?.origin_depth, origin_chain: v?.origin_chain }));
  const capturedChain = existsSync(capture) ? readFileSync(capture, 'utf8') : '(no capture file)';
  const capturedDepth = existsSync(capture + '.depth') ? readFileSync(capture + '.depth', 'utf8') : '(no depth file)';
  check(capturedChain.includes('"agy"') && capturedChain.includes(normalizeCwd(dirB)) && capturedDepth === '1',
    'B3 CLI child inherited the chain via DSH_CREW_ORIGIN_CHAIN/DSH_CREW_DEPTH env', 'chain=' + capturedChain + ' depth=' + capturedDepth);
  const cfg = await srv.call('dsh_worker_config', {});
  check(cfg.json?.origin?.depth === 0 && cfg.json?.origin?.depth_limit === 3 && cfg.json?.origin_depth_limit === 3,
    'B3 dsh_worker_config shows inherited origin + default limit');
  const cfg2 = await srv.call('dsh_worker_config', { origin_depth_limit: 2 });
  check(cfg2.json?.origin_depth_limit === 2 && cfg2.json?.origin?.depth_limit === 2, 'B3 origin_depth_limit adjustable via dsh_worker_config');
  const cfg3 = await srv.call('dsh_worker_config', { reset: true });
  check(cfg3.json?.origin_depth_limit === 3, 'B3 reset restores the default limit');
  srv.stop();
}

// B4-B7: concurrency lock — reject, bypass, release on completion, release on cancel
{
  const delayFile = join(WORK, 'b4-delay'); writeFileSync(delayFile, '5000');
  const modeFile = join(WORK, 'b4-mode'); writeFileSync(modeFile, 'NORMAL');
  const srv = await startServer({ FAKE_AGY_DELAY_FILE: delayFile, FAKE_AGY_MODE_FILE: modeFile });

  const spawned = await srv.call('dsh_spawn_worker', { task: 'long task', worker: 'agy', cwd: dirC });
  const holderId = spawned.json?.id;
  check(spawned.json?.status === 'running' && !!holderId, 'B4 spawn job 1 in ' + dirC + ' (id ' + holderId + ')');

  const blocked = await srv.call('dsh_run_worker', { task: 'other task', worker: 'agy', cwd: dirC, timeout_seconds: 10 });
  console.log('      B4 rejection response: ' + blocked.text.slice(0, 700));
  check(blocked.json?.rejected_by === 'cwd-lock' && blocked.json?.holder?.jobId === holderId
      && blocked.json?.holder?.backend === 'agy' && typeof blocked.json?.holder?.startedAt === 'string',
    'B4 second dispatch to the same cwd is rejected with holder info');
  check((blocked.json?.error ?? '').includes(holderId) && (blocked.json?.error ?? '').includes('allow_concurrent_cwd'),
    'B4 rejection error names holder job id + suggests allow_concurrent_cwd');

  const st1 = await srv.call('dsh_worker_status', {});
  const lockEntry = (st1.json ?? []).find((x) => x?.kind === 'cwd-lock');
  check(!!lockEntry && lockEntry.holder?.jobId === holderId && lockEntry.cwd === normalizeCwd(dirC),
    'B4 dsh_worker_status observes the lock (which cwd is held by whom)', JSON.stringify(lockEntry));

  writeFileSync(delayFile, '200');
  const allowed = await srv.call('dsh_run_worker', { task: 'read-only task', worker: 'agy', cwd: dirC, timeout_seconds: 60, allow_concurrent_cwd: true });
  check(allowed.json?.status === 'done', 'B5 allow_concurrent_cwd: true lets the parallel dispatch through');

  // B6: release on completion — wait for job 1, then a plain dispatch succeeds
  const done1 = await srv.call('dsh_worker_result', { job_id: holderId, wait_seconds: 20 });
  check(done1.json?.status === 'done' && !!done1.json?.endedAt, 'B6 job 1 completed (release-on-completion precondition)');
  const again = await srv.call('dsh_run_worker', { task: 'after completion', worker: 'agy', cwd: dirC, timeout_seconds: 60 });
  check(again.json?.status === 'done', 'B6 same-cwd dispatch succeeds after the holder completed (lock released)');

  // B7: release on cancel
  writeFileSync(modeFile, 'HANG');
  const hanging = await srv.call('dsh_spawn_worker', { task: 'hang forever', worker: 'agy', cwd: dirD });
  const hangId = hanging.json?.id;
  check(hanging.json?.status === 'running' && !!hangId, 'B7 spawn hanging job in ' + dirD + ' (id ' + hangId + ')');
  await sleep(400);
  const cancelled = await srv.call('dsh_worker_cancel', { job_id: hangId });
  check(cancelled.json?.status === 'cancelled', 'B7 cancel accepted (status cancelled)');
  let settledView = null;
  for (let i = 0; i < 30; i++) {
    const r = await srv.call('dsh_worker_result', { job_id: hangId, wait_seconds: 1 });
    if (r.json?.endedAt) { settledView = r.json; break; }
    await sleep(200);
  }
  check(!!settledView && settledView.status === 'cancelled', 'B7 cancelled job fully settled (endedAt set)');
  writeFileSync(modeFile, 'NORMAL');
  const afterCancel = await srv.call('dsh_run_worker', { task: 'after cancel', worker: 'agy', cwd: dirD, timeout_seconds: 60 });
  check(afterCancel.json?.status === 'done', 'B7 same-cwd dispatch succeeds after cancel (lock released)');
  srv.stop();
}

// B8: release on timeout
{
  const delayFile = join(WORK, 'b8-delay'); writeFileSync(delayFile, '20000');
  const srv = await startServer({ FAKE_AGY_DELAY_FILE: delayFile });
  const r = await srv.call('dsh_run_worker', { task: 'slow task', worker: 'agy', cwd: dirE, timeout_seconds: 2 });
  console.log('      B8 first (timed-out) dispatch response: ' + r.text.slice(0, 400));
  const id = r.json?.id;
  check(!!id && (r.json?.status === 'running' || r.json?.status === 'failed'), 'B8 dispatch started then hit the 2s deadline (id ' + id + ')');
  let settled = null;
  for (let i = 0; i < 40; i++) {
    const p = await srv.call('dsh_worker_result', { job_id: id, wait_seconds: 2 });
    if (p.json?.endedAt) { settled = p.json; break; }
  }
  check(!!settled && settled.status === 'failed' && settled.stopReason === 'timeout', 'B8 timed-out job settled failed/timeout',
    JSON.stringify({ status: settled?.status, stopReason: settled?.stopReason }));
  writeFileSync(delayFile, '200');
  const again = await srv.call('dsh_run_worker', { task: 'after timeout', worker: 'agy', cwd: dirE, timeout_seconds: 60 });
  check(again.json?.status === 'done', 'B8 same-cwd dispatch succeeds after the timeout settled (lock released)');
  srv.stop();
}

// ================= PHASE C: hub path with a mock hub =================
sec('Phase C — hub path (in-process mock hub; the live hub is never contacted)');

async function startMockHub() {
  const state = { jobs: new Map(), spawnBodies: [], nextId: 1 };
  const server = http.createServer((req, res) => {
    const send = (status, body) => {
      const s = JSON.stringify(body);
      res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(s) });
      res.end(s);
    };
    const url = new URL(req.url, 'http://localhost');
    const route = url.pathname.slice('/_dsh/dsh-crew'.length);
    try {
      if (route === '/ping') return send(200, { ok: true, service: 'dsh-crew-hub' });
      if (route === '/jobs' && req.method === 'GET') return send(200, { ok: true, jobs: [...state.jobs.values()] });
      if (route === '/jobs' && req.method === 'POST') {
        let body = '';
        req.on('data', (d) => { body += d; });
        req.on('end', () => {
          const spec = JSON.parse(body);
          state.spawnBodies.push(spec);
          const id = 'hub-' + (state.nextId++) + '-mock';
          const job = {
            id, tier: spec.tier, effort: spec.effort, status: 'running', source: spec.source,
            task: String(spec.task ?? '').slice(0, 300), cwd: spec.cwd, mode: 'hub',
            turn: 0, step: 0, tokens: { input: 0, output: 0, reasoning: 0 },
            startedAt: new Date().toISOString(), endedAt: null, result: null, error: null, stopReason: null,
          };
          state.jobs.set(id, job);
          send(200, { ok: true, job: { ...job } });
        });
        return;
      }
      const m = route.match(/^\/jobs\/([^\/]+)$/);
      if (m && req.method === 'GET') {
        const job = state.jobs.get(m[1]);
        if (!job) return send(404, { ok: false, error: 'no such job' });
        return send(200, { ok: true, job: { ...job, ...(job.status !== 'running' ? { result: job.result ?? '', stopReason: job.stopReason } : {}) } });
      }
      const c = route.match(/^\/jobs\/([^\/]+)\/cancel$/);
      if (c && req.method === 'POST') {
        const job = state.jobs.get(c[1]);
        if (!job) return send(404, { ok: false, error: 'no such job' });
        job.status = 'cancelled'; job.error = 'cancelled by request'; job.endedAt = new Date().toISOString();
        return send(200, { ok: true, job: { ...job, result: '', stopReason: 'cancelled' } });
      }
      return send(404, { ok: false, error: 'unknown jobs endpoint' });
    } catch (err) {
      return send(400, { ok: false, error: err?.message ?? String(err) });
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { state, url: 'http://127.0.0.1:' + server.address().port, close: () => server.close() };
}

{
  const mock = await startMockHub();
  const srv = await startServer({ DSH_CREW_HUB: mock.url });

  const first = await srv.call('dsh_spawn_worker', { task: 'hub task', cwd: dirF });
  const hubId = first.json?.id;
  check(first.json?.status === 'running' && !!hubId, 'C1 hub spawn accepted (id ' + hubId + ')');
  const body0 = mock.state.spawnBodies[0] ?? {};
  check(body0.origin_chain?.length === 1 && body0.origin_chain?.[0]?.backend === 'hub' && body0.origin_chain?.[0]?.cwd === normalizeCwd(dirF)
      && body0.origin_depth === 1,
    'C1 hub spawn spec carries origin_chain + origin_depth', JSON.stringify({ origin_chain: body0.origin_chain, origin_depth: body0.origin_depth }));
  check(first.json?.origin_depth === 1 && first.json?.origin_chain?.length === 1,
    'C1 hub job view re-attached the origin client-side', JSON.stringify({ origin_depth: first.json?.origin_depth, origin_chain: first.json?.origin_chain }));

  const blocked = await srv.call('dsh_spawn_worker', { task: 'second hub task', cwd: dirF });
  console.log('      C1 rejection response: ' + blocked.text.slice(0, 600));
  check(blocked.json?.rejected_by === 'cwd-lock' && blocked.json?.holder?.jobId === hubId && blocked.json?.holder?.backend === 'hub',
    'C1 second hub dispatch to the same cwd is rejected with holder info');

  const resWhileRunning = await srv.call('dsh_worker_result', { job_id: hubId, wait_seconds: 0 });
  check(resWhileRunning.json?.status === 'running' && resWhileRunning.json?.origin_depth === 1,
    'C2 hub result view while running carries the origin');

  mock.state.jobs.get(hubId).status = 'done';
  mock.state.jobs.get(hubId).endedAt = new Date().toISOString();
  const resDone = await srv.call('dsh_worker_result', { job_id: hubId, wait_seconds: 0 });
  check(resDone.json?.status === 'done', 'C2 mock hub settles the job');

  const st = await srv.call('dsh_worker_status', {});
  const locks = (st.json ?? []).filter((x) => x?.kind === 'cwd-lock');
  check(locks.length === 0, 'C2 dsh_worker_status purged the settled hub job lock');

  const again = await srv.call('dsh_spawn_worker', { task: 'third hub task', cwd: dirF });
  check(again.json?.status === 'running', 'C2 same-cwd hub dispatch succeeds after the holder settled');

  srv.stop();
  mock.close();
}

// ---------- summary ----------
sec('SUMMARY');
console.log('failures: ' + failures);
console.log('work dir: ' + WORK);
rmSync(WORK, { recursive: true, force: true });
if (failures > 0) { console.error('VERIFICATION FAILED (' + failures + ' failing checks)'); process.exit(1); }
console.log('ALL_WPC9_GUARDRAIL_CHECKS_PASSED');
