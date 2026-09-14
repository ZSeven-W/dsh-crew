// The tier binding has to REACH a dispatch, in both backends.
//
// tier-binding.test.mjs proves the resolver is correct; it proves nothing
// about whether anything calls it. These checks read the dispatch sites
// themselves, so a new call site added later without the binding — which
// would silently pin that path back to DeepSeek while the config claims
// otherwise — fails here instead of in production. Issue #10.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (p) => readFileSync(join(root, p), 'utf8');
const server = read('src/server.mjs');
const hub = read('src/hub/index.mjs');
const jobs = read('src/jobs.mjs');

/** Every line that opens this call must also pass the binding. */
function callSitesCarryBinding(source, needle) {
  const lines = source.split('\n').filter((l) => l.includes(needle));
  return lines.length > 0 && lines.every((l) => l.includes('bindingForTier'));
}

test('every hub dispatch carries the tier binding', () => {
  assert.ok(callSitesCarryBinding(server, 'hub.spawn({'));
});

test('every standalone dispatch carries the tier binding', () => {
  assert.ok(callSitesCarryBinding(server, 'startJob({'));
});

test('the hub no longer keeps its own tier -> model table', () => {
  assert.equal(hub.includes('TIER_MODELS'), false);
  assert.ok(hub.includes('resolveTierBinding'));
});

test('the hub hands the resolved route to the model selection and to agents.create', () => {
  assert.ok(hub.includes('provider: resolvedProvider, model: resolvedModel'));
  assert.ok(hub.includes('provider: selection.provider, model: selection.model'));
});

test('the standalone harness gets the resolved route, not a hardcoded provider', () => {
  assert.ok(jobs.includes('provider: dispatchProvider'));
  assert.ok(jobs.includes('model: dispatchModel'));
  assert.equal(jobs.includes("provider: 'deepseek-official',"), false);
});

test('the config tool can enumerate what the host has, and says so when it cannot', () => {
  // available_providers must be null (not []) in standalone mode: "we cannot
  // see them" is not "there are none".
  assert.ok(server.includes('available_providers: available'));
  assert.ok(server.includes('const available = reachable ?'));
  assert.ok(server.includes(': null;'));
});

test('a tier bound to a custom route carries the unverified-route caveat', () => {
  // Being listed by listProviders() means an adapter is registered, not that
  // it can serve an agent call: dispatching to the vision re-routing adapter
  // fails with "registration.adapter.prepareCall is not a function" (measured
  // on a live host). Neither does DSH report tool-calling support anywhere.
  // The caveat stands until a real probe exists (#10).
  assert.ok(server.includes('route_caveat'));
  assert.ok(server.includes('prepareCall'));
});
