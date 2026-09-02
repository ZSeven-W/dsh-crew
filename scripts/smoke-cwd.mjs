#!/usr/bin/env node
// Smoke assertions for the cross-platform cwd helpers (issue #5): the hub
// must accept Windows drive / UNC paths as absolute, and the MCP layer must
// map unset / "." / "current" cwd values onto the caller's workspace while
// relative paths resolve against it. No framework — node:assert only.
//
//   node scripts/smoke-cwd.mjs

import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { canonicalCwd, isAbsoluteCwd, resolveWorkerCwd } from '../src/paths.mjs';

// Absolute-path predicate: POSIX, Windows drive (both slash styles) and UNC.
for (const p of ['/a/b', 'D:\\a\\b', 'C:/a/b', '\\\\srv\\share\\p']) {
  assert.equal(isAbsoluteCwd(p), true, JSON.stringify(p) + ' should be absolute');
}
// Relative, empty and non-string values are never absolute.
for (const p of ['a/b', '', undefined]) {
  assert.equal(isAbsoluteCwd(p), false, JSON.stringify(p) + ' should not be absolute');
}

// MCP-side resolver: unset / "." / "current" mean the caller's workspace,
// relative paths resolve against it, absolute paths normalize as-is.
const base = resolve('project');
assert.equal(resolveWorkerCwd(undefined, base), base);
assert.equal(resolveWorkerCwd('.', base), base);
assert.equal(resolveWorkerCwd('current', base), base);
assert.equal(resolveWorkerCwd('', base), base);
assert.equal(resolveWorkerCwd('sub/dir', base), resolve(base, 'sub/dir'));
assert.equal(resolveWorkerCwd('/abs', base), resolve('/abs'));

// Canonical form never re-roots a foreign-platform absolute path under
// process.cwd(): a Windows path on a POSIX hub is only normalized.
if (process.platform !== 'win32') {
  assert.equal(canonicalCwd('D:/AI/../floorplan'), 'D:\\floorplan');
  assert.equal(canonicalCwd('\\\\srv\\share\\p\\.'), '\\\\srv\\share\\p');
  assert.equal(canonicalCwd('/a/../b'), '/b');
  assert.equal(resolveWorkerCwd('D:\\AI\\floorplan', base), 'D:\\AI\\floorplan');
}

console.log('smoke-cwd: all assertions passed');
