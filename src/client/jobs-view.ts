// Pure view helpers for the worker-jobs table (WPC10). No React, no window:
// everything is a function of the job snapshot, so it is side-effect free and
// unit-testable (scripts/verify-wpc10-client.mjs).

export const ORPHAN_MISSES = 2;         // consecutive OK snapshots without the job -> orphaned
export const GHOST_CAP = 40;            // keep at most this many orphaned records
export const SHARD_STALE_HINT_MIN = 5;  // minutes: surface the stale hint in the tooltip
export const SHARD_STALE_WARN_MIN = 10; // minutes: amber dot instead of blue while still running
export const STALL_SECONDS = 120;       // display-only mirror of STALL_SECONDS in cli-workers.mjs

export interface GhostEntry { job: any; lastSeenAt: number; misses: number; }

/** "3m4s ago"-style readable age for a timestamp (ISO string or epoch ms). */
export function timeAgo(ts: any): string {
  if (ts === undefined || ts === null || ts === '') return '';
  const s = Math.max(0, Math.round((Date.now() - +new Date(ts)) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m`;
}

/** Ellipsize a path by trimming the HEAD: the tail (repo name) is the part that matters. */
export function shortPath(p: any): string {
  const s = String(p ?? '');
  if (s.length <= 34) return s;
  return '…' + s.slice(-33);
}

/** Multi-line rendering of an origin chain for tooltips (mirrors origin-guard formatChain). */
export function chainText(chain: any): string {
  if (!Array.isArray(chain)) return '';
  return chain
    .map((h: any, i: number) => `  ${i + 1}. ${h?.source ?? '?'} → ${h?.backend ?? '?'} @ ${h?.cwd ?? '?'}`)
    .join('\n');
}

/**
 * Fold a fresh OK /jobs snapshot into the ghost registry. Running jobs are
 * (re-)registered with a fresh snapshot; a previously-running job missing
 * from ORPHAN_MISSES consecutive OK snapshots becomes an orphaned ghost —
 * rendered on the board instead of silently disappearing (WPC10 incident:
 * a hub restart killed a running job and erased every trace of it).
 * A non-OK fetch must never reach this function.
 */
export function reconcileGhosts(live: any[], ghosts: Record<string, GhostEntry>, now: number): Record<string, GhostEntry> {
  const next: Record<string, GhostEntry> = {};
  const terminal = new Set<string>();
  for (const j of live ?? []) {
    if (!j || !j.id) continue;
    if (j.status === 'running') next[j.id] = { job: j, lastSeenAt: now, misses: 0 };
    else terminal.add(j.id); // settled in the feed: the ghost (if any) is done
  }
  for (const [id, g] of Object.entries(ghosts ?? {})) {
    if (!g || !g.job) continue;
    if (next[id] || terminal.has(id)) continue; // still alive, or finished normally
    const lastSeenAt = Number.isFinite(g.lastSeenAt) ? g.lastSeenAt : now;
    const misses = (Number.isFinite(g.misses) ? g.misses : 0) + 1;
    const job = misses >= ORPHAN_MISSES
      ? {
          ...g.job,
          status: 'orphaned',
          orphan: {
            kind: g.job.originWriterAlive === false ? 'writer-gone' : 'vanished',
            origin: g.job.origin ?? null,
            lastSeenAt,
          },
        }
      : g.job; // first miss: keep showing it as running (torn shard-read protection)
    next[id] = { job, lastSeenAt, misses };
  }
  const ids = Object.keys(next).sort((a, b) => next[b].lastSeenAt - next[a].lastSeenAt);
  for (const id of ids.slice(GHOST_CAP)) delete next[id];
  return next;
}

/**
 * The rows the board renders: the live snapshot plus any ghost rows (jobs the
 * feed no longer lists), with running jobs whose writer process is gone
 * re-labeled as orphaned — sorted running-first (running → orphaned →
 * finished, newest startedAt first within each group).
 */
export function displayJobs(live: any[], ghosts: Record<string, GhostEntry>): any[] {
  const rows: any[] = [...(live ?? [])];
  const seen = new Set(rows.map((j) => j?.id));
  for (const [id, g] of Object.entries(ghosts ?? {})) {
    if (seen.has(id) || !g?.job) continue;
    rows.push(g.job);
  }
  return rows
    .map((j) => {
      if (j?.status === 'running' && j.originWriterAlive === false) {
        return { ...j, status: 'orphaned', orphan: { kind: 'writer-gone', origin: j.origin ?? null } };
      }
      return j;
    })
    .sort((a, b) => {
      const ra = a?.status === 'running' ? 0 : a?.status === 'orphaned' ? 1 : 2;
      const rb = b?.status === 'running' ? 0 : b?.status === 'orphaned' ? 1 : 2;
      if (ra !== rb) return ra - rb;
      return +new Date(b?.startedAt ?? 0) - +new Date(a?.startedAt ?? 0);
    });
}

/**
 * Workspaces held by live running jobs, grouped by cwd. This is the panel's
 * view of the cwd-lock table: locks live inside each dispatching MCP session
 * (unreachable from the hub routes), but a running job occupying a cwd is
 * exactly what the lock refuses a second dispatch for.
 */
export function heldWorkspaces(rows: any[]): Array<{ cwd: string; jobs: any[] }> {
  const byCwd = new Map<string, any[]>();
  for (const j of rows ?? []) {
    if (j?.status !== 'running' || !j.cwd) continue;
    const list = byCwd.get(j.cwd) ?? [];
    list.push(j);
    byCwd.set(j.cwd, list);
  }
  return [...byCwd.entries()]
    .map(([cwd, jobs]) => ({
      cwd,
      jobs: jobs.sort((a, b) => +new Date(b.startedAt ?? 0) - +new Date(a.startedAt ?? 0)),
    }))
    .sort((a, b) => a.cwd.localeCompare(b.cwd));
}

/** Dot color + label + tooltip for a job's status cell. */
export function statusInfoOf(job: any, copy: any): { color: string; label: string; title: string } {
  const st = job?.status;
  if (st === 'orphaned') {
    if (job.orphan?.kind === 'writer-gone') {
      return {
        color: '#f0883e',
        label: copy.statusOrphaned,
        title: copy.orphanWriterGone(job.orphan?.origin ?? job.origin ?? '?'),
      };
    }
    return {
      color: '#f0883e',
      label: copy.statusOrphaned,
      title: copy.orphanVanished(timeAgo(job.orphan?.lastSeenAt) || '…'),
    };
  }
  if (st === 'running') {
    if (job.liveness === 'stalled') {
      const last = job.activityLastEventAt ? timeAgo(job.activityLastEventAt) : '';
      return { color: '#d29922', label: copy.statusStalled, title: copy.stalledTip(last) };
    }
    if (job.originShardUpdatedAt) {
      const mins = Math.floor((Date.now() - +new Date(job.originShardUpdatedAt)) / 60_000);
      if (mins >= SHARD_STALE_HINT_MIN) {
        return {
          color: mins >= SHARD_STALE_WARN_MIN ? '#d29922' : '#4a9eff',
          label: copy.statusRunning,
          title: copy.shardStale(mins),
        };
      }
    }
    return { color: '#4a9eff', label: copy.statusRunning, title: copy.statusTitle(st) };
  }
  if (st === 'done') return { color: '#3fb950', label: copy.statusDone, title: copy.statusTitle(st) };
  if (st === 'cancelled') return { color: '#f85149', label: copy.statusCancelled, title: copy.statusTitle(st) };
  return { color: '#f85149', label: copy.statusFailed, title: copy.statusTitle(st ?? '?') };
}
