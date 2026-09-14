// Which LLM route a worker tier dispatches to.
//
// Historically each tier was two constants: provider "deepseek-official" plus
// deepseek-v4-flash / deepseek-v4-pro. A user who had already configured
// another route in DSH — a local Ollama server is the motivating case
// (issue #10) — had no way to send workers to it, even though the dispatch
// path already hands {provider, model} to the host and the host resolves the
// provider id itself.
//
// This module is the one place that answers "tier -> route". It deliberately
// does NOT define providers: a provider is configured once, in DSH, and named
// here. That keeps one configuration surface instead of three (DSH's own
// provider settings, this plugin's custom-provider list for the vision route,
// and a third one for workers).

/** The built-in DeepSeek route for each tier — the behaviour before #10. */
export const DEFAULT_TIER_BINDING = Object.freeze({
  flash: Object.freeze({ provider: 'deepseek-official', model: 'deepseek-v4-flash' }),
  pro: Object.freeze({ provider: 'deepseek-official', model: 'deepseek-v4-pro' }),
});

export const TIERS = Object.freeze(['flash', 'pro']);

/** A configured value counts only when it is a non-blank string. */
function configured(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/**
 * Resolve one tier against a config object.
 *
 * Provider and model are resolved INDEPENDENTLY, so naming only a model keeps
 * the default provider (the common "same endpoint, different model" case) and
 * naming only a provider keeps the tier's model id (an OpenAI-compatible
 * gateway that serves the same model name). A blank value is not a
 * configuration — it falls back rather than dispatching to "".
 */
export function resolveTierBinding(tier, config = {}) {
  const fallback = DEFAULT_TIER_BINDING[tier];
  if (fallback === undefined) {
    throw new Error(`unknown tier "${tier}" (expected: ${TIERS.join(', ')})`);
  }
  return {
    provider: configured(config[`${tier}_provider`]) ?? fallback.provider,
    model: configured(config[`${tier}_model`]) ?? fallback.model,
  };
}

/** True when this tier dispatches somewhere other than the shipped default. */
export function isCustomBinding(tier, config = {}) {
  const resolved = resolveTierBinding(tier, config);
  const fallback = DEFAULT_TIER_BINDING[tier];
  return resolved.provider !== fallback.provider || resolved.model !== fallback.model;
}

/** Both tiers at once, for config views. */
export function describeBindings(config = {}) {
  const out = {};
  for (const tier of TIERS) {
    out[tier] = { ...resolveTierBinding(tier, config), custom: isCustomBinding(tier, config) };
  }
  return out;
}
