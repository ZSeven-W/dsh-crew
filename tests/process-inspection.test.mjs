import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { readProcessName, readProcessCommand, detectOrchestrator } from '../src/process-info.mjs';
import { procCommand, isWorkerCommand, killWorkerProcess } from '../src/proc-kill.mjs';

const windowsRecord = (overrides = {}) => ({
  ProcessId: 42,
  Name: 'Codex.exe',
  CommandLine: '"C:\\Program Files\\nodejs\\node.exe" "C:\\工作区\\dsh-sdk-jsonrpc-demo\\lib\\bin.js" "C:\\工作区\\worker.cordis.yml"',
  ...overrides,
});

test('Windows queries CIM directly and preserves quoted Unicode command lines', () => {
  const record = windowsRecord();
  let calls = 0;
  const run = (file, args, options) => {
    calls += 1;
    assert.equal(file, 'powershell.exe');
    assert.ok(args.includes('-NoProfile') && args.includes('-NonInteractive'));
    assert.match(args.at(-1), /Get-CimInstance Win32_Process/);
    assert.match(args.at(-1), /ProcessId = 42/);
    assert.equal(options.windowsHide, true);
    assert.equal(options.timeout, 10_000);
    return '\ufeff' + JSON.stringify(record);
  };
  assert.deepEqual(readProcessName(42, { platform: 'win32', run }), { ok: true, name: 'Codex.exe' });
  assert.deepEqual(readProcessCommand(42, { platform: 'win32', run }), { ok: true, command: record.CommandLine });
  assert.equal(calls, 2);
  assert.ok(isWorkerCommand(record.CommandLine));
});

test('Windows absent, inaccessible, malformed and wrong-pid records fail distinctly', () => {
  const read = (output) => readProcessCommand(42, { platform: 'win32', run: () => output });
  assert.equal(read('null').reason, 'no-such-process');
  assert.equal(read(JSON.stringify(windowsRecord({ CommandLine: null }))).reason, 'process-query-failed');
  assert.equal(read(JSON.stringify(windowsRecord({ ProcessId: 43 }))).reason, 'process-query-failed');
  assert.equal(read('unexpected output').reason, 'process-query-failed');
  const error = Object.assign(new Error('CIM access denied'), { status: 1 });
  assert.equal(readProcessCommand(42, { platform: 'win32', run: () => { throw error; } }).reason, 'process-query-failed');
});

test('invalid process ids never reach a shell or process query', () => {
  for (const pid of [0, -1, 1.5, '42; Stop-Process -Id 1', null, undefined]) {
    assert.equal(readProcessCommand(pid, { platform: 'win32', run: () => assert.fail('query executed') }).reason, 'bad-pid');
  }
});

test('POSIX inspection keeps argument arrays and distinguishes missing from unreadable processes', () => {
  const run = (file, args) => {
    assert.equal(file, 'ps');
    assert.deepEqual(args, ['-p', '42', '-o', 'command=']);
    return 'node /work/dsh-sdk-jsonrpc-demo/lib/bin.js /work/worker.cordis.yml\n';
  };
  assert.equal(readProcessCommand(42, { platform: 'linux', run }).ok, true);
  assert.equal(readProcessCommand(42, { platform: 'darwin', run: () => '' }).reason, 'no-such-process');
  assert.equal(readProcessCommand(42, { platform: 'linux', run: () => { throw Object.assign(new Error(), { status: 1 }); } }).reason, 'no-such-process');
  assert.equal(readProcessCommand(42, { platform: 'linux', run: () => { throw new Error('permission denied'); } }).reason, 'ps-failed');
  assert.equal(procCommand(42, () => 'injected command').command, 'injected command');
});

test('orchestrator detection uses the parent executable name and keeps explicit Claude identity', () => {
  assert.equal(detectOrchestrator({ env: {}, parentPid: 42, readName: (pid) => {
    assert.equal(pid, 42);
    return { ok: true, name: 'C:\\Program Files\\Codex\\Codex.exe' };
  } }), 'codex');
  assert.equal(detectOrchestrator({ env: {}, readName: () => ({ ok: true, name: 'claude.exe' }) }), 'claude-code');
  assert.equal(detectOrchestrator({ env: {}, readName: () => ({ ok: false, reason: 'process-query-failed' }) }), 'unknown');
  assert.equal(detectOrchestrator({ env: { CLAUDECODE: '1' }, readName: () => assert.fail('unnecessary query') }), 'claude-code');
});

test('quoted worker executables require both the executable and backend markers', () => {
  assert.ok(isWorkerCommand('"C:\\Program Files\\agy\\agy.exe" --print test --output-format stream-json'));
  assert.ok(isWorkerCommand('"C:\\Program Files\\grok\\grok.exe" -p test --output-format streaming-messages-json'));
  assert.equal(isWorkerCommand('"C:\\Program Files\\nodejs\\node.exe" unrelated.js worker.cordis.yml'), false);
  assert.equal(isWorkerCommand('cmd.exe /c "node dsh-sdk-jsonrpc-demo/lib/bin.js worker.cordis.yml"'), false);
});

test('Windows group termination refuses explicitly before querying or signalling', async () => {
  await assert.rejects(killWorkerProcess({ pid: 42, pgid: 42, platform: 'win32', ps: () => assert.fail('must refuse first') }),
    (error) => error.code === 'unsupported-platform');
});

test('native process inspection refuses an unrelated child and kills only the verified fixture', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh process inspection '));
  const binDir = join(dir, 'dsh-sdk-jsonrpc-demo', 'lib');
  mkdirSync(binDir, { recursive: true });
  const script = join(binDir, 'bin.js');
  writeFileSync(script, 'setInterval(() => {}, 1000);\n');
  const marker = join(dir, 'worker.cordis.yml');
  writeFileSync(marker, 'fixture only\n');
  const worker = spawn(process.execPath, [script, marker], { stdio: 'ignore' });
  const unrelated = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  try {
    await Promise.all([once(worker, 'spawn'), once(unrelated, 'spawn')]);
    const info = readProcessCommand(worker.pid);
    assert.equal(info.ok, true, JSON.stringify(info));
    assert.ok(info.command.includes('dsh-sdk-jsonrpc-demo'));
    assert.equal(readProcessName(worker.pid).ok, true);
    await assert.rejects(killWorkerProcess({ pid: unrelated.pid, graceMs: 100 }), (error) => error.code === 'not-a-worker');
    assert.doesNotThrow(() => process.kill(unrelated.pid, 0));
    // Electron's Node mode is not a standalone worker executable; normal Node
    // and both CI platforms exercise the actual verified termination path.
    if (/^node(?:\.exe)?$/i.test(basename(process.execPath))) {
      const exited = once(worker, 'exit');
      const killed = await killWorkerProcess({ pid: worker.pid, graceMs: 100 });
      assert.equal(killed.ok, true);
      assert.equal(killed.group, false);
      await exited;
    }
  } finally {
    worker.kill();
    unrelated.kill();
    rmSync(dir, { recursive: true, force: true });
  }
});
