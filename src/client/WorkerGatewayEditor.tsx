import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { ModelField } from './model-field';
import type { ModelListState } from './model-field';
import {
  canonicalEndpoint, discoverGatewayModels, gatewayDiscoveryRequest,
  loadWorkerGateways, retryWorkerGatewayCredential, saveWorkerGateway,
  type GatewayCatalog, type GatewayDraft, type GatewayRemote, type GatewaySaveResult,
} from './worker-gateway';

const COPY = {
  zh: {
    title: '自定义 Worker 端点', endpoint: '已保存端点', newProvider: '＋ 新增端点', provider: 'Provider ID',
    base: 'Base URL', model: '模型 ID', append: '追加模型 ID（可选）', key: 'API Key（可选）',
    hint: '支持 OpenAI 兼容的 Chat Completions。密钥存入 DSH 凭据库；同一地址留空可保留已有密钥。',
    unavailable: '此 DSH 实例的 Provider 配置不可写。', refresh: '重新读取',
    save: '保存端点', retry: '重试保存密钥', saving: '保存中…', loading: '正在读取…',
    saved: '端点已保存。', 'credential-pending': '端点已保存，密钥写入失败。可以重试保存密钥。',
    'invalid-id': 'Provider ID 请使用小写字母开头，可包含数字和连字符。',
    'invalid-url': '请输入 HTTP 或 HTTPS 地址，地址中请勿包含凭据、查询参数或片段。',
    'invalid-model': '新增端点时请填写模型 ID。', 'key-required': '更换已鉴权端点的地址时，请填写新地址使用的密钥。',
    'id-taken': '该 Provider ID 已被使用。',
    conflict: '配置已变化。请核对后重新保存。', failed: '保存失败，请重试。',
    fetch: '获取模型列表', fetching: '获取中…', manual: '手动输入模型 ID', pick: '从列表选择模型',
    modelBlank: '— 不追加 —',
    modelsEmpty: '没有可用模型，可手动填写。', modelsMissing: '未在 DSH 中找到该端点，可手动填写。',
    modelsUnsupported: '当前 DSH 不支持模型列表，请手动填写。', modelsFailed: '无法获取模型列表，可手动填写。',
    modelsUnauthorized: '鉴权失败，请检查 API Key 后重试。',
  },
  en: {
    title: 'Custom worker endpoint', endpoint: 'Saved endpoint', newProvider: '＋ Add an endpoint', provider: 'Provider ID',
    base: 'Base URL', model: 'Model ID', append: 'Add model ID (optional)', key: 'API key (optional)',
    hint: 'Supports OpenAI-compatible Chat Completions. DSH stores the key in its credential store; leave it blank to keep the key for the same URL.',
    unavailable: 'This DSH instance has no writable provider configuration.', refresh: 'Reload',
    save: 'Save endpoint', retry: 'Retry storing key', saving: 'Saving…', loading: 'Loading…',
    saved: 'Endpoint saved.', 'credential-pending': 'The endpoint was saved. Retry storing the key.',
    'invalid-id': 'Start the provider ID with a lowercase letter. Use lowercase letters, digits and hyphens.',
    'invalid-url': 'Enter an HTTP or HTTPS URL without credentials, a query or a fragment.',
    'invalid-model': 'Enter the model ID for the new endpoint.', 'key-required': 'Enter the key for the new URL when changing an authenticated endpoint.',
    'id-taken': 'This provider ID is already in use.',
    conflict: 'The configuration changed. Review your draft and save again.', failed: 'Could not save. Try again.',
    fetch: 'Fetch models', fetching: 'Fetching…', manual: 'Enter a model ID manually', pick: 'Pick a model from the list',
    modelBlank: '— Do not add —',
    modelsEmpty: 'No models available; enter one manually.', modelsMissing: 'This endpoint is not configured in DSH; enter a model manually.',
    modelsUnsupported: 'This DSH build cannot list models; enter one manually.', modelsFailed: 'Could not list models; enter one manually.',
    modelsUnauthorized: 'Authentication failed. Check the API key and try again.',
  },
};

const EMPTY_DRAFT: GatewayDraft = { id: '', baseURL: '', modelId: '', apiKey: '', editing: false };
type Styles = Record<'field' | 'fieldLabel' | 'input' | 'btn', CSSProperties>;

export function WorkerGatewayEditor({ locale, remote, styles, onSaved, discoverSaved }: {
  locale: string;
  remote: GatewayRemote | null;
  styles: Styles;
  onSaved: () => void;
  discoverSaved: (provider: string, revision: number) => Promise<ModelListState>;
}) {
  const copy = COPY[locale === 'zh' ? 'zh' : 'en'];
  const [catalog, setCatalog] = useState<GatewayCatalog | null | undefined>();
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [notice, setNotice] = useState<keyof typeof copy | null>(null);
  const [modelState, setModelState] = useState<{ seq: number; state: ModelListState } | null>(null);
  const seq = useRef(0);
  const reload = useCallback(async () => {
    try {
      setCatalog(remote ? await loadWorkerGateways(remote) : null);
    } catch {
      setCatalog(null);
    }
  }, [remote]);
  useEffect(() => { void reload(); }, [reload]);

  function updateDraft(patch: Partial<GatewayDraft>): void {
    if ('id' in patch || 'baseURL' in patch || 'apiKey' in patch) seq.current += 1;
    setDraft(current => ({ ...current, ...patch }));
    setNotice(current => current === null || current === 'credential-pending' ? current : null);
  }

  function selectProvider(id: string): void {
    const selected = catalog?.providers.find(provider => provider.id === id);
    seq.current += 1;
    setDraft(selected ? { ...EMPTY_DRAFT, id, baseURL: selected.baseURL, editing: true } : EMPTY_DRAFT);
    setModelState(selected === undefined ? null : {
      seq: seq.current,
      state: selected.modelIds.length === 0
        ? { kind: 'empty' }
        : { kind: 'ready', models: selected.modelIds.map(modelId => ({ id: modelId })) },
    });
    setNotice(null);
  }

  async function fetchModels(): Promise<void> {
    if (!remote) return;
    const at = seq.current;
    const source = draft;
    setModelState({ seq: at, state: { kind: 'loading' } });
    const fresh = source.editing && !source.apiKey.trim() ? await loadWorkerGateways(remote).catch(() => null) : null;
    if (seq.current !== at) return;
    const request = gatewayDiscoveryRequest(source, fresh);
    let state: ModelListState = { kind: 'failed' };
    if (request?.provider && fresh) {
      state = await discoverSaved(request.provider, fresh.revision).catch(() => ({ kind: 'failed' }));
    } else if (request) {
      state = await discoverGatewayModels(remote, request);
    }
    if (seq.current !== at) return;
    setModelState({ seq: at, state });
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!remote || !catalog || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      let result: GatewaySaveResult;
      if (pendingRef !== null) {
        const stored = await retryWorkerGatewayCredential(remote, pendingRef, draft.apiKey);
        result = stored ? { kind: 'saved' } : { kind: 'credential-pending', ref: pendingRef };
      } else {
        result = await saveWorkerGateway(remote, catalog, draft);
      }
      setNotice(result.kind);
      if (result.kind === 'credential-pending') {
        setPendingRef(result.ref);
      } else if (result.kind === 'saved') {
        setPendingRef(null);
        seq.current += 1;
        setDraft({ ...draft, id: draft.id.trim(), modelId: '', apiKey: '', editing: true });
        setModelState(null);
        await reload();
        onSaved();
      } else if (result.kind === 'conflict') {
        await reload();
      }
    } catch {
      setNotice('failed');
    } finally {
      setBusy(false);
    }
  }

  const input = { ...styles.input, width: '100%', minWidth: 0, boxSizing: 'border-box' as const };
  const locked = busy || pendingRef !== null;
  const modelList: ModelListState = modelState?.seq === seq.current ? modelState.state : { kind: 'idle' };
  const noticeColor = notice === 'saved' ? 'light-dark(#166e39, #7bd99a)'
    : notice === 'credential-pending' ? 'light-dark(#805000, #f0bf65)' : 'light-dark(#aa2727, #ff9a9a)';
  return (
    <section aria-label={copy.title}
      style={{ borderTop: '1px solid rgba(128,128,128,0.16)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      {!remote || catalog === null
        ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
          <span>{copy.unavailable}</span>
          {remote && <button type="button" style={styles.btn} onClick={() => void reload()}>{copy.refresh}</button>}
        </div>
        : catalog === undefined ? <div role="status" style={{ fontSize: 12, opacity: 0.6 }}>{copy.loading}</div>
          : <form aria-label={copy.title} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }} onSubmit={submit}>
            <div className="dsh-crew-gateway-fields">
              <label style={styles.field}><span style={styles.fieldLabel}>{copy.endpoint}</span>
                <span className="dsh-crew-select">
                  <select style={{ ...input, paddingRight: 24 }} disabled={locked} value={draft.editing ? draft.id : ''}
                    onChange={(event) => selectProvider(event.target.value)}>
                    <option value="">{copy.newProvider}</option>
                    {catalog.providers.map(provider => <option key={provider.id} value={provider.id}>{provider.id}</option>)}
                    {draft.editing && draft.id !== '' && !catalog.providers.some(provider => provider.id === draft.id)
                      && <option value={draft.id}>{draft.id}</option>}
                  </select>
                </span>
              </label>
              {!draft.editing && <label style={styles.field}><span style={styles.fieldLabel}>{copy.provider}</span>
                <input style={input} required autoComplete="off" disabled={locked} value={draft.id}
                  onChange={(event) => updateDraft({ id: event.target.value })} /></label>}
              <label style={styles.field}><span style={styles.fieldLabel}>{copy.base}</span>
                <input style={input} required type="url" placeholder="https://gateway.example/v1" autoComplete="off" disabled={locked}
                  value={draft.baseURL} onChange={(event) => updateDraft({ baseURL: event.target.value })} /></label>
              <label style={styles.field}><span style={styles.fieldLabel}>{copy.key}</span>
                <input style={input} type="password" autoComplete="new-password" disabled={busy}
                  value={draft.apiKey} onChange={(event) => updateDraft({ apiKey: event.target.value })} /></label>
            <div style={{ ...styles.field, gridColumn: draft.editing ? undefined : '1 / -1', minWidth: 0 }}>
              <span style={styles.fieldLabel}>{draft.editing ? copy.append : copy.model}</span>
              <ModelField key={draft.editing ? draft.id : 'new-provider'} value={draft.modelId}
                onChange={(value) => updateDraft({ modelId: value })}
                list={modelList} onFetch={() => void fetchModels()}
                fetchDisabled={canonicalEndpoint(draft.baseURL) === null}
                disabled={locked} required={!draft.editing} ariaLabel={draft.editing ? copy.append : copy.model}
                copy={{
                  fetch: copy.fetch, fetching: copy.fetching, manual: copy.manual, pick: copy.pick,
                  blank: copy.modelBlank, empty: copy.modelsEmpty, missing: copy.modelsMissing,
                  failed: copy.modelsFailed, unsupported: copy.modelsUnsupported, unauthorized: copy.modelsUnauthorized,
                }}
                styles={styles} />
            </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button type="submit" style={styles.btn} disabled={busy || (pendingRef !== null && !draft.apiKey.trim())}>
                {busy ? copy.saving : pendingRef ? copy.retry : copy.save}
              </button>
              {notice && <span role={notice === 'saved' ? 'status' : 'alert'} style={{ fontSize: 12, color: noticeColor }}>{copy[notice]}</span>}
            </div>
            <span style={{ fontSize: 11.5, opacity: 0.55, lineHeight: 1.5 }}>{copy.hint}</span>
          </form>}
    </section>
  );
}
