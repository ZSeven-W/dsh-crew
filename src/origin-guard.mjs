// Origin-chain guard against recursive worker self-amplification (WPC9 guardrail 1).
//
// Every dispatch carries an origin chain: the ordered list of (backend, cwd)
// hops the task has already travelled. A crew-enabled host can itself be
// someone else's worker — CC dispatches to codex, codex (crew installed)
// dispatches back — and without a guard the host×backend matrix lets one
// worker spawn another forever: quota burns through in minutes while every
// single vantage point along the chain looks innocent.
//
// Data shape of one hop:
//   { backend: 'hub' | 'standalone' | 'agy' | 'grok' | <future cli backend>,
//     cwd: canonical absolute path (see cwd-lock.mjs normalizeCwd),
//     source: orchestrator id of the dispatching host ('claude-code', 'codex', ...) }
//
// Cross-process transport:
//   - This MCP server reads DSH_CREW_ORIGIN_CHAIN (JSON array of hops) at
//     startup and inherits it as INHERITED_ORIGIN; crew instances spawned
//     down-chain do the same, so the chain survives process boundaries.
//   - Every dispatch appends its own hop and passes the extended chain to the
//     worker: env vars DSH_CREW_ORIGIN_CHAIN / DSH_CREW_DEPTH for CLI and
//     standalone children (jobs.mjs / cli-workers.mjs spawn env), and
//     origin_chain / origin_depth spec fields for hub spawns (hub-client is
//     unchanged; the current hub ignores unknown spec fields and this
//     client-side session re-attaches them to every hub view it returns).
//   - DSH_CREW_DEPTH is written alongside as an integer for observability but
//     is never trusted on read: the chain is authoritative and depth is
//     derived from its length (env can be hostile).
//
// A dispatch is refused — before anything is spawned — when:
//   1. the extended chain repeats a (backend, cwd) pair: the classic
//      worker-eats-itself loop, or
//   2. the extended chain is deeper than the configured limit (default 3).

import { normalizeCwd } from './cwd-lock.mjs';

export const ORIGIN_CHAIN_ENV = 'DSH_CREW_ORIGIN_CHAIN';
export const ORIGIN_DEPTH_ENV = 'DSH_CREW_DEPTH';

// Why 3: depth = number of dispatch hops. 1 is a direct worker, 2 a worker
// delegating once, 3 one more legitimate re-delegation — real fan-out graphs
// rarely go deeper. Beyond that, nesting is almost certainly workers
// spawning workers, and each extra level multiplies spend, so the cap cuts
// the self-amplification loop at its first steps while leaving headroom for
// legitimate delegation. Adjust per session via dsh_worker_config.
export const DEFAULT_ORIGIN_DEPTH_LIMIT = 3;

/** Parse and sanitize the inherited chain from env. Never throws. */
export function readInheritedOrigin(env = process.env) {
  const empty = { chain: [], depth: 0 };
  try {
    const raw = env[ORIGIN_CHAIN_ENV];
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return empty;
    const chain = [];
    for (const h of parsed) {
      if (!h || typeof h !== 'object') continue;
      if (typeof h.backend !== 'string' || !h.backend) continue;
      if (typeof h.cwd !== 'string' || !h.cwd) continue;
      chain.push({
        backend: h.backend,
        cwd: normalizeCwd(h.cwd),
        source: typeof h.source === 'string' ? h.source : null,
      });
    }
    return { chain, depth: chain.length };
  } catch {
    return empty;
  }
}

/** Human-readable chain for error messages and dashboards. */
export function formatChain(chain) {
  return chain
    .map((h, i) => `  ${i + 1}. ${h.source ?? 'unknown-host'} → ${h.backend} @ ${h.cwd}`)
    .join('\n');
}

/**
 * Append this dispatch's hop to the inherited chain and run both guard
 * checks. Returns { ok: true, origin } or { ok: false, error } where error is
 * a fully readable refusal (code, reason, message incl. the rendered chain).
 */
export function extendOrigin({ inherited, backend, cwd, source = null, depthLimit = DEFAULT_ORIGIN_DEPTH_LIMIT }) {
  const hop = { backend, cwd: normalizeCwd(cwd), source };
  const chain = [...inherited.chain, hop];
  const depth = chain.length;

  // Loop: any (backend, cwd) pair seen twice along the chain (including the
  // hop about to be dispatched) is the worker-eats-itself signature.
  const seen = new Map();
  for (const h of chain) {
    const key = h.backend + '\u0000' + h.cwd;
    const first = seen.get(key);
    if (first) {
      return {
        ok: false,
        error: {
          code: 'origin-loop',
          reason: 'origin loop detected (duplicate backend+cwd)',
          message:
            `Worker self-dispatch loop detected — refusing to dispatch.\n` +
            `The hop ${backend} @ ${hop.cwd} repeats an earlier hop of the origin chain; ` +
            `dispatching it would close a worker→worker cycle, the classic recursive self-amplification ` +
            `(quota burns in minutes, invisible from any single vantage point).\n` +
            `Origin chain (source → backend @ cwd):\n${formatChain(chain)}`,
          chain, depth, limit: depthLimit, duplicate: hop,
        },
      };
    }
    seen.set(key, h);
  }

  // Depth: one more nesting level than allowed means "workers spawning workers".
  if (depth > depthLimit) {
    return {
      ok: false,
      error: {
        code: 'origin-depth-exceeded',
        reason: 'origin chain depth limit exceeded',
        message:
          `Origin chain depth ${depth} exceeds the configured limit of ${depthLimit} — refusing to dispatch.\n` +
          `This dispatch would nest workers ${depth} levels deep; beyond the limit, nesting is almost ` +
          `certainly workers spawning workers (recursive self-amplification).\n` +
          `Origin chain (source → backend @ cwd):\n${formatChain(chain)}\n` +
          `Raise the limit via dsh_worker_config origin_depth_limit only if this nesting is deliberate.`,
        chain, depth, limit: depthLimit,
      },
    };
  }

  return { ok: true, origin: { chain, depth, limit: depthLimit } };
}
