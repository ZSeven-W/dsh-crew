import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  loadWorkerGateways, retryWorkerGatewayCredential, saveWorkerGateway,
} from '../src/client/worker-gateway.ts';

const draft = {
  id: 'local-gateway',
  baseURL: ' http://127.0.0.1:9000/v1/ ',
  modelId: 'team-model',
  apiKey: ' fixture-key ',
  editing: false,
};

function host({ providers = {}, writable = true, conflict = false, rejectKey = false } = {}) {
  const calls = [];
  const view = { ns: 'llm-pi-ai', revision: 8, value: { providers } };
  const ok = value => ({ ok: true, value });
  const remote = {
    settings: {
      describe: async () => ok({ writable, namespaces: [view] }),
      mutate: async (...args) => {
        calls.push(['settings', ...args]);
        return conflict ? { ok: false, error: { code: 'settings/conflict' } } : ok(view);
      },
    },
    llm: {
      listProviders: async () => ok([{ id: 'deepseek-official' }]),
      listConfigurableProviders: async () => ok([{ provider: 'anthropic' }]),
    },
    credentials: {
      set: async (...args) => {
        calls.push(['credential', ...args]);
        if (rejectKey) throw new Error('Credential store unavailable');
        return ok(undefined);
      },
    },
  };
  return { remote, calls };
}

test('creates a custom route and stores its key through credentials only', async () => {
  const { remote, calls } = host();
  const catalog = await loadWorkerGateways(remote);
  assert.deepEqual(catalog.providers, []);
  assert.deepEqual(await saveWorkerGateway(remote, catalog, draft), { kind: 'saved' });
  const ref = calls[0][2][0].value.apiKeyEnv;
  assert.match(ref, /^DSH_CREW_LOCAL_GATEWAY_[A-F0-9]{32}_API_KEY$/);
  assert.deepEqual(calls, [
    ['settings', 'llm-pi-ai', [{ op: 'set', path: ['providers', 'local-gateway'], value: {
      api: 'openai-completions', baseURL: 'http://127.0.0.1:9000/v1',
      models: [{ id: 'team-model' }], apiKeyEnv: ref,
    } }], 8],
    ['credential', ref, 'fixture-key'],
  ]);
});

test('rejects invalid endpoints and provider IDs before writing', async () => {
  const { remote, calls } = host();
  const catalog = await loadWorkerGateways(remote);
  for (const baseURL of ['ftp://example.test/v1', 'https://user:secret@example.test/v1', 'https://example.test/v1?key=secret']) {
    assert.deepEqual(await saveWorkerGateway(remote, catalog, { ...draft, baseURL }), { kind: 'invalid-url' });
  }
  assert.deepEqual(await saveWorkerGateway(remote, catalog, { ...draft, id: '9gateway' }), { kind: 'invalid-id' });
  assert.deepEqual(await saveWorkerGateway(remote, catalog, { ...draft, modelId: '' }), { kind: 'invalid-model' });
  for (const id of ['deepseek-official', 'anthropic']) {
    assert.deepEqual(await saveWorkerGateway(remote, catalog, { ...draft, id }), { kind: 'id-taken' });
  }
  assert.deepEqual(calls, []);
});

test('editing preserves previous model details and a blank key leaves the credential reference alone', async () => {
  const previous = { id: 'previous-model', contextWindow: 8000 };
  const { remote, calls } = host({ providers: {
    'local-gateway': { api: 'openai-completions', baseURL: 'http://127.0.0.1:9000/v1', models: [previous], apiKeyEnv: 'EXISTING_KEY' },
    'messages-gateway': { api: 'anthropic-messages', baseURL: 'https://messages.example.test', models: [] },
  } });
  const catalog = await loadWorkerGateways(remote);
  assert.deepEqual(catalog.providers.map(provider => provider.id), ['local-gateway']);
  assert.deepEqual(await saveWorkerGateway(remote, catalog, { ...draft, editing: true, apiKey: '' }), { kind: 'saved' });
  assert.deepEqual(calls, [
    ['settings', 'llm-pi-ai', [
      { op: 'set', path: ['providers', 'local-gateway', 'models'], value: [previous, { id: 'team-model' }] },
    ], 8],
  ]);
});

test('rotating a key on an existing endpoint uses a route-specific reference', async () => {
  const { remote, calls } = host({ providers: {
    'local-gateway': { api: 'openai-completions', baseURL: 'http://127.0.0.1:9000/v1', models: [{ id: 'team-model' }], apiKeyEnv: 'SHARED_KEY' },
  } });
  const catalog = await loadWorkerGateways(remote);
  assert.deepEqual(await saveWorkerGateway(remote, catalog, { ...draft, editing: true, modelId: '' }), { kind: 'saved' });
  const ref = calls[0][2][0].value;
  assert.match(ref, /^DSH_CREW_LOCAL_GATEWAY_[A-F0-9]{32}_API_KEY$/);
  assert.deepEqual(calls, [
    ['settings', 'llm-pi-ai', [
      { op: 'set', path: ['providers', 'local-gateway', 'apiKeyEnv'], value: ref },
    ], 8],
    ['credential', ref, 'fixture-key'],
  ]);
});

test('changing an authenticated URL never points the new endpoint at the previous key', async () => {
  const oldRef = 'DSH_CREW_LOCAL_GATEWAY_0123456789ABCDEF0123456789ABCDEF_API_KEY';
  const { remote, calls } = host({ providers: {
    'local-gateway': { api: 'openai-completions', baseURL: 'https://old.example.test/v1', models: [{ id: 'team-model' }], apiKeyEnv: oldRef },
  } });
  const catalog = await loadWorkerGateways(remote);
  assert.deepEqual(await saveWorkerGateway(remote, catalog, { ...draft, editing: true, apiKey: '' }), { kind: 'key-required' });
  assert.deepEqual(calls, []);
  assert.deepEqual(await saveWorkerGateway(remote, catalog, { ...draft, editing: true }), { kind: 'saved' });
  const ops = calls[0][2];
  assert.equal(ops[0].value, 'http://127.0.0.1:9000/v1');
  assert.notEqual(ops[1].value, oldRef);
  assert.match(ops[1].value, /^DSH_CREW_LOCAL_GATEWAY_[A-F0-9]{32}_API_KEY$/);
  assert.deepEqual(calls[1], ['credential', ops[1].value, 'fixture-key']);
});

test('a stale revision never writes a credential', async () => {
  const { remote, calls } = host({ conflict: true });
  assert.deepEqual(await saveWorkerGateway(remote, await loadWorkerGateways(remote), draft), { kind: 'conflict' });
  assert.deepEqual(calls.map(([operation]) => operation), ['settings']);
});

test('a partial save can retry the credential without touching settings', async () => {
  const { remote, calls } = host({ rejectKey: true });
  const result = await saveWorkerGateway(remote, await loadWorkerGateways(remote), draft);
  assert.equal(result.kind, 'credential-pending');
  assert.equal(calls[0][2][0].value.apiKeyEnv, result.ref);
  remote.credentials.set = async (...args) => {
    calls.push(['credential-retry', ...args]);
    return { ok: true };
  };
  assert.equal(await retryWorkerGatewayCredential(remote, result.ref, draft.apiKey), true);
  assert.deepEqual(calls.map(([operation]) => operation), ['settings', 'credential', 'credential-retry']);
});

test('hosts without writable provider settings leave the editor unavailable', async () => {
  const { remote, calls } = host({ writable: false });
  assert.equal(await loadWorkerGateways(remote), null);
  assert.equal(await loadWorkerGateways(undefined), null);
  assert.deepEqual(calls, []);
});
