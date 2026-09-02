// Cross-platform path helpers shared by the hub, the MCP server, and the
// smoke tests. Worker cwd values may arrive from Windows agents (drive
// letters, backslashes, UNC) or from Claude Code / Codex sessions, so every
// absolute-path gate and cwd resolution lives here instead of a POSIX-only
// check duplicated across backends.

import { isAbsolute, resolve, posix, win32 } from 'node:path';

/**
 * True when cwd is an absolute path on any supported platform: POSIX (/a/b),
 * Windows drive (D:\a\b, C:/a/b) or UNC (\\srv\share\p). Non-strings
 * and the empty string are never absolute. (path.win32.isAbsolute also
 * accepts POSIX-style roots like /x, which is fine here.)
 */
export function isAbsoluteCwd(cwd) {
  if (typeof cwd !== 'string' || cwd === '') return false;
  return posix.isAbsolute(cwd) || win32.isAbsolute(cwd);
}

/**
 * Resolve a worker cwd the same way on every backend: undefined / null /
 * '' / '.' / 'current' mean the caller's current workspace (base), a
 * relative path resolves against base, and an absolute path normalizes
 * as-is — so D:/x and D:\x map to one workspace on Windows.
 */
export function resolveWorkerCwd(cwd, base = process.cwd()) {
  if (cwd === undefined || cwd === null || cwd === '' || cwd === '.' || cwd === 'current') return resolve(base);
  if (isAbsoluteCwd(cwd)) return canonicalCwd(cwd);
  return resolve(base, cwd);
}

/**
 * Canonical form of an absolute cwd. A path that is absolute on this host
 * goes through resolve(); a foreign-platform absolute path (a Windows path
 * reaching a POSIX hub, or the reverse) is only normalized in its own
 * flavour — never re-rooted under process.cwd(), which is what a bare
 * resolve() would silently do.
 */
export function canonicalCwd(cwd) {
  if (isAbsolute(cwd)) return resolve(cwd);
  if (win32.isAbsolute(cwd)) return win32.normalize(cwd);
  return posix.normalize(cwd);
}
