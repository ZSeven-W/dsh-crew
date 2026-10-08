import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorkerRegistry } from '../src/hub/index.mjs';
test('the hub preserves needs_input after disposal and exposes the unresolved question', async () => {
  let disposed = false, idle = Promise.resolve(), handler;
  const agent = { session: {}, async whenIdle() { await idle; }, followup() {
    idle = handler({ questions: [{ id: 'q', question: 'May I overwrite the existing file?' }] }).catch(() => {
      assert.equal(disposed, true, 'runtime must be stopped before another step could run');
    });
  } };
  const ctx = { get() {}, sessions: { async flush() {} }, agents: { async create(options) {
    await options.setup({ on(name, fn) { if (name === 'user-questions/request') handler = fn; } });
    return { agent, dispose() { disposed = true; } };
  } } };
  const registry = new WorkerRegistry(ctx, { publish() {} });
  const job = await registry.spawn({ task: 'fixture only', cwd: '/fixture', tier: 'flash' });
  await job.promise;
  assert.equal(job.status, 'needs_input');
  assert.equal(registry.view(job, true).questions[0].id, 'q');
  assert.equal(JSON.parse(job.result).needs_input, true);
});
