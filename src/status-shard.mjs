// Sharded worker-status publishing: every writer (hub process, per-session
// standalone MCP server) owns one file under ~/.config/dsh-crew/status.d/
// and readers merge all fresh shards. Kills the last-writer-wins race that a
// single shared status.json had with multiple concurrent writers.

import { writeFileSync, mkdirSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CONFIG_DIR = join(homedir(), '.config', 'dsh-crew');
const SHARD_DIR = join(CONFIG_DIR, 'status.d');
export const SHARD_FRESH_MS = 30 * 60 * 1000;

export function createShardWriter(kind) {
  const writer = `${kind}-${process.pid}`;
  const file = join(SHARD_DIR, `${writer}.json`);
  const cleanup = () => { try { rmSync(file, { force: true }); } catch {} };
  process.once('exit', cleanup);
  process.once('SIGINT', () => { cleanup(); process.exit(130); });
  process.once('SIGTERM', () => { cleanup(); process.exit(143); });
  return {
    writer,
    publish(jobs) {
      try {
        mkdirSync(SHARD_DIR, { recursive: true });
        writeFileSync(file, JSON.stringify({ updatedAt: new Date().toISOString(), writer, jobs }, null, 2));
      } catch {}
    },
    dispose: cleanup,
  };
}

/**
 * Whether the process that wrote a shard still exists. Writers are named
 * "<kind>-<pid>"; process.kill(pid, 0) answers existence without signalling
 * (ESRCH = gone, EPERM = exists but owned elsewhere). Returns null when the
 * writer is not a parseable "<kind>-<pid>" (e.g. the legacy status.json).
 */
export function writerProcessAlive(writer) {
  if (typeof writer !== 'string') return null;
  const m = /-(\d+)$/.exec(writer);
  if (!m) return null;
  const pid = Number(m[1]);
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try { process.kill(pid, 0); return true; }
  catch (err) {
    if (err?.code === 'ESRCH') return false;
    if (err?.code === 'EPERM') return true;
    return null;
  }
}

/** Merge fresh shards (plus the legacy status.json during transition). */
export function readMergedStatus({ excludeWriter } = {}) {
  const jobs = [];
  const now = Date.now();
  const consume = (raw) => {
    try {
      const shard = JSON.parse(raw);
      if (shard.writer === excludeWriter) return;
      if (now - +new Date(shard.updatedAt) > SHARD_FRESH_MS) return;
      // WPC10: expose the owning writer's liveness and last-write time so the
      // panel can flag running jobs whose instance died (orphans) instead of
      // showing them as running forever or dropping them silently.
      const writerAlive = writerProcessAlive(shard.writer);
      for (const job of shard.jobs ?? []) {
        jobs.push({
          ...job,
          origin: shard.writer ?? 'legacy',
          originWriterAlive: writerAlive,
          originShardUpdatedAt: typeof shard.updatedAt === 'string' ? shard.updatedAt : null,
        });
      }
    } catch {}
  };
  try {
    for (const f of readdirSync(SHARD_DIR)) {
      if (f.endsWith('.json')) { try { consume(readFileSync(join(SHARD_DIR, f), 'utf8')); } catch {} }
    }
  } catch {}
  try { consume(readFileSync(join(CONFIG_DIR, 'status.json'), 'utf8')); } catch {}
  return jobs;
}
