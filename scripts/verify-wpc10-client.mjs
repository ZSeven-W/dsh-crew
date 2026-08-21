// WPC10 client-logic verification: bundles src/client/jobs-view.ts with
// esbuild and exercises the pure view helpers — orphan-ghost reconciliation
// (vanished + writer-gone), running-first ordering, held-workspace grouping,
// path/chain rendering and status-cell labeling. No browser needed.
//
//   node scripts/verify-wpc10-client.mjs

import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'dsh-crew-wpc10-'));
let failures = 0;
function check(name, cond) {
  if (cond) console.log('  ok - ' + name);
  else { failures += 1; console.error('  FAIL - ' + name); }
}

try {
  await build({
    entryPoints: [join(ROOT, 'src', 'client', 'jobs-view.ts')],
    bundle: true, platform: 'node', format: 'esm',
    outfile: join(tmp, 'jobs-view.mjs'), logLevel: 'silent',
  });
  const mod = await import(pathToFileURL(join(tmp, 'jobs-view.mjs')).href);
  const {
    reconcileGhosts, displayJobs, heldWorkspaces, shortPath, chainText, statusInfoOf,
    ORPHAN_MISSES, GHOST_CAP,
  } = mod;

  const zh = {
    statusRunning: '运行中', statusStalled: '疑似卡住', statusDone: '完成',
    statusFailed: '失败', statusCancelled: '已取消', statusOrphaned: '失联',
    statusTitle: (s) => `状态：${s}`, orphanWriterGone: (o) => `writer gone ${o}`,
    orphanVanished: (a) => `vanished ${a}`, stalledTip: (l) => `stalled ${l}`,
    shardStale: (m) => `stale ${m}`,
  };
  const now = Date.now();
  const job = (o = {}) => ({
    id: 'job-1-x', status: 'running', startedAt: new Date(now - 60_000).toISOString(),
    tier: 'flash', effort: 'max', task: 'do the thing', source: 'claude-code', cwd: '/w/a', ...o,
  });

  // 1. Vanished-job detection: two consecutive OK snapshots without the job → orphaned ghost.
  let g = reconcileGhosts([job()], {}, now);
  check('running job registers a ghost', g['job-1-x']?.misses === 0 && g['job-1-x']?.job?.status === 'running');
  g = reconcileGhosts([], g, now + 3000);
  check('first miss keeps it running (torn-read protection)',
    g['job-1-x']?.misses === 1 && g['job-1-x']?.job?.status === 'running');
  g = reconcileGhosts([], g, now + 6000);
  check('second miss marks it orphaned/vanished',
    g['job-1-x']?.job?.status === 'orphaned' && g['job-1-x']?.job?.orphan?.kind === 'vanished'
    && g['job-1-x']?.job?.orphan?.lastSeenAt === now);

  // 2. A terminal state observed in a later snapshot drops the ghost (normal finish).
  let g2 = reconcileGhosts([job()], {}, now);
  g2 = reconcileGhosts([job({ status: 'done', endedAt: new Date(now).toISOString() })], g2, now + 3000);
  check('terminal job drops its ghost', !g2['job-1-x']);

  // 3. Reappearance resets the miss counter.
  let g3 = reconcileGhosts([job()], {}, now);
  g3 = reconcileGhosts([], g3, now + 3000);
  g3 = reconcileGhosts([job()], g3, now + 6000);
  check('reappearing job resets misses', g3['job-1-x']?.misses === 0);

  // 4. Writer-gone: a live row whose writer process is dead is re-labeled immediately,
  //    and the kind survives the later vanish.
  const dead = job({ originWriterAlive: false, origin: 'hub-99999' });
  const rows = displayJobs([dead], {});
  check('writer-gone live row re-labeled orphaned',
    rows[0]?.status === 'orphaned' && rows[0]?.orphan?.kind === 'writer-gone' && rows[0]?.orphan?.origin === 'hub-99999');
  let g4 = reconcileGhosts([dead], {}, now);
  g4 = reconcileGhosts([], g4, now + 3000);
  g4 = reconcileGhosts([], g4, now + 6000);
  check('vanished writer-gone ghost keeps its kind', g4['job-1-x']?.job?.orphan?.kind === 'writer-gone');
  const aliveForeign = job({ originWriterAlive: true, origin: 'mcp-111', id: 'job-2-y' });
  check('alive writer stays running', displayJobs([aliveForeign], {})[0]?.status === 'running');

  // 5. Ordering: running → orphaned → finished, newest startedAt first.
  const rNew = job({ id: 'r1', startedAt: new Date(now - 1000).toISOString() });
  const rOld = job({ id: 'r2', startedAt: new Date(now - 5000).toISOString() });
  const orph = job({ id: 'o1', status: 'orphaned', orphan: { kind: 'vanished', lastSeenAt: now } });
  const fin = job({ id: 'f1', status: 'done', startedAt: new Date(now - 2000).toISOString() });
  const ordered = displayJobs([fin, rOld, orph, rNew], {});
  check('running first, orphaned second, finished last (newest first)',
    ordered.map((j) => j.id).join(',') === 'r1,r2,o1,f1');

  // 6. Held workspaces: only live running rows hold a cwd; grouped and sorted by cwd.
  const held = heldWorkspaces([job({ cwd: '/w/z' }), job({ cwd: '/w/a' }), orph, job({ cwd: '/w/z', id: 'job-2-y' })]);
  check('heldWorkspaces groups and sorts by cwd',
    held.length === 2 && held[0].cwd === '/w/a' && held[1].cwd === '/w/z' && held[1].jobs.length === 2);
  check('orphaned rows never hold a workspace', held.every((h) => h.jobs.every((j) => j.status === 'running')));

  // 7. Rendering helpers.
  const long = '/a/very/long/path/that/exceeds/the/length/limit/repo';
  const sp = shortPath(long);
  check('shortPath trims the head and keeps the tail', sp.length === 34 && sp.startsWith('…') && sp.endsWith('repo'));
  check('shortPath leaves short paths alone', shortPath('/w/a') === '/w/a');
  check('chainText renders hops', chainText([{ source: 'claude-code', backend: 'hub', cwd: '/w/a' }]).includes('claude-code → hub @ /w/a'));

  // 8. Status-cell labeling.
  const sRun = statusInfoOf(job(), zh);
  check('running → blue + running label', sRun.color === '#4a9eff' && sRun.label === '运行中');
  const sStall = statusInfoOf(job({ liveness: 'stalled', activityLastEventAt: new Date(now - 130_000).toISOString() }), zh);
  check('stalled CLI → amber + stalled label', sStall.color === '#d29922' && sStall.label === '疑似卡住');
  const sStaleWarn = statusInfoOf(job({ originShardUpdatedAt: new Date(now - 11 * 60_000).toISOString() }), zh);
  check('stale shard (≥10min) → amber warning while still running', sStaleWarn.color === '#d29922' && sStaleWarn.label === '运行中');
  const sStaleHint = statusInfoOf(job({ originShardUpdatedAt: new Date(now - 6 * 60_000).toISOString() }), zh);
  check('mildly stale shard (≥5min) → blue with hint', sStaleHint.color === '#4a9eff' && sStaleHint.title.startsWith('stale'));
  const sOrph = statusInfoOf(orph, zh);
  check('orphaned → orange + orphan label', sOrph.color === '#f0883e' && sOrph.label === '失联');
  const sDone = statusInfoOf(job({ status: 'done' }), zh);
  check('done → green', sDone.color === '#3fb950' && sDone.label === '完成');

  // 9. Ghost registry is capped.
  let gc = {};
  const many = Array.from({ length: GHOST_CAP + 5 }, (_, i) => job({ id: `job-${i}-y` }));
  gc = reconcileGhosts(many, gc, now);
  check('ghost registry stays capped', Object.keys(gc).length <= GHOST_CAP);

  console.log('  (ORPHAN_MISSES = ' + ORPHAN_MISSES + ', GHOST_CAP = ' + GHOST_CAP + ')');
  if (failures > 0) { console.error('\nWPC10 CLIENT CHECKS FAILED: ' + failures); process.exit(1); }
  console.log('\nALL_WPC10_CLIENT_CHECKS_PASSED');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
