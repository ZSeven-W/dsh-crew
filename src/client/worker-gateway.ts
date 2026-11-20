const NAMESPACE = 'llm-pi-ai';
const PROTOCOL = 'openai-completions';
const PROVIDER_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

type Reply<T> = { ok: true; value: T } | { ok: false; error: { code: string; message?: string } };
type ModelProfile = { id: string; [key: string]: unknown };
type ProviderProfile = {
  api?: string;
  baseURL?: string;
  apiKeyEnv?: string;
  models?: ModelProfile[];
};
type Namespace = {
  ns: string;
  revision: number;
  value: { providers?: Record<string, ProviderProfile> };
};
type SettingOp = { op: 'set'; path: string[]; value: unknown };
export type WorkerRoute = { provider: string; model: string };

export type GatewayRemote = {
  settings: {
    describe(): Promise<Reply<{ writable: boolean; namespaces: Namespace[] }>>;
    mutate(ns: string, ops: SettingOp[], expectedRevision: number): Promise<Reply<Namespace>>;
  };
  llm: {
    listProviders(): Promise<Reply<{ id: string }[]>>;
    listConfigurableProviders(): Promise<Reply<{ provider: string }[]>>;
    discoverModels?(settingsNs: string, request: Omit<DiscoveryRequest, 'provider'>, signal?: AbortSignal): Promise<Reply<DiscoveredModel[]>>;
  };
  credentials: {
    set(ref: string, key: string): Promise<Reply<unknown>>;
  };
};

export type GatewayProvider = {
  id: string;
  baseURL: string;
  modelIds: string[];
  models: ModelProfile[];
  apiKeyEnv?: string;
};

export type GatewayCatalog = {
  revision: number;
  providers: GatewayProvider[];
  taken: string[];
};

export type GatewayDraft = {
  id: string;
  baseURL: string;
  modelId: string;
  apiKey: string;
  editing: boolean;
};

export type DiscoveredModel = { id: string; name?: string };

export type DiscoveryRequest = {
  baseURL: string;
  api: string;
  provider?: string;
  apiKey?: string;
};

export type DiscoveryOutcome =
  | { kind: 'ready'; models: DiscoveredModel[] }
  | { kind: 'empty' }
  | { kind: 'unsupported' }
  | { kind: 'unauthorized' }
  | { kind: 'failed' };

export type GatewaySaveResult =
  | { kind: 'saved' }
  | { kind: 'credential-pending'; ref: string }
  | { kind: 'invalid-id' | 'invalid-url' | 'invalid-model' | 'key-required' | 'id-taken' | 'conflict' | 'failed' };

export async function loadWorkerGateways(remote: GatewayRemote): Promise<GatewayCatalog | null> {
  if (!remote?.settings || !remote.llm || !remote.credentials) return null;
  const [settings, active, directory] = await Promise.all([
    remote.settings.describe(), remote.llm.listProviders(), remote.llm.listConfigurableProviders(),
  ]);
  if (!settings.ok || !settings.value.writable || !active.ok || !directory.ok) return null;
  const view = settings.value.namespaces.find(entry => entry.ns === NAMESPACE);
  if (!view) return null;
  const profiles = Object.entries(view.value.providers ?? {});
  return {
    revision: view.revision,
    providers: profiles.flatMap(([id, profile]) => {
      if (profile.api !== PROTOCOL || !profile.baseURL) return [];
      const models = profile.models ?? [];
      return [{ id, baseURL: profile.baseURL, modelIds: models.map(model => model.id), models, apiKeyEnv: profile.apiKeyEnv }];
    }),
    taken: [...new Set([
      ...profiles.map(([id]) => id),
      ...active.value.map(entry => entry.id),
      ...directory.value.map(entry => entry.provider),
    ])],
  };
}

export function canonicalEndpoint(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export async function retryWorkerGatewayCredential(remote: GatewayRemote, ref: string, apiKey: string): Promise<boolean> {
  const key = apiKey.trim();
  if (!key) return false;
  try {
    return (await remote.credentials.set(ref, key)).ok;
  } catch {
    return false;
  }
}

export async function saveWorkerGateway(
  remote: GatewayRemote, catalog: GatewayCatalog, draft: GatewayDraft,
): Promise<GatewaySaveResult> {
  const id = draft.id.trim();
  if (!PROVIDER_ID.test(id)) return { kind: 'invalid-id' };
  const baseURL = canonicalEndpoint(draft.baseURL);
  if (!baseURL) return { kind: 'invalid-url' };

  const existing = catalog.providers.find(provider => provider.id === id);
  if (draft.editing && !existing) return { kind: 'conflict' };
  if (!draft.editing && catalog.taken.includes(id)) return { kind: 'id-taken' };
  const model = draft.modelId.trim();
  if (!existing && !model) return { kind: 'invalid-model' };
  const apiKey = draft.apiKey.trim();
  const endpointChanged = existing !== undefined && baseURL !== canonicalEndpoint(existing.baseURL);
  if (endpointChanged && existing.apiKeyEnv && !apiKey) return { kind: 'key-required' };
  const stem = `DSH_CREW_${id.toUpperCase().replaceAll('-', '_')}`;
  const ref = apiKey
    ? `${stem}_${crypto.randomUUID().replaceAll('-', '').toUpperCase()}_API_KEY`
    : undefined;
  const path = ['providers', id];
  const ops: SettingOp[] = [];

  if (existing) {
    if (endpointChanged) ops.push({ op: 'set', path: [...path, 'baseURL'], value: baseURL });
    if (model && !existing.modelIds.includes(model)) {
      ops.push({ op: 'set', path: [...path, 'models'], value: [...existing.models, { id: model }] });
    }
    if (ref) ops.push({ op: 'set', path: [...path, 'apiKeyEnv'], value: ref });
  } else {
    ops.push({ op: 'set', path, value: {
      api: PROTOCOL, baseURL, models: [{ id: model }],
      ...(ref ? { apiKeyEnv: ref } : {}),
    } });
  }
  if (ops.length === 0) return { kind: 'saved' };

  const written = await remote.settings.mutate(NAMESPACE, ops, catalog.revision);
  if (written.ok === false) return { kind: written.error.code === 'settings/conflict' ? 'conflict' : 'failed' };
  if (ref && !await retryWorkerGatewayCredential(remote, ref, apiKey)) return { kind: 'credential-pending', ref };
  return { kind: 'saved' };
}

export function gatewayDiscoveryRequest(
  draft: GatewayDraft, catalog: GatewayCatalog | null,
): DiscoveryRequest | null {
  const baseURL = canonicalEndpoint(draft.baseURL);
  if (baseURL === null) return null;
  const apiKey = draft.apiKey.trim();
  if (apiKey !== '') return { baseURL, api: PROTOCOL, apiKey };
  const saved = draft.editing && catalog !== null
    ? catalog.providers.find(provider => provider.id === draft.id.trim() && canonicalEndpoint(provider.baseURL) === baseURL)
    : undefined;
  return saved === undefined
    ? { baseURL, api: PROTOCOL }
    : { baseURL, api: PROTOCOL, provider: saved.id };
}

function normalizeDiscovered(value: unknown): DiscoveredModel[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const models: DiscoveredModel[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const id = (entry as { id?: unknown }).id;
    if (typeof id !== 'string') continue;
    const trimmed = id.trim();
    if (trimmed === '' || seen.has(trimmed)) continue;
    seen.add(trimmed);
    const name = (entry as { name?: unknown }).name;
    models.push(typeof name === 'string' && name.trim() !== '' ? { id: trimmed, name: name.trim() } : { id: trimmed });
  }
  return models;
}

function discoveryUnsupported(reply: { error?: { code?: string; message?: string } }): boolean {
  const code = reply.error?.code ?? '';
  const message = reply.error?.message ?? '';
  return code === 'NO_DISCOVERY'
    || /no model discovery is registered|has no model listing|DISCOVERY_UNSUPPORTED/u.test(message);
}

export async function discoverGatewayModels(
  remote: GatewayRemote, request: DiscoveryRequest,
): Promise<DiscoveryOutcome> {
  if (typeof remote?.llm?.discoverModels !== 'function') return { kind: 'unsupported' };
  let reply: Reply<DiscoveredModel[]>;
  try {
    const { baseURL, api, apiKey } = request;
    reply = await remote.llm.discoverModels(NAMESPACE, { baseURL, api, ...(apiKey ? { apiKey } : {}) }, AbortSignal.timeout(15000));
  } catch {
    return { kind: 'failed' };
  }
  if (!reply) return { kind: 'failed' };
  if (reply.ok === false) {
    if (/\banswered (401|403)\b/.test(reply.error.message ?? '')) return { kind: 'unauthorized' };
    return discoveryUnsupported(reply) ? { kind: 'unsupported' } : { kind: 'failed' };
  }
  const models = normalizeDiscovered(reply.value);
  return models.length === 0 ? { kind: 'empty' } : { kind: 'ready', models };
}
