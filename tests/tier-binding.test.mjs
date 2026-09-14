// Tier -> LLM route binding (src/tier-binding.mjs), issue #10.
//
// The contract these tests pin down is "a blank value is not a configuration".
// Every field here reaches a real dispatch: a tier that resolved to provider
// "" or model "" would not fall back, it would ask the host to route to
// nothing, and the failure would surface deep inside the agent runtime rather
// than at the config call that caused it.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TIER_BINDING,
  TIERS,
  describeBindings,
  isCustomBinding,
  resolveTierBinding,
} from '../src/tier-binding.mjs';

test('an empty config keeps the shipped DeepSeek routes', () => {
  assert.deepEqual(resolveTierBinding('flash', {}), { provider: 'deepseek-official', model: 'deepseek-v4-flash' });
  assert.deepEqual(resolveTierBinding('pro', {}), { provider: 'deepseek-official', model: 'deepseek-v4-pro' });
  assert.deepEqual(resolveTierBinding('flash'), { ...DEFAULT_TIER_BINDING.flash });
});

test('a bound tier dispatches to the named route', () => {
  const cfg = { flash_provider: 'ollama', flash_model: 'qwen3:8b' };
  assert.deepEqual(resolveTierBinding('flash', cfg), { provider: 'ollama', model: 'qwen3:8b' });
  // Binding one tier must not move the other.
  assert.deepEqual(resolveTierBinding('pro', cfg), { ...DEFAULT_TIER_BINDING.pro });
});

test('provider and model are independent', () => {
  // Same endpoint, different model: naming only the model keeps the provider.
  assert.deepEqual(
    resolveTierBinding('flash', { flash_model: 'deepseek-v4-pro' }),
    { provider: 'deepseek-official', model: 'deepseek-v4-pro' },
  );
  // A gateway serving the same model id: naming only the provider keeps the model.
  assert.deepEqual(
    resolveTierBinding('pro', { pro_provider: 'my-gateway' }),
    { provider: 'my-gateway', model: 'deepseek-v4-pro' },
  );
});

test('blank and whitespace are not configurations — they fall back, never dispatch to ""', () => {
  for (const blank of ['', '   ', '\t', '\n']) {
    const resolved = resolveTierBinding('flash', { flash_provider: blank, flash_model: blank });
    assert.deepEqual(resolved, { ...DEFAULT_TIER_BINDING.flash }, `blank ${JSON.stringify(blank)}`);
    assert.notEqual(resolved.provider, '');
    assert.notEqual(resolved.model, '');
  }
});

test('a configured value is trimmed, so a stray space cannot invent a route', () => {
  assert.deepEqual(
    resolveTierBinding('flash', { flash_provider: '  ollama  ', flash_model: ' qwen3:8b ' }),
    { provider: 'ollama', model: 'qwen3:8b' },
  );
});

test('non-string config values are ignored rather than coerced', () => {
  // A settings surface that writes null/0/false must not produce provider "null".
  for (const junk of [null, undefined, 0, false, 42, {}, []]) {
    assert.deepEqual(
      resolveTierBinding('pro', { pro_provider: junk, pro_model: junk }),
      { ...DEFAULT_TIER_BINDING.pro },
      `junk ${JSON.stringify(junk)}`,
    );
  }
});

test('an unknown tier is refused, not silently defaulted', () => {
  assert.throws(() => resolveTierBinding('turbo', {}), /unknown tier "turbo"/);
  assert.throws(() => resolveTierBinding(undefined, {}), /unknown tier/);
});

test('isCustomBinding reports only a real departure from the default', () => {
  assert.equal(isCustomBinding('flash', {}), false);
  assert.equal(isCustomBinding('flash', { flash_provider: '' }), false);
  assert.equal(isCustomBinding('flash', { flash_provider: 'ollama' }), true);
  assert.equal(isCustomBinding('flash', { flash_model: 'qwen3:8b' }), true);
  // Spelling the default out explicitly is still the default.
  assert.equal(
    isCustomBinding('pro', { pro_provider: 'deepseek-official', pro_model: 'deepseek-v4-pro' }),
    false,
  );
});

test('describeBindings covers every tier and flags the custom ones', () => {
  const view = describeBindings({ flash_provider: 'ollama', flash_model: 'qwen3:8b' });
  assert.deepEqual(Object.keys(view).sort(), [...TIERS].sort());
  assert.equal(view.flash.custom, true);
  assert.equal(view.pro.custom, false);
  assert.equal(view.pro.provider, 'deepseek-official');
});
