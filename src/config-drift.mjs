// Which session defaults the saved config would now set differently.
//
// The MCP server seeds its session defaults from ~/.config/dsh-crew/config.json
// once, at startup (server.mjs): one server process is one Claude Code / Codex
// session, and dsh_worker_config overrides per session. That is deliberate,
// but an edit to the file (by hand or from the settings page) then does
// nothing for the running session, and nothing said so. This module only
// REPORTS the gap; it never changes what a session dispatches to. Issue #23.

import { isDeepStrictEqual } from 'node:util';

/** The config keys server.mjs copies into sessionConfig at startup. */
export const SESSION_SEEDED_KEYS = Object.freeze([
  'default_tier', 'default_effort', 'mode', 'default_timeout_seconds',
  'tier_policy', 'escalate_on_failure', 'preset_flash', 'preset_pro',
  'flash_provider', 'flash_model', 'pro_provider', 'pro_model',
]);

/** Normalize the way server.mjs / tier-binding.mjs read them: a blank route is the default, a blank or missing preset is 'default' (presetForTier treats both the same). */
function seeded(key, value) {
  if (/^(flash|pro)_(provider|model)$/.test(key)) return typeof value === 'string' ? value.trim() : '';
  if (key === 'preset_flash' || key === 'preset_pro') return value || 'default';
  return value;
}

/**
 * Keys whose saved value changed since the session started AND differs from
 * what the session uses now, so a change already applied with
 * dsh_worker_config is not reported again. `now` is a fresh readGlobalConfig():
 * exactly what a NEW session would start with (an unreadable file reads as
 * the defaults, for a new session too).
 *
 * @returns {Record<string, {at_start: unknown, now: unknown}>} empty when nothing drifted
 */
export function configDrift({ atStart, session, now, keys = SESSION_SEEDED_KEYS }) {
  const out = {};
  for (const key of keys) {
    const a = seeded(key, atStart?.[key]);
    const n = seeded(key, now?.[key]);
    const s = seeded(key, session?.[key]);
    // Deep comparison: readGlobalConfig passes values through unvalidated,
    // so a hand-edited file can put an object or array under any key, and two
    // parses of the same file must not read as a change.
    if (!isDeepStrictEqual(a, n) && !isDeepStrictEqual(s, n)) out[key] = { at_start: a, now: n };
  }
  return out;
}
