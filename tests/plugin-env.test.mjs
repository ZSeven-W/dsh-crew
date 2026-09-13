// The DSH_ -> DSHPLUGIN_ migration contract (src/plugin-env.mjs).
//
// The rules under test are not cosmetic. DSH refuses to load any .env file
// that sets a DSH_-prefixed variable and aborts the host before plugins load,
// so the legacy names exist only to keep working shell exports alive — and a
// fallback that fires on an EMPTY new value would silently resurrect a stale
// override the user just tried to clear.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LEGACY_ENV_PREFIX,
  PLUGIN_ENV_PREFIX,
  legacyEnvName,
  pluginEnv,
  pluginEnvName,
  resetPluginEnvWarnings,
} from '../src/plugin-env.mjs';

/** Collect warnings instead of writing them to stderr. */
function capture() {
  const lines = [];
  return { lines, warn: (message) => lines.push(message) };
}

test('the new prefix does not collide with the reserved one', () => {
  // The whole point: DSH's blacklist matches names STARTING WITH "DSH_".
  assert.equal(PLUGIN_ENV_PREFIX.startsWith(LEGACY_ENV_PREFIX), false);
  assert.equal(pluginEnvName('CREW_HUB'), 'DSHPLUGIN_CREW_HUB');
  assert.equal(legacyEnvName('CREW_HUB'), 'DSH_CREW_HUB');
});

test('the new name wins, the legacy name is the fallback, absence is undefined', () => {
  resetPluginEnvWarnings();
  const sink = capture();
  assert.equal(
    pluginEnv('CREW_HUB', { env: { DSHPLUGIN_CREW_HUB: 'new', DSH_CREW_HUB: 'old' }, warn: sink.warn }),
    'new',
  );
  resetPluginEnvWarnings();
  assert.equal(pluginEnv('CREW_HUB', { env: { DSH_CREW_HUB: 'old' }, warn: sink.warn }), 'old');
  assert.equal(pluginEnv('CREW_HUB', { env: {}, warn: sink.warn }), undefined);
});

test('resolution is by presence, so an empty new value does NOT fall back', () => {
  resetPluginEnvWarnings();
  const sink = capture();
  // "I deliberately want no override here" must not resurrect the legacy value.
  assert.equal(
    pluginEnv('CREW_HUB', { env: { DSHPLUGIN_CREW_HUB: '', DSH_CREW_HUB: 'stale' }, warn: sink.warn }),
    '',
  );
});

test('a legacy variable warns exactly once per process, naming both sides', () => {
  resetPluginEnvWarnings();
  const sink = capture();
  const env = { DSH_CREW_HUB: 'old' };
  pluginEnv('CREW_HUB', { env, warn: sink.warn });
  pluginEnv('CREW_HUB', { env, warn: sink.warn });
  pluginEnv('CREW_HUB', { env, warn: sink.warn });
  assert.equal(sink.lines.length, 1);
  assert.match(sink.lines[0], /DSH_CREW_HUB/);
  assert.match(sink.lines[0], /DSHPLUGIN_CREW_HUB/);
  // The remedy must say REPLACE: adding the new name beside the old one in a
  // .env file still aborts the host, so "also set the new one" is wrong advice.
  assert.match(sink.lines[0], /REPLACE/);
});

test('the warning never prints the value (hub URLs and paths are not for logs)', () => {
  resetPluginEnvWarnings();
  const sink = capture();
  pluginEnv('CREW_HUB', {
    env: { DSH_CREW_HUB: 'http://secret.internal:9999/private' },
    warn: sink.warn,
  });
  assert.equal(sink.lines.length, 1);
  assert.equal(sink.lines[0].includes('secret.internal'), false);
});

test('a legacy variable still warns when the new name overrides it', () => {
  resetPluginEnvWarnings();
  const sink = capture();
  pluginEnv('CREW_HUB', { env: { DSHPLUGIN_CREW_HUB: 'new', DSH_CREW_HUB: 'old' }, warn: sink.warn });
  assert.equal(sink.lines.length, 1);
  assert.match(sink.lines[0], /takes precedence/);
});

test('a new-only variable is silent', () => {
  resetPluginEnvWarnings();
  const sink = capture();
  pluginEnv('CREW_HUB', { env: { DSHPLUGIN_CREW_HUB: 'new' }, warn: sink.warn });
  assert.deepEqual(sink.lines, []);
});
