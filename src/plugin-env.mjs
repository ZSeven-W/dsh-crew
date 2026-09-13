// Plugin-owned environment variables live under `DSHPLUGIN_`, never `DSH_`.
//
// DSH reserves the ENTIRE `DSH_` prefix for host bootstrap settings and
// refuses to load any `.env` file that sets one: @deepseek-ai/dsh-app-boot
// (BOOTSTRAP_PREFIXES) throws on the first match and rejects the whole file,
// so `dsh web` aborts at startup. A user who configured a plugin the way DSH
// teaches — ~/.dsh/.env, or the working directory's .env — therefore took the
// host down with an error naming a variable the plugin owns
// (dsh-openpencil issue #6, the same trap family-wide).
//
// Legacy `DSH_`-prefixed names are still READ so existing shell exports keep
// working; they are removed in the first 1.0.0 prerelease. Reading them cannot
// make them work in a .env file — the host rejects that file before any plugin
// loads — which is why migration means REPLACING the old assignment, never
// adding the new name beside it.

export const PLUGIN_ENV_PREFIX = 'DSHPLUGIN_';
export const LEGACY_ENV_PREFIX = 'DSH_';

const PLUGIN_LABEL = 'dsh-crew';

/** One warning per legacy variable per process, not one per lookup. */
const warned = new Set();

/** Reset the once-per-process warning ledger (tests only). */
export function resetPluginEnvWarnings() {
  warned.clear();
}

/** Current name of a plugin variable, given the suffix after the prefix. */
export function pluginEnvName(suffix) {
  return PLUGIN_ENV_PREFIX + suffix;
}

/** Legacy (pre-rename) name of the same variable. */
export function legacyEnvName(suffix) {
  return LEGACY_ENV_PREFIX + suffix;
}

/**
 * Read one plugin variable by its suffix (e.g. 'CREW_HUB').
 *
 * Resolution is by PRESENCE, not truthiness: a new variable set to the empty
 * string is a deliberate "no override" and must not silently resurrect a stale
 * legacy value. Validating the value stays with the caller.
 */
export function pluginEnv(suffix, options = {}) {
  const env = options.env ?? process.env;
  const warn = options.warn ?? ((message) => { process.stderr.write(message + '\n'); });
  const current = pluginEnvName(suffix);
  const legacy = legacyEnvName(suffix);
  const hasCurrent = env[current] !== undefined;
  const hasLegacy = env[legacy] !== undefined;
  if (hasLegacy && !warned.has(legacy)) {
    warned.add(legacy);
    // Names and precedence only — never the value, which is often a URL or path.
    warn(
      `${PLUGIN_LABEL}: ${legacy} is deprecated; rename it to ${current}`
      + (hasCurrent ? ` (${current} is also set and takes precedence)` : '')
      + `. DSH reserves the ${LEGACY_ENV_PREFIX} prefix for itself: a .env file that sets ${legacy} makes the `
      + 'host abort at startup, so REPLACE the old assignment — adding the new name beside it does not help.',
    );
  }
  return hasCurrent ? env[current] : env[legacy];
}
