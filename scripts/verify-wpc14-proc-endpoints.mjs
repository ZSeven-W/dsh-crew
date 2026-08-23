// WPC14 endpoint verification: ghost-process liveness probing and the
// verified kill path (src/proc-kill.mjs + hub routes /_dsh/dsh-crew/proc-alive
// and /_dsh/dsh-crew/proc-kill).
//
//   node scripts/verify-wpc14-proc-endpoints.mjs
//
// What runs for real:
//   1. Pure logic always: parsePid / isWorkerCommand / procCommand against the
//      REAL verified command shapes (dsh runtime node command from the
//      cmd-shim exec line, agy/grok buildArgs from cli-workers.mjs).
//   2. killWorkerProcess with an injected ps (deterministic, no /bin/ps):
//      refusal on non-worker command lines, refusal on ps failure, SIGTERM
//      kill of a fake worker process, pgid-mismatch refusal.
//   3. Real-ps integration (skipped when /bin/ps is unavailable, reported):
//      a spawned `sleep 300` (non-worker) is refused and SURVIVES, a fake
//      dsh runtime process (path+args matching the real shape) is killed,
//      already-dead pids refuse as no-such-process.
//   4. Live hub endpoints at 127.0.0.1:3080, only when the running instance
//      has the WPC14 routes (an instance booted before this change answers
//      404/empty and the script says so - restart DSH to activate).
//
// Every spawned process is cleaned up before exit.

import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parsePid, procAlive, procCommand, isWorkerCommand, killWorkerProcess, ProcKillRefused, PROC_KILL_GRACE_MS,
} from '../src/proc-kill.mjs';
import { createShardWriter, readMergedStatus } from '../src/status-shard.mjs';

const HUB = 'http://127.0.0.1:3080/_dsh/dsh-crew';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const spawned = []; // every child we ever spawn, cleaned up in finally
let failures = 0;
function check(name, cond, detail = '') {
  if (cond) console.log('  ok - ' + name);
  else { failures += 1; console.error('  FAIL - ' + name + (detail ? ' | ' + detail : '')); }
}
function note(msg) { console.log('  -- ' + msg); }

function spawnTracked(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'ignore'], ...opts });
  spawned.push(child);
  return child;
}

async function waitDead(pid, maxMs = 3000) {
  const deadline = Date.now() + maxMs;
  while (procAlive(pid) && Date.now() < deadline) await sleep(100);
  return !procAlive(pid);
}

// ---------------------------------------------------------------- pure logic
console.log('== 1. pure logic (parsePid / isWorkerCommand / procCommand) ==');
check('parsePid accepts positive integers', parsePid(1) === 1 && parsePid(4242) === 4242);
check('parsePid rejects garbage',
  parsePid(0) === null && parsePid(-5) === null && parsePid(4.5) === null
  && parsePid('abc') === null && parsePid(null) === null && parsePid(undefined) === null
  && parsePid(99999999999) === null && parsePid('') === null);

const REAL_SHAPES = {
  dsh: 'node /Users/fini/workspace/dsh-plugins/dsh-crew/node_modules/@deepseek-ai/dsh-sdk-jsonrpc-demo/lib/bin.js /Users/fini/workspace/dsh-plugins/dsh-crew/worker.cordis.yml',
  agy: '/Users/fini/.local/bin/agy --print do the thing --output-format stream-json --dangerously-skip-permissions --mode accept-edits --print-timeout 1800s',
  grok: '/Users/fini/.local/bin/grok -p do the thing --output-format streaming-messages-json --include-partial-messages --permission-mode bypassPermissions',
  shim: '/bin/sh /Users/fini/workspace/dsh-plugins/dsh-crew/node_modules/.bin/dsh-jsonrpc-agent /Users/fini/workspace/dsh-plugins/dsh-crew/worker.cordis.yml',
};
check('isWorkerCommand accepts the real dsh runtime shape (shim exec line)', isWorkerCommand(REAL_SHAPES.dsh));
check('isWorkerCommand accepts the real agy shape', isWorkerCommand(REAL_SHAPES.agy));
check('isWorkerCommand accepts the real grok shape', isWorkerCommand(REAL_SHAPES.grok));
check('isWorkerCommand accepts the transient pnpm-shim shape', isWorkerCommand(REAL_SHAPES.shim));
check('isWorkerCommand rejects sleep/ls/garbage',
  !isWorkerCommand('sleep 300') && !isWorkerCommand('/bin/ls -la') && !isWorkerCommand('') && !isWorkerCommand(null));
check('isWorkerCommand rejects unrelated node scripts (pid-recycling case)',
  !isWorkerCommand('node /usr/local/bin/npm install react')
  && !isWorkerCommand('node /x/dsh-sdk-jsonrpc-demo/lib/bin.js something-else.yml'));
check('isWorkerCommand rejects bash wrappers and marker-less binaries',
  !isWorkerCommand("bash -c 'agy --print hi --output-format stream-json'")
  && !isWorkerCommand('/Users/fini/.local/bin/agy --version'));

check('procCommand returns no-such-process for a fake ps exiting 1',
  (() => {
    const err = new Error('exited'); err.status = 1;
    const r = procCommand(1, () => { throw err; });
    return r.ok === false && r.reason === 'no-such-process';
  })());
check('procCommand returns ps-failed for a broken ps',
  (() => {
    const r = procCommand(1, () => { throw new Error('EPERM'); });
    return r.ok === false && r.reason === 'ps-failed';
  })());
check('procCommand reads an injected command line',
  procCommand(1, () => REAL_SHAPES.agy).command === REAL_SHAPES.agy);

// ---------------------- shard mirror passthrough (pid reaches the feed)
console.log('== 1b. shard mirror carries pid/pgid into the merged feed ==');
{
  const shardWriter = createShardWriter('wpc14-verify');
  shardWriter.publish([{ id: 'job-wpc14-fake', status: 'running', pid: 424242, pgid: 424242, startedAt: new Date().toISOString() }]);
  const merged = readMergedStatus({});
  const mine = merged.find((j) => j.id === 'job-wpc14-fake');
  check('shard mirror keeps pid+pgid (ghost tombstones snapshot this feed)',
    mine?.pid === 424242 && mine?.pgid === 424242);
  check('shard mirror marks the verify writer alive', mine?.originWriterAlive === true);
  shardWriter.dispose();
}

// ------------------------------------- deterministic kills with injected ps
console.log('== 2. killWorkerProcess with injected ps ==');
const s1 = spawnTracked('sleep', ['300']);
await sleep(300);
check('sleep spawns and lives', procAlive(s1.pid));
await (async () => {
  try { await killWorkerProcess({ pid: s1.pid, ps: () => 'sleep 300' }); check('non-worker with injected ps refuses', false); }
  catch (e) { check('non-worker with injected ps refuses', e instanceof ProcKillRefused && e.code === 'not-a-worker'); }
})();
check('refused sleep survives', procAlive(s1.pid));
await (async () => {
  try { await killWorkerProcess({ pid: s1.pid, ps: () => { throw new Error('EPERM'); } }); check('unreadable command line refuses', false); }
  catch (e) { check('unreadable command line refuses', e instanceof ProcKillRefused && e.code === 'ps-failed'); }
})();
await (async () => {
  try { await killWorkerProcess({ pid: s1.pid, pgid: s1.pid + 1, ps: () => REAL_SHAPES.agy }); check('pgid mismatch refuses', false); }
  catch (e) { check('pgid mismatch refuses', e instanceof ProcKillRefused && e.code === 'pgid-mismatch'); }
})();
check('sleep survives all refusals', procAlive(s1.pid));
// worker-shaped fake ps: SIGTERM actually lands on the sleep and kills it.
const r1 = await killWorkerProcess({ pid: s1.pid, ps: () => REAL_SHAPES.dsh });
check('worker-shaped ps kills via SIGTERM', r1.ok === true && r1.killed === true && r1.signal === 'SIGTERM');
check('the killed process is gone', await waitDead(s1.pid));
// With an injected ps the command check cannot see the death; the kill path
// then reports alreadyGone instead of refusing (real ps produces the
// no-such-process refusal - see section 3).
const rGone = await killWorkerProcess({ pid: s1.pid, ps: () => REAL_SHAPES.dsh });
check('injected ps on a dead pid reports alreadyGone',
  rGone.ok === true && rGone.killed === false && rGone.alreadyGone === true && rGone.signal === 'none');
await (async () => {
  try { await killWorkerProcess({ pid: 0 }); check('invalid pid refuses', false); }
  catch (e) { check('invalid pid refuses', e instanceof ProcKillRefused && e.code === 'bad-pid'); }
})();

// ---------------------------------------------- real ps (when /bin/ps works)
console.log('== 3. real-ps integration ==');
let psAvailable = false;
try {
  const self = procCommand(process.pid);
  psAvailable = self.ok === true && /node/.test(self.command ?? '');
} catch { psAvailable = false; }
if (!psAvailable) {
  note('SKIPPED: /bin/ps is not executable in this environment (sandbox denies it) - the real-command-line checks above ran with injected ps instead');
} else {
  note('ps available: running real command-line verification');
  const s2 = spawnTracked('sleep', ['300']);
  await sleep(300);
  check('real ps: procAlive sees the live sleep', procAlive(s2.pid) === true);
  await (async () => {
    try { await killWorkerProcess({ pid: s2.pid }); check('real ps: sleep 300 refuses', false); }
    catch (e) { check('real ps: sleep 300 refuses', e instanceof ProcKillRefused && e.code === 'not-a-worker'); }
  })();
  check('real ps: refused sleep still alive', procAlive(s2.pid));
  try { process.kill(s2.pid, 'SIGKILL'); } catch {}
  check('cleanup: sleep gone', await waitDead(s2.pid));
  check('real ps: procAlive sees the dead sleep', procAlive(s2.pid) === false);
  await (async () => {
    try { await killWorkerProcess({ pid: s2.pid }); check('real ps: dead pid refuses as no-such-process', false); }
    catch (e) { check('real ps: dead pid refuses as no-such-process', e instanceof ProcKillRefused && e.code === 'no-such-process'); }
  })();

  // Fake dsh runtime: path + args match the real standalone shape, and it
  // leads its own process group (detached) so the pgid group-kill is real too.
  const dir = mkdtempSync(join(tmpdir(), 'wpc14-fake-dsh-'));
  const binDir = join(dir, 'dsh-sdk-jsonrpc-demo', 'lib');
  mkdirSync(binDir, { recursive: true });
  writeFileSync(join(binDir, 'bin.js'), "setInterval(() => {}, 1000);\n");
  const cordis = join(dir, 'worker.cordis.yml');
  writeFileSync(cordis, 'fake\n');
  const fake = spawnTracked('node', [join(binDir, 'bin.js'), cordis], { detached: true });
  await sleep(500);
  const info = procCommand(fake.pid);
  check('real ps reads the fake runtime command', info.ok === true && isWorkerCommand(info.command));
  const r2 = await killWorkerProcess({ pid: fake.pid, pgid: fake.pid });
  check('real ps: group kill of the fake runtime succeeds', r2.ok === true && r2.killed === true && r2.group === true);
  check('real ps: the fake runtime is dead', await waitDead(fake.pid));
  rmSync(dir, { recursive: true, force: true });
}

// ----------------------- real command lines via pgrep (no /bin/ps needed)
console.log('== 3b. real process command lines via pgrep ==');
let pgrepAvailable = false;
try {
  const probe = execFileSync('pgrep', ['-fl', 'launchd'], { encoding: 'utf8', timeout: 3000 });
  pgrepAvailable = probe.trim() !== '';
} catch { pgrepAvailable = false; }
if (!pgrepAvailable) {
  note('SKIPPED: pgrep unavailable in this environment');
} else {
  const s5 = spawnTracked('sleep', ['300']);
  await sleep(400);
  let cmd = null;
  try {
    const out5 = execFileSync('pgrep', ['-fl', '^sleep 300$'], { encoding: 'utf8', timeout: 3000 });
    const line = out5.split('\n').find((l) => l.startsWith(String(s5.pid) + ' '));
    cmd = line ? line.slice(line.indexOf(' ') + 1) : null;
  } catch { cmd = null; }
  check('pgrep: real command line of the live sleep process', cmd === 'sleep 300');
  check('pgrep: the real sleep command rejects the worker check',
    cmd !== null && isWorkerCommand(cmd) === false);
  try { process.kill(s5.pid, 'SIGKILL'); } catch {}
  await waitDead(s5.pid);

  // Fake dsh runtime: same path+args shape the standalone spawn produces
  // (verified from the cmd-shim exec line), read back via pgrep.
  const dir = mkdtempSync(join(tmpdir(), 'wpc14-fake-dsh-'));
  const binDir = join(dir, 'dsh-sdk-jsonrpc-demo', 'lib');
  mkdirSync(binDir, { recursive: true });
  writeFileSync(join(binDir, 'bin.js'), "setInterval(() => {}, 1000);\n");
  const cordis = join(dir, 'worker.cordis.yml');
  writeFileSync(cordis, 'fake\n');
  const fake = spawnTracked('node', [join(binDir, 'bin.js'), cordis], { detached: true });
  await sleep(500);
  let fakeCmd = null;
  try {
    const outF = execFileSync('pgrep', ['-fl', 'wpc14-fake-dsh'], { encoding: 'utf8', timeout: 3000 });
    const line = outF.split('\n').find((l) => l.startsWith(String(fake.pid) + ' '));
    fakeCmd = line ? line.slice(line.indexOf(' ') + 1) : null;
  } catch { fakeCmd = null; }
  check('pgrep: real command line of the fake runtime', !!fakeCmd);
  check('pgrep: the real fake-runtime command matches the worker check',
    fakeCmd !== null && isWorkerCommand(fakeCmd) === true);
  try { process.kill(-fake.pid, 'SIGKILL'); } catch {}
  await waitDead(fake.pid);
  rmSync(dir, { recursive: true, force: true });
}

// ---------------------------- real route handlers via a mocked webServer
console.log('== 4. hub route handlers driven through apply(ctx) with a mock webServer ==');
{
  const { apply } = await import('../src/hub/index.mjs');
  const handlers = new Map();
  const webServer = { register: (spec) => { handlers.set(spec.path, spec.handler); return () => {}; } };
  const ctx = {
    inject: (deps, cb) => { if (deps?.includes?.('webServer')) cb({ webServer }); },
    settings: { get: () => undefined },
    logger: { info: () => {}, warn: () => {} },
  };
  const dispose = await apply(ctx);
  const BASE = '/_dsh/dsh-crew';
  const route = (name) => handlers.get(BASE + name);
  check('proc-alive + proc-kill routes registered on the mock webServer',
    typeof route('/proc-alive') === 'function' && typeof route('/proc-kill') === 'function');
  const mkReq = (method, url, body, remote = '127.0.0.1') => ({
    method,
    url,
    socket: { remoteAddress: remote },
    headers: { host: '127.0.0.1:3080' },
    async *[Symbol.asyncIterator]() { if (body !== undefined) yield Buffer.from(body); },
  });
  const call = async (name, method, url, body, remote) => {
    const res = { out: null };
    res.writeHead = (status, headers) => { res.out = { status, headers, body: '' }; };
    res.end = (data) => { res.out.body = String(data); };
    await route(name)(mkReq(method, url, body, remote), res);
    let json = null;
    try { json = JSON.parse(res.out?.body ?? ''); } catch {}
    return { status: res.out?.status, json };
  };
  let r = await call('/proc-alive', 'GET', BASE + '/proc-alive?pid=' + process.pid);
  check('route proc-alive: own pid alive', r.status === 200 && r.json?.alive === true);
  r = await call('/proc-alive', 'GET', BASE + '/proc-alive?pid=99999999');
  check('route proc-alive: absurd pid dead', r.status === 200 && r.json?.alive === false);
  r = await call('/proc-alive', 'GET', BASE + '/proc-alive?pid=abc');
  check('route proc-alive: non-integer pid -> 400', r.status === 400 && r.json?.ok === false);
  r = await call('/proc-alive', 'GET', BASE + '/proc-alive?pid=-1');
  check('route proc-alive: negative pid -> 400', r.status === 400 && r.json?.ok === false);
  r = await call('/proc-alive', 'POST', BASE + '/proc-alive?pid=1');
  check('route proc-alive: wrong method -> 405', r.status === 405);
  r = await call('/proc-alive', 'GET', BASE + '/proc-alive?pid=1', undefined, '10.0.0.9');
  check('route proc-alive: non-loopback -> 403', r.status === 403 && r.json?.ok === false);
  r = await call('/proc-kill', 'POST', BASE + '/proc-kill', JSON.stringify({ pid: 'x' }));
  check('route proc-kill: invalid pid -> 400', r.status === 400 && r.json?.ok === false);
  r = await call('/proc-kill', 'POST', BASE + '/proc-kill', JSON.stringify({ pid: 5, pgid: 'y' }));
  check('route proc-kill: invalid pgid -> 400', r.status === 400 && r.json?.ok === false);
  const s4 = spawnTracked('sleep', ['300']);
  await sleep(300);
  r = await call('/proc-kill', 'POST', BASE + '/proc-kill', JSON.stringify({ pid: s4.pid }));
  // Under a ps-denying sandbox this is ps-failed; with real ps it is
  // not-a-worker. Both are refusals with a readable error - the point here
  // is the route never kills an unverified process.
  check('route proc-kill: sleep refuses (403) with a readable error',
    r.status === 403 && r.json?.ok === false
    && ['not-a-worker', 'ps-failed'].includes(r.json?.code)
    && typeof r.json?.error === 'string' && r.json.error.length > 10);
  check('route proc-kill: refused sleep survives', procAlive(s4.pid));
  try { process.kill(s4.pid, 'SIGKILL'); } catch {}
  await waitDead(s4.pid);
  await dispose().catch(() => {});
}

// ------------------------------------------------------- live hub endpoints
console.log('== 5. live hub endpoints (' + HUB + ') ==');
let routesLive = false;
try {
  const ping = await fetch(HUB + '/ping', { signal: AbortSignal.timeout(1500) });
  const pingBody = await ping.json();
  note('hub ping: ' + JSON.stringify(pingBody));
  const probe = await fetch(HUB + '/proc-alive?pid=' + process.pid, { signal: AbortSignal.timeout(1500) });
  const probeText = await probe.text();
  try {
    const probeBody = JSON.parse(probeText);
    if (probe.ok && typeof probeBody?.alive === 'boolean') routesLive = true;
  } catch { /* empty/HTML 404 from a pre-WPC14 instance */ }
  if (!routesLive) {
    note('the running hub does not have the WPC14 routes yet (HTTP ' + probe.status + ', body: ' + JSON.stringify(probeText.slice(0, 120)) + ')');
    note('-> live endpoint tests SKIPPED: the instance was booted before this change; restart DSH to activate the routes (module tests above cover the logic)');
  }
} catch (e) {
  note('hub unreachable (' + String(e?.message ?? e) + ') -> live endpoint tests SKIPPED');
}
if (routesLive) {
  const getJson = async (path, init = {}) => {
    const res = await fetch(HUB + path, { signal: AbortSignal.timeout(15000), ...init });
    let body = null;
    try { body = await res.json(); } catch {}
    return { res, body };
  };
  let a = await getJson('/proc-alive?pid=' + process.pid);
  check('live proc-alive: own pid is alive', a.res.ok && a.body?.alive === true);
  a = await getJson('/proc-alive?pid=99999999');
  check('live proc-alive: absurd pid is dead', a.res.ok && a.body?.alive === false);
  a = await getJson('/proc-alive?pid=abc');
  check('live proc-alive: non-integer pid -> 400', a.res.status === 400 && a.body?.ok === false);
  a = await getJson('/proc-alive?pid=-1');
  check('live proc-alive: negative pid -> 400', a.res.status === 400 && a.body?.ok === false);
  a = await getJson('/proc-kill', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pid: 'x' }) });
  check('live proc-kill: invalid pid -> 400', a.res.status === 400 && a.body?.ok === false);
  const s3 = spawnTracked('sleep', ['300']);
  await sleep(300);
  a = await getJson('/proc-kill', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pid: s3.pid }) });
  check('live proc-kill: sleep 300 refuses (403)', a.res.status === 403 && a.body?.ok === false && a.body?.code === 'not-a-worker');
  check('live proc-kill: refused sleep survives', procAlive(s3.pid));
  try { process.kill(s3.pid, 'SIGKILL'); } catch {}
  await waitDead(s3.pid);
}

// ------------------------------------------------------------------ cleanup
for (const child of spawned) {
  if (child.exitCode === null && child.signalCode === null) {
    try { child.kill('SIGKILL'); } catch {}
    if (child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
  }
}
await sleep(300);

if (failures > 0) { console.error('\nWPC14 ENDPOINT CHECKS FAILED: ' + failures); process.exit(1); }
console.log('\nALL_WPC14_ENDPOINT_CHECKS_PASSED (grace = ' + PROC_KILL_GRACE_MS + 'ms, real-ps = ' + psAvailable + ', real-pgrep = ' + pgrepAvailable + ', mock-routes = true, live-routes = ' + routesLive + ')');
