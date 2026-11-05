// Settled jobs release their live agent (src/hub/index.mjs scheduleIdleRelease).
//
// A live agent pins its whole session log. Keeping one per finished job grew
// the hub by megabytes per job until it ran out of heap, so a settled job keeps
// its agent only for a warm continue, then disposes it; a later continue
// resumes the persisted session. Ownership of the agent follows the newest job.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { WorkerRegistry } from '../src/hub/index.mjs';

function fixture(config = {}) {
  const events = new Map();
  const resumed = [];
  const disposed = [];
  let created = 0;
  const emit = (text) => {
    events.get('session/event')({}, { type: 'assistant/message', data: { message: { content: [{ type: 'text', text }] } } });
    events.get('session/event')({}, { type: 'turn/end', data: { reason: { kind: 'completed' } } });
  };
  const makeHandle = (name, answer) => {
    const agent = { session: {}, model: { select() {} }, async whenIdle() {}, followup() { emit(answer()); } };
    return { name, agent, async dispose() { disposed.push(name); } };
  };
  const ctx = {
    get(name) {
      if (name === 'agentPresets') return { async resolve(id) { return { id: id ?? 'standard' }; }, async mount() {} };
      return undefined;
    },
    sessions: { async flush() {} },
    agents: {
      async create(options) {
        await options.setup({ on(name, fn) { events.set(name, fn); }, tools: { register() {} } });
        let turns = 0;
        return makeHandle(`live-${++created}`, () => (++turns === 1 ? 'first answer' : 'warm answer'));
      },
      async resume(options) {
        resumed.push(options.resumeSessionId);
        await options.setup({ on(name, fn) { events.set(name, fn); }, tools: { register() {} } });
        return makeHandle(`resumed-${resumed.length}`, () => 'cold answer');
      },
    },
  };
  const registry = new WorkerRegistry(ctx, { publish() {} });
  registry.getConfig = () => config;
  return { registry, resumed, disposed };
}

const tick = () => new Promise((done) => setImmediate(done));

test('with idle_release_seconds 0 a settled job disposes its agent at once', async () => {
  const f = fixture({ idle_release_seconds: 0 });
  const first = await f.registry.spawn({ task: 'first', cwd: '/fixture', timeout_seconds: 30 });
  await first.promise;
  await tick();
  assert.equal(first.handle, undefined);
  assert.deepEqual(f.disposed, ['live-1']);

  const second = await f.registry.continueJob(first.id, 'later');
  await second.promise;
  assert.equal(second.result, 'cold answer', 'a released agent is continued from the persisted session');
  assert.deepEqual(f.resumed, [first.sessionId]);
});

test('by default the agent stays live for a warm continue, which takes ownership of it', async () => {
  const f = fixture();
  const first = await f.registry.spawn({ task: 'first', cwd: '/fixture', timeout_seconds: 30 });
  await first.promise;
  assert.ok(first.handle, 'kept for a warm continue');
  assert.ok(first._idleTimer, 'with a release timer armed');

  const second = await f.registry.continueJob(first.id, 'and then?');
  assert.equal(first.handle, undefined, 'the agent moved to the continuation');
  await second.promise;
  assert.equal(second.result, 'warm answer');
  assert.equal(f.resumed.length, 0);
  assert.deepEqual(f.disposed, [], 'nothing disposed while the continuation may still be continued');

  f.registry.releaseIdle(first);
  assert.deepEqual(f.disposed, [], 'the old record no longer owns the agent');
  f.registry.releaseIdle(second);
  assert.deepEqual(f.disposed, ['live-1']);
  assert.equal(second.handle, undefined);
});

test('continuing an older job id reuses the agent the newest job holds', async () => {
  const f = fixture();
  const first = await f.registry.spawn({ task: 'first', cwd: '/fixture', timeout_seconds: 30 });
  await first.promise;
  const second = await f.registry.continueJob(first.id, 'two');
  await second.promise;

  const third = await f.registry.continueJob(first.id, 'three');
  await third.promise;
  assert.equal(third.result, 'warm answer');
  assert.equal(f.resumed.length, 0, 'the live agent is found on the newest job, not resumed beside it');
  assert.equal(second.handle, undefined);
  assert.ok(third.handle);
  await f.registry.dispose();
});

test('unloading the hub disposes the agents settled jobs still hold', async () => {
  const f = fixture();
  const first = await f.registry.spawn({ task: 'first', cwd: '/fixture', timeout_seconds: 30 });
  await first.promise;
  await f.registry.dispose();
  assert.deepEqual(f.disposed, ['live-1']);
  assert.equal(first.handle, undefined);
});
