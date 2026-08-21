// CLI worker adapter: runs a named worker profile (worker-profiles.mjs) as a
// child CLI process and folds it into the shared job registry (jobs.mjs), so
// dsh_worker_status / dsh_worker_result / dsh_worker_cancel work unchanged.
//
// Spawning rules (both backends):
//   - detached: true — the CLI leads its own process group, so cancel/timeout
//     can SIGTERM (then SIGKILL after a grace period) the whole tree and no
//     orphan processes survive (e.g. agy's in-process language server).
//   - env: full process.env passthrough (auth, proxy, GROK_HOME etc.).
//   - cwd: the caller-provided workspace.
//   - timeout: a wall timer here kills the group at the deadline; agy
//     additionally gets --print-timeout = deadline + 15s as a self-exit
//     backstop in case our timer can never fire.
//
// Streams per backend:
//   agy  — `agy --print <task> --output-format stream-json …` emits NDJSON:
//          {"event":"init"} / {"event":"step_update"} (text_delta + usage while
//          generating; the liveness signal) / {"event":"result"} (final response).
//   grok — `grok -p <task> --output-format streaming-messages-json
//          --include-partial-messages …` emits NDJSON: {"type":"system"} init,
//          {"type":"stream_event","event":{Anthropic wire event}} deltas
//          (liveness signal), {"type":"assistant"} whole message,
//          {"type":"result"} final. Usage from "result" replaces the per-message
//          accumulation to avoid double counting.
//
// Liveness ("在动" vs "卡死"): every stream line refreshes activity.lastEventAt.
// A staleness timer flips liveness to "stalled" when no event arrived for
// STALL_SECONDS while the process is still running (heuristic — a long tool
// run with a quiet CLI may false-positive, but the process is still alive and
// job.status stays "running"). dsh_worker_status surfaces liveness + activity.

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { resolveProfile } from './worker-profiles.mjs';
import { registerJob, publishStatus } from './jobs.mjs';
import { acquireCwdLock } from './cwd-lock.mjs';
import { ORIGIN_CHAIN_ENV, ORIGIN_DEPTH_ENV } from './origin-guard.mjs';

export const STALL_SECONDS = 120;
export const DEFAULT_TIMEOUT_MS = 1_800_000; // matches standalone spawn default
const SIGKILL_GRACE_MS = 2_000;
const PUBLISH_MIN_INTERVAL_MS = 2_000;
const RAW_LINE_CAP = 300; // bounded memory: keep the last N stream lines for debugging
const STDERR_TAIL_BYTES = 4_096;

let nextCliId = 1;

/** SIGTERM the process group, SIGKILL it after a grace period. Never throws. */
export function killGroup(child) {
  try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  const t = setTimeout(() => {
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }, SIGKILL_GRACE_MS);
  t.unref?.();
}

function usageToTokens(u) {
  return {
    input: (u?.input_tokens ?? 0) + (u?.cache_read_input_tokens ?? 0),
    output: u?.output_tokens ?? 0,
    reasoning: u?.thinking_tokens ?? 0,
  };
}

/** Absolute usage for a backend whose "result" event reports session totals. */
function setTokensFromUsage(job, u) {
  job.tokens = usageToTokens(u);
}

function addTokensFromUsage(job, u) {
  const t = usageToTokens(u);
  job.tokens.input += t.input;
  job.tokens.output += t.output;
  job.tokens.reasoning += t.reasoning;
}

function buildArgs(profile, task, timeoutMs, effortOverride) {
  if (profile.backend === 'agy') {
    const timeoutSec = Math.ceil(timeoutMs / 1000);
    const args = [
      '--print', task,
      '--output-format', 'stream-json',
      '--dangerously-skip-permissions',
      '--mode', 'accept-edits',
      '--print-timeout', `${timeoutSec + 15}s`, // self-exit backstop above our deadline
    ];
    if (profile.model) args.push('--model', profile.model);
    if (effortOverride && profile.effortMap?.[effortOverride]) {
      args.push('--effort', profile.effortMap[effortOverride]);
    }
    return args;
  }
  if (profile.backend === 'grok') {
    const args = [
      '-p', task,
      '--output-format', 'streaming-messages-json',
      '--include-partial-messages',
      '--permission-mode', 'bypassPermissions',
    ];
    if (profile.model) args.push('--model', profile.model);
    // grok-4.5 is not a reasoning model; no --reasoning-effort even when the
    // caller passes effort (profile.effortMap === null).
    return args;
  }
  throw new Error(`no CLI adapter for backend "${profile.backend}"`);
}

function makeLineHandler(profile, job) {
  if (profile.backend === 'agy') return handleAgyLine;
  if (profile.backend === 'grok') return handleGrokLine;
  throw new Error(`no CLI adapter for backend "${profile.backend}"`);
}

function handleAgyLine(job, line, msg) {
  const ev = msg.event;
  if (ev === 'init') {
    job.permissionMode = msg.init?.permission_mode ?? null;
    job.toolCount = msg.init?.tools?.length ?? 0;
    return;
  }
  if (ev === 'step_update') {
    const s = msg.step_update ?? {};
    job.turn = s.step_index ?? job.turn;
    job.step = (s.step_index ?? 0) + 1;
    if (s.step_type === 'agent_response' && typeof s.text_delta === 'string') {
      job._text = (job._text ?? '') + s.text_delta;
    }
    if (s.usage) addTokensFromUsage(job, s.usage);
    return;
  }
  if (ev === 'result') {
    const r = msg.result ?? {};
    job._agyStatus = r.status ?? null;
    if (typeof r.response === 'string') job.result = r.response;
    if (r.usage) setTokensFromUsage(job, r.usage);
    if (r.status && r.status !== 'SUCCESS') job.error = `agy result status: ${r.status}`;
    return;
  }
  if (ev === 'error') {
    job.error = msg.error ?? JSON.stringify(msg);
    return;
  }
}

function handleGrokLine(job, line, msg) {
  if (msg.type === 'system' && msg.subtype === 'init') {
    job.permissionMode = msg.permissionMode ?? null;
    job.modelUsed = msg.model ?? null;
    job.toolCount = msg.tools?.length ?? 0;
    return;
  }
  if (msg.type === 'stream_event') {
    const e = msg.event ?? {};
    switch (e.type) {
      case 'message_start': job._msgText = ''; break;
      case 'content_block_delta': {
        const d = e.delta ?? {};
        if (d.type === 'text_delta') job._msgText = (job._msgText ?? '') + d.text;
        break;
      }
      case 'message_delta': {
        if (e.usage) job._msgUsage = e.usage; // per-message; replaced by totals on result
        if (e.delta?.stop_reason) job._stopReason = e.delta.stop_reason;
        break;
      }
    }
    return;
  }
  if (msg.type === 'assistant' && msg.message) {
    const m = msg.message;
    const text = (m.content ?? [])
      .filter((c) => c?.type === 'text').map((c) => c.text).join('');
    if (text) job._msgText = text; // last whole message = the final answer
    if (m.usage) job._msgUsage = m.usage;
    if (m.stop_reason) job._stopReason = m.stop_reason;
    return;
  }
  if (msg.type === 'result') {
    job._grokIsError = !!msg.is_error;
    if (typeof msg.result === 'string') job.result = msg.result;
    if (msg.usage) setTokensFromUsage(job, msg.usage); // totals win over message sums
    if (msg.is_error) {
      job.error = String(msg.errors?.[0] ?? `grok result error (${msg.subtype})`).slice(0, 400);
    }
    return;
  }
  if (msg.type === 'error') {
    job.error = msg.error?.message ?? JSON.stringify(msg.error);
    return;
  }
}

function touchActivity(job) {
  const now = Date.now();
  job.activity.events += 1;
  job.activity.lastEventAt = new Date(now).toISOString();
  job.liveness = 'active';
  clearTimeout(job._stallTimer);
  job._stallTimer = setTimeout(() => {
    if (job.status !== 'running') return;
    job.liveness = 'stalled';
    publishStatus();
  }, STALL_SECONDS * 1000);
  job._stallTimer.unref?.();
  if (now - (job._lastPublishAt ?? 0) >= PUBLISH_MIN_INTERVAL_MS) {
    job._lastPublishAt = now;
    publishStatus();
  }
}

function settle(job, { status, error, stopReason }) {
  if (job._settled) return;
  job._settled = true;
  // Release the cwd lock on EVERY terminal path: exit (done/failed), spawn
  // error, timeout kill, cancel — all settle through here (WPC9).
  job._releaseCwdLock?.();
  job._releaseCwdLock = null;
  clearTimeout(job._timer);
  clearTimeout(job._stallTimer);
  if (job.status === 'cancelled') {
    job.stopReason ??= 'cancelled';
  } else {
    job.status = status;
    if (error !== undefined) job.error = job.error ?? error;
    if (stopReason !== undefined) job.stopReason = job.stopReason ?? stopReason;
  }
  job.endedAt = new Date().toISOString();
  publishStatus();
  for (const w of job.waiters.splice(0)) w();
}

export async function startCliJob({ worker, task, cwd, timeoutMs = DEFAULT_TIMEOUT_MS, source = 'api', effort, origin = null, allowConcurrentCwd = false }) {
  const profile = typeof worker === 'string' ? resolveProfile(worker) : worker;
  const workspace = resolve(cwd ?? process.cwd());
  const args = buildArgs(profile, task, timeoutMs, effort);
  const id = `cli-${nextCliId++}-${Date.now().toString(36)}`;
  const startedAt = new Date().toISOString();

  // Cwd advisory lock BEFORE the child spawns: a conflicting dispatch is
  // refused with the holder info (WPC9). The lock is released by settle(),
  // which every terminal path passes through.
  let releaseLock = null;
  if (!allowConcurrentCwd) {
    releaseLock = acquireCwdLock({ cwd: workspace, jobId: id, backend: profile.backend, mode: 'cli', startedAt }).release;
  }

  const job = {
    id,
    backend: profile.backend,
    profile: profile.name,
    mode: 'cli',
    tier: profile.name, // display: profile name rides the tier column
    model: profile.model ?? '(cli default)',
    effort: (effort && profile.effortMap?.[effort]) ?? profile.effort ?? null,
    task, source, cwd: workspace,
    status: 'running', turn: 0, step: 0, currentTool: null, toolCalls: 0,
    tokens: { input: 0, output: 0, reasoning: 0 },
    startedAt, endedAt: null,
    origin_depth: origin?.depth ?? null, origin_chain: origin?.chain ?? null,
    result: null, error: null, stopReason: null,
    activity: { events: 0, lastEventAt: null },
    liveness: 'starting',
    waiters: [],
    permissionMode: null, modelUsed: null, toolCount: null,
    _text: '', _msgText: '', _msgUsage: null, _stopReason: null,
    _agyStatus: null, _grokIsError: false,
    _rawLines: [], _stderrTail: '',
    _timer: null, _stallTimer: null, _lastPublishAt: 0, _settled: false,
    _releaseCwdLock: releaseLock,
  };
  try {
    registerJob(job);
  } catch (err) {
    releaseLock?.();
    throw err;
  }

  let child;
  try {
    child = spawn(profile.cli, args, {
      cwd: workspace,
      // Origin guard: the CLI worker inherits the dispatch chain, so a crew
      // instance it starts itself continues the chain (WPC9).
      env: {
        ...process.env,
        ...(origin ? { [ORIGIN_CHAIN_ENV]: JSON.stringify(origin.chain), [ORIGIN_DEPTH_ENV]: String(origin.depth) } : {}),
      },
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    // spawn() throws synchronously only for malformed options; settle the job
    // so it does not linger as 'running' with no process behind it.
    settle(job, {
      status: 'failed',
      error: `could not spawn "${profile.cli}": ${err?.message ?? err}`,
      stopReason: 'spawn-failed',
    });
    return job;
  }
  job.pid = child.pid;
  job.pgid = -child.pid;
  // cancelJob() in jobs.mjs calls job.harness.close() — same interface as the
  // standalone DSH harness.
  job.harness = { child, close: async () => killGroup(child) };

  job._timer = setTimeout(() => {
    if (job.status !== 'running') return;
    // Mark failed immediately so dsh_worker_status shows the timeout during
    // the 0-2 s kill window; settle() finalizes endedAt/waiters on exit.
    job.status = 'failed';
    job.stopReason = 'timeout';
    job.error = `timed out after ${Math.round(timeoutMs / 1000)}s (CLI process group killed)`;
    job.liveness = 'stalled';
    publishStatus();
    killGroup(child);
    job._timedOut = true;
  }, timeoutMs);

  const handleLine = makeLineHandler(profile, job);
  let buf = '';
  child.stdout.on('data', (chunk) => {
    buf += chunk.toString();
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      job._rawLines.push(line.slice(0, 500));
      if (job._rawLines.length > RAW_LINE_CAP) job._rawLines.splice(0, job._rawLines.length - RAW_LINE_CAP);
      touchActivity(job);
      // Once failed/cancelled/timed-out, ignore what the dying process still
      // writes: its final error events must not overwrite the timeout/cancel
      // error we already recorded.
      if (job.status !== 'running') continue;
      try {
        handleLine(job, line, JSON.parse(line));
      } catch {
        // Non-JSON stdout line (banner, stray output): keep as evidence, no parse.
      }
    }
  });
  child.stderr.on('data', (chunk) => {
    job._stderrTail = (job._stderrTail + chunk.toString()).slice(-STDERR_TAIL_BYTES);
  });

  child.on('error', (err) => {
    settle(job, {
      status: 'failed',
      error: `could not spawn "${profile.cli}": ${err?.message ?? err} — is it installed and on PATH?`,
      stopReason: 'spawn-failed',
    });
  });

  child.on('exit', (code, signal) => {
    const timedOut = job._timedOut === true;
    if (job.status === 'running') {
      if (timedOut) {
        settle(job, { status: 'failed', stopReason: 'timeout' });
      } else if (job._agyStatus && job._agyStatus !== 'SUCCESS') {
        settle(job, { status: 'failed', stopReason: job._agyStatus });
      } else if (job._grokIsError) {
        settle(job, { status: 'failed', stopReason: 'error' });
      } else if (job.result != null && code === 0) {
        job.stopReason = job._stopReason ?? 'completed';
        settle(job, { status: 'done', stopReason: job.stopReason });
      } else if (job.result != null && code !== 0) {
        settle(job, {
          status: 'failed',
          stopReason: job._stopReason ?? `exit code ${code}`,
          error: job._stderrTail.trim().slice(-400) || `CLI exited with code ${code}`,
        });
      } else if (code === 0) {
        // Stream ended without a result event: fall back to accumulated text
        // and the last per-message usage we saw.
        job.result = job._text ?? job._msgText ?? '';
        if (job._msgUsage) addTokensFromUsage(job, job._msgUsage);
        job.stopReason = job._stopReason ?? 'completed';
        settle(job, { status: 'done', stopReason: job.stopReason });
      } else {
        settle(job, {
          status: 'failed',
          stopReason: `exit code ${code}${signal ? ` (signal ${signal})` : ''}`,
          error: job._stderrTail.trim().slice(-400) || `CLI exited with code ${code}`,
        });
      }
    } else {
      settle(job, { status: job.status }); // cancelled path: keep the cancellation
    }
  });

  return job;
}
