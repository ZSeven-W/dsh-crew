// WPC14: liveness probing and verified killing of ghost worker processes.
//
// Ghost rows on the jobs board record the pid (and process-group id) of the
// OS process a job ran in. Standalone runtimes and agy/grok CLI workers are
// independent processes: when their dispatching host dies, the process can
// survive as a true orphan. This module backs the hub endpoints
// (/_dsh/dsh-crew/proc-alive and /_dsh/dsh-crew/proc-kill):
//
//   1. Is pid alive? process.kill(pid, 0) - the same probe the status shard
//      uses for writer liveness (status-shard.mjs writerProcessAlive).
//   2. May we kill pid? A pid copied from a tombstone may have been recycled
//      by an unrelated process since the job died, so the kill path reads the
//      process command line (ps) and refuses unless it matches a process
//      shape this plugin actually spawns. Verified shapes (not guessed):
//        - standalone DSH runtime: `node .../dsh-sdk-jsonrpc-demo/lib/bin.js
//          .../worker.cordis.yml`. jobs.mjs spawns node_modules/.bin/dsh-jsonrpc-agent,
//          a shim whose exec line is `exec node "$basedir/../@deepseek-ai/dsh-sdk-jsonrpc-demo/lib/bin.js" "$@"`
//          (verified from the shim's cmd-shim-target) with args [worker.cordis.yml].
//        - agy: `.../agy --print <task> --output-format stream-json
//          --dangerously-skip-permissions --mode accept-edits --print-timeout Ns ...`
//          (worker-profiles.mjs cli: 'agy' + cli-workers.mjs buildArgs; the
//          binary is a native Mach-O executable at ~/.local/bin/agy here).
//        - grok: `.../grok -p <task> --output-format streaming-messages-json
//          --include-partial-messages --permission-mode bypassPermissions ...`
//          (same two sources; native binary at ~/.local/bin/grok here).
//
// Refusals follow the origin-guard style: a code, a reason and a readable
// multi-line message (zh/en via i18n.mjs, adopted per request by the hub).

import { execFileSync } from 'node:child_process';
import { tr } from './i18n.mjs';

/** SIGTERM -> SIGKILL grace window for the kill path. */
export const PROC_KILL_GRACE_MS = 3_000;

/** Positive-integer pid/pgid validation; returns the number or null. */
export function parsePid(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > 0x7fffffff) return null;
  return n;
}

/** Whether pid refers to a process that exists right now. Never throws. */
export function procAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if (err?.code === 'ESRCH') return false;
    return err?.code === 'EPERM'; // exists, owned elsewhere
  }
}

/** Readable refusal: code + localized message + optional facts. */
export class ProcKillRefused extends Error {
  constructor(code, zh, en, extra = {}) {
    super(tr(zh, en));
    this.name = 'ProcKillRefused';
    this.code = code;
    Object.assign(this, extra);
  }
}

function defaultRunPs(args) {
  return execFileSync('ps', args, { encoding: 'utf8', timeout: 3_000 });
}

/**
 * The command line of pid via `ps -p <pid> -o command=`.
 * Returns { ok: true, command } or { ok: false, reason } where reason is
 * 'no-such-process' (ps found nothing / exited 1) or 'ps-failed' (cannot
 * read - refusing to kill without verification is the caller's job).
 * `run` is injectable so the verify script can exercise the logic without ps.
 */
export function procCommand(pid, run = defaultRunPs) {
  try {
    const command = String(run(['-p', String(pid), '-o', 'command=']) ?? '').trim();
    if (!command) return { ok: false, reason: 'no-such-process' };
    return { ok: true, command };
  } catch (err) {
    if (err?.status === 1) return { ok: false, reason: 'no-such-process' };
    return { ok: false, reason: 'ps-failed', detail: err?.message ?? String(err) };
  }
}

/**
 * Whether a command line matches a process shape this plugin spawns.
 * The executable (first token's basename) AND a stable per-backend argument
 * marker must both match; the pid-recycling case (an unrelated process that
 * happens to share the binary name) then still refuses.
 */
export function isWorkerCommand(command) {
  if (typeof command !== 'string' || command.trim() === '') return false;
  const cmd = command.trim();
  const first = cmd.split(/\s+/)[0] ?? '';
  const base = (first.split('/').pop() ?? '').split('\\').pop().toLowerCase();
  if (base === 'node' || base === 'node.exe') {
    // Standalone runtime: node .../@deepseek-ai/dsh-sdk-jsonrpc-demo/lib/bin.js .../worker.cordis.yml
    return /dsh-sdk-jsonrpc-demo/i.test(cmd) && /worker\.cordis\.yml/.test(cmd);
  }
  if (base === 'agy') {
    // agy --print <task> --output-format stream-json --dangerously-skip-permissions ...
    return /--output-format\s+stream-json/.test(cmd);
  }
  if (base === 'grok') {
    // grok -p <task> --output-format streaming-messages-json --include-partial-messages ...
    return /streaming-messages-json/.test(cmd) || /--include-partial-messages/.test(cmd);
  }
  if (base === 'sh' || base === 'bash' || base === 'dash' || base === 'zsh') {
    // Transient window where the pnpm shim itself is still the live process:
    // /bin/sh .../node_modules/.bin/dsh-jsonrpc-agent .../worker.cordis.yml
    return /\bdsh-jsonrpc-agent\b/i.test(cmd) && /worker\.cordis\.yml/.test(cmd);
  }
  return false;
}

const NOT_A_WORKER_ZH = (pid, command) =>
  '拒绝杀死 pid ' + pid + '：其命令行不匹配任何 dsh-crew 工作进程特征（该 pid 可能已被系统回收复用）。\n' +
  '命令行：' + command + '\n' +
  '可杀特征：standalone DSH 运行时（…dsh-sdk-jsonrpc-demo… worker.cordis.yml）、' +
  'agy（…--output-format stream-json…）、grok（…streaming-messages-json…）。';

const NOT_A_WORKER_EN = (pid, command) =>
  'Refusing to kill pid ' + pid + ': its command line matches no process shape dsh-crew spawns (the pid may have been recycled).\n' +
  'command: ' + command + '\n' +
  'Accepted shapes: standalone DSH runtime (…dsh-sdk-jsonrpc-demo… worker.cordis.yml), ' +
  'agy (…--output-format stream-json…), grok (…streaming-messages-json…).';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Verified kill of a recorded worker process. Verifies the command line
 * BEFORE signalling; SIGTERMs the pid (or the whole group via kill(-pgid)
 * when pgid is given - it must equal pid, the only group relationship this
 * plugin ever records); after ~3s of grace anything still alive gets SIGKILL.
 * Throws ProcKillRefused on invalid input, an unreadable/gone process or a
 * non-worker command line. `ps` is injectable for tests.
 */
export async function killWorkerProcess({ pid, pgid, graceMs = PROC_KILL_GRACE_MS, ps = undefined }) {
  if (parsePid(pid) === null) {
    throw new ProcKillRefused('bad-pid', 'pid 必须是正整数', 'pid must be a positive integer');
  }
  const groupKill = pgid !== undefined && pgid !== null;
  if (groupKill && (parsePid(pgid) === null || pgid !== pid)) {
    throw new ProcKillRefused(
      'pgid-mismatch',
      'pgid ' + pgid + ' 与 pid ' + pid + ' 不一致 — 拒绝整组杀死（dsh-crew 只会记录 pgid === pid 的进程组）',
      'pgid ' + pgid + ' does not match pid ' + pid + ' — refusing the group kill (dsh-crew only ever records pgid === pid)',
      { pid, pgid },
    );
  }

  const info = procCommand(pid, ps);
  if (!info.ok) {
    if (info.reason === 'no-such-process') {
      throw new ProcKillRefused('no-such-process', '进程 ' + pid + ' 不存在', 'no such process: ' + pid, { pid });
    }
    throw new ProcKillRefused(
      'ps-failed',
      '无法读取进程 ' + pid + ' 的命令行（' + info.detail + '）— 未经校验拒绝杀死',
      'could not read the command line of pid ' + pid + ' (' + info.detail + ') — refusing to kill without verification',
      { pid },
    );
  }
  if (!isWorkerCommand(info.command)) {
    throw new ProcKillRefused('not-a-worker', NOT_A_WORKER_ZH(pid, info.command), NOT_A_WORKER_EN(pid, info.command), {
      pid,
      command: info.command,
    });
  }

  const target = groupKill ? -pgid : pid;
  let signal = 'SIGTERM';
  try {
    process.kill(target, 'SIGTERM');
  } catch (err) {
    if (err?.code === 'ESRCH') {
      return { ok: true, killed: false, alreadyGone: true, pid, pgid: groupKill ? pgid : null, signal: 'none', group: groupKill, command: info.command };
    }
    throw new ProcKillRefused(
      'signal-failed',
      '向 pid ' + pid + ' 发送 SIGTERM 失败：' + (err?.message ?? err),
      'failed to signal pid ' + pid + ' with SIGTERM: ' + (err?.message ?? err),
      { pid },
    );
  }

  // Grace: poll the target's existence; SIGKILL whatever survives. For a
  // group kill, kill(-pgid, 0) answers for the WHOLE group (ESRCH only when
  // no member remains), so stragglers are caught too.
  const stillAlive = () => {
    try { process.kill(target, 0); return true; } catch (err) { return err?.code === 'EPERM'; }
  };
  const deadline = Date.now() + graceMs;
  while (stillAlive() && Date.now() < deadline) await sleep(200);
  if (stillAlive()) {
    signal = 'SIGKILL';
    try { process.kill(target, 'SIGKILL'); } catch { /* raced with exit */ }
  }
  return { ok: true, killed: true, alreadyGone: false, pid, pgid: groupKill ? pgid : null, signal, group: groupKill, command: info.command };
}
