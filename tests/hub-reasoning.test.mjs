import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WorkerRegistry } from '../src/hub/index.mjs';

function host(reasoning, lookupError, permissions) {
  const requests = [], lookups = [], handlers = new Map();
  const dispatchedPermissions = [];
  let created = 0, disposed = 0, queued = false;
  const context = {
    get: name => name === 'permissionPresets' ? permissions : undefined,
    llm: {
      async resolveModelInfo(provider, model) {
        lookups.push({ provider, model });
        if (lookupError) throw lookupError;
        return { provider, id: model, ...(reasoning === undefined ? {} : { reasoning }) };
      },
    },
    agents: {
      async create(options) {
        created++;
        const session = { permission: 'workspace-write' };
        await options.setup({ on(name, listener) { handlers.set(name, listener); } });
        return {
          dispose: async () => { disposed++; },
          agent: {
            session,
            followup() { queued = true; dispatchedPermissions.push(session.permission); },
            async whenIdle() {
              if (!queued) return;
              queued = false;
              await handlers.get('system-prompt/assemble')({}, {}, async () => ({ variables: {} }));
              const request = await handlers.get('agent/request')({}, async () => ({
                provider: 'inherited', model: 'inherited', reasoningEffort: 'high', messages: [],
              }));
              requests.push(request);
              // Independent model-contract boundary: unavailable controls reject,
              // and an advertised model only accepts its declared effort IDs.
              if (Object.hasOwn(request, 'reasoningEffort')
                  && !reasoning?.efforts.some(item => item.id === request.reasoningEffort)) {
                throw new Error(`unsupported effort: ${request.reasoningEffort}`);
              }
              handlers.get('session/event')({}, { type: 'turn/end', data: { reason: { kind: 'completed' } } });
            },
          },
        };
      },
    },
    sessions: { flush: async () => {} },
  };
  const registry = new WorkerRegistry(context, { publish() {} });
  return { registry, requests, lookups, dispatchedPermissions, created: () => created, disposed: () => disposed };
}

const task = { task: 'offline fixture', cwd: process.cwd(), provider: 'ab', model: 'cn:deepseek-v4.1-flash' };

for (const effort of [undefined, 'off', 'high', 'max']) {
  test(`unavailable reasoning omits ${effort ?? 'default'} and inherited effort`, async () => {
    const { registry, requests, lookups } = host(undefined);
    const job = await registry.spawn({ ...task, ...(effort === undefined ? {} : { effort }) });
    await job.promise;
    assert.equal(job.status, 'done');
    assert.equal(requests.length, 1);
    assert.equal(Object.hasOwn(requests[0], 'reasoningEffort'), false);
    assert.equal(requests[0].provider, task.provider);
    assert.equal(requests[0].model, task.model);
    assert.deepEqual(lookups, [{ provider: task.provider, model: task.model }]);
    assert.equal(registry.view(job).effort, effort ?? 'max');
    assert.equal(registry.view(job).effectiveEffort, null);
  });
}

for (const effort of ['off', 'high', 'max']) {
  test(`advertised reasoning preserves ${effort}`, async () => {
    const { registry, requests } = host({ efforts: ['off', 'high', 'max'].map(id => ({ id })) });
    const job = await registry.spawn({ ...task, effort });
    await job.promise;
    assert.equal(job.status, 'done');
    assert.equal(requests[0].reasoningEffort, effort);
    assert.equal(registry.view(job).effectiveEffort, effort);
  });
}

test('a wrong effort for a reasoning model is not silently removed', async () => {
  const { registry, requests } = host({ efforts: [{ id: 'high' }] });
  const job = await registry.spawn({ ...task, effort: 'max' });
  await job.promise;
  assert.equal(requests[0].reasoningEffort, 'max');
  assert.equal(job.status, 'failed');
  assert.match(job.error, /unsupported effort: max/);
});

test('capability lookup failure does not launch a worker or guess support', async () => {
  const { registry, created } = host(undefined, new Error('route unavailable'));
  await assert.rejects(registry.spawn(task), /route unavailable/);
  assert.equal(created(), 0);
  assert.equal(registry.jobs.size, 0);
});

function permissionService() {
  const changes = [];
  return {
    changes,
    resolve(name) {
      if (!['workspace-write', 'danger-full-access'].includes(name)) throw new Error(`unknown preset: ${name}`);
      return { name };
    },
    set(session, name) { this.resolve(name); changes.push(name); session.permission = name; },
    current(session) { return session.permission; },
  };
}

test('no Crew permission preference preserves the DSH initial permissions', async () => {
  const permissions = permissionService();
  const { registry, dispatchedPermissions } = host(undefined, undefined, permissions);
  const job = await registry.spawn(task);
  await job.promise;
  assert.equal(job.status, 'done');
  assert.deepEqual(permissions.changes, []);
  assert.deepEqual(dispatchedPermissions, ['workspace-write']);
  assert.equal(registry.view(job).permissionPreset, 'workspace-write');
});

test('saved Crew permission applies before dispatch and is read for every worker', async () => {
  const permissions = permissionService();
  const { registry, dispatchedPermissions } = host(undefined, undefined, permissions);
  let preference = 'danger-full-access';
  registry.getConfig = () => ({ permission_preset: preference });
  for (let count = 0; count < 2; count++) {
    const job = await registry.spawn(task);
    await job.promise;
    assert.equal(job.status, 'done');
    assert.equal(registry.view(job).permissionPreset, 'danger-full-access');
  }
  preference = 'default';
  const job = await registry.spawn(task);
  await job.promise;
  assert.deepEqual(dispatchedPermissions, ['danger-full-access', 'danger-full-access', 'workspace-write']);
});

for (const permissionPreset of ['default', 'workspace-write']) {
  test(`explicit ${permissionPreset} takes precedence over saved Full access`, async () => {
    const permissions = permissionService();
    const { registry, dispatchedPermissions } = host(undefined, undefined, permissions);
    registry.getConfig = () => ({ permission_preset: 'danger-full-access' });
    const job = await registry.spawn({ ...task, permissionPreset });
    await job.promise;
    assert.equal(job.status, 'done');
    assert.deepEqual(dispatchedPermissions, ['workspace-write']);
    assert.equal(permissions.changes.includes('danger-full-access'), false);
  });
}

test('unavailable or invalid permission selection rejects before creating a session', async () => {
  const missing = host(undefined);
  await assert.rejects(missing.registry.spawn({ ...task, permissionPreset: 'danger-full-access' }), /does not support permission/);
  assert.equal(missing.created(), 0);
  const invalid = host(undefined, undefined, permissionService());
  for (const permissionPreset of ['', ' ', 42, 'not-a-preset']) {
    await assert.rejects(invalid.registry.spawn({ ...task, permissionPreset }), /permission preset|unknown preset/);
  }
  assert.equal(invalid.created(), 0);
});

test('host permission refusal disposes the session without sending the task', async () => {
  const permissions = permissionService();
  permissions.set = () => { throw new Error('host refused preset'); };
  const { registry, requests, dispatchedPermissions, disposed } = host(undefined, undefined, permissions);
  const job = await registry.spawn({ ...task, permissionPreset: 'danger-full-access' });
  await job.promise;
  assert.equal(job.status, 'failed');
  assert.match(job.error, /host refused preset/);
  assert.equal(disposed(), 1);
  assert.deepEqual(requests, []);
  assert.deepEqual(dispatchedPermissions, []);
});

test('cancelling an in-flight worker is not overwritten by its turn completion', async () => {
  const { registry } = host(undefined);
  let release, dispatched;
  const gate = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { dispatched = resolve; });
  const create = registry.ctx.agents.create;
  registry.ctx.agents.create = async options => {
    const handle = await create(options);
    const idle = handle.agent.whenIdle;
    let calls = 0;
    handle.agent.whenIdle = async () => {
      if (++calls === 2) { dispatched(); await gate; }
      return idle();
    };
    return handle;
  };
  const job = await registry.spawn(task);
  await started;
  await registry.cancel(job.id);
  release();
  await job.promise;
  assert.equal(job.status, 'cancelled');
  assert.equal(job.error, 'cancelled by request');
});
