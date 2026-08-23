// Smoke test for the published tarball. It reproduces, step by step, the
// exact failure that shipped in 0.1.0-rc.1 and 0.1.0-rc.2 and guards against
// it coming back:
//
//   1. npm pack the current tree (prepack runs smoke:mcp, which rebuilds
//      lib/server.mjs and asserts the bundle invariants first);
//   2. install the tarball with plain npm into a brand-new empty directory;
//   3. the install must succeed with NO ERESOLVE, and must NOT pull any
//      @deepseek-ai/* package into node_modules (@deepseek-ai/* is host
//      runtime only - the DSH host provides it, plain npm never must);
//   4. both src/server.mjs and lib/server.mjs must answer initialize +
//      tools/list with the full 6-tool roster and matching versions.
//
// Why this exists: rc.1/rc.2 declared the whole @deepseek-ai/* stack as
// REQUIRED peerDependencies. npm 7+ auto-installs peers, and the pinned
// 0.1.0-rc.6 versions conflict with the 0.1.0-rc.8 transitive resolution
// inside dsh-agent-spine-demo -> dsh-tools -> dsh-agent, so a plain
// \`npm i @zseven-w/dsh-crew\` died with ERESOLVE. rc.3 first marked every
// @deepseek-ai/* peer optional - and still failed: npm also auto-places
// optional peers (peerOptional) when they fit, and the exact rc.6 pins
// ERESOLVE against the rc.8 tree (dsh-llm rc.6 vs dsh-session rc.8).
// The fix that actually installs: NO @deepseek-ai/* in peerDependencies at
// all; the host stack is documented in the inert dshHostRuntime field.
// The \`dsh plugin add\` path never hit any of this because the DSH host
// provides those packages itself - which is why two releases shipped
// without anyone noticing. Installing the packed tarball is now part of
// the test, not a step someone has to remember.
//
//   npm run smoke:pack
//
// Deliberately NOT wired into prepack (npm pack runs prepack, and this
// script calls npm pack itself - that would recurse). Run it explicitly as
// the last gate before publishing.

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKG_NAME = '@zseven-w/dsh-crew';
const EXPECTED_TOOLS = [
  'dsh_run_worker',
  'dsh_worker_config',
  'dsh_spawn_worker',
  'dsh_worker_status',
  'dsh_worker_result',
  'dsh_worker_cancel',
].sort();

const HOST_RUNTIME_PACKAGES = [
  '@deepseek-ai/dsh-agent',
  '@deepseek-ai/dsh-agent-presets',
  '@deepseek-ai/dsh-agent-spine-demo',
  '@deepseek-ai/dsh-bash-local',
  '@deepseek-ai/dsh-compaction-basic',
  '@deepseek-ai/dsh-fs-local',
  '@deepseek-ai/dsh-fs-observation-policy',
  '@deepseek-ai/dsh-llm',
  '@deepseek-ai/dsh-llm-deepseek',
  '@deepseek-ai/dsh-sandbox-local',
  '@deepseek-ai/dsh-sandbox-policy',
  '@deepseek-ai/dsh-sdk-client',
  '@deepseek-ai/dsh-sdk-jsonrpc-demo',
  '@deepseek-ai/dsh-sdk-jsonrpc-server',
  '@deepseek-ai/dsh-session',
  '@deepseek-ai/dsh-session-persistence-jsonl',
  '@deepseek-ai/dsh-subprocess-local',
  '@deepseek-ai/dsh-token-meter',
  '@deepseek-ai/dsh-tool-fs',
  '@deepseek-ai/dsh-tool-todo',
].sort();

const tempDirs = [];
let child = null;

function cleanup() {
  for (const d of tempDirs) {
    try { rmSync(d, { recursive: true, force: true }); } catch {}
  }
}

function fail(msg) {
  if (child) { try { child.kill(); } catch {} }
  cleanup();
  console.error('\nSMOKE FAILED: ' + msg);
  process.exit(1);
}

function run(cmd, args, { cwd, timeoutMs = 300_000, env = {} } = {}) {
  try {
    return execFileSync(cmd, args, {
      cwd,
      env: { ...process.env, ...env },
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const tail = (s) => (s || '').slice(-4000);
    fail(cmd + ' ' + args.join(' ') + ' failed in ' + cwd +
      '\n--- stdout tail ---\n' + tail(err.stdout) +
      '\n--- stderr tail ---\n' + tail(err.stderr));
  }
}

async function handshake(serverRel, label) {
  const serverPath = join(installDir, 'node_modules', PKG_NAME, serverRel);
  console.log('\n=== ' + label + ' ===');
  console.log('$ node ' + serverPath);
  child = spawn(process.execPath, [serverPath], { cwd: installDir, stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '';
  let finished = false;
  child.stderr.on('data', (d) => { stderr += d.toString(); });
  child.on('exit', (code) => {
    if (!finished) fail(label + ' exited early (code ' + code + ')\nstderr: ' + stderr.trim());
  });

  const pending = new Map();
  const responses = [];
  let buf = '';
  let nextId = 1;

  function send(msg) { child.stdin.write(JSON.stringify(msg) + '\n'); }
  function request(method, params) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => reject(new Error('timed out waiting for ' + method + ' (stderr: ' + stderr.trim() + ')')), 15000);
      pending.set(id, { resolve, reject, timer });
      send({ jsonrpc: '2.0', id, method, params });
    });
  }

  function routeLine(line) {
    const raw = line.trim();
    if (!raw) return;
    let msg;
    try { msg = JSON.parse(raw); }
    catch { fail(label + ': non-JSON line on stdout (protocol broken): ' + raw.slice(0, 200)); }
    if (msg.id !== undefined && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.error) p.reject(new Error(msg.error.code + ': ' + msg.error.message));
      else p.resolve(msg);
    }
  }

  child.stdout.on('data', (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (line.trim()) { responses.push(line.trim()); routeLine(line); }
    }
  });

  const initParams = { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'smoke-pack', version: '0.0.0' } };
  console.log('--- initialize request ---');
  console.log(JSON.stringify({ jsonrpc: '2.0', method: 'initialize', params: initParams }));

  const init = await request('initialize', initParams);
  console.log('--- initialize response (raw) ---');
  console.log(responses[responses.length - 1]);
  const info = init.result && init.result.serverInfo;
  if (!info || info.name !== 'dsh-crew') fail(label + ': serverInfo.name is ' + JSON.stringify(info && info.name) + ', expected dsh-crew');

  send({ jsonrpc: '2.0', method: 'notifications/initialized' });

  const list = await request('tools/list', {});
  console.log('--- tools/list response (raw) ---');
  console.log(responses[responses.length - 1]);
  const names = (list.result && list.result.tools || []).map((t) => t.name).sort();
  if (JSON.stringify(names) !== JSON.stringify(EXPECTED_TOOLS)) {
    fail(label + ': tools/list returned ' + JSON.stringify(names) + ', expected ' + JSON.stringify(EXPECTED_TOOLS));
  }
  console.log('[' + label + '] OK: ' + names.length + ' tools, serverInfo=' + JSON.stringify(info));

  finished = true;
  child.kill();
  child = null;
  return info;
}

// ---------------------------------------------------------------------------
// 1. Pack the current tree. prepack runs smoke:mcp (rebuild + bundle
//    assertions), so a stale or broken lib/server.mjs cannot get packed.
console.log('[smoke:pack] 1/5 npm pack (prepack runs smoke:mcp first) ...');
const packDir = mkdtempSync(join(tmpdir(), 'dsh-crew-pack-'));
tempDirs.push(packDir);
// Hermetic npm cache: a shared ~/.npm cache can be stale, or (as seen on
// the author's machine) hold root-owned leftovers from older npm versions,
// which would fail this test with EPERM instead of testing the tarball.
const cacheDir = mkdtempSync(join(tmpdir(), 'dsh-crew-npm-cache-'));
tempDirs.push(cacheDir);
const packOut = run('npm', ['pack', '--cache', cacheDir, '--pack-destination', packDir], { cwd: ROOT, env: { npm_config_cache: cacheDir } });
console.log(packOut.split('\n').slice(-6).join('\n'));
const tarballs = readdirSync(packDir).filter((f) => f.endsWith('.tgz'));
if (tarballs.length !== 1) fail('expected exactly one tarball in ' + packDir + ', found ' + JSON.stringify(tarballs));
const tarballPath = join(packDir, tarballs[0]);
console.log('[smoke:pack] tarball: ' + tarballPath + ' (' + statSync(tarballPath).size + ' bytes)');

// ---------------------------------------------------------------------------
// 2. Install into a brand-new empty directory - the external-user scenario
//    from issue #3 that never worked before.
console.log('\n[smoke:pack] 2/5 npm init -y && npm i ' + tarballPath);
const installDir = mkdtempSync(join(tmpdir(), 'dsh-crew-install-'));
tempDirs.push(installDir);
console.log(run('npm', ['init', '-y', '--cache', cacheDir], { cwd: installDir, env: { npm_config_cache: cacheDir } }).split('\n').slice(0, 3).join('\n'));
const installOut = run('npm', ['i', tarballPath, '--cache', cacheDir], { cwd: installDir, timeoutMs: 600_000, env: { npm_config_cache: cacheDir } });
console.log(installOut.split('\n').slice(-12).join('\n'));
if (/ERESOLVE/.test(installOut)) fail('npm i printed ERESOLVE - optional peers are still being auto-installed');

// ---------------------------------------------------------------------------
// 3. No @deepseek-ai/* may land in node_modules. The DSH host owns them.
console.log('\n[smoke:pack] 3/5 asserting no @deepseek-ai/* in node_modules');
const nmDir = join(installDir, 'node_modules');
if (!existsSync(nmDir)) fail('node_modules missing after install');
if (existsSync(join(nmDir, '@deepseek-ai'))) {
  fail('node_modules/@deepseek-ai exists: ' + readdirSync(join(nmDir, '@deepseek-ai')).join(', '));
}
console.log('[smoke:pack] node_modules/@deepseek-ai absent. top level: ' + readdirSync(nmDir).sort().join(', '));

// Regression guard on the declaration itself. npm 7+ auto-installs peers -
// optional ones included when they can be placed - so the only shape that
// keeps a plain npm install clean AND @deepseek-ai/*-free is to have no
// @deepseek-ai/* in peerDependencies at all (the 0.1.0-rc.3 fix for issue
// #3). The host-runtime stack is documented in the inert dshHostRuntime
// field instead, and that list is asserted here too.
const installedPkg = JSON.parse(readFileSync(join(installDir, 'node_modules', PKG_NAME, 'package.json'), 'utf8'));
for (const name of Object.keys(installedPkg.peerDependencies || {})) {
  if (name.startsWith('@deepseek-ai/')) {
    fail('peer ' + name + ' is still in peerDependencies - @deepseek-ai/* must be host runtime only (see dshHostRuntime)');
  }
}
const hostRuntime = installedPkg.dshHostRuntime || {};
for (const name of HOST_RUNTIME_PACKAGES) {
  if (!hostRuntime[name]) fail('dshHostRuntime is missing ' + name + ' - keep the host-runtime list in sync with worker.cordis.yml / the DSH host profile');
}
console.log('[smoke:pack] package.json guard OK: 0 @deepseek-ai/* peers; all ' +
  HOST_RUNTIME_PACKAGES.length + ' host-runtime packages documented in dshHostRuntime; version=' + installedPkg.version);

// ---------------------------------------------------------------------------
// 4+5. Both server entry points must serve the full roster. src/ needs the
// installed zod + MCP SDK; lib/ is the self-contained bundle. Either one
// failing means an installed copy dies at startup - the issue #1 scenario.
const srcInfo = await handshake('src/server.mjs', '[smoke:pack] 4/5 src/server.mjs (installed copy)');
const libInfo = await handshake('lib/server.mjs', '[smoke:pack] 5/5 lib/server.mjs (installed copy)');
if (srcInfo.version !== libInfo.version) {
  fail('version mismatch: src/server.mjs reports ' + srcInfo.version + ' but lib/server.mjs reports ' + libInfo.version + ' - run npm run build:mcp');
}
if (srcInfo.version !== installedPkg.version) {
  fail('version mismatch: servers report ' + srcInfo.version + ' but package.json says ' + installedPkg.version);
}
// The plugin manifest is the version the host displays, and nothing else
// checks it: 0.1.0-rc.5 shipped with package.json at rc.5 and this file still
// at rc.4 because a release bumped one place and not the other.
const manifestPath = join(installDir, 'node_modules', PKG_NAME, '.claude-plugin', 'plugin.json');
let manifestVersion;
try {
  manifestVersion = JSON.parse(readFileSync(manifestPath, 'utf8')).version;
} catch (err) {
  fail('cannot read .claude-plugin/plugin.json from the installed copy: ' + err.message);
}
if (manifestVersion !== installedPkg.version) {
  fail('version mismatch: .claude-plugin/plugin.json says ' + manifestVersion + ' but package.json says ' + installedPkg.version);
}
console.log('[smoke:pack] version guard OK: package.json, plugin.json, src/server.mjs and lib/server.mjs all report ' + installedPkg.version);

cleanup();
console.log('\nSMOKE PASSED: the packed tarball installs with plain npm (no ERESOLVE), pulls zero @deepseek-ai/* packages, and both src/server.mjs and lib/server.mjs serve initialize + tools/list with all ' + EXPECTED_TOOLS.length + ' tools.');
