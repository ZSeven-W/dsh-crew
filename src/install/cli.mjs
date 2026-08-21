#!/usr/bin/env node
// Usage: node src/install/cli.mjs <claude|codex|agy|grok|all|hud|uninstall-*> [--statusline] [--project]

import {
  installClaudeCode, installCodex, installAgy, installGrok,
  uninstallClaudeCode, uninstallCodex, uninstallAgy, uninstallGrok, installHudSegment,
} from './install.mjs';

const cmd = process.argv[2];
const flags = new Set(process.argv.slice(3));
const opts = { statusline: flags.has('--statusline'), scope: flags.has('--project') ? 'project' : 'user' };

const run = {
  claude: () => [installClaudeCode(opts)],
  codex: () => [installCodex(opts)],
  agy: () => [installAgy(opts)],
  grok: () => [installGrok(opts)],
  all: () => [installClaudeCode(opts), installHudSegment(opts), installCodex(opts), installAgy(opts), installGrok(opts)],
  'uninstall-claude': () => [uninstallClaudeCode(opts)],
  'uninstall-codex': () => [uninstallCodex(opts)],
  'uninstall-agy': () => [uninstallAgy(opts)],
  'uninstall-grok': () => [uninstallGrok(opts)],
  hud: () => [installHudSegment(opts)],
}[cmd];

if (!run) {
  console.error('usage: cli.mjs <claude|codex|agy|grok|all|hud|uninstall-claude|uninstall-codex|uninstall-agy|uninstall-grok> [--statusline] [--project]');
  process.exit(1);
}
for (const p of run()) {
  const r = await p;
  for (const a of r.actions) console.log('•', a);
}
console.log('done.');
