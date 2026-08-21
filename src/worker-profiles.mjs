// Named worker-profile registry for the external-CLI dispatch backends.
//
// A profile = backend × model × effort. dsh_run_worker / dsh_spawn_worker
// accept an optional `worker: <profile name>`; when set, the dispatch
// bypasses the hub/standalone tier logic entirely and runs the task through
// the profile's CLI (see cli-workers.mjs). Calls without `worker` keep the
// existing tier/mode behavior unchanged.
//
// Extending to a new CLI backend (e.g. codex) = one profile entry here + one
// backend implementation (buildArgs + stream parser) in cli-workers.mjs.

export const WORKER_PROFILES = {
  // --- Agy = Antigravity CLI (google3/jetski), measured with agy 1.1.16 ---
  //
  // Permission tradeoff: agy 1.1.16 has NO workspace-scoped permission mode.
  // The only non-interactive approval switches are the full-approval flag
  // --dangerously-skip-permissions ("Auto-approve all tool permission requests
  // without prompting") and --mode accept-edits (auto-apply edit suggestions).
  // --sandbox restricts the CLI terminal itself, which would cripple a coding
  // worker. A headless worker has nobody to answer prompts, so we use the
  // full-approval switch: the caller already trusts the worker with its cwd,
  // same as the DSH standalone path (full agent tools) and hub path.
  agy: {
    name: 'agy',
    backend: 'agy',                 // backend key implemented in cli-workers.mjs
    cli: 'agy',                     // binary resolved from PATH at spawn time
    label: 'Agy (Antigravity CLI) — CLI default model',
    // Measured 2026-08-21: `agy models` lists gemini-3.7/3.6/3.5-flash
    // (-high/-medium/-low), gemini-3.1-pro, claude-sonnet-4-6,
    // claude-opus-4-6-thinking, gpt-oss-120b-medium. The CLI resolves its
    // default model server-side and exposes it nowhere (logs, events and the
    // summaries db carry no model id), so we pass no --model and document the
    // default as "CLI default" instead of guessing.
    model: null,
    // null = CLI default effort. When the CALLER explicitly passes effort=
    // (off|high|max), it maps to agy's native low|medium|high.
    effort: null,
    effortMap: { off: 'low', high: 'medium', max: 'high' },
    permission:
      '--dangerously-skip-permissions + --mode accept-edits (FULL approval: auto-approves all tool permission requests; agy 1.1.16 offers no workspace-scoped permission mode)',
    notes:
      'output: stream-json NDJSON (init / step_update / result). Activity signal: step_update events (text_delta + usage) while generating.',
  },

  // --- Grok = grok-build CLI, measured with grok 1.0.3 ---
  //
  // Permission tradeoff: grok DOES have finer-grained modes, but the docs
  // (docs.x.ai, "Permissions and safety" / "Agent mode") explicitly say that
  // in non-interactive sessions restricted modes block tool calls ("Auto mode
  // blocked this action …") and recommend always-approve for automation:
  // "For automation that must run tools without interactive approval, use
  // always-approve (and deny rules if you need hard blocks)". Empirically on
  // 2026-08-21 acceptEdits ran a terminal command that wrote outside the cwd
  // ($HOME) without asking, so it is NOT a command-scoped restriction anyway.
  // We therefore use bypassPermissions (always-approve); deny rules, hooks and
  // some shell ask rules still apply, so users can hard-block via ~/.grok.
  grok: {
    name: 'grok',
    backend: 'grok',
    cli: 'grok',
    label: 'Grok (grok-4.5)',
    // Measured 2026-08-21: `grok models` → "* grok-4.5 (default)".
    model: 'grok-4.5',
    // grok-4.5 is not a reasoning model; --reasoning-effort is not passed.
    effort: null,
    effortMap: null,
    permission:
      '--permission-mode bypassPermissions (always-approve; docs.x.ai recommends always-approve for headless automation; deny rules/hooks still apply)',
    notes:
      'output: streaming-messages-json NDJSON (system init / stream_event Anthropic wire events / whole assistant message / result). Activity signal: content_block_delta + thinking_delta stream events.',
  },
};

export function resolveProfile(name) {
  const p = WORKER_PROFILES[name];
  if (!p) {
    throw new Error(
      `unknown worker profile "${name}" (available: ${Object.keys(WORKER_PROFILES).join(', ')})`,
    );
  }
  return p;
}

/** Descriptors for dsh_worker_config output: name, backend, label, pins. */
export function listProfiles() {
  return Object.values(WORKER_PROFILES).map((p) => ({
    name: p.name,
    backend: p.backend,
    label: p.label,
    model: p.model,
    effort: p.effort,
    permission: p.permission,
    cli: p.cli,
  }));
}
