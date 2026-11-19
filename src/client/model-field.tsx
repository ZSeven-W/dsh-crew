import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

export type ModelOption = { id: string; name?: string };

export type ModelListState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; models: ModelOption[] }
  | { kind: 'empty' }
  | { kind: 'missing' }
  | { kind: 'unsupported' }
  | { kind: 'unauthorized' }
  | { kind: 'failed' };

export type ModelFieldCopy = {
  fetch: string;
  fetching: string;
  manual: string;
  pick: string;
  blank: string;
  empty: string;
  missing: string;
  failed: string;
  unsupported: string;
  unauthorized: string;
};

type ModelFieldStyles = {
  input: CSSProperties;
  btn: CSSProperties;
};

function statusText(list: ModelListState, copy: ModelFieldCopy): string | null {
  if (list.kind === 'empty') return copy.empty;
  if (list.kind === 'missing') return copy.missing;
  if (list.kind === 'unsupported') return copy.unsupported;
  if (list.kind === 'unauthorized') return copy.unauthorized;
  if (list.kind === 'failed') return copy.failed;
  return null;
}

export function ModelField({
  value, onChange, list, onFetch, fetchDisabled, disabled, required, placeholder, copy, styles, ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  list: ModelListState;
  onFetch?: () => void;
  fetchDisabled?: boolean;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  copy: ModelFieldCopy;
  styles: ModelFieldStyles;
  ariaLabel: string;
}) {
  const [manual, setManual] = useState(false);
  const ready = list.kind === 'ready';
  const models = ready ? list.models : [];
  const busy = list.kind === 'loading';
  useEffect(() => { if (!ready) setManual(false); }, [ready]);
  const pick = ready && !manual;
  const known = value === '' || models.some(model => model.id === value);
  const status = statusText(list, copy);
  const controlStyle = { ...styles.input, width: '100%', minWidth: 0, boxSizing: 'border-box' as const };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {pick ? (
          <span className="dsh-crew-select">
            <select aria-label={ariaLabel} value={value} title={value || undefined} disabled={disabled} required={required}
              onChange={(event) => onChange(event.target.value)} style={{ ...controlStyle, paddingRight: 24 }}>
              <option value="">{copy.blank}</option>
              {models.map(model => (
                <option key={model.id} value={model.id} title={model.name}>{model.id}</option>
              ))}
              {!known && <option value={value}>{value}</option>}
            </select>
          </span>
        ) : (
          <input aria-label={ariaLabel} value={value} disabled={disabled} required={required} placeholder={placeholder}
            autoComplete="off" spellCheck={false}
            onChange={(event) => onChange(event.target.value)} style={controlStyle} />
        )}
        {ready && (
          <button type="button" disabled={disabled} aria-label={pick ? copy.manual : copy.pick}
            title={pick ? copy.manual : copy.pick}
            style={{ ...styles.btn, padding: '3px 8px', flexShrink: 0 }}
            onClick={() => setManual(current => !current)}>
            <span aria-hidden="true">{pick ? '✎' : '▾'}</span>
          </button>
        )}
        {onFetch && (
          <button type="button" disabled={disabled || fetchDisabled || busy}
            aria-busy={busy || undefined}
            style={{ ...styles.btn, flexShrink: 0, whiteSpace: 'nowrap' }}
            onClick={onFetch}>
            {busy ? copy.fetching : copy.fetch}
          </button>
        )}
      </div>
      {status && <div role="status" style={{ fontSize: 11, opacity: 0.62, lineHeight: 1.4 }}>{status}</div>}
    </div>
  );
}
