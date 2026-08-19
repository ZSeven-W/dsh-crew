// Builds lib/server.mjs: a self-contained bundle of the MCP stdio server.
// Only the third-party packages the MCP protocol itself needs - the MCP SDK
// and zod - are inlined, so the published plugin works from a plain
// directory copy with no node_modules (Claude Code's directory marketplace
// copies the repo without installing anything, and a bundled file needs no
// install step).
//
// Every @deepseek-ai/* package stays external. The standalone dispatch path
// loads @deepseek-ai/dsh-sdk-client lazily (dynamic import inside
// startJob), and hub mode never touches it. Inlining the DSH stack here
// would re-couple the MCP server to the SDK version and bloat the bundle
// (the previous build carried a 580 KB closure for a lazy optional path).
//
// Equivalent esbuild CLI (what `npm run build:mcp` asks for):
//   esbuild src/server.mjs --bundle --platform=node --format=esm --packages=bundle --external:@deepseek-ai/* --target=node18 --outfile=lib/server.mjs
//
// --target=node18: the MCP SDK requires node >= 18; this keeps the bundle
// runnable on every node that can run the SDK, instead of pinning the
// output to the build machine's node version.

import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(ROOT, 'lib'), { recursive: true });

await build({
  entryPoints: [join(ROOT, 'src', 'server.mjs')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'bundle',
  // @deepseek-ai/* resolves at runtime only when standalone dispatch is
  // actually used (jobs.mjs startJob); external takes precedence over
  // packages:bundle for these specifiers.
  external: ['@deepseek-ai/*'],
  target: 'node18',
  outfile: join(ROOT, 'lib', 'server.mjs'),
  logLevel: 'info',
});

