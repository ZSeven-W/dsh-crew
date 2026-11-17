// Config drift reporting (src/config-drift.mjs), issue #23.
//
// Session scope is deliberate: the MCP server seeds its session defaults
// from config.json once at startup, and dsh_worker_config overrides per
// session. The contract these tests pin down is that the drift note is a
// faithful, quiet signal: it fires only when the saved file would seed a
// NEW session differently from what THIS session uses now, it goes silent
// once the change is applied to the session, and it never fires for keys
// that are not session defaults.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SESSION_SEEDED_KEYS, configDrift } from '../src/config-drift.mjs';

test('no drift when start, session and file all agree', () => {
  const cfg = { flash_model: 'a', default_timeout_seconds: 1800 };
  assert.deepEqual(configDrift({ atStart: cfg, session: cfg, now: cfg }), {});
});

test('a saved change the session is not using is reported', () => {
  const drift = configDrift({
    atStart: { flash_model: 'a' },
    session: { flash_model: 'a' },
    now: { flash_model: 'b' },
  });
  assert.deepEqual(drift, { flash_model: { at_start: 'a', now: 'b' } });
});

test('a change already applied to the session is not reported', () => {
  assert.deepEqual(configDrift({
    atStart: { flash_model: 'a' },
    session: { flash_model: 'b' },
    now: { flash_model: 'b' },
  }), {});
});

test('reverting the file to the startup value is not drift', () => {
  assert.deepEqual(configDrift({
    atStart: { flash_model: 'a' },
    session: { flash_model: 'c' },
    now: { flash_model: 'a' },
  }), {});
});

test('a session override does not hide a different saved value', () => {
  const drift = configDrift({
    atStart: { flash_model: 'a' },
    session: { flash_model: 'c' },
    now: { flash_model: 'b' },
  });
  assert.deepEqual(drift, { flash_model: { at_start: 'a', now: 'b' } });
});

test('blank and missing route values normalize the same way', () => {
  assert.deepEqual(configDrift({
    atStart: {},
    session: { flash_provider: '' },
    now: { flash_provider: '   ' },
  }), {});
  assert.deepEqual(configDrift({
    atStart: { pro_model: ' x ' },
    session: { pro_model: 'x' },
    now: { pro_model: 'x' },
  }), {});
});

test('a missing preset and the default preset are the same', () => {
  assert.deepEqual(configDrift({
    atStart: {},
    session: { preset_flash: 'default' },
    now: { preset_flash: 'default' },
  }), {});
});

test('keys outside the session defaults are ignored', () => {
  assert.deepEqual(configDrift({
    atStart: { vision_provider: 'a', hub_url: 'http://x' },
    session: { vision_provider: 'a', hub_url: 'http://x' },
    now: { vision_provider: 'b', hub_url: 'http://y', custom_providers: [{ id: 'z' }] },
  }), {});
});

test('numeric and boolean session defaults are reported', () => {
  const drift = configDrift({
    atStart: { default_timeout_seconds: 1800, escalate_on_failure: false },
    session: { default_timeout_seconds: 1800, escalate_on_failure: false },
    now: { default_timeout_seconds: 600, escalate_on_failure: true },
  });
  assert.deepEqual(drift, {
    default_timeout_seconds: { at_start: 1800, now: 600 },
    escalate_on_failure: { at_start: false, now: true },
  });
});

// Wiring: the report has to be computed from the startup snapshot, the live
// session and a fresh read of the file — anything else (comparing against
// the session only, or a cached read) would mislabel deliberate session
// overrides as drift or miss edits entirely.

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const server = readFileSync(join(root, 'src/server.mjs'), 'utf8');

test('the handler compares startup snapshot, session and a fresh file read', () => {
  assert.ok(server.includes('configDrift({ atStart: globalDefaults, session: sessionConfig, now: readGlobalConfig() })'));
});

test('the handler exposes the drift as config_changed_since_start', () => {
  assert.ok(server.includes('config_changed_since_start: drift'));
});

test('SESSION_SEEDED_KEYS matches the keys server.mjs seeds from globalDefaults', () => {
  const init = server.slice(server.indexOf('const sessionConfig = {'), server.indexOf('};', server.indexOf('const sessionConfig = {')));
  const seeded = new Set([...init.matchAll(/globalDefaults\.(\w+)/g)].map((m) => m[1]));
  assert.deepEqual(seeded, new Set(SESSION_SEEDED_KEYS));
});

test('object and array values compare by content, not by instance', () => {
  // readGlobalConfig passes values through unvalidated, so a hand-edited
  // file can put an object under any key; two parses of the same file
  // produce different instances with the same content.
  assert.deepEqual(configDrift({
    atStart: { mode: { x: 1 }, escalate_on_failure: [] },
    session: { mode: { x: 1 }, escalate_on_failure: [] },
    now: { mode: { x: 1 }, escalate_on_failure: [] },
  }), {});
  assert.deepEqual(configDrift({
    atStart: { mode: { x: 1 } },
    session: { mode: { x: 1 } },
    now: { mode: { x: 2 } },
  }), { mode: { at_start: { x: 1 }, now: { x: 2 } } });
});

test('a blank preset and the default preset are the same', () => {
  // presetForTier resolves '' and 'default' identically (roster default).
  assert.deepEqual(configDrift({
    atStart: { preset_flash: 'default' },
    session: { preset_flash: 'default' },
    now: { preset_flash: '' },
  }), {});
  assert.deepEqual(configDrift({
    atStart: { preset_pro: '' },
    session: { preset_pro: 'default' },
    now: { preset_pro: 'default' },
  }), {});
});

test('no dotted globalDefaults read anywhere in server.mjs escapes the key list', () => {
  const all = new Set([...server.matchAll(/globalDefaults\.(\w+)/g)].map((m) => m[1]));
  assert.deepEqual(all, new Set(SESSION_SEEDED_KEYS));
});
