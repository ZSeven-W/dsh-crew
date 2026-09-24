// The TOML the installers write must parse (#12).
//
// A Windows install path placed raw between double quotes is not TOML:
// `C:\Users\...` opens a `\U` unicode escape and `\node_modules` a `\n`, so
// grok refused to start ("too few unicode value digits"). The check parses
// with a real TOML parser (Python's tomllib) rather than comparing strings,
// since a string comparison would only restate the quoting rule under test.

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PY_PARSE = 'import sys, json, tomllib; print(json.dumps(tomllib.loads(sys.stdin.read())))';

function parseToml(text) {
  const r = spawnSync('python3', ['-c', PY_PARSE], { input: text, encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    return { ok: false, error: (r.stderr || String(r.error)).trim() };
  }
  return { ok: true, value: JSON.parse(r.stdout) };
}

const hasTomllib = spawnSync('python3', ['-c', 'import tomllib'], { encoding: 'utf8' }).status === 0;

// The installer migrates ~/.config at import time; keep that off the real home.
let home;
let install;
before(async () => {
  home = mkdtempSync(join(tmpdir(), 'dsh-crew-toml-'));
  process.env.HOME = home;
  install = await import('../src/install/install.mjs');
});

test('a Windows path survives the round trip', { skip: !hasTomllib && 'python3 tomllib unavailable' }, () => {
  const path = 'C:\\Users\\kk\\.dsh\\profiles\\web\\node_modules\\@zseven-w\\dsh-crew\\lib\\server.mjs';

  // The shape that shipped: rejected by the parser.
  assert.equal(parseToml(`args = ["${path}"]\n`).ok, false);

  const parsed = parseToml(`args = [${install.tomlString(path)}]\n`);
  assert.ok(parsed.ok, parsed.error);
  assert.deepEqual(parsed.value.args, [path]);
});

test('quotes and control characters survive the round trip', { skip: !hasTomllib && 'python3 tomllib unavailable' }, () => {
  for (const path of [`C:\\Users\\O'Brien\\x`, '/home/a "b"/x', 'C:\\tab\there', 'del\x7fchar']) {
    const parsed = parseToml(`v = ${install.tomlString(path)}\n`);
    assert.ok(parsed.ok, `${JSON.stringify(path)}: ${parsed.error}`);
    assert.equal(parsed.value.v, path);
  }
});

test('installGrok writes a config.toml that parses', { skip: !hasTomllib && 'python3 tomllib unavailable' }, () => {
  const result = install.installGrok({ home });
  assert.ok(result.ok);
  const parsed = parseToml(readFileSync(join(home, '.grok', 'config.toml'), 'utf8'));
  assert.ok(parsed.ok, parsed.error);
  const server = parsed.value.mcp_servers['dsh-crew'];
  assert.equal(server.command, 'node');
  assert.match(server.args[0], /server\.mjs$/);
});

test('installCodex writes agent roles that parse', { skip: !hasTomllib && 'python3 tomllib unavailable' }, () => {
  install.installCodex({ home });
  for (const f of ['ds-flash.toml', 'ds-pro.toml']) {
    const parsed = parseToml(readFileSync(join(home, '.codex', 'agents', f), 'utf8'));
    assert.ok(parsed.ok, `${f}: ${parsed.error}`);
    assert.match(parsed.value.mcp_servers['dsh-crew'].args[0], /server\.mjs$/);
  }
});

test.after(() => rmSync(home, { recursive: true, force: true }));
