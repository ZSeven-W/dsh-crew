// One-click installers: register the Claude Code plugin persistently and
// render Codex / agy / grok agent roles with real paths. Called from the CLI
// entry or the DSH settings page. All edits are backed up and idempotent.

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync, rmSync, rmdirSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MARKETPLACE_NAME = 'dsh-crew';
const PLUGIN_KEY = `dsh-crew@${MARKETPLACE_NAME}`;
const MCP_TOOLS = ['dsh_run_worker', 'dsh_spawn_worker', 'dsh_worker_status', 'dsh_worker_result', 'dsh_worker_cancel'];

function backup(file) {
  if (existsSync(file)) {
    const bak = `${file}.dsh-crew-backup-${Date.now()}`;
    copyFileSync(file, bak);
    return bak;
  }
  return null;
}

function readJson(file, fallback) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; }
}

function readText(file) {
  try { return readFileSync(file, 'utf8'); } catch { return ''; }
}

/**
 * Remove the [header] section (plus any trailing blank lines) from TOML text.
 * Leaves every other section byte-for-byte intact. Returns input unchanged
 * when the section is absent.
 */
function removeTomlSection(toml, header) {
  const lines = toml.split('\n');
  const start = lines.findIndex((l) => l.trim() === '[' + header + ']');
  if (start === -1) return toml;
  let end = start + 1;
  while (end < lines.length && !/^\s*\[/.test(lines[end])) end++;
  while (end < lines.length && lines[end].trim() === '') end++;
  lines.splice(start, end - start);
  return lines.join('\n');
}

// One-time migration from the pre-rename config dir (dsh-workers → dsh-crew).
try {
  const oldDir = join(homedir(), '.config', 'dsh-workers');
  const newDir = join(homedir(), '.config', 'dsh-crew');
  if (existsSync(oldDir) && !existsSync(newDir)) {
    const { renameSync } = await import('node:fs');
    renameSync(oldDir, newDir);
  }
} catch {}

const GLOBAL_CONFIG_FILE = join(CONFIG_DIR_HOME(), 'config.json');
function CONFIG_DIR_HOME() { return join(homedir(), '.config', 'dsh-crew'); }

export const GLOBAL_CONFIG_DEFAULTS = {
  default_tier: 'flash',
  default_effort: 'max',
  mode: 'auto',
  default_timeout_seconds: 1800,
  hub_url: 'http://127.0.0.1:3080',
  // auto = orchestrator picks the tier; flash-only / pro-only clamp every
  // dispatch to one tier at the tool layer regardless of what was requested.
  tier_policy: 'auto',
  // When a blocking flash run fails, retry the same task once on pro.
  escalate_on_failure: false,
  // Multimodal bridge: which subscription CLI lends the text-only DS model
  // eyes (describe_image) and a brush (generate_image).
  vision_provider: 'claude-code', // claude-code | codex | grok | agy | <custom id> | off
  vision_model: 'haiku', // model passed to the vision CLI; free-form
  imagegen_provider: 'codex', // codex | agy | grok | <custom id> | off
  // User-defined providers, each either an OpenAI-compatible HTTP endpoint or a
  // local command. Entry shape:
  //   { id, name, type: 'api' | 'cli', models: [],
  //     api: base_url, api_key, imagegen_model
  //     cli: vision_command, imagegen_command }
  // CLI commands run via bash with shell-quoted placeholders: vision
  // {image} {question} {model} (stdout is the answer), imagegen
  // {prompt} {output} {size} (must write the file to {output}).
  custom_providers: [],
  // User-added model ids per provider, merged into the panel's model list.
  extra_models: {},
  // Hub-mode agent preset per tier: 'default' follows the DSH roster default.
  preset_flash: 'minimal',
  preset_pro: 'default',
};

export function readGlobalConfig() {
  return { ...GLOBAL_CONFIG_DEFAULTS, ...readJson(GLOBAL_CONFIG_FILE, {}) };
}

export function writeGlobalConfig(patch) {
  mkdirSync(CONFIG_DIR_HOME(), { recursive: true });
  const next = { ...readGlobalConfig() };
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (v !== undefined && k in GLOBAL_CONFIG_DEFAULTS) next[k] = v;
  }
  writeFileSync(GLOBAL_CONFIG_FILE, JSON.stringify(next, null, 2) + '\n');
  return next;
}

/** What is currently installed where — drives the settings-page buttons. */
export function installStatus({ home = homedir() } = {}) {
  const settings = readJson(join(home, '.claude', 'settings.json'), {});
  const enabled = settings.enabledPlugins;
  const claudeInstalled = !!(enabled && !Array.isArray(enabled) && enabled[PLUGIN_KEY]);
  const hudWired = typeof settings.statusLine?.command === 'string'
    && settings.statusLine.command.includes('worker-segment.sh');
  const codexInstalled = existsSync(join(home, '.codex', 'agents', 'ds-flash.toml'));
  const agyMcp = readJson(join(home, '.gemini', 'config', 'mcp_config.json'), {});
  const agyInstalled = !!(agyMcp.mcpServers && agyMcp.mcpServers['dsh-crew'])
    || existsSync(join(home, '.gemini', 'config', 'agents', 'ds-flash.md'));
  const grokTxt = readText(join(home, '.grok', 'config.toml'));
  const grokInstalled = grokTxt.includes('[mcp_servers.dsh-crew]')
    || existsSync(join(home, '.grok', 'agents', 'ds-flash.md'));
  return {
    claude: { installed: claudeInstalled, hud: hudWired },
    codex: { installed: codexInstalled },
    agy: { installed: agyInstalled },
    grok: { installed: grokInstalled },
  };
}

export function uninstallCodex({ home = homedir() } = {}) {
  const actions = [];
  for (const f of ['ds-flash.toml', 'ds-pro.toml']) {
    const p = join(home, '.codex', 'agents', f);
    if (existsSync(p)) { backup(p); rmSync(p); actions.push(`removed: ${p} (backup kept)`); }
  }
  for (const f of ['dsh-config.md', 'dsh-status.md', 'dsh-playbook.md']) {
    const p = join(home, '.codex', 'prompts', f);
    if (existsSync(p)) { rmSync(p); actions.push(`removed: ${p}`); }
  }
  return { ok: true, actions: actions.length ? actions : ['nothing to remove'] };
}

export async function installClaudeCode({ home = homedir(), statusline = false } = {}) {
  const actions = [];

  // The repo is its own marketplace: .claude-plugin/marketplace.json lists the
  // plugin with source './'. Pointing at the parent directory instead would
  // need a manifest written into whatever directory the user cloned into.
  const mpDir = ROOT;
  actions.push(`marketplace: ${mpDir} (self-marketplace, source ./)`);

  // 2. settings.json: marketplace + enabledPlugins + permissions allowlist.
  const settingsFile = join(home, '.claude', 'settings.json');
  mkdirSync(dirname(settingsFile), { recursive: true });
  const bak = backup(settingsFile);
  if (bak) actions.push(`backup: ${bak}`);
  const settings = readJson(settingsFile, {});

  // Both fields are records (see json.schemastore.org/claude-code-settings.json).
  // Older versions of this installer wrote arrays, which Claude Code ignores
  // with a warning — migrate those in place.
  const markets = (settings.extraKnownMarketplaces && !Array.isArray(settings.extraKnownMarketplaces)
    && typeof settings.extraKnownMarketplaces === 'object') ? settings.extraKnownMarketplaces : {};
  if (Array.isArray(settings.extraKnownMarketplaces)) actions.push('migrated legacy extraKnownMarketplaces array');
  markets[MARKETPLACE_NAME] = { source: { source: 'directory', path: mpDir } };
  if (markets['dsh-workers']) {
    delete markets['dsh-workers'];
    actions.push('removed pre-rename dsh-workers marketplace entry');
  }
  settings.extraKnownMarketplaces = markets;

  const enabled = (settings.enabledPlugins && !Array.isArray(settings.enabledPlugins)
    && typeof settings.enabledPlugins === 'object') ? settings.enabledPlugins : {};
  if (Array.isArray(settings.enabledPlugins)) {
    for (const key of settings.enabledPlugins) if (typeof key === 'string') enabled[key] = true;
    actions.push('migrated legacy enabledPlugins array');
  }
  enabled[PLUGIN_KEY] = true;
  if (enabled['dsh-workers@dsh-workers']) {
    delete enabled['dsh-workers@dsh-workers'];
    actions.push('removed pre-rename dsh-workers plugin entry');
  }
  settings.enabledPlugins = enabled;

  settings.permissions = settings.permissions ?? {};
  let allow = Array.isArray(settings.permissions.allow) ? settings.permissions.allow : [];
  const preRename = allow.filter((r) => typeof r === 'string' && r.startsWith('mcp__plugin_dsh-workers_'));
  if (preRename.length) {
    allow = allow.filter((r) => !preRename.includes(r));
    actions.push(`removed ${preRename.length} pre-rename permission rules`);
  }
  for (const tool of MCP_TOOLS) {
    const rule = `mcp__plugin_dsh-crew_dsh-crew__${tool}`;
    if (!allow.includes(rule)) allow.push(rule);
  }
  settings.permissions.allow = allow;

  if (statusline && !settings.statusLine) {
    settings.statusLine = { type: 'command', command: `bash ${join(ROOT, 'statusline', 'statusline.sh')}` };
    actions.push('statusline: installed');
  } else if (statusline) {
    actions.push('statusline: skipped (one already configured)');
  }

  writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');
  actions.push(`settings: registered ${PLUGIN_KEY} + ${MCP_TOOLS.length} permission rules`);

  // Materialize the install through the claude CLI: registers the marketplace
  // in the plugin cache (settings alone leave a stale/absent cache entry) and
  // pulls the plugin so the next session loads it. Best-effort: settings are
  // already correct, so a missing CLI just means one manual `plugin install`.
  if (home !== homedir()) {
    actions.push('cli: skipped (non-default home; test mode)');
    return { ok: true, actions };
  }
  try {
    const { execSync } = await import('node:child_process');
    const run = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 });
    try { run(`claude plugin marketplace add ${JSON.stringify(mpDir)}`); actions.push('cli: marketplace registered'); }
    catch (err) {
      // Re-adding an existing marketplace is the expected no-op; anything else
      // is a real failure (a missing or invalid manifest, say) and must be said
      // out loud — reporting it as "already registered" hides the cause of the
      // `plugin install` error that follows.
      const msg = String(err?.stdout ?? '') + String(err?.stderr ?? '') + String(err?.message ?? err);
      if (/already/i.test(msg)) actions.push('cli: marketplace add skipped (already registered)');
      else actions.push(`cli: marketplace add failed — ${msg.replace(/\s+/g, ' ').trim().slice(0, 160)}`);
    }
    // `plugin install` on an already-installed plugin is a no-op and leaves a
    // stale snapshot in ~/.claude/plugins/cache — uninstall first so an update
    // always re-copies the current code.
    try { run(`claude plugin uninstall ${PLUGIN_KEY}`); } catch {}
    run(`claude plugin install ${PLUGIN_KEY} --scope user -y`);
    actions.push(`cli: plugin snapshot refreshed (${PLUGIN_KEY})`);
  } catch (err) {
    actions.push(`cli: plugin install failed — run manually: claude plugin install ${PLUGIN_KEY} -y (${String(err?.message ?? err).slice(0, 120)})`);
  }
  return { ok: true, actions };
}

export function installCodex({ home = homedir(), scope } = {}) {
  const actions = [];
  const agentsDir = scope === 'project' ? join(process.cwd(), '.codex', 'agents') : join(home, '.codex', 'agents');
  mkdirSync(agentsDir, { recursive: true });
  const srcDir = join(ROOT, 'codex', 'agents');
  for (const f of readdirSync(srcDir).filter((f) => f.endsWith('.toml'))) {
    const dest = join(agentsDir, f);
    const bak = backup(dest);
    if (bak) actions.push(`backup: ${bak}`);
    const rendered = readFileSync(join(srcDir, f), 'utf8')
      .replace(/args = \[.*server\.mjs"\]/, `args = ["${join(ROOT, 'src', 'server.mjs')}"]`);
    writeFileSync(dest, rendered);
    actions.push(`role: ${dest}`);
  }
  const promptsDir = scope === 'project' ? join(process.cwd(), '.codex', 'prompts') : join(home, '.codex', 'prompts');
  mkdirSync(promptsDir, { recursive: true });
  const promptsSrc = join(ROOT, 'codex', 'prompts');
  for (const f of readdirSync(promptsSrc).filter((f) => f.endsWith('.md'))) {
    writeFileSync(join(promptsDir, f), readFileSync(join(promptsSrc, f), 'utf8'));
    actions.push(`prompt: ${join(promptsDir, f)}`);
  }
  return { ok: true, actions };
}

// ---------- agy (Antigravity CLI) ----------
// Global MCP config: ~/.gemini/config/mcp_config.json
//   { "mcpServers": { "<name>": { "command", "args", "disabled", "env"? } } }
// Global agents: ~/.gemini/config/agents/<name>.md (frontmatter: name,
//   description required; model flash|pro, subagent, tools, ... optional).
// Global skills: ~/.gemini/config/skills/<name>/SKILL.md.
// After a server runs once, agy keeps tool-schema caches under
// ~/.gemini/{antigravity,antigravity-cli,antigravity-ide}/mcp/<name>/ —
// uninstall removes those too.

export function installAgy({ home = homedir() } = {}) {
  const actions = [];
  const serverPath = join(ROOT, 'lib', 'server.mjs');
  if (!existsSync(serverPath)) {
    actions.push(`warning: ${serverPath} missing — run pnpm build:mcp so the registered server can start`);
  }

  // 1. MCP server entry (idempotent; existing entry is replaced).
  const mcpFile = join(home, '.gemini', 'config', 'mcp_config.json');
  mkdirSync(dirname(mcpFile), { recursive: true });
  const bak = backup(mcpFile);
  if (bak) actions.push(`backup: ${bak}`);
  const cfg = readJson(mcpFile, {});
  cfg.mcpServers = cfg.mcpServers ?? {};
  cfg.mcpServers['dsh-crew'] = { command: 'node', args: [serverPath], disabled: false };
  writeFileSync(mcpFile, JSON.stringify(cfg, null, 2) + '\n');
  actions.push(`mcp: registered dsh-crew (node ${serverPath}) in ${mcpFile}`);

  // 2. Agent definitions (no path rendering needed — agy reads the global MCP
  //    config itself, so the roles never embed a server path).
  const agentsDir = join(home, '.gemini', 'config', 'agents');
  mkdirSync(agentsDir, { recursive: true });
  for (const f of ['ds-flash.md', 'ds-pro.md']) {
    const dest = join(agentsDir, f);
    const b = backup(dest);
    if (b) actions.push(`backup: ${b}`);
    writeFileSync(dest, readFileSync(join(ROOT, 'agy', 'agents', f), 'utf8'));
    actions.push(`agent: ${dest}`);
  }

  // 3. Skills (agy's command/prompt packaging — /skills in the CLI).
  for (const s of ['dsh-config', 'dsh-status', 'dsh-playbook']) {
    const dest = join(home, '.gemini', 'config', 'skills', s, 'SKILL.md');
    mkdirSync(dirname(dest), { recursive: true });
    const b = backup(dest);
    if (b) actions.push(`backup: ${b}`);
    writeFileSync(dest, readFileSync(join(ROOT, 'agy', 'skills', s, 'SKILL.md'), 'utf8'));
    actions.push(`skill: ${dest}`);
  }
  return { ok: true, actions };
}

export function uninstallAgy({ home = homedir() } = {}) {
  const actions = [];

  const mcpFile = join(home, '.gemini', 'config', 'mcp_config.json');
  const cfg = readJson(mcpFile, null);
  if (cfg && cfg.mcpServers && cfg.mcpServers['dsh-crew']) {
    backup(mcpFile);
    delete cfg.mcpServers['dsh-crew'];
    writeFileSync(mcpFile, JSON.stringify(cfg, null, 2) + '\n');
    actions.push(`mcp: removed dsh-crew from ${mcpFile} (backup kept)`);
  }

  for (const f of ['ds-flash.md', 'ds-pro.md']) {
    const p = join(home, '.gemini', 'config', 'agents', f);
    if (existsSync(p)) {
      backup(p);
      rmSync(p);
      actions.push(`removed: ${p} (backup kept)`);
    }
  }

  for (const s of ['dsh-config', 'dsh-status', 'dsh-playbook']) {
    const dir = join(home, '.gemini', 'config', 'skills', s);
    const sk = join(dir, 'SKILL.md');
    if (existsSync(sk)) {
      rmSync(sk);
      try { rmdirSync(dir); } catch {}
      actions.push(`removed skill: ${dir}`);
    }
  }

  // Tool-schema caches (regenerable — agy re-creates them on next server use).
  for (const flavour of ['antigravity', 'antigravity-cli', 'antigravity-ide']) {
    const p = join(home, '.gemini', flavour, 'mcp', 'dsh-crew');
    if (existsSync(p)) {
      rmSync(p, { recursive: true, force: true });
      actions.push(`removed mcp cache: ${p}`);
    }
  }

  return { ok: true, actions: actions.length ? actions : ['nothing to remove'] };
}

// ---------- grok (Grok Build CLI) ----------
// User MCP config: ~/.grok/config.toml
//   [mcp_servers.<name>]
//   command = "..."   args = [...]   enabled = true
// User agents: ~/.grok/agents/<name>.md (frontmatter: name, description,
//   prompt_mode, model, permission_mode, tools, mcpInheritance, ...).
// User slash commands: ~/.grok/commands/<name>.md (flat files, CC legacy
//   layout — filename stem becomes the command, $ARGUMENTS is substituted).

export function installGrok({ home = homedir() } = {}) {
  const actions = [];
  const serverPath = join(ROOT, 'lib', 'server.mjs');
  if (!existsSync(serverPath)) {
    actions.push(`warning: ${serverPath} missing — run pnpm build:mcp so the registered server can start`);
  }

  // 1. MCP server section in ~/.grok/config.toml (idempotent: replace the
  //    existing [mcp_servers.dsh-crew] block if present, keep the rest).
  const cfgFile = join(home, '.grok', 'config.toml');
  mkdirSync(dirname(cfgFile), { recursive: true });
  const bak = backup(cfgFile);
  if (bak) actions.push(`backup: ${bak}`);
  let toml = readText(cfgFile);
  toml = removeTomlSection(toml, 'mcp_servers.dsh-crew').replace(/\n+$/, '');
  toml += `\n\n[mcp_servers.dsh-crew]\ncommand = "node"\nargs = ["${serverPath}"]\nenabled = true\n`;
  writeFileSync(cfgFile, toml);
  actions.push(`mcp: registered dsh-crew (node ${serverPath}) in ${cfgFile}`);

  // 2. Agent definitions.
  const agentsDir = join(home, '.grok', 'agents');
  mkdirSync(agentsDir, { recursive: true });
  for (const f of ['ds-flash.md', 'ds-pro.md']) {
    const dest = join(agentsDir, f);
    const b = backup(dest);
    if (b) actions.push(`backup: ${b}`);
    writeFileSync(dest, readFileSync(join(ROOT, 'grok', 'agents', f), 'utf8'));
    actions.push(`agent: ${dest}`);
  }

  // 3. Slash commands (/dsh-config, /dsh-status, /dsh-playbook).
  const commandsDir = join(home, '.grok', 'commands');
  mkdirSync(commandsDir, { recursive: true });
  for (const f of ['dsh-config.md', 'dsh-status.md', 'dsh-playbook.md']) {
    const dest = join(commandsDir, f);
    const b = backup(dest);
    if (b) actions.push(`backup: ${b}`);
    writeFileSync(dest, readFileSync(join(ROOT, 'grok', 'commands', f), 'utf8'));
    actions.push(`command: ${dest}`);
  }
  return { ok: true, actions };
}

export function uninstallGrok({ home = homedir() } = {}) {
  const actions = [];

  const cfgFile = join(home, '.grok', 'config.toml');
  if (existsSync(cfgFile)) {
    const before = readText(cfgFile);
    let after = removeTomlSection(before, 'mcp_servers.dsh-crew');
    // Drop dsh-crew from any disabled_mcp_servers list grok may have written.
    after = after.split('\n').map((l) => (l.includes('disabled_mcp_servers') && l.includes('dsh-crew')
      ? l.replace(/"dsh-crew"\s*,?\s*/g, '').replace(/,\s*\]/g, ']')
      : l)).join('\n');
    if (after !== before) {
      backup(cfgFile);
      writeFileSync(cfgFile, after.replace(/\n{3,}$/, '\n'));
      actions.push(`mcp: removed dsh-crew from ${cfgFile} (backup kept)`);
    }
  }

  for (const f of ['ds-flash.md', 'ds-pro.md']) {
    const p = join(home, '.grok', 'agents', f);
    if (existsSync(p)) {
      backup(p);
      rmSync(p);
      actions.push(`removed: ${p} (backup kept)`);
    }
  }

  for (const f of ['dsh-config.md', 'dsh-status.md', 'dsh-playbook.md']) {
    const p = join(home, '.grok', 'commands', f);
    if (existsSync(p)) {
      rmSync(p);
      actions.push(`removed: ${p}`);
    }
  }

  return { ok: true, actions: actions.length ? actions : ['nothing to remove'] };
}

/**
 * Wire the DSH worker segment into an existing claude-hud statusline via its
 * --extra-cmd hook (requires CLAUDE_HUD_ALLOW_EXTRA_CMD=1). Idempotent.
 */
export function installHudSegment({ home = homedir() } = {}) {
  const settingsFile = join(home, '.claude', 'settings.json');
  const settings = readJson(settingsFile, null);
  if (!settings) return { ok: false, actions: ['settings.json not found'] };
  const cmd = settings.statusLine?.command;
  if (typeof cmd !== 'string' || !cmd.includes('claude-hud')) {
    return { ok: false, actions: ['statusLine is not claude-hud; use statusline/statusline.sh directly instead'] };
  }
  const segment = join(ROOT, 'statusline', 'worker-segment.sh');
  if (cmd.includes(segment)) return { ok: true, actions: ['already wired'] };
  if (cmd.includes('worker-segment.sh')) {
    // Wired to a stale copy (e.g. pre-rename path) — repoint the --extra-cmd at the current segment.
    const next = cmd.replace(/--extra-cmd "bash [^"]*worker-segment\.sh"/, `--extra-cmd "bash ${segment}"`);
    if (next === cmd) return { ok: false, actions: ['worker-segment.sh present but path not replaceable; rewire manually'] };
    const bak = backup(settingsFile);
    settings.statusLine.command = next;
    writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');
    return { ok: true, actions: [...(bak ? [`backup: ${bak}`] : []), `statusLine: repointed worker-segment.sh to ${segment}`] };
  }
  let next = cmd;
  if (!next.includes('CLAUDE_HUD_ALLOW_EXTRA_CMD')) {
    next = next.replace(/exec\s+/, 'exec env CLAUDE_HUD_ALLOW_EXTRA_CMD=1 ');
    if (!next.includes('CLAUDE_HUD_ALLOW_EXTRA_CMD')) return { ok: false, actions: ['could not find exec in statusLine command; wire manually'] };
  }
  const extra = ` --extra-cmd "bash ${segment}"`;
  if (next.endsWith("'")) next = next.slice(0, -1) + extra + "'";
  else next += extra;
  const bak = backup(settingsFile);
  settings.statusLine.command = next;
  writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');
  return { ok: true, actions: [...(bak ? [`backup: ${bak}`] : []), 'statusLine: claude-hud now runs worker-segment.sh via --extra-cmd'] };
}

/**
 * Array-form extraKnownMarketplaces entries are keyed objects shaped like
 * { "dsh-crew": { source: { source: 'directory', path } } } — never arrays
 * of paths. Match any element that names this marketplace, or whose
 * directory (source.path, or a top-level path for safety) resolves to the
 * repo ROOT this installer registers.
 */
function isDshMarketplaceEntry(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (Object.prototype.hasOwnProperty.call(entry, MARKETPLACE_NAME)) return true;
  const candidates = [entry, ...Object.values(entry).filter((v) => v && typeof v === 'object')];
  return candidates.some((v) => {
    const p = v.path ?? v.source?.path;
    return typeof p === 'string' && resolve(p) === ROOT;
  });
}

export async function uninstallClaudeCode({ home = homedir() } = {}) {
  const actions = [];
  const settingsFile = join(home, '.claude', 'settings.json');
  const settings = readJson(settingsFile, null);
  if (!settings) return { ok: true, actions: ['settings.json not found'] };
  backup(settingsFile);
  if (Array.isArray(settings.extraKnownMarketplaces)) {
    settings.extraKnownMarketplaces = settings.extraKnownMarketplaces.filter((m) => !isDshMarketplaceEntry(m));
  } else if (settings.extraKnownMarketplaces) {
    delete settings.extraKnownMarketplaces[MARKETPLACE_NAME];
  }
  if (Array.isArray(settings.enabledPlugins)) {
    settings.enabledPlugins = settings.enabledPlugins.filter((p) => p !== PLUGIN_KEY);
  } else if (settings.enabledPlugins) {
    delete settings.enabledPlugins[PLUGIN_KEY];
  }
  if (settings.permissions?.allow) {
    settings.permissions.allow = settings.permissions.allow.filter((r) => !r.startsWith('mcp__plugin_dsh-crew_'));
  }
  writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n');
  actions.push('settings: unregistered from settings.json (backup kept)');

  // Mirror install: the CLI keeps its own plugin state — known_marketplaces
  // and the cache snapshot in ~/.claude/plugins/ — that rewriting settings
  // alone never removes, so `claude plugin list` would still show the plugin
  // as disabled. Best-effort, exactly like install: settings are already
  // clean, so a missing CLI just leaves the two commands below manual.
  if (home !== homedir()) {
    actions.push('cli: skipped (non-default home; test mode)');
    actions.push('unregistered from settings.json (backup kept)');
    return { ok: true, actions };
  }
  const cliErrors = [];
  try {
    const { execSync } = await import('node:child_process');
    const run = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 });
    for (const cmd of ['claude plugin uninstall ' + PLUGIN_KEY, 'claude plugin marketplace remove ' + MARKETPLACE_NAME]) {
      try { run(cmd); } catch (err) {
        const msg = String(err?.stdout ?? '') + String(err?.stderr ?? '') + String(err?.message ?? err);
        cliErrors.push(msg.replace(/\s+/g, ' ').trim().slice(0, 160));
      }
    }
  } catch (err) {
    cliErrors.push(String(err?.message ?? err).slice(0, 120));
  }
  if (cliErrors.length) {
    actions.push('cli: cleanup failed — run manually: claude plugin uninstall ' + PLUGIN_KEY + '; claude plugin marketplace remove ' + MARKETPLACE_NAME + ' (' + cliErrors.join(' | ') + ')');
    actions.push('settings.json was cleaned (backup kept) but the Claude Code CLI cleanup failed — run the commands above manually');
    return { ok: true, actions };
  }
  actions.push('cli: uninstalled ' + PLUGIN_KEY + ' and removed marketplace ' + MARKETPLACE_NAME);
  actions.push('uninstalled from Claude Code CLI and unregistered from settings.json (backup kept)');
  return { ok: true, actions };
}
