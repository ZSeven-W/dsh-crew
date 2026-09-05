// Regression tests for the PATTERN-AUDIT (2026-09-06) confirmed defects.
// Each test pins a guard; deleting the guard turns the test red.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync as exists, mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ---------- D1 (P4): agy image-gen must not report success on an unverified file ----------
test('generate_image(provider=agy) refuses when no nonce-matching image exists (no false success)', async () => {
  const work = mkdtempSync(join(tmpdir(), 'agy-guard-'));
  const home = join(work, 'home');
  const bin = join(work, 'bin');
  mkdirSync(join(home, '.gemini', 'antigravity-cli', 'brain', 'fake'), { recursive: true });
  mkdirSync(bin, { recursive: true });
  const shim = join(bin, 'agy');
  writeFileSync(shim, '#!/bin/sh\necho "saved to /nope/x.png"\nexit 0\n');
  chmodSync(shim, 0o755);
  // A fresh decoy image the fake CLI never was asked to produce.
  writeFileSync(join(home, '.gemini', 'antigravity-cli', 'brain', 'fake', 'decoy.png'), 'not-your-image');

  const { createMultimodalTools } = await import('../src/multimodal.mjs');
  const [, generateImage] = createMultimodalTools(() => ({ imagegen_provider: 'agy' }));
  const out = join(work, 'out.png');
  const prevHome = process.env.HOME;
  const prevPath = process.env.PATH;
  process.env.HOME = home;
  process.env.PATH = `${bin}:${prevPath}`;
  try {
    await assert.rejects(
      () => generateImage.execute({ prompt: 'a red circle', output_path: out }),
      /nonce|no .*image|not find/i,
      'a nonce-less decoy must NOT be reported as a successful generation',
    );
    assert.ok(!exists(out), 'no output file may be written from the decoy');
  } finally {
    process.env.HOME = prevHome;
    process.env.PATH = prevPath;
    rmSync(work, { recursive: true, force: true });
  }
});

// ---------- D2 (P2): hub route ?wait must reject garbage instead of silently not waiting ----------
test('parseWaitSeconds rejects non-numeric / negative / NaN waits', async () => {
  const { parseWaitSeconds } = await import('../src/hub/index.mjs');
  assert.equal(parseWaitSeconds('abc'), null);
  assert.equal(parseWaitSeconds(''), 0);
  assert.equal(parseWaitSeconds(undefined), 0);
  assert.equal(parseWaitSeconds(null), 0);
  assert.equal(parseWaitSeconds('-5'), null);
  assert.equal(parseWaitSeconds('12'), 12);
  assert.equal(parseWaitSeconds('12.9'), null); // integers only
});

// ---------- D3 (P5): truncated task strings must be visibly marked ----------
test('jobView marks a truncated task, hub view marks a truncated task', async () => {
  const { jobView } = await import('../src/jobs.mjs');
  const long = 'x'.repeat(500);
  const v = jobView({ id: 'j', tier: 'flash', model: 'm', effort: 'max', status: 'done', source: 't', task: long, turn: 0, step: 0, currentTool: null, toolCalls: 0, tokens: {}, cwd: '/tmp', startedAt: 't', endedAt: 't' });
  assert.ok(v.task.endsWith('…'), `task slice must end with an ellipsis marker when truncated, got tail: ${JSON.stringify(v.task.slice(-10))}`);
  const short = jobView({ id: 'j', tier: 'flash', model: 'm', effort: 'max', status: 'done', source: 't', task: 'short task', turn: 0, step: 0, currentTool: null, toolCalls: 0, tokens: {}, cwd: '/tmp', startedAt: 't', endedAt: 't' });
  assert.ok(!short.task.endsWith('…'), 'untruncated tasks must not carry the marker');
});
