// DSH host plugin: workers-hub.
// Runs DeepSeek workers as first-class in-host agent sessions (visible in the
// Web UI session list), exposes a loopback jobs API for the CC/Codex MCP shim,
// and serves the one-click installer endpoints for the settings page.

import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { isAbsoluteCwd, canonicalCwd } from '../paths.mjs';
import { createShardWriter, readMergedStatus } from '../status-shard.mjs';
import { procAlive, killWorkerProcess, parsePid, ProcKillRefused } from '../proc-kill.mjs';
import { installWorkerQuestionHandoff } from '../worker-question.mjs';
import { probeProvider } from '../provider-probe.mjs';
import { crewConfigDir } from '../config-paths.mjs';
import { WorkerMailbox, parentMessageTool, messageText, MAX_MESSAGE_LENGTH } from '../worker-mailbox.mjs';
import { pluginEnv } from '../plugin-env.mjs';
import { applyModelSelection } from './model-selection.mjs';
import { JobLog } from '../job-log.mjs';

// No @deepseek-ai imports here on purpose: this plugin is loaded into the
// profile realm, and importing our own package copies would create duplicate
// module realms (symbol identity mismatches in the tool runtime). Everything
// below either imports this package's own modules or touches ctx APIs.

/** Inlined shape of createUserMessage (role + fresh id, frozen). */
function userMessage(text) {
  return Object.freeze({
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  });
}

/**
 * The rejection a worker's ask_user_question receives. Shaped like the host's
 * UserQuestionError (name + code) so the seam restores it as one and the
 * model sees the message, the same way the host answers a question from a
 * child agent that has no human either (DELEGATED_CALLER).
 */
export function unattendedQuestion() {
  const error = new Error(
    'no one is attending this dsh-crew worker session, so a question cannot be answered and must not be waited on. '
    + 'Stop and put the unresolved question in your final message so the orchestrator can obtain the required answer or approval. '
    + 'An unanswered question grants no permission; never select an option automatically.',
  );
  error.name = 'UserQuestionError';
  error.code = 'UNATTENDED_WORKER';
  return error;
}

export const name = 'dsh-crew';
export const inject = ['agents', 'sessions', 'agentDefaultModel', 'tools', 'llm', 'attachments'];

// Optional: the host's durable locale preference seeds server-side strings
// before the panel is ever opened. Absent preference means "browser decides".
function seedLangFromHost(ctx) {
  try {
    const pref = ctx.settings?.get?.('locale')?.preference;
    if (pref) setLang(pref);
  } catch { /* settings service absent or shaped differently — keep the default */ }
}

import { setLang } from '../i18n.mjs';

const ROUTE_BASE = '/_dsh/dsh-crew';
// Tier -> {provider, model}. The defaults live in tier-binding.mjs; the
// caller may override per dispatch, and the hub's own config is the fallback
// when it does not (the same shape the preset lookup below uses).
import { describeBindings, resolveTierBinding, TIERS } from '../tier-binding.mjs';
const CONFIG_DIR = crewConfigDir();

// ---------- job registry ----------

/** Bounded task preview with a visible truncation marker (PATTERN-AUDIT D3:
// a silently truncated task reads like the whole brief in status views). */
function clipTask(task, cap = 300) {
  return task.length > cap ? task.slice(0, cap) + '…' : task;
}

/**
 * A job's own mailbox, built from the optional messaging token its dispatcher
 * supplied. Spawn and continue share this one rule so a continued job is
 * messaging-enabled exactly when a spawned one would be: no token means no
 * mailbox (the pre-messaging behavior), and WorkerMailbox enforces the token's
 * 32–128 character shape in both paths.
 */
function mailboxFromToken(messaging_token) {
  return messaging_token === undefined ? null : new WorkerMailbox(messaging_token);
}

// setTimeout fires at once for delays above 2^31-1 ms (~24.8 days), so every
// bound, explicit or from config, is clamped to one day.
const MAX_BOUND_SECONDS = 86_400;

/** Hard bound for a job: the explicit value, else the config default, else 30 min. */
function hardBoundSeconds(explicit, cfg) {
  const raw = Number.isFinite(explicit) && explicit > 0 ? explicit
    : (Number.isFinite(cfg.default_timeout_seconds) && cfg.default_timeout_seconds > 0 ? cfg.default_timeout_seconds : 1800);
  return Math.min(MAX_BOUND_SECONDS, Math.max(1, Math.floor(raw)));
}

/** Stall bound: no session event for this long settles the job. 0 disables it. */
function stallBoundSeconds(cfg) {
  const raw = cfg.stall_timeout_seconds;
  if (raw === 0) return 0;
  return Number.isFinite(raw) && raw > 0 ? Math.min(MAX_BOUND_SECONDS, Math.floor(raw)) : 1800;
}

/**
 * How long a settled job keeps its live agent for a warm dsh_worker_continue.
 * After that the agent is disposed and a later continue resumes the persisted
 * session instead (the cold path). Every live agent pins its whole session log,
 * so keeping them forever grows the hub by megabytes per job until it runs out
 * of heap. 0 releases the agent as soon as the job settles.
 */
function idleReleaseSeconds(cfg) {
  const raw = cfg.idle_release_seconds;
  if (raw === 0) return 0;
  return Number.isFinite(raw) && raw > 0 ? Math.min(MAX_BOUND_SECONDS, Math.floor(raw)) : 7200;
}

export class WorkerRegistry {
  constructor(ctx, shard = createShardWriter('hub')) {
    this.ctx = ctx;
    this.jobs = new Map();
    this.nextId = 1;
    this.shard = shard;
    // One session can be continued many times: each continuation is a new job
    // record on the same agent. The pointer says which record is running now,
    // and the weak map remembers which agents already own the worker tool.
    this.activeJobBySession = new Map();
    this.parentToolByAgent = new WeakMap();
  }

  /** Make `job` the job whose turn currently owns this session's agent. */
  activateSessionJob(job) {
    this.activeJobBySession.set(job.sessionId, job.id);
  }

  /**
   * The job a session's live agent is reporting for right now. A live agent is
   * shared by every continuation of its session, so an event listener captured
   * at spawn time must follow the newest job instead of the one it was born
   * with; `fallback` keeps the listener useful before any job is active.
   */
  activeSessionJob(sessionId, fallback) {
    const jobId = this.activeJobBySession.get(sessionId);
    return (jobId === undefined ? undefined : this.jobs.get(jobId)) ?? fallback;
  }

  /**
   * The mailbox `message_parent` must write to, resolved when the tool runs.
   * Returning null for a job that is not running (or was continued without a
   * token) lets the tool explain itself instead of writing into the previous
   * job's closed mailbox.
   */
  currentMailbox(sessionId) {
    const jobId = this.activeJobBySession.get(sessionId);
    const job = jobId === undefined ? undefined : this.jobs.get(jobId);
    if (job === undefined || job.status !== 'running') return null;
    return job.mailbox ?? null;
  }

  /**
   * Register the worker-facing `message_parent` tool once per agent. The live
   * continuation path finds the spawn-time registration (its resolver reads the
   * active job, so the tool follows the new job); the cold resume path has a
   * fresh agent and registers it here. A second registration would collide with
   * the first in the agent's tool layer, hence the weak map.
   */
  ensureParentMessageTool(agentCtx, sessionId) {
    if (agentCtx?.tools?.register === undefined) return undefined;
    const registered = this.parentToolByAgent.get(agentCtx);
    if (registered !== undefined) return registered;
    const tool = parentMessageTool(() => this.currentMailbox(sessionId));
    agentCtx.tools.register(tool);
    this.parentToolByAgent.set(agentCtx, tool);
    return tool;
  }

  view(job, withResult = false) {
    const v = {
      id: job.id, sessionId: job.sessionId, tier: job.tier, model: job.model, provider: job.provider,
      effort: job.effort, status: job.status, source: job.source, task: clipTask(job.task),
      cwd: job.cwd, turn: job.turn, step: job.step, currentTool: job.currentTool,
      toolCalls: job.toolCalls, tokens: job.tokens, mode: 'hub',
      messages: job.messages,
      continued_from: job.continued_from ?? null,
      lease_expires_at: job.lease === undefined ? null : new Date(job.lease.expiresAt).toISOString(),
      startedAt: job.startedAt, endedAt: job.endedAt,
      ...(job.questions === undefined ? {} : { questions: job.questions }),
    };
    if (withResult) {
      v.result = job.result; v.error = job.error; v.stopReason = job.stopReason;
      v.reasonDetail = job.reasonDetail;
    }
    return v;
  }

  publish() {
    this.shard.publish([...this.jobs.values()].map((j) => this.view(j)));
  }

  async spawn({ task, tier = 'flash', effort = 'max', cwd, source = 'api', provider, model, preset, messaging_token, timeout_seconds, lease_seconds }) {
    if (!TIERS.includes(tier)) throw new Error(`unknown tier "${tier}"`);
    // An explicit {provider, model} from the caller wins (the MCP process owns
    // session-level overrides, exactly as it does for presets); otherwise the
    // hub's own stored config decides, and failing that the tier default.
    const bound = resolveTierBinding(tier, this.getConfig?.() ?? {});
    const resolvedProvider = typeof provider === 'string' && provider.trim() !== '' ? provider.trim() : bound.provider;
    const resolvedModel = typeof model === 'string' && model.trim() !== '' ? model.trim() : bound.model;
    if (!['off', 'high', 'max'].includes(effort)) throw new Error(`unknown effort "${effort}"`);
    if (lease_seconds !== undefined && (!Number.isInteger(lease_seconds) || lease_seconds < 60 || lease_seconds > 3600)) {
      throw new Error('lease_seconds must be an integer from 60 to 3600');
    }
    // Accept POSIX, Windows drive (D:\x, C:/x) and UNC (\\srv\share) roots.
    if (!isAbsoluteCwd(cwd)) throw new Error('cwd must be an absolute path');
    const mailbox = mailboxFromToken(messaging_token);
    // One canonical form for the job, the advisory lock and the workspace
    // lookup: D:/x and D:\x must map to the same workspace on Windows.
    const cwdPath = canonicalCwd(cwd);
    await this.ctx.get('loader')?.await();

    // Resolve everything that can throw BEFORE the job is registered. A job in
    // this.jobs with no run(), no promise and no finalizer is a zombie: its
    // status stays 'running' forever and a message() awaiting job.started
    // hangs until the HTTP client gives up.
    const selection = { provider: resolvedProvider, model: resolvedModel, reasoningEffort: effort };
    const presets = this.ctx.get('agentPresets');
    const cfg = this.getConfig?.() ?? {};
    const wanted = preset ?? (tier === 'flash' ? cfg.preset_flash : cfg.preset_pro);
    const presetId = presets === undefined
      ? undefined
      : (await presets.resolve(!wanted || wanted === 'default' ? undefined : wanted)).id;

    const id = `hub-${this.nextId++}-${Date.now().toString(36)}`;
    const sessionId = `session-${randomUUID()}`;
    const log = new JobLog(id);
    log.record('status', `spawned tier=${tier} effort=${effort} model=${resolvedModel}`, { cwd: cwdPath });
    const job = {
      id, sessionId, tier, model: resolvedModel, provider: resolvedProvider, effort, task, source, cwd: cwdPath,
      status: 'running', turn: 0, step: 0, currentTool: null, toolCalls: 0,
      tokens: { input: 0, output: 0, reasoning: 0 },
      startedAt: new Date().toISOString(), endedAt: null,
      result: null, error: null, stopReason: null, handle: null, waiters: [],
      texts: [], mailbox, log,
      // Accepted / admitted / lost. Every text a dispatcher sends lands in one
      // bucket: pending when accepted, delivered once the agent's next step
      // starts, refused if the job settles first (or the steer throws).
      messages: { delivered: 0, pending: 0, refused: 0 },
      _pendingMessages: 0,
      presetId,
      continued_from: null,
    };
    job.started = new Promise(resolve => { job.markStarted = resolve; });
    if (lease_seconds !== undefined) job.lease = { seconds: lease_seconds, expiresAt: Date.now() + lease_seconds * 1000 };
    this.jobs.set(id, job);
    this.activateSessionJob(job);

    // A dispatch without an upper bound is a worker nobody can stop by waiting.
    this.armBounds(job, hardBoundSeconds(timeout_seconds, cfg), stallBoundSeconds(cfg));

    const onEvent = (session, event) => {
      const target = this.activeSessionJob(sessionId, job.eventTarget ?? job);
      this.trackEvent(target, target.log, event);
    };

    const run = async () => {
      job.ready = this.ctx.agents.create({
        sessionId,
        meta: { cwd: cwdPath, ...(presetId === undefined ? {} : { agentPreset: presetId }) },
        agentOptions: { provider: selection.provider, model: selection.model },
        setup: async (agentCtx) => {
          job.agentCtx = agentCtx;
          if (presets !== undefined) await presets.mount(agentCtx, presetId);
          if (mailbox) this.ensureParentMessageTool(agentCtx, sessionId);
          // Nobody attends a worker session, so a question would wait forever
          // (#13). Claim this agent's requests ahead of the Web answerer and
          // put them to the orchestrator through the running job's mailbox.
          installWorkerQuestionHandoff(agentCtx, job, () => this.publish(), {
            currentJob: () => this.activeSessionJob(sessionId, job.eventTarget ?? job),
            currentMailbox: () => this.currentMailbox(sessionId),
          });
          agentCtx.on('session/event', onEvent);
          agentCtx.on('agent/error', (payload) => {
            const target = this.activeSessionJob(sessionId, job.eventTarget ?? job);
            const err = payload?.error;
            if (target.status !== 'needs_input') target.error = err?.message ?? String(err);
            target.log.record('error', target.error ?? 'agent error');
          });
        },
      });
      const handle = await job.ready;
      job.handle = handle;
      // dsh 0.2.2 no longer allows an `agent/request` listener to change the
      // route; select it on the agent itself, before the first step.
      applyModelSelection(handle.agent, selection);
      if (job.status !== 'running') { await handle.dispose(); return; }
      try {
        // Group the worker session under the workspace of its cwd; create the
        // workspace when none exists yet (resolveByPath is exact-match, so a
        // job cwd never inherits a parent directory's workspace).
        const registry = this.ctx.get('workspaceRegistry');
        if (registry !== undefined) {
          const ws = (await registry.resolveByPath(cwdPath)) ?? (await registry.create(cwdPath));
          await ws.attachSession(sessionId);
        }
      } catch (err) {
        this.ctx.logger?.warn?.(`dsh-crew: workspace attach failed for ${cwdPath}: ${err?.message ?? err}`);
      }
      await handle.agent.whenIdle();
      handle.agent.followup(userMessage(task));
      job.markStarted();
      await handle.agent.whenIdle();
      if (job.status === 'running') {
        job.result = job.texts.at(-1) ?? '';
        job.status = job.stopReason === 'completed' ? 'done' : 'failed';
      }
      if (job.status === 'failed' && !job.error) job.error = `turn ended: ${job.stopReason ?? 'unknown'}`;
      await this.ctx.sessions.flush(handle.agent.session);
    };

    job.promise = run()
      .catch((err) => {
        if (job.status === 'running') job.status = 'failed';
        job.error = job.error ?? (err?.message ?? String(err));
      })
      .finally(() => this.finish(job, log));

    this.publish();
    return job;
  }

  /** Renew a job's lease (a dispatcher poll is proof someone still waits). */
  renewLease(job) {
    if (job?.lease !== undefined) job.lease.expiresAt = Date.now() + job.lease.seconds * 1000;
  }

  /**
   * Arm a job's two bounds: a hard wall-clock timer, and a stall bound that the
   * watchdog checks against the last session event (sweepStalls).
   */
  armBounds(job, hardSeconds, stallSeconds) {
    job.lastProgressAt = Date.now();
    job.stallSeconds = stallSeconds;
    job._timeoutTimer = setTimeout(() => this.expire(job, `timed out after ${hardSeconds}s`), hardSeconds * 1000);
    job._timeoutTimer.unref?.();
  }

  /**
   * Settle a running job as 'timeout'. The record is settled here, not after
   * dispose(): a hung agent may never unblock whenIdle, and the job must not
   * stay half-finished (no endedAt, pending counts, waiters). The last text
   * the worker wrote is kept as the result so the orchestrator can resume.
   */
  expire(job, error) {
    if (job.status !== 'running') return;
    job.status = 'timeout';
    job.error = error;
    if (!job.result && job.texts.length > 0) job.result = job.texts.at(-1);
    job.log.record('status', job.error, { status: 'timeout' });
    this.publish();
    const handle = job.handle;
    job.handle = undefined;
    try { handle?.dispose?.().catch(() => {}); } catch {}
    this.finish(job, job.log);
  }

  /** Settle running jobs with no session event within their stall bound. Called by the watchdog. */
  sweepStalls(now = Date.now()) {
    for (const job of this.jobs.values()) {
      if (job.status !== 'running' || !(job.stallSeconds > 0)) continue;
      const idleMs = now - job.lastProgressAt;
      if (idleMs < job.stallSeconds * 1000) continue;
      this.expire(job, `stalled: no progress for ${Math.floor(idleMs / 1000)}s (stall bound ${job.stallSeconds}s)`);
    }
  }

  /** Cancel running jobs whose dispatcher stopped polling. Called by the watchdog. */
  sweepLeases(now = Date.now()) {
    for (const job of this.jobs.values()) {
      if (job.status !== 'running' || job.lease === undefined) continue;
      if (now < job.lease.expiresAt) continue;
      job.status = 'cancelled';
      job.error = 'cancelled: dispatcher stopped polling (lease expired)';
      job.log.record('status', job.error, { status: 'cancelled' });
      const handle = job.handle;
      job.handle = undefined;
      try { handle?.dispose?.().catch(() => {}); } catch {}
      this.finish(job, job.log);
      this.publish();
    }
  }

  async wait(id, timeoutMs) {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    if (job.status !== 'running') return job;
    await Promise.race([
      new Promise((res) => job.waiters.push(res)),
      timeoutMs > 0 ? new Promise((res) => setTimeout(res, timeoutMs)) : Promise.resolve(),
    ]);
    return job;
  }

  /** Fold one session event into a job's counters and its per-job log. */
  trackEvent(job, log, event) {
    job.lastProgressAt = Date.now();
    switch (event.type) {
      case 'step/start':
        job.turn = event.data?.turn ?? job.turn;
        job.step = event.data?.step ?? job.step;
        log.record('step', `step ${job.step} (turn ${job.turn})`, { step: job.step, turn: job.turn });
        if (job._pendingMessages > 0) {
          job.messages.delivered += job._pendingMessages;
          job.messages.pending = Math.max(0, job.messages.pending - job._pendingMessages);
          log.record('message', `delivered ${job._pendingMessages} message(s) (next step started)`);
          job._pendingMessages = 0;
        }
        break;
      case 'tool/call': {
        const name = event.data?.name ?? 'tool';
        job.currentTool = name;
        job.toolCalls += 1;
        log.record('tool_call', name, { tool: name });
        break;
      }
      case 'tool/result':
        log.record('tool_result', `${job.currentTool ?? 'tool'} finished`, { ok: event.data?.ok !== false });
        job.currentTool = null;
        break;
      case 'assistant/message': {
        const u = event.data?.usage;
        if (u) {
          job.tokens.input += u.inputTokens ?? 0;
          job.tokens.output += u.outputTokens ?? 0;
          job.tokens.reasoning += u.reasoningTokens ?? 0;
        }
        const text = (event.data?.message?.content ?? [])
          .filter((c) => c?.type === 'text').map((c) => c.text).join('');
        if (text) {
          job.texts.push(text);
          log.record('text', text);
        }
        break;
      }
      case 'turn/end':
        job.stopReason = event.data?.reason?.kind ?? null;
        job.reasonDetail = event.data?.reason;
        log.record('status', `turn ended: ${job.stopReason ?? 'unknown'}`, { stop_reason: job.stopReason });
        break;
    }
    this.publish();
  }

  /** Settle a job's record after its run finishes (shared by spawn and continue). */
  finish(job, log) {
    if (job._finished === true) return;
    job._finished = true;
    clearTimeout(job._timeoutTimer);
    job.endedAt = new Date().toISOString();
    job.currentTool = null;
    job.markStarted();
    if (job._continues !== undefined) {
      const previous = this.jobs.get(job._continues);
      if (previous !== undefined) previous.continueOpen = false;
    }
    log.record('status', `job ${job.status}${job.error ? `: ${job.error}` : ''}`, { status: job.status });
    if (job.messages.pending > 0) {
      const lost = job.messages.pending;
      job.messages.refused += lost;
      job.messages.pending = 0;
      job._pendingMessages = 0;
      log.record('message', `refused ${lost} message(s): job settled before the next step`);
    }
    if (job.mailbox) {
      const finalText = String(job.result || job.error || '').trim() || `Worker ${job.status}`;
      job.mailbox.append('completion', finalText.slice(0, MAX_MESSAGE_LENGTH), { status: job.status });
      job.mailbox.close();
    }
    this.publish();
    for (const w of job.waiters.splice(0)) w();
    this.scheduleIdleRelease(job);
  }

  /** Keep a settled job's live agent for a warm continue, then dispose it. */
  scheduleIdleRelease(job) {
    if (job.handle === undefined || job.handle === null) return;
    clearTimeout(job._idleTimer);
    const seconds = idleReleaseSeconds(this.getConfig?.() ?? {});
    if (seconds === 0) { this.releaseIdle(job); return; }
    job._idleTimer = setTimeout(() => this.releaseIdle(job), seconds * 1000);
    job._idleTimer.unref?.();
  }

  /** Dispose a settled job's agent; a later continue takes the cold path. */
  releaseIdle(job) {
    clearTimeout(job._idleTimer);
    job._idleTimer = undefined;
    if (job.status === 'running') return;
    const handle = job.handle;
    if (handle === undefined || handle === null) return;
    job.handle = undefined;
    job.agentCtx = undefined;
    job.log?.record('status', 'idle agent released');
    try { Promise.resolve(handle.dispose?.()).catch(() => {}); } catch {}
  }

  /**
   * The settled job on a session that still holds its live agent. After a
   * continuation the agent belongs to the newest job, not the one named in
   * the request.
   */
  liveOwner(sessionId) {
    for (const job of this.jobs.values()) {
      if (job.sessionId === sessionId && job.status !== 'running' && job.handle !== undefined && job.handle !== null) return job;
    }
    return undefined;
  }

  ownedJob(id, token) {
    const job = this.jobs.get(id);
    if (!job?.mailbox) throw new Error('no messaging-enabled job with that id');
    job.mailbox.authorize(token);
    return job;
  }

  async message(id, token, text, replyTo) {
    const job = this.ownedJob(id, token);
    messageText(text);
    const handle = await job.ready;
    await job.started;
    if (job.status !== 'running' || !handle) {
      throw new Error(`worker is ${job.status}; dispatch a new task to continue completed work`);
    }
    if (replyTo !== undefined) {
      job.mailbox.reply(replyTo, text);
      job.messages.delivered += 1;
      job.log.record('message', 'reply delivered to a waiting tool');
      return { accepted: true, job_id: id, reply_to: replyTo, delivery: 'tool_reply' };
    }
    const message = Object.freeze({ ...userMessage(text), source: { kind: 'dsh-crew-orchestrator' } });
    job.messages.pending += 1;
    job._pendingMessages += 1;
    job.log.record('message', 'accepted (pending the next step)');
    try {
      handle.agent.steer(message);
    } catch (err) {
      job.messages.pending -= 1;
      job.messages.refused += 1;
      job._pendingMessages -= 1;
      job.log.record('message', `refused: ${err?.message ?? err}`);
      throw err;
    }
    return { accepted: true, job_id: id, message_id: message.id, delivery: 'next_step', pending: job.messages.pending };
  }

  async messages(id, token, after, wait, signal) {
    const job = this.ownedJob(id, token);
    return { job_id: id, ...await job.mailbox.wait(after, wait, signal), status: job.status };
  }

  /**
   * Continue a settled job in the same session: a new job record that resumes
   * the persisted session and asks the next question. This is what "the worker
   * still remembers" means; continuing must not need a fresh, amnesiac worker.
   */
  async continueJob(id, text, { timeout_seconds, messaging_token } = {}) {
    const previous = this.jobs.get(id);
    if (previous === undefined) throw new Error(`no such job: ${id}`);
    if (previous.status === 'running') throw new Error('worker is running: use dsh_worker_message to steer it');
    if (previous.continueOpen === true) throw new Error('worker is already being continued');
    messageText(text);
    // Same rule (and the same 32–128 character validation) as spawn. Built
    // before the claim is taken: a bad token must fail without leaving the old
    // job marked as being continued.
    const mailbox = mailboxFromToken(messaging_token);
    previous.continueOpen = true;

    try {
      return this.startContinuation(previous, text, timeout_seconds, mailbox);
    } catch (err) {
      previous.continueOpen = false;
      throw err;
    }
  }

  /** The body of continueJob; the claim is already taken by the caller. */
  startContinuation(previous, text, timeout_seconds, mailbox = null) {
    const id = previous.id;
    const cfg = this.getConfig?.() ?? {};
    const presets = this.ctx.get('agentPresets');
    const selection = { provider: previous.provider, model: previous.model, reasoningEffort: previous.effort };
    const newId = `hub-${this.nextId++}-${Date.now().toString(36)}`;
    const log = new JobLog(newId);
    log.record('status', `continued from ${id}`, { continued_from: id });
    const job = {
      id: newId, sessionId: previous.sessionId, tier: previous.tier, model: previous.model, provider: previous.provider,
      effort: previous.effort, task: text, source: previous.source, cwd: previous.cwd,
      status: 'running', turn: 0, step: 0, currentTool: null, toolCalls: 0,
      tokens: { input: 0, output: 0, reasoning: 0 },
      startedAt: new Date().toISOString(), endedAt: null,
      result: null, error: null, stopReason: null, handle: null, waiters: [],
      texts: [], mailbox: mailbox ?? null, log, messages: { delivered: 0, pending: 0, refused: 0 }, _pendingMessages: 0,
      presetId: previous.presetId, continued_from: id, _continues: id,
    };
    job.started = new Promise(resolve => { job.markStarted = resolve; });
    this.jobs.set(newId, job);
    // From this moment the worker tool resolves to THIS job's mailbox, even
    // while the live agent is the one spawned for the previous job.
    this.activateSessionJob(job);

    this.armBounds(job, hardBoundSeconds(timeout_seconds, cfg), stallBoundSeconds(cfg));

    const run = async () => {
      // Preferred: the old agent is still live, so reusing its handle continues
      // the real session. Resuming the persisted session instead would fail
      // with "already owned by an active write handle" while that handle exists.
      const owner = this.liveOwner(previous.sessionId);
      if (owner !== undefined) {
        const live = owner.handle;
        const ownerCtx = owner.agentCtx;
        // The agent moves to this job: it is the one to dispose it later, and
        // the old record must not release it mid-turn.
        clearTimeout(owner._idleTimer);
        owner._idleTimer = undefined;
        owner.handle = undefined;
        owner.agentCtx = undefined;
        job.ready = Promise.resolve(live);
        owner.eventTarget = job;
        previous.eventTarget = job;
        job.handle = live;
        // The continuation lives on the previous job's agent, so it owns that
        // agent's tool registry too; a chained continuation must find it here.
        // `handle.agent.ctx` is the scoped context the host passes to setup, so
        // a job created before this bookkeeping existed still has a way back.
        job.agentCtx = ownerCtx ?? live.agent.ctx;
        // The spawn-time tool (if the old job had a mailbox) already resolves
        // its mailbox per call, so reusing the agent must NOT register a second
        // one. An agent spawned without a token has no tool yet; if this
        // continuation supplied one, add it once before the turn starts.
        if (job.mailbox !== null) {
          try {
            this.ensureParentMessageTool(job.agentCtx, previous.sessionId);
          } catch (err) {
            log.record('error', `message_parent unavailable: ${err?.message ?? err}`);
          }
        }
        await live.agent.whenIdle();
        if (job.status !== 'running') return;
        live.agent.followup(userMessage(text));
        job.markStarted();
        await live.agent.whenIdle();
        if (job.status === 'running') {
          job.result = job.texts.at(-1) ?? '';
          job.status = job.stopReason === 'completed' ? 'done' : 'failed';
        }
        if (job.status === 'failed' && !job.error) job.error = `turn ended: ${job.stopReason ?? 'unknown'}`;
        await this.ctx.sessions.flush(live.agent.session);
        return;
      }
      // Cold path: the hub restarted, the handle is gone; reload the persisted
      // session and continue on a fresh agent.
      job.ready = this.ctx.agents.resume({
        resumeSessionId: previous.sessionId,
        agentOptions: { provider: selection.provider, model: selection.model },
        setup: async (agentCtx) => {
          job.agentCtx = agentCtx;
          if (presets !== undefined) await presets.mount(agentCtx, previous.presetId);
          // A fresh agent has no spawn-time registration to reuse; register the
          // tool once when this continuation has a mailbox to write to. Without
          // a token the resumed turn keeps the old no-tool behavior.
          if (job.mailbox !== null) this.ensureParentMessageTool(agentCtx, previous.sessionId);
          installWorkerQuestionHandoff(agentCtx, job, () => this.publish(), {
            currentJob: () => this.activeSessionJob(previous.sessionId, job),
            currentMailbox: () => this.currentMailbox(previous.sessionId),
          });
          // This resumed handle can itself be continued later; its listeners
          // must follow the newest job on the session, exactly like the ones a
          // live agent inherited from spawn.
          agentCtx.on('session/event', (session, event) => {
            const target = this.activeSessionJob(previous.sessionId, job);
            this.trackEvent(target, target.log, event);
          });
          agentCtx.on('agent/error', (payload) => {
            const target = this.activeSessionJob(previous.sessionId, job);
            const err = payload?.error;
            if (target.status !== 'needs_input') target.error = err?.message ?? String(err);
            target.log.record('error', target.error ?? 'agent error');
          });
        },
      });
      const handle = await job.ready;
      job.handle = handle;
      if (job.status !== 'running') { job.handle = undefined; await handle.dispose(); return; }
      applyModelSelection(handle.agent, selection);
      await handle.agent.whenIdle();
      if (job.status !== 'running') { job.handle = undefined; await handle.dispose(); return; }
      handle.agent.followup(userMessage(text));
      job.markStarted();
      await handle.agent.whenIdle();
      if (job.status === 'running') {
        job.result = job.texts.at(-1) ?? '';
        job.status = job.stopReason === 'completed' ? 'done' : 'failed';
      }
      if (job.status === 'failed' && !job.error) job.error = `turn ended: ${job.stopReason ?? 'unknown'}`;
      await this.ctx.sessions.flush(handle.agent.session);
    };

    job.promise = run()
      .catch((err) => {
        if (job.status === 'running') job.status = 'failed';
        job.error = job.error ?? (err?.message ?? String(err));
      })
      .finally(() => this.finish(job, log));
    this.publish();
    return job;
  }

  async cancel(id) {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    if (job.status === 'running') {
      job.status = 'cancelled';
      job.error = 'cancelled by request';
      job.log?.record('status', 'cancelled by request', { status: 'cancelled' });
      const handle = job.handle;
      job.handle = undefined;
      try { await handle?.dispose(); } catch {}
      this.finish(job, job.log);
      this.publish();
    }
    return job;
  }

  async dispose() {
    for (const job of this.jobs.values()) {
      clearTimeout(job._idleTimer);
      job._idleTimer = undefined;
      const handle = job.handle;
      if (handle === undefined || handle === null) continue;
      job.handle = undefined;
      try { await handle.dispose(); } catch {}
    }
  }
}

// ---------- loopback route helpers (pattern from dsh-noema) ----------

function isIpv4Loopback(a) { return /^127(\.\d{1,3}){3}$/.test(a); }
function isLoopbackAddress(address) {
  if (!address) return false;
  const n = address.toLowerCase().split('%', 1)[0];
  if (n === '::1' || isIpv4Loopback(n)) return true;
  if (!n.startsWith('::ffff:')) return false;
  return isIpv4Loopback(n.slice(7));
}
function isLoopbackRequest(req) {
  if (!isLoopbackAddress(req.socket?.remoteAddress)) return false;
  const host = (req.headers.host ?? '').split(':')[0].toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || isIpv4Loopback(host);
}
function sendJson(res, status, value, headers = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'cross-origin-resource-policy': 'same-origin',
    ...headers,
  });
  res.end(body);
}
/**
 * The panel is the authority on the active locale (DSH's setting may be unset,
 * leaving it to the browser), so it tags requests with ?lang= / body.lang and
 * the hub adopts it. Conversation-side paths with no request behind them —
 * pasted-image transcription — then follow the same language.
 */
function adoptLang(value) {
  if (value === 'zh' || value === 'en') setLang(value);
}

/**
 * `?wait` as a non-negative integer second count. Absent/empty means 0;
 * anything non-numeric, fractional or negative is null (HTTP 400) — a
 * garbage wait must be an error, never a silent no-wait (PATTERN-AUDIT D2:
 * `?wait=abc` used to return immediately with 200 OK because
 * Math.min(NaN, 600) is NaN and the wait promise resolved instantly).
 */
export function parseWaitSeconds(value) {
  if (value === undefined || value === null || value === '') return 0;
  if (!/^\d+$/.test(String(value))) return null;
  const n = Number(value);
  if (!Number.isSafeInteger(n)) return null;
  return n;
}

async function readBody(req, limit = 64 * 1024) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > limit) throw new Error('payload too large');
  }
  return body.trim() === '' ? {} : JSON.parse(body);
}

// ---------- plugin entry ----------

export async function apply(ctx) {
  seedLangFromHost(ctx);
  const hub = new WorkerRegistry(ctx);
  try {
    const { readGlobalConfig } = await import('../install/install.mjs');
    hub.getConfig = () => readGlobalConfig();
  } catch {}
  const disposers = [];
  // Lease watchdog: a dispatcher that stops polling (closed window, crashed
  // session) must not leave a worker burning quota forever. Only opt-in leases
  // are swept; a job without lease_seconds is never auto-cancelled.
  // The same tick settles stalled jobs (no session event within the stall bound).
  const leaseTimer = setInterval(() => { hub.sweepLeases(); hub.sweepStalls(); }, 15_000);
  leaseTimer.unref?.();
  disposers.push(() => clearInterval(leaseTimer));

  // Multimodal bridge: register describe_image / generate_image for the DS
  // model. Config is read per call so settings-page edits apply live.
  try {
    const { createMultimodalTools } = await import('../multimodal.mjs');
    const { readGlobalConfig } = await import('../install/install.mjs');
    for (const tool of createMultimodalTools(() => readGlobalConfig())) {
      disposers.push(ctx.effect(() => ctx.tools.register(tool), `dsh-crew: ${tool.name} tool`));
    }
  } catch (err) {
    ctx.logger?.warn?.(`dsh-crew: multimodal tools unavailable: ${err?.message ?? err}`);
  }

  // Vision route: image paste on the text-only DS models (admission adapter +
  // pre-step transcription).
  try {
    const { installVisionRoute } = await import('../vision-route.mjs');
    const { readGlobalConfig } = await import('../install/install.mjs');
    disposers.push(installVisionRoute(ctx, () => readGlobalConfig()));
  } catch (err) {
    ctx.logger?.warn?.(`dsh-crew: vision route unavailable: ${err?.message ?? err}`);
  }

  ctx.inject(['webServer'], (webCtx) => {
    const webServer = webCtx.webServer;
    const disposers = [];

    disposers.push(webServer.register({
      kind: 'exact', path: `${ROUTE_BASE}/worker-probe`,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) return sendJson(res, 403, { ok: false, error: 'loopback only' });
        if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' }, { allow: 'POST' });
        if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) return sendJson(res, 415, { ok: false, error: 'application/json required' });
        try {
          const body = await readBody(req);
          if (typeof body.provider !== 'string' || body.provider.trim() === '' || typeof body.model !== 'string' || body.model.trim() === '') return sendJson(res, 400, { ok: false, error: 'provider and model required' });
          const result = await probeProvider(ctx.llm, { provider: body.provider.trim(), model: body.model.trim() });
          return sendJson(res, 200, { ok: true, result });
        } catch { return sendJson(res, 400, { ok: false, error: 'invalid probe request' }); }
      },
    }));

    disposers.push(webServer.register({
      kind: 'exact', path: `${ROUTE_BASE}/ping`,
      handler: (req, res) => sendJson(res, 200, { ok: true, service: 'dsh-crew-hub' }),
    }));

    // WPC14: liveness probe for a ghost job's recorded pid. The panel probes
    // orphaned tombstones that carry a pid so it can offer the "process still
    // alive" badge and a kill button; same process.kill(pid, 0) probe the
    // status shard uses for writer liveness (status-shard.mjs writerProcessAlive).
    disposers.push(webServer.register({
      kind: 'exact', path: `${ROUTE_BASE}/proc-alive`,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) return sendJson(res, 403, { ok: false, error: 'loopback only' });
        if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'GET only' }, { allow: 'GET' });
        try {
          const url = new URL(req.url, 'http://localhost');
          const pid = parsePid(url.searchParams.get('pid'));
          if (pid === null) return sendJson(res, 400, { ok: false, error: 'pid must be a positive integer' });
          return sendJson(res, 200, { ok: true, alive: procAlive(pid) });
        } catch (err) {
          return sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
        }
      },
    }));

    // WPC14: verified kill of a ghost job's recorded pid. The pid may have
    // been recycled since the job died, so the command line is read (ps) and
    // must match a process shape this plugin spawns (DSH runtime / agy /
    // grok) before anything is signalled; then SIGTERM (whole group when a
    // pgid is given) and SIGKILL after a ~3s grace. Refusals are readable,
    // in the origin-guard style.
    disposers.push(webServer.register({
      kind: 'exact', path: `${ROUTE_BASE}/proc-kill`,
      handler: async (req, res) => {
        if (pluginEnv('CREW_ISOLATED') === '1') return sendJson(res, 403, { ok: false, error: 'process killing is disabled in the isolated development instance' });
        if (!isLoopbackRequest(req)) return sendJson(res, 403, { ok: false, error: 'loopback only' });
        if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' }, { allow: 'POST' });
        try {
          const body = await readBody(req);
          adoptLang(body?.lang);
          const pid = parsePid(body?.pid);
          if (pid === null) return sendJson(res, 400, { ok: false, error: 'pid must be a positive integer' });
          let pgid = null;
          if (body.pgid !== undefined && body.pgid !== null) {
            pgid = parsePid(body.pgid);
            if (pgid === null) return sendJson(res, 400, { ok: false, error: 'pgid must be a positive integer' });
          }
          const result = await killWorkerProcess({ pid, pgid });
          return sendJson(res, 200, { ok: true, ...result });
        } catch (err) {
          if (err instanceof ProcKillRefused) {
            return sendJson(res, 403, { ok: false, error: err.message, code: err.code, pid: err.pid ?? null, command: err.command ?? null });
          }
          return sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
        }
      },
    }));

    disposers.push(webServer.register({
      kind: 'prefix', path: `${ROUTE_BASE}/jobs`,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) return sendJson(res, 403, { ok: false, error: 'loopback only' });
        try {
          const url = new URL(req.url, 'http://localhost');
          const parts = url.pathname.slice(`${ROUTE_BASE}/jobs`.length).split('/').filter(Boolean);
          if (req.method === 'GET' && parts.length === 0) {
            // Machine-wide view: this hub's live jobs plus fresh shards from
            // other writers (standalone MCP sessions, other hub instances).
            const own = [...hub.jobs.values()].map((j) => ({ ...hub.view(j), origin: hub.shard.writer }));
            const foreign = readMergedStatus({ excludeWriter: hub.shard.writer });
            return sendJson(res, 200, { ok: true, jobs: [...own, ...foreign] });
          }
          if (req.method === 'GET' && parts.length === 1) {
            const wait = parseWaitSeconds(url.searchParams.get('wait'));
            if (wait === null) return sendJson(res, 400, { ok: false, error: 'wait must be a non-negative integer number of seconds' });
            // A dispatcher poll is liveness evidence: renew unless the caller is
            // an internal probe (?renew=0), which must not keep a lease alive.
            const jobForLease = hub.jobs.get(parts[0]);
            if (jobForLease !== undefined && url.searchParams.get('renew') !== '0') hub.renewLease(jobForLease);
            const job = await hub.wait(parts[0], Math.min(wait, 600) * 1000);
            if (!job) return sendJson(res, 404, { ok: false, error: 'no such job' });
            return sendJson(res, 200, { ok: true, job: hub.view(job, true) });
          }
          if (req.method === 'POST' && parts.length === 0) {
            const payload = await readBody(req);
            const job = await hub.spawn(payload);
            return sendJson(res, 200, { ok: true, job: hub.view(job) });
          }
          if (parts.length === 2 && parts[1] === 'messages') {
            const token = req.headers['x-dsh-crew-job-token'];
            if (req.method === 'POST') {
              const body = await readBody(req);
              return sendJson(res, 200, { ok: true, result: await hub.message(parts[0], token, body.message, body.reply_to) });
            }
            if (req.method === 'GET') {
              const after = parseWaitSeconds(url.searchParams.get('after'));
              const wait = parseWaitSeconds(url.searchParams.get('wait'));
              if (after === null || wait === null || wait > 30) {
                return sendJson(res, 400, { ok: false, error: 'invalid message cursor or wait (maximum 30 seconds)' });
              }
              const controller = new AbortController();
              const onClose = () => controller.abort(new Error('message reader disconnected'));
              res.once('close', onClose);
              try {
                const result = await hub.messages(parts[0], token, after, wait, controller.signal);
                if (!res.destroyed) return sendJson(res, 200, { ok: true, result });
                return;
              } finally { res.removeListener('close', onClose); }
            }
          }
          if (req.method === 'POST' && parts.length === 2 && parts[1] === 'cancel') {
            const job = await hub.cancel(parts[0]);
            if (!job) return sendJson(res, 404, { ok: false, error: 'no such job' });
            return sendJson(res, 200, { ok: true, job: hub.view(job, true) });
          }
          if (req.method === 'POST' && parts.length === 2 && parts[1] === 'continue') {
            const body = await readBody(req);
            const job = await hub.continueJob(parts[0], body.text, {
              timeout_seconds: body.timeout_seconds,
              messaging_token: body.messaging_token,
            });
            return sendJson(res, 200, { ok: true, job: hub.view(job) });
          }
          return sendJson(res, 404, { ok: false, error: 'unknown jobs endpoint' });
        } catch (err) {
          if (!res.destroyed) return sendJson(res, 400, { ok: false, error: err?.message ?? String(err) });
        }
      },
    }));

    disposers.push(webServer.register({
      kind: 'exact', path: `${ROUTE_BASE}/config`,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) return sendJson(res, 403, { ok: false, error: 'loopback only' });
        try {
          const { readGlobalConfig, writeGlobalConfig } = await import(`../install/install.mjs?t=${Date.now()}`);
          if (req.method === 'GET') {
            adoptLang(new URL(req.url, 'http://localhost').searchParams.get('lang'));
            return sendJson(res, 200, { ok: true, config: readGlobalConfig() });
          }
          if (req.method === 'POST') return sendJson(res, 200, { ok: true, config: writeGlobalConfig(await readBody(req)) });
          return sendJson(res, 405, { ok: false, error: 'GET or POST' }, { allow: 'GET, POST' });
        } catch (err) {
          return sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
        }
      },
    }));

    disposers.push(webServer.register({
      kind: 'exact', path: `${ROUTE_BASE}/presets`,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) return sendJson(res, 403, { ok: false, error: 'loopback only' });
        try {
          const presets = ctx.get('agentPresets');
          if (presets === undefined) return sendJson(res, 200, { ok: true, presets: [] });
          const list = await presets.list();
          return sendJson(res, 200, {
            ok: true,
            defaultId: presets.defaultId,
            presets: list.map((p) => ({ id: p.id, name: p.name ?? p.id, trust: p.trust })),
          });
        } catch (err) {
          return sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
        }
      },
    }));

    // The MCP server runs as its own process and cannot reach ctx.llm, so the
    // routes the HOST has configured are published here. This is the whole
    // point of issue #10: a local model is configured once in DSH, and the
    // worker config names it instead of redefining it.
    disposers.push(webServer.register({
      kind: 'exact', path: `${ROUTE_BASE}/providers`,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) return sendJson(res, 403, { ok: false, error: 'loopback only' });
        try {
          const { readGlobalConfig } = await import('../install/install.mjs');
          const providers = ctx.llm.listProviders().map((p) => ({ id: p.id, name: p.name ?? p.id }));
          return sendJson(res, 200, {
            ok: true,
            providers,
            bindings: describeBindings(readGlobalConfig()),
          });
        } catch (err) {
          return sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
        }
      },
    }));

    disposers.push(webServer.register({
      kind: 'exact', path: `${ROUTE_BASE}/vision-models`,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) return sendJson(res, 403, { ok: false, error: 'loopback only' });
        try {
          const url = new URL(req.url, 'http://localhost');
          const provider = url.searchParams.get('provider');
          const force = url.searchParams.get('refresh') === '1';
          const lang = url.searchParams.get('lang');
          adoptLang(lang);
          const { listVisionModels } = await import('../multimodal.mjs');
          const { readGlobalConfig } = await import('../install/install.mjs');
          return sendJson(res, 200, { ok: true, models: await listVisionModels(provider, force, () => readGlobalConfig(), lang) });
        } catch (err) {
          return sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
        }
      },
    }));

    disposers.push(webServer.register({
      kind: 'exact', path: `${ROUTE_BASE}/provider-test`,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) return sendJson(res, 403, { ok: false, error: 'loopback only' });
        if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' });
        try {
          // The entry comes from the panel form so unsaved edits can be probed.
          const entry = await readBody(req);
          adoptLang(entry?.lang);
          const { testProvider } = await import('../multimodal.mjs');
          const result = await testProvider(entry, entry?.lang);
          return sendJson(res, 200, { ok: true, result });
        } catch (err) {
          return sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
        }
      },
    }));

    disposers.push(webServer.register({
      kind: 'exact', path: `${ROUTE_BASE}/install/status`,
      handler: async (req, res) => {
        if (!isLoopbackRequest(req)) return sendJson(res, 403, { ok: false, error: 'loopback only' });
        try {
          const { installStatus } = await import(`../install/install.mjs?t=${Date.now()}`);
          return sendJson(res, 200, { ok: true, status: installStatus() });
        } catch (err) {
          return sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
        }
      },
    }));

    disposers.push(webServer.register({
      kind: 'exact', path: `${ROUTE_BASE}/install`,
      handler: async (req, res) => {
        if (pluginEnv('CREW_ISOLATED') === '1') return sendJson(res, 403, { ok: false, error: 'global installers are disabled in the isolated development instance' });
        if (!isLoopbackRequest(req)) return sendJson(res, 403, { ok: false, error: 'loopback only' });
        if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' }, { allow: 'POST' });
        try {
          const { target, statusline } = await readBody(req);
          // Cache-busted import: the installer must always run the code
          // currently on disk, not whatever this process first loaded —
          // a stale cached copy once re-broke user settings after a fix.
          const {
            installClaudeCode, installCodex, installHudSegment, uninstallClaudeCode, uninstallCodex,
            installAgy, installGrok, uninstallAgy, uninstallGrok,
          } = await import(`../install/install.mjs?t=${Date.now()}`);
          if (target === 'claude') {
            const base = await installClaudeCode({ statusline: !!statusline });
            const hud = installHudSegment({});
            return sendJson(res, 200, {
              ok: base.ok,
              actions: [...base.actions, ...hud.actions.map((a) => `hud: ${a}`)],
            });
          }
          if (target === 'codex') return sendJson(res, 200, installCodex({}));
          if (target === 'agy') return sendJson(res, 200, installAgy({}));
          if (target === 'grok') return sendJson(res, 200, installGrok({}));
          if (target === 'claude-uninstall') return sendJson(res, 200, await uninstallClaudeCode({}));
          if (target === 'codex-uninstall') return sendJson(res, 200, uninstallCodex({}));
          if (target === 'agy-uninstall') return sendJson(res, 200, uninstallAgy({}));
          if (target === 'grok-uninstall') return sendJson(res, 200, uninstallGrok({}));
          return sendJson(res, 400, { ok: false, error: 'target must be claude | codex | agy | grok | claude-uninstall | codex-uninstall | agy-uninstall | grok-uninstall' });
        } catch (err) {
          return sendJson(res, 500, { ok: false, error: err?.message ?? String(err) });
        }
      },
    }));

    return () => { for (const d of disposers.reverse()) d(); };
  });

  ctx.logger?.info?.('dsh-crew hub mounted (jobs API + installer endpoints + multimodal tools)');
  return async () => {
    for (const d of disposers.reverse()) { try { d(); } catch {} }
    await hub.dispose();
  };
}
