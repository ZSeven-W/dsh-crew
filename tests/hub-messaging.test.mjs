// Isolated tests for continuing a Crew Hub worker in its own session:
// WorkerRegistry.message() and the job record that survives a Hub reload.
//
// Everything here is a fake host: no DSH agent is created, no model is called,
// no HTTP server listens, and the only files touched live in a fresh mkdtemp
// directory. The fakes model exactly the seams the hub uses (agents.create /
// agents.resume / agent.steer / agent.followup / agent.whenIdle /
// session events / permissionPresets.current) so the assertions are about the
// hub's own behaviour, not about a stubbed echo.

import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { WorkerRegistry } from '../src/hub/index.mjs';
import { createHubJobStore } from '../src/hub/job-store.mjs';

const SAFE_PARENT = resolve(tmpdir());
const WORKSPACE = await mkdtemp(join(SAFE_PARENT, 'crew-hub-messaging-'));
const TASK = { task: 'isolated messaging fixture', cwd: WORKSPACE, provider: 'ab', model: 'cn:deepseek-v4.1-flash' };

after(async () => {
  assert.equal(resolve(WORKSPACE).startsWith(SAFE_PARENT), true);
  await rm(WORKSPACE, { recursive: true, force: true });
});

/** One message object from the hub is a frozen user message; read its text. */
function messageText(input) {
  return (input?.content ?? []).filter(part => part?.type === 'text').map(part => part.text).join('');
}

function permissionService() {
  const changes = [];
  return {
    changes,
    resolve(name) {
      if (!['workspace-write', 'danger-full-access', 'default'].includes(name)) throw new Error(`unknown preset: ${name}`);
      return { name };
    },
    set(session, name) { this.resolve(name); changes.push(name); session.permission = name; },
    current(session) { return session?.permission ?? null; },
  };
}

/**
 * Minimal agent runtime: one queued turn per followup, steers join the turn
 * that is open at that moment, and whenIdle resolves when nothing is left.
 */
function createAgentRuntime(agentCtx, session, host, reply) {
  const queue = [];
  const idleWaiters = [];
  let open = null;
  let busy = false;
  let pumping = false;

  const wake = () => { for (const waiter of idleWaiters.splice(0)) waiter(); };

  async function completeTurn(turn) {
    const last = turn.messages.at(-1);
    const plan = reply(last, turn) ?? {};
    let failure = null;
    if (plan.ask) {
      const listeners = agentCtx.listeners('user-questions/request');
      try {
        // Prepend order: the worker handoff listener is registered last and wins.
        for (const listener of [...listeners].reverse()) await listener({ questions: plan.ask });
      } catch (error) { failure = error; }
    }
    if (failure === null) {
      agentCtx.emit('session/event', session, {
        type: 'assistant/message',
        data: {
          message: { content: [{ type: 'text', text: plan.text ?? `echo:${last}` }] },
          usage: { inputTokens: 1, outputTokens: 1 },
        },
      });
    }
    agentCtx.emit('session/event', session, {
      type: 'turn/end',
      data: { reason: { kind: failure === null ? 'completed' : 'error' } },
    });
  }

  async function pump() {
    if (pumping) return;
    pumping = true;
    try {
      while (queue.length > 0) {
        const turn = queue.shift();
        open = turn;
        const gate = host.takeHold();
        host.markTurnStarted();
        if (gate) await gate;
        await completeTurn(turn);
        if (open === turn) open = null;
      }
    } finally {
      pumping = false;
      busy = queue.length > 0;
      wake();
    }
  }

  const agent = {
    session,
    disposed: false,
    steerCalls: [],
    followupCalls: [],
    steer(input) {
      const text = messageText(input);
      agent.steerCalls.push(text);
      if (open === null) {
        open = { messages: [text] };
        queue.push(open);
      } else {
        open.messages.push(text);
      }
      busy = true;
      wake();
      void pump();
    },
    followup(input) {
      const text = messageText(input);
      agent.followupCalls.push(text);
      queue.push({ messages: [text] });
      busy = true;
      wake();
      void pump();
    },
    async whenIdle() {
      while (busy) await new Promise(resolve => idleWaiters.push(resolve));
    },
  };
  return agent;
}

function createAgentCtx() {
  const map = new Map();
  return {
    on(name, listener) {
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(listener);
      return () => {};
    },
    listeners(name) { return map.get(name) ?? []; },
    emit(name, ...args) {
      for (const listener of map.get(name) ?? []) {
        try { listener(...args); } catch { /* a listener must not break the turn */ }
      }
    },
  };
}

/**
 * A fake DSH host. `seedSessions` models the permissions DSH still holds for a
 * session id after a Hub reload; `reply(text)` decides what each turn answers
 * or that it raises a user question.
 */
function createHost({ seedSessions = {}, reply = text => `echo:${text}`, store = null, initialPermission = 'workspace-write' } = {}) {
  const permissions = permissionService();
  const host = {
    creates: 0,
    disposals: 0,
    resumeCalls: [],
    flushed: [],
    handles: [],
    sessions: new Map(),
    turnStarts: 0,
    holds: [],
    startWaiters: [],
    createGate: null,
    resumeGate: null,
    takeHold() { return host.holds.shift() ?? null; },
    markTurnStarted() { host.turnStarts += 1; for (const resolve of host.startWaiters.splice(0)) resolve(); },
    nextTurnStart() { return new Promise(resolve => host.startWaiters.push(resolve)); },
    /** Block the next turn until the returned release() is called. */
    holdNextTurn() {
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      host.holds.push(gate);
      return release;
    },
    agent() { return host.handles.at(-1).agent; },
  };
  for (const [id, seeded] of Object.entries(seedSessions)) host.sessions.set(id, { id, ...seeded });

  const context = {
    get: name => (name === 'permissionPresets' ? permissions : undefined),
    llm: { async resolveModelInfo(provider, model) { return { provider, id: model }; } },
    logger: { info() {}, warn() {} },
    agents: {
      async create(options) {
        if (host.createGate) await host.createGate;
        host.creates += 1;
        const session = { id: options.sessionId, permission: initialPermission };
        host.sessions.set(options.sessionId, session);
        const agentCtx = createAgentCtx();
        await options.setup(agentCtx);
        const agent = createAgentRuntime(agentCtx, session, host, reply);
        const handle = { agent, dispose: async () => { host.disposals += 1; agent.disposed = true; } };
        host.handles.push(handle);
        return handle;
      },
      async resume(options) {
        host.resumeCalls.push({ resumeSessionId: options.resumeSessionId, agentOptions: options.agentOptions });
        if (host.resumeGate) await host.resumeGate;
        const session = host.sessions.get(options.resumeSessionId)
          ?? { id: options.resumeSessionId, permission: initialPermission };
        host.sessions.set(options.resumeSessionId, session);
        const agentCtx = createAgentCtx();
        await options.setup(agentCtx);
        const agent = createAgentRuntime(agentCtx, session, host, reply);
        const handle = { agent, dispose: async () => { host.disposals += 1; agent.disposed = true; } };
        host.handles.push(handle);
        return handle;
      },
    },
    sessions: { async flush(session) { host.flushed.push(session); } },
  };

  const registry = new WorkerRegistry(context, { publish() {} }, store);
  return { registry, host, permissions, context };
}

/** A ready-made done job: one task turn, one completed answer. */
async function doneJob(options = {}) {
  const built = createHost(options);
  const job = await built.registry.spawn(TASK);
  await job.promise;
  assert.equal(job.status, 'done');
  return { ...built, job };
}

// ---------- running worker: steer / followup ----------

test('messaging a running worker steers the same session and never creates another', async () => {
  const built = createHost();
  const release = built.host.holdNextTurn();
  const started = built.host.nextTurnStart();
  const job = await built.registry.spawn(TASK);
  await started;

  const same = await built.registry.message(job.id, { message: 'check the trailing loader' });
  assert.equal(same, job);
  assert.equal(built.host.creates, 1);
  assert.equal(built.host.resumeCalls.length, 0);
  const agent = built.host.agent();
  assert.deepEqual(agent.steerCalls, ['check the trailing loader']);
  assert.deepEqual(agent.followupCalls, ['isolated messaging fixture']);
  assert.equal(job.status, 'running');
  assert.equal(job.history, undefined, 'a steer must not open a continuation record');

  const receipt = built.registry.view(job).lastMessage;
  assert.equal(receipt.delivery, 'steer');
  assert.equal(typeof receipt.id, 'string');
  assert.equal(receipt.id.length > 0, true);
  assert.equal(Number.isNaN(Date.parse(receipt.acceptedAt)), false);

  release();
  await job.promise;
  assert.equal(job.status, 'done');
  assert.equal(job.result, 'echo:check the trailing loader');
  assert.equal(built.registry.view(job).continuationCount, 0);
});

test('a followup on a running worker queues its own turn instead of joining the open one', async () => {
  const built = createHost();
  const release = built.host.holdNextTurn();
  const started = built.host.nextTurnStart();
  const job = await built.registry.spawn(TASK);
  await started;

  await built.registry.message(job.id, { message: 'then write the changelog', delivery: 'followup' });
  const agent = built.host.agent();
  assert.deepEqual(agent.followupCalls, ['isolated messaging fixture', 'then write the changelog']);
  assert.deepEqual(agent.steerCalls, []);
  assert.equal(built.registry.view(job).lastMessage.delivery, 'followup');

  release();
  await job.promise;
  assert.equal(job.status, 'done');
  assert.deepEqual(job.texts, ['echo:isolated messaging fixture', 'echo:then write the changelog']);
  assert.equal(job.result, 'echo:then write the changelog');
});

// ---------- idle worker: continue in place ----------

test('an idle worker continues in the same session, keeping history and permissions', async () => {
  const { registry, host, permissions, job } = await doneJob();
  const sessionId = job.sessionId;
  const preset = registry.view(job).permissionPreset;
  assert.equal(preset, 'workspace-write');
  const firstEndedAt = job.endedAt;

  // Hold the new turn open so the assertions observe the running continuation.
  const release = host.holdNextTurn();
  const continued = await registry.message(job.id, { message: 'one more pass' });
  assert.equal(continued, job);
  assert.equal(job.status, 'running');
  assert.equal(job.result, null, 'the stale result must not be readable while the new turn runs');
  assert.equal(job.error, null);
  assert.equal(job.endedAt, null);

  // Same session, same runtime: no second create for the same agent, no resume.
  assert.equal(host.creates, 1);
  assert.equal(host.resumeCalls.length, 0);
  const agent = host.agent();
  assert.deepEqual(agent.followupCalls, ['isolated messaging fixture', 'one more pass']);
  assert.deepEqual(agent.steerCalls, []);
  assert.equal(sessionId, job.sessionId);

  assert.equal(job.history.length, 1);
  assert.equal(job.history[0].result, 'echo:isolated messaging fixture');
  assert.equal(job.history[0].status, 'done');
  assert.equal(job.history[0].endedAt, firstEndedAt);
  assert.equal(registry.view(job).permissionPreset, preset);
  assert.deepEqual(permissions.changes, [], 'continuing must not re-apply or grant a permission preset');

  release();
  await job.promise;
  assert.equal(job.status, 'done');
  assert.equal(job.result, 'echo:one more pass');
  assert.equal(job.history.length, 1);
  const view = registry.view(job, true);
  assert.equal(view.result, 'echo:one more pass');
  assert.equal(view.continuationCount, 1);
  assert.deepEqual(view.history.map(entry => entry.result), ['echo:isolated messaging fixture']);
  assert.equal(view.lastMessage.delivery, 'followup');
  assert.equal(host.flushed.length, 2, 'each completed turn is flushed to DSH session storage');
});

test('a needs_input worker answers a follow-up in the same session and clears its question', async () => {
  let asked = false;
  const built = createHost({
    reply: (text) => {
      if (/approval/.test(text) && !asked) {
        asked = true;
        return { ask: [{ id: 'q1', question: 'Overwrite the file?', options: [{ label: 'Yes' }, { label: 'No' }] }] };
      }
      return { text: `echo:${text}` };
    },
  });
  const { registry, host, permissions } = built;
  const job = await registry.spawn(TASK);
  await job.promise;

  await registry.message(job.id, { message: 'this needs approval' });
  await job.promise;
  assert.equal(job.status, 'needs_input');
  assert.equal(registry.view(job).questions.length, 1);
  assert.match(job.result, /needs_input/);

  // Hold the answering turn open: the assertions below are about the state
  // between accepting the message and the worker finishing it.
  const release = host.holdNextTurn();
  const resumed = await registry.message(job.id, { message: 'approved, go ahead' });
  assert.equal(resumed, job);
  assert.equal(job.status, 'running');
  assert.equal(job.questions, undefined, 'the answered question must not stay attached to the job');
  assert.equal(job.history.length, 2, 'each continuation archives the state it replaced');
  assert.equal(job.history[0].status, 'done');
  assert.equal(job.history[1].status, 'needs_input');
  assert.match(job.history[1].result, /needs_input/);
  assert.equal(host.creates, 1);
  assert.equal(host.resumeCalls.length, 0);
  assert.deepEqual(permissions.changes, []);

  release();
  await job.promise;
  assert.equal(job.status, 'done');
  assert.equal(job.result, 'echo:approved, go ahead');
  assert.equal(registry.view(job).questions, undefined);
});

// ---------- validation, cancellation, queueing ----------

test('unknown ids and invalid payloads are refused without touching a worker', async () => {
  const { registry, host, job } = await doneJob();
  const agent = host.agent();

  assert.equal(await registry.message('hub-missing', { message: 'hello' }), undefined);

  for (const bad of [{}, { message: '' }, { message: '   ' }, { message: 42 }, { message: 'x'.repeat(60001) }]) {
    await assert.rejects(registry.message(job.id, bad), /message must contain 1 to 60000 characters/);
  }
  for (const delivery of ['steer ', 'resume', '', 42]) {
    await assert.rejects(registry.message(job.id, { message: 'hello', delivery }), /delivery must be steer or followup/);
  }
  assert.equal(job.status, 'done');
  assert.deepEqual(agent.followupCalls, ['isolated messaging fixture']);
  assert.deepEqual(agent.steerCalls, []);
  assert.equal(job.history, undefined);
  assert.equal(job.lastMessage, undefined);
});

test('a cancelled worker is not continued', async () => {
  const built = createHost();
  const release = built.host.holdNextTurn();
  const started = built.host.nextTurnStart();
  const job = await built.registry.spawn(TASK);
  await started;
  await built.registry.cancel(job.id);
  release();
  await job.promise;
  assert.equal(job.status, 'cancelled');

  await assert.rejects(
    built.registry.message(job.id, { message: 'pick it back up' }),
    /cancelled worker cannot be continued/,
  );
  assert.deepEqual(built.host.agent().steerCalls, []);
  assert.deepEqual(built.host.agent().followupCalls, ['isolated messaging fixture']);
  assert.equal(built.host.creates, 1);
});

test('a cancel that lands while the job is preparing refuses the message instead of resurrecting it', async () => {
  const built = createHost();
  let releaseCreate;
  built.host.createGate = new Promise(resolve => { releaseCreate = resolve; });
  const spawning = built.registry.spawn(TASK);
  await new Promise(resolve => setImmediate(resolve));
  const id = [...built.registry.jobs.keys()].at(-1);
  assert.equal(typeof id, 'string');

  const message = built.registry.message(id, { message: 'too early' });
  // deliver() is queued behind job.ready; let it start and block there.
  await new Promise(resolve => setImmediate(resolve));
  await built.registry.cancel(id);
  releaseCreate();
  await spawning;

  await assert.rejects(message, /cancelled while preparing the message/);
  assert.equal(built.registry.jobs.get(id).status, 'cancelled');
  assert.equal(built.host.disposals, 1, 'the freshly created runtime is disposed, not reused');
});

test('two messages queued at once are delivered in order by one continuation', async () => {
  const { registry, host, job } = await doneJob();
  const release = host.holdNextTurn();
  const [first, second] = await Promise.all([
    registry.message(job.id, { message: 'first note' }),
    registry.message(job.id, { message: 'second note', delivery: 'followup' }),
  ]);
  assert.equal(first, job);
  assert.equal(second, job);
  assert.equal(host.creates, 1);
  assert.equal(host.resumeCalls.length, 0, 'the second message must ride the continuation, not resume again');
  assert.deepEqual(host.agent().followupCalls, ['isolated messaging fixture', 'first note', 'second note']);
  assert.equal(job.history.length, 1, 'only the pre-continuation result is archived once');

  release();
  await job.promise;
  assert.equal(host.turnStarts, 3, 'one task turn plus two continuation turns on the same runtime');
  assert.equal(job.status, 'done');
  assert.equal(job.result, 'echo:second note');
});

test('a continuation is refused while another worker holds the same workspace', async () => {
  const built = createHost();
  const { registry, host } = built;
  const first = await registry.spawn(TASK);
  await first.promise;
  assert.equal(first.status, 'done');

  const release = host.holdNextTurn();
  const started = host.nextTurnStart();
  const second = await registry.spawn(TASK);
  await started;

  await assert.rejects(
    registry.message(first.id, { message: 'continue anyway' }),
    new RegExp(`workspace already held by running job ${second.id}`),
  );
  assert.equal(first.status, 'done');
  assert.equal(first.history, undefined);
  assert.equal(host.resumeCalls.length, 0);

  release();
  await second.promise;
});

// ---------- job store and Hub reload ----------

async function tempStore(pid = 9090) {
  const directory = await mkdtemp(join(SAFE_PARENT, 'crew-hub-store-'));
  return { directory, store: () => createHubJobStore(directory, { warn() {} }, pid) };
}

test('the job store keeps well-formed hub records per host process and survives garbage', async () => {
  const { directory, store } = await tempStore(4242);
  try {
    const warnings = [];
    const writer = createHubJobStore(directory, { warn: message => warnings.push(message) }, 4242);
    assert.deepEqual(writer.load(), []);

    writer.save([
      { id: 'hub-1-a', sessionId: 'session-1', cwd: WORKSPACE, status: 'done', task: 't', result: 'r' },
      { id: 'standalone-2', sessionId: 'session-2', cwd: WORKSPACE, status: 'done' },
      { id: 'hub-3-b', cwd: WORKSPACE, status: 'done' },
      { id: 'hub-4-c', sessionId: 'session-4', status: 'done' },
      { id: 'hub-5-d', sessionId: 'session-5', cwd: WORKSPACE, status: 'done' },
    ]);
    assert.deepEqual(await readdir(join(directory, 'hub-jobs')), ['4242.json'], 'the write is atomic');
    assert.deepEqual((await store().load()).map(job => job.id), ['hub-1-a', 'hub-5-d']);

    // A different host process never reads another process's records.
    assert.deepEqual(createHubJobStore(directory, null, 4243).load(), []);

    const file = join(directory, 'hub-jobs', '4242.json');
    await writeFile(file, '{"truncated":', 'utf8');
    assert.deepEqual(writer.load(), []);
    assert.equal(warnings.some(message => /cannot read job records/.test(message)), true);
    assert.deepEqual(createHubJobStore(directory, null, 4242).load(), [], 'an unreadable record file is reported, not trusted');

    await writeFile(file, JSON.stringify({ jobs: [] }), 'utf8');
    assert.deepEqual(writer.load(), [], 'a non-array payload is rejected');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a Hub reload keeps the session reference and continues it through agents.resume', async () => {
  const { directory, store } = await tempStore(777);
  try {
    const before = createHost({ store: store() });
    const job = await before.registry.spawn(TASK);
    await job.promise;
    assert.equal(job.status, 'done');
    const sessionId = job.sessionId;

    const records = store().load();
    assert.equal(records.length, 1);
    assert.equal(records[0].id, job.id);
    assert.equal(records[0].sessionId, sessionId);
    assert.equal(records[0].cwd, WORKSPACE);
    assert.equal(records[0].status, 'done');
    assert.equal(records[0].result, 'echo:isolated messaging fixture');
    assert.equal(records[0].task, 'isolated messaging fixture');

    // New process, same record file: DSH still holds the session and its access.
    const reloaded = createHost({ store: store(), seedSessions: { [sessionId]: { permission: 'workspace-write' } } });
    const restored = reloaded.registry.jobs.get(job.id);
    assert.equal(restored.status, 'done');
    assert.equal(restored.handle, null);
    assert.equal(restored.result, 'echo:isolated messaging fixture');

    const releaseFirst = reloaded.host.holdNextTurn();
    const continued = await reloaded.registry.message(job.id, { message: 'carry on' });
    assert.equal(continued, restored);
    assert.equal(reloaded.host.creates, 0, 'a reloaded job must not open a new session');
    assert.equal(reloaded.host.resumeCalls.length, 1);
    assert.equal(reloaded.host.resumeCalls[0].resumeSessionId, sessionId);
    assert.deepEqual(reloaded.host.resumeCalls[0].agentOptions, { provider: 'ab', model: 'cn:deepseek-v4.1-flash' });
    assert.equal(restored.status, 'running');
    assert.equal(restored.permissionPreset, 'workspace-write', 'the resumed session keeps the access it had');
    assert.deepEqual(reloaded.permissions.changes, [], 'resuming must never set a permission preset');

    releaseFirst();
    await restored.promise;
    assert.equal(restored.status, 'done');
    assert.equal(restored.result, 'echo:carry on');
    assert.equal(restored.history.length, 1);
    assert.equal(restored.history[0].result, 'echo:isolated messaging fixture');

    // A second continuation rides the resumed runtime instead of resuming again.
    await reloaded.registry.message(job.id, { message: 'and again' });
    await restored.promise;
    assert.equal(reloaded.host.resumeCalls.length, 1);
    assert.equal(restored.result, 'echo:and again');
    assert.equal(restored.history.length, 2);

    const afterReload = store().load();
    assert.equal(afterReload[0].history.length, 2);
    assert.equal(afterReload[0].lastMessage.delivery, 'followup');
    assert.equal(afterReload[0].sessionId, sessionId);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a job recorded as running is not presented as live and can still be resumed', async () => {
  const { directory, store } = await tempStore(778);
  try {
    const record = {
      id: 'hub-7-run', sessionId: 'session-7', cwd: WORKSPACE, status: 'running',
      provider: 'ab', model: 'cn:deepseek-v4.1-flash', tier: 'flash', effort: 'max',
      effectiveEffort: null, task: 'half finished', texts: ['partial'], tokens: { input: 1, output: 1, reasoning: 0 },
      startedAt: new Date(0).toISOString(), endedAt: null, result: null, error: null,
    };
    store().save([record]);

    const reloaded = createHost({
      store: store(),
      seedSessions: { 'session-7': { permission: 'danger-full-access' } },
      reply: text => `echo:${text}`,
    });
    const job = reloaded.registry.jobs.get('hub-7-run');
    assert.equal(job.status, 'failed');
    assert.equal(job.stopReason, 'host_reloaded');
    assert.match(job.error, /follow-up/);
    const view = reloaded.registry.view(job, true);
    assert.equal(view.status, 'failed');
    assert.equal(view.sessionId, 'session-7');

    const release = reloaded.host.holdNextTurn();
    const continued = await reloaded.registry.message('hub-7-run', { message: 'finish it' });
    assert.equal(continued, job);
    assert.equal(reloaded.host.resumeCalls.length, 1);
    assert.equal(reloaded.host.resumeCalls[0].resumeSessionId, 'session-7');
    assert.equal(job.status, 'running');
    assert.equal(job.permissionPreset, 'danger-full-access');

    release();
    await job.promise;
    assert.equal(job.status, 'done');
    assert.equal(job.result, 'echo:finish it');
    assert.equal(job.history.length, 1);
    assert.equal(job.history[0].status, 'failed');
    assert.equal(job.history[0].stopReason, 'host_reloaded');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('a cancel during the resume of a reloaded job disposes the new runtime and refuses the message', async () => {
  const { directory, store } = await tempStore(781);
  try {
    const first = createHost({ store: store() });
    const job = await first.registry.spawn(TASK);
    await job.promise;
    assert.equal(job.status, 'done');

    const reloaded = createHost({
      store: store(),
      seedSessions: { [job.sessionId]: { permission: 'workspace-write' } },
    });
    let releaseResume;
    reloaded.host.resumeGate = new Promise(resolve => { releaseResume = resolve; });
    const message = reloaded.registry.message(job.id, { message: 'keep going' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(reloaded.host.resumeCalls.length, 1, 'the continuation is resuming the recorded session');

    await reloaded.registry.cancel(job.id);
    assert.equal(reloaded.registry.jobs.get(job.id).status, 'cancelled');

    releaseResume();
    await assert.rejects(message, /cancelled while preparing the message/);
    assert.equal(reloaded.registry.jobs.get(job.id).status, 'cancelled');
    assert.equal(reloaded.host.disposals, 1, 'the resumed runtime is disposed instead of left running');
    assert.deepEqual(reloaded.host.agent().followupCalls, [], 'nothing is delivered to the cancelled session');
    assert.equal(store().load()[0].status, 'cancelled');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('persisted records stay readable JSON after a continuation', async () => {
  const { directory, store } = await tempStore(779);
  try {
    const built = createHost({ store: store() });
    const job = await built.registry.spawn(TASK);
    await job.promise;
    await built.registry.message(job.id, { message: 'second pass' });
    await job.promise;

    const raw = await readFile(join(directory, 'hub-jobs', '779.json'), 'utf8');
    const parsed = JSON.parse(raw);
    assert.equal(Array.isArray(parsed), true);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].id, job.id);
    assert.equal(parsed[0].result, 'echo:second pass');
    assert.equal(parsed[0].history.length, 1);
    assert.equal(typeof parsed[0].lastMessage.id, 'string');
    assert.equal(parsed[0].lastMessage.delivery, 'followup');
    assert.equal(JSON.stringify(parsed[0]).includes('waiters'), false, 'runtime-only fields are not persisted');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
