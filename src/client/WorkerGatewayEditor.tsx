import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import {
  loadWorkerGateways, retryWorkerGatewayCredential, saveWorkerGateway,
  type GatewayCatalog, type GatewayDraft, type GatewayRemote, type GatewaySaveResult,
} from './worker-gateway';

const COPY = {
  zh: {
    title: '自定义 Worker 端点', newProvider: '新增 Provider', provider: 'Provider ID',
    base: 'Base URL', model: '模型 ID', append: '追加模型 ID（可选）', key: 'API Key（可选）',
    hint: '支持 OpenAI 兼容的 Chat Completions。密钥存入 DSH 凭据库。原地址继续使用时，留空可保留已有密钥。',
    unavailable: '此 DSH 实例的 Provider 配置不可写。', refresh: '重新读取',
    save: '保存端点', retry: '重试保存密钥', saving: '保存中…', loading: '正在读取…',
    saved: '已保存，可在下方选择该 Provider。', 'credential-pending': '端点已保存，密钥写入失败。可以重试保存密钥。',
    'invalid-id': 'Provider ID 请使用小写字母开头，可包含数字和连字符。',
    'invalid-url': '请输入 HTTP 或 HTTPS 地址，地址中请勿包含凭据、查询参数或片段。',
    'invalid-model': '新增端点时请填写模型 ID。', 'key-required': '更换已鉴权端点的地址时，请填写新地址使用的密钥。',
    'id-taken': '该 Provider ID 已被使用。',
    conflict: '配置已变化。请核对后重新保存。', failed: '保存失败，请重试。',
  },
  en: {
    title: 'Custom worker endpoint', newProvider: 'Add a provider', provider: 'Provider ID',
    base: 'Base URL', model: 'Model ID', append: 'Add model ID (optional)', key: 'API key (optional)',
    hint: 'Supports OpenAI-compatible Chat Completions. DSH stores the key in its credential store. Leave it blank to keep the key for the same URL.',
    unavailable: 'This DSH instance has no writable provider configuration.', refresh: 'Reload',
    save: 'Save endpoint', retry: 'Retry storing key', saving: 'Saving…', loading: 'Loading…',
    saved: 'Saved. Select this provider below.', 'credential-pending': 'The endpoint was saved. Retry storing the key.',
    'invalid-id': 'Start the provider ID with a lowercase letter. Use lowercase letters, digits and hyphens.',
    'invalid-url': 'Enter an HTTP or HTTPS URL without credentials, a query or a fragment.',
    'invalid-model': 'Enter the model ID for the new endpoint.', 'key-required': 'Enter the key for the new URL when changing an authenticated endpoint.',
    'id-taken': 'This provider ID is already in use.',
    conflict: 'The configuration changed. Review your draft and save again.', failed: 'Could not save. Try again.',
  },
};

const EMPTY_DRAFT: GatewayDraft = { id: '', baseURL: '', modelId: '', apiKey: '', editing: false };
type Styles = Record<'blockGrid' | 'field' | 'fieldLabel' | 'input' | 'btn', CSSProperties>;

export function WorkerGatewayEditor({ locale, remote, styles, onSaved }: {
  locale: string;
  remote: GatewayRemote | null;
  styles: Styles;
  onSaved: () => void;
}) {
  const copy = COPY[locale === 'zh' ? 'zh' : 'en'];
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<GatewayCatalog | null | undefined>();
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [notice, setNotice] = useState<keyof typeof copy | null>(null);
  const reload = useCallback(async () => {
    try {
      setCatalog(remote ? await loadWorkerGateways(remote) : null);
    } catch {
      setCatalog(null);
    }
  }, [remote]);
  useEffect(() => { if (open) void reload(); }, [open, reload]);

  function selectProvider(id: string) {
    const selected = catalog?.providers.find(provider => provider.id === id);
    setDraft(selected ? { ...EMPTY_DRAFT, id, baseURL: selected.baseURL, editing: true } : EMPTY_DRAFT);
    setNotice(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!remote || !catalog || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      let result: GatewaySaveResult;
      if (pendingRef) {
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
        setDraft({ ...draft, id: draft.id.trim(), modelId: '', apiKey: '', editing: true });
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

  const input = { ...styles.input, width: '100%', boxSizing: 'border-box' as const };
  const locked = busy || pendingRef !== null;
  return (
    <details style={{ gridColumn: '1 / -1' }} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>{copy.title}</summary>
      {!remote || catalog === null
        ? <p style={{ fontSize: 12 }}>{copy.unavailable}{' '}
          {remote && <button type="button" style={styles.btn} onClick={() => void reload()}>{copy.refresh}</button>}</p>
        : catalog === undefined ? <p style={{ fontSize: 12 }}>{copy.loading}</p>
          : <form aria-label={copy.title} style={{ ...styles.blockGrid, marginTop: 10 }} onSubmit={submit}>
            <p style={{ gridColumn: '1 / -1', margin: 0, fontSize: 11.5 }}>{copy.hint}</p>
            <label style={{ ...styles.field, gridColumn: '1 / -1' }}>
              <span style={styles.fieldLabel}>{copy.provider}</span>
              <select style={input} disabled={locked} value={draft.editing ? draft.id : ''} onChange={(e) => selectProvider(e.target.value)}>
                <option value="">{copy.newProvider}</option>
                {catalog.providers.map(provider => <option key={provider.id}>{provider.id}</option>)}
              </select>
            </label>
            {!draft.editing && <label style={styles.field}><span style={styles.fieldLabel}>{copy.provider}</span>
              <input style={input} required autoComplete="off" disabled={locked} value={draft.id}
                onChange={(e) => setDraft({ ...draft, id: e.target.value })} /></label>}
            <label style={styles.field}><span style={styles.fieldLabel}>{copy.base}</span>
              <input style={input} required type="url" placeholder="https://gateway.example/v1" autoComplete="off" disabled={locked}
                value={draft.baseURL} onChange={(e) => setDraft({ ...draft, baseURL: e.target.value })} /></label>
            <label style={styles.field}><span style={styles.fieldLabel}>{draft.editing ? copy.append : copy.model}</span>
              <input style={input} required={!draft.editing} autoComplete="off" disabled={locked}
                value={draft.modelId} onChange={(e) => setDraft({ ...draft, modelId: e.target.value })} /></label>
            <label style={styles.field}><span style={styles.fieldLabel}>{copy.key}</span>
              <input style={input} type="password" autoComplete="new-password" disabled={busy}
                value={draft.apiKey} onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })} /></label>
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" style={styles.btn} disabled={busy || (pendingRef !== null && !draft.apiKey.trim())}>
                {busy ? copy.saving : pendingRef ? copy.retry : copy.save}
              </button>
              {notice && <span role="status" style={{ marginLeft: 8, fontSize: 12 }}>{copy[notice]}</span>}
            </div>
          </form>}
    </details>
  );
}
