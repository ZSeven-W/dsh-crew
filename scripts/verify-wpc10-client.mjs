// WPC10 client-logic verification: bundles src/client/jobs-view.ts with
// esbuild and exercises the pure view helpers — orphan-ghost reconciliation
// (vanished + writer-gone), running-first ordering, held-workspace grouping,
// path/chain rendering and status-cell labeling. WPC13 additions on top:
// workspace grouping (multi-cwd, no-cwd bucket, running-first within a
// group), per-group finished counts, lock-badge derivation (kind:"cwd-lock"
// entries + running-job fallback) and the group-header path helpers
// (basename, ~-substitution + middle ellipsis, stable storage key).
// No browser needed.
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
    groupJobs, finishedCountOf, workspaceKey, basenameOf, abbrevPath, workspaceLocks, lockBadgeOf,
    ghostPidOf, procBadgeOf, dueProcProbes, PROC_PROBE_INTERVAL_MS,
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
  // 10. WPC13 workspace grouping: multi-cwd groups, no-cwd bucket, ordering.
  const gj = groupJobs([
    job({ cwd: '/w/z' }), job({ cwd: '/w/a' }),
    job({ cwd: '/w/z', id: 'job-2-y', startedAt: new Date(now - 2000).toISOString() }),
    job({ cwd: undefined, id: 'job-n1' }),
    job({ cwd: '', id: 'job-n2', status: 'done' }),
  ]);
  check('groupJobs splits rows into per-cwd groups sorted by path',
    gj.length === 3 && gj[0].cwd === '/w/a' && gj[0].jobs.length === 1
    && gj[1].cwd === '/w/z' && gj[1].jobs.length === 2);
  check('running rows precede finished rows inside a group',
    gj[1].jobs[0].status === 'running' && gj[1].jobs[1].status === 'running');
  check('jobs without a cwd land in the trailing null-cwd group',
    gj[2].cwd === null && gj[2].jobs.map((j) => j.id).join(',') === 'job-n1,job-n2');
  check('finishedCountOf counts only settled rows',
    finishedCountOf(gj[1].jobs) === 0 && finishedCountOf(gj[2].jobs) === 1);

  // 11. WPC13 grouping skips non-job status rows (kind: "cwd-lock").
  const mixedGroup = groupJobs([job({ cwd: '/w/x' }), { kind: 'cwd-lock', id: 'cwd-lock-1', cwd: '/w/l', holder: {} }]);
  check('groupJobs skips kind:"cwd-lock" feed entries',
    mixedGroup.length === 1 && mixedGroup[0].cwd === '/w/x' && mixedGroup[0].jobs.length === 1);

  // 12. Orphaned ghosts stay visible in their workspace group.
  const ghostGroup = groupJobs(displayJobs([], {
    'job-1-x': { job: job({ status: 'orphaned', orphan: { kind: 'vanished', lastSeenAt: now }, cwd: '/w/g' }), lastSeenAt: now, misses: 2 },
  }));
  check('orphaned ghosts stay in their workspace group',
    ghostGroup.length === 1 && ghostGroup[0].cwd === '/w/g' && ghostGroup[0].jobs[0].id === 'job-1-x');

  // 13. WPC13 lock view: kind:"cwd-lock" entries and the running-job fallback.
  const lockRow = { kind: 'cwd-lock', id: 'cwd-lock-1', cwd: '/w/l', holder: { jobId: 'hub-1', backend: 'hub-1', mode: 'hub', startedAt: new Date(now - 462_000).toISOString(), cwd: '/w/l' } };
  const wl = workspaceLocks([lockRow, job({ cwd: '/w/l' }), job({ cwd: '/w/q', status: 'done' }), orph]);
  check('workspaceLocks reads kind:"cwd-lock" entries with their holder',
    wl.some((l) => l.cwd === '/w/l' && l.holder.jobId === 'hub-1' && l.holder.backend === 'hub-1'));
  check('workspaceLocks falls back to running jobs and ignores settled rows',
    wl.some((l) => l.cwd === '/w/l' && l.holder.jobId === 'job-1-x') && !wl.some((l) => l.cwd === '/w/q'));

  // 14. WPC13 badge derivation: backend + age from startedAt, null when free.
  const badgeCopy = { lockBadgeTip: (h) => 'tip:' + h.jobId + ':' + h.backend };
  const badge = lockBadgeOf(wl, '/w/l', badgeCopy, now);
  check('lock badge shows backend and age from startedAt',
    badge !== null && badge.text === '🔒 hub-1 · 7m42s' && badge.title === 'tip:hub-1:hub-1');
  check('no badge for a free workspace or the no-cwd group',
    lockBadgeOf(wl, '/w/free', badgeCopy, now) === null && lockBadgeOf(wl, null, badgeCopy, now) === null);

  // 15. WPC13 group-header path helpers.
  check('basenameOf strips trailing slashes and handles null/root',
    basenameOf('/w/a/repo') === 'repo' && basenameOf('/w/a/repo/') === 'repo'
    && basenameOf(null) === '' && basenameOf('/') === '/');
  check('abbrevPath swaps $HOME for ~',
    abbrevPath('/home/fini/workspace/dsh-plugins/dsh-crew', '/home/fini') === '~/workspace/dsh-plugins/dsh-crew');
  const longAp = abbrevPath('/a/very/long/path/that/keeps/going/way/past/the/limit/repo');
  check('abbrevPath middle-ellipsizes while keeping head and tail',
    longAp.startsWith('/a/very') && longAp.endsWith('repo') && longAp.includes('…') && longAp.length <= 44);
  check('abbrevPath leaves short paths alone', abbrevPath('/w/a') === '/w/a');
  check('workspaceKey is stable, distinct and storage-safe',
    workspaceKey('/w/a') === workspaceKey('/w/a') && workspaceKey('/w/a') !== workspaceKey('/w/b')
    && !workspaceKey('/w/a/b').includes('/') && workspaceKey(null) === workspaceKey('')
    && workspaceKey(null) !== workspaceKey('/w/a'));

  // 16. WPC14 ghost pid extraction: only valid positive-integer pairs count.
  check('ghostPidOf reads a pid and defaults pgid to null',
    ghostPidOf(job({ pid: 4242 }))?.pid === 4242 && ghostPidOf(job({ pid: 4242 }))?.pgid === null);
  check('ghostPidOf reads a pid+pgid pair',
    JSON.stringify(ghostPidOf(job({ pid: 4242, pgid: 4242 }))) === JSON.stringify({ pid: 4242, pgid: 4242 }));
  check('ghostPidOf rejects missing/zero/negative/non-integer pid',
    ghostPidOf(job()) === null && ghostPidOf(job({ pid: 0 })) === null
    && ghostPidOf(job({ pid: -5 })) === null && ghostPidOf(job({ pid: 4.5 })) === null
    && ghostPidOf(job({ pid: '42' })) === null);
  check('ghostPidOf rejects an invalid pgid',
    ghostPidOf(job({ pid: 4242, pgid: -1 })) === null && ghostPidOf(job({ pid: 4242, pgid: 'x' })) === null);

  // 17. WPC14 badge derivation: only an affirmative probe on an orphaned
  //     pid-carrying tombstone shows the badge + kill button.
  const ghostPidJob = job({ status: 'orphaned', pid: 4242, pgid: 4242, orphan: { kind: 'vanished', lastSeenAt: now } });
  check('alive probe shows the badge with pid+pgid',
    JSON.stringify(procBadgeOf(ghostPidJob, { alive: true })) === JSON.stringify({ pid: 4242, pgid: 4242 }));
  check('failed probe (alive: null) hides the badge', procBadgeOf(ghostPidJob, { alive: null }) === null);
  check('no probe yet hides the badge', procBadgeOf(ghostPidJob, null) === null);
  check('dead-process probe hides the badge', procBadgeOf(ghostPidJob, { alive: false }) === null);
  check('badge needs a pid on the tombstone', procBadgeOf(job({ status: 'orphaned' }), { alive: true }) === null);
  check('badge only applies to orphaned rows', procBadgeOf(job({ pid: 4242, status: 'running' }), { alive: true }) === null);

  // 18. WPC14 probe scheduling: pid-carrying orphans only, throttled per ghost id.
  const ghostWithPid = { g1: { job: ghostPidJob, lastSeenAt: now, misses: 2 } };
  const noPidGhost = { g2: { job: job({ status: 'orphaned' }), lastSeenAt: now, misses: 2 } };
  const runningGhost = { g3: { job: job({ pid: 9 }), lastSeenAt: now, misses: 0 } };
  const due = dueProcProbes({ ...ghostWithPid, ...noPidGhost, ...runningGhost }, {}, now);
  check('dueProcProbes picks pid-carrying orphaned ghosts only',
    due.length === 1 && due[0].id === 'g1' && due[0].pid === 4242 && due[0].pgid === 4242);
  check('recently probed ghosts are throttled',
    dueProcProbes(ghostWithPid, { g1: now - PROC_PROBE_INTERVAL_MS + 1000 }, now).length === 0);
  check('an old probe attempt makes the ghost due again',
    dueProcProbes(ghostWithPid, { g1: now - PROC_PROBE_INTERVAL_MS - 1000 }, now).length === 1);

  // 19. WPC14 tombstones keep the recorded pid through the vanish sequence.
  let gp = reconcileGhosts([job({ pid: 4242 })], {}, now);
  gp = reconcileGhosts([], gp, now + 3000);
  gp = reconcileGhosts([], gp, now + 6000);
  check('orphaned tombstone keeps the recorded pid',
    gp['job-1-x']?.job?.pid === 4242 && gp['job-1-x']?.job?.status === 'orphaned');

  console.log('  (ORPHAN_MISSES = ' + ORPHAN_MISSES + ', GHOST_CAP = ' + GHOST_CAP + ')');
  if (failures > 0) { console.error('\nWPC10 CLIENT CHECKS FAILED: ' + failures); process.exit(1); }
  console.log('\nALL_WPC10_CLIENT_CHECKS_PASSED');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
