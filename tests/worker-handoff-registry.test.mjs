import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorkerRegistry } from '../src/hub/index.mjs';

test('cancellation during model resolution prevents the worker from starting', async () => {
  const lookup = Promise.withResolvers();
  let lookupSignal;
  let created = 0;
  const ctx = {
    get() {},
    sessions: { async flush() {} },
    llm: { resolveModelInfo(_provider, _model, signal) {
      lookupSignal = signal;
      return lookup.promise;
    } },
    agents: { async create() {
      created += 1;
      return { agent: { session: {}, async whenIdle() {}, followup() {} }, async dispose() {} };
    } },
  };
  const registry = new WorkerRegistry(ctx, { publish() {} });
  const job = await registry.spawn({ task: 'fixture only', cwd: '/fixture' });
  await registry.cancel(job.id);
  lookup.resolve({});
  await job.promise;
  assert.equal(created, 0, 'A cancelled job must not create an agent');
  assert.equal(job.status, 'cancelled');
  assert.equal(lookupSignal?.aborted, true);
});

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
