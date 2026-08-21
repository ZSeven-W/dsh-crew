// DSH host plugin: workers-hub.
// Runs DeepSeek workers as first-class in-host agent sessions (visible in the
// Web UI session list), exposes a loopback jobs API for the CC/Codex MCP shim,
// and serves the one-click installer endpoints for the settings page.

import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createShardWriter, readMergedStatus } from '../status-shard.mjs';

// No @deepseek-ai imports here on purpose: this plugin is loaded into the
// profile realm, and importing our own package copies would create duplicate
// module realms (symbol identity mismatches in the tool runtime). Everything
// below is either plain data or inlined logic that only touches ctx APIs.

/** Inlined from @deepseek-ai/dsh-agent model-selection.ts (same semantics). */
function installModelSelection(agentCtx, selection) {
  agentCtx.on('system-prompt/assemble', async (_assembly, _cause, next) => {
    const selected = selection.current;
    const assembled = await next();
    selection.assembled = selected;
    if (selected === undefined) return assembled;
    return { ...assembled, variables: { ...assembled.variables, provider: selected.provider, model: selected.model } };
  });
  agentCtx.on('agent/request', async (_payload, next) => {
    const resolved = await next();
    const selected = selection.assembled;
    if (selected === undefined) return resolved;
    const { reasoningEffort: _inherited, ...rest } = resolved;
    return {
      ...rest, provider: selected.provider, model: selected.model,
      ...(selected.reasoningEffort === undefined ? {} : { reasoningEffort: selected.reasoningEffort }),
    };
  });
}

/** Inlined shape of createUserMessage (role + fresh id, frozen). */
function userMessage(text) {
  return Object.freeze({
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  });
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
const TIER_MODELS = { flash: 'deepseek-v4-flash', pro: 'deepseek-v4-pro' };
const CONFIG_DIR = join(homedir(), '.config', 'dsh-crew');

// ---------- job registry ----------

class WorkerRegistry {
  constructor(ctx) {
    this.ctx = ctx;
    this.jobs = new Map();
    this.nextId = 1;
    this.shard = createShardWriter('hub');
  }

  view(job, withResult = false) {
    const v = {
      id: job.id, sessionId: job.sessionId, tier: job.tier, model: job.model,
      effort: job.effort, status: job.status, source: job.source, task: job.task.slice(0, 300),
      cwd: job.cwd, turn: job.turn, step: job.step, currentTool: job.currentTool,
      toolCalls: job.toolCalls, tokens: job.tokens, mode: 'hub',
      startedAt: job.startedAt, endedAt: job.endedAt,
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

  async spawn({ task, tier = 'flash', effort = 'max', cwd, source = 'api', provider = 'deepseek-official', preset }) {
    const model = TIER_MODELS[tier];
    if (!model) throw new Error(`unknown tier "${tier}"`);
    if (!['off', 'high', 'max'].includes(effort)) throw new Error(`unknown effort "${effort}"`);
    if (!cwd || !cwd.startsWith('/')) throw new Error('cwd must be an absolute path');
    await this.ctx.get('loader')?.await();

    const id = `hub-${this.nextId++}-${Date.now().toString(36)}`;
    const sessionId = `session-${randomUUID()}`;
    const job = {
      id, sessionId, tier, model, effort, task, source, cwd,
      status: 'running', turn: 0, step: 0, currentTool: null, toolCalls: 0,
      tokens: { input: 0, output: 0, reasoning: 0 },
      startedAt: new Date().toISOString(), endedAt: null,
      result: null, error: null, stopReason: null, handle: null, waiters: [],
      texts: [],
    };
    this.jobs.set(id, job);

    const selection = { provider, model, reasoningEffort: effort };
    const presets = this.ctx.get('agentPresets');
    const cfg = this.getConfig?.() ?? {};
    const wanted = preset ?? (tier === 'flash' ? cfg.preset_flash : cfg.preset_pro);
    const presetId = presets === undefined
      ? undefined
      : (await presets.resolve(!wanted || wanted === 'default' ? undefined : wanted)).id;

    const onEvent = (session, event) => {
      switch (event.type) {
        case 'step/start':
          job.turn = event.data?.turn ?? job.turn;
          job.step = event.data?.step ?? job.step;
          break;
        case 'tool/call': job.currentTool = event.data?.name ?? null; job.toolCalls += 1; break;
        case 'tool/result': job.currentTool = null; break;
        case 'assistant/message': {
          const u = event.data?.usage;
          if (u) {
            job.tokens.input += u.inputTokens ?? 0;
            job.tokens.output += u.outputTokens ?? 0;
            job.tokens.reasoning += u.reasoningTokens ?? 0;
          }
          const text = (event.data?.message?.content ?? [])
            .filter((c) => c?.type === 'text').map((c) => c.text).join('');
          if (text) job.texts.push(text);
          break;
        }
        case 'turn/end':
          job.stopReason = event.data?.reason?.kind ?? null;
          job.reasonDetail = event.data?.reason;
          break;
      }
      this.publish();
    };

    const run = async () => {
      const handle = await this.ctx.agents.create({
        sessionId,
        meta: { cwd, ...(presetId === undefined ? {} : { agentPreset: presetId }) },
        agentOptions: { provider: selection.provider, model: selection.model },
        setup: async (agentCtx) => {
          installModelSelection(agentCtx, { current: selection, assembled: undefined });
          if (presets !== undefined) await presets.mount(agentCtx, presetId);
          agentCtx.on('session/event', onEvent);
          agentCtx.on('agent/error', (payload) => {
            const err = payload?.error;
            job.error = err?.message ?? String(err);
          });
        },
      });
      job.handle = handle;
      try {
        // Group the worker session under the workspace of its cwd; create the
        // workspace when none exists yet (resolveByPath is exact-match, so a
        // job cwd never inherits a parent directory's workspace).
        const registry = this.ctx.get('workspaceRegistry');
        if (registry !== undefined) {
          const ws = (await registry.resolveByPath(cwd)) ?? (await registry.create(cwd));
          await ws.attachSession(sessionId);
        }
      } catch (err) {
        this.ctx.logger?.warn?.(`dsh-crew: workspace attach failed for ${cwd}: ${err?.message ?? err}`);
      }
      await handle.agent.whenIdle();
      handle.agent.followup(userMessage(task));
      await handle.agent.whenIdle();
      job.result = job.texts.at(-1) ?? '';
      job.status = job.stopReason === 'completed' ? 'done' : 'failed';
      if (job.status === 'failed' && !job.error) job.error = `turn ended: ${job.stopReason ?? 'unknown'}`;
      await this.ctx.sessions.flush(handle.agent.session);
    };

    job.promise = run()
      .catch((err) => {
        if (job.status === 'running') job.status = 'failed';
        job.error = job.error ?? (err?.message ?? String(err));
      })
      .finally(() => {
        job.endedAt = new Date().toISOString();
        job.currentTool = null;
        this.publish();
        for (const w of job.waiters.splice(0)) w();
      });

    this.publish();
    return job;
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

  async cancel(id) {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    if (job.status === 'running') {
      job.status = 'cancelled';
      job.error = 'cancelled by request';
      try { await job.handle?.dispose(); } catch {}
      this.publish();
    }
    return job;
  }

  async dispose() {
    for (const job of this.jobs.values()) {
      if (job.status === 'running') { try { await job.handle?.dispose(); } catch {} }
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
      kind: 'exact', path: `${ROUTE_BASE}/ping`,
      handler: (req, res) => sendJson(res, 200, { ok: true, service: 'dsh-crew-hub' }),
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
            const wait = Number(url.searchParams.get('wait') ?? 0);
            const job = await hub.wait(parts[0], Math.min(wait, 600) * 1000);
            if (!job) return sendJson(res, 404, { ok: false, error: 'no such job' });
            return sendJson(res, 200, { ok: true, job: hub.view(job, true) });
          }
          if (req.method === 'POST' && parts.length === 0) {
            const payload = await readBody(req);
            const job = await hub.spawn(payload);
            return sendJson(res, 200, { ok: true, job: hub.view(job) });
          }
          if (req.method === 'POST' && parts.length === 2 && parts[1] === 'cancel') {
            const job = await hub.cancel(parts[0]);
            if (!job) return sendJson(res, 404, { ok: false, error: 'no such job' });
            return sendJson(res, 200, { ok: true, job: hub.view(job, true) });
          }
          return sendJson(res, 404, { ok: false, error: 'unknown jobs endpoint' });
        } catch (err) {
          return sendJson(res, 400, { ok: false, error: err?.message ?? String(err) });
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
            presets: list.map((p) => ({ id: p.id, name: p.name ?? p.id })),
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
          if (target === 'claude-uninstall') return sendJson(res, 200, uninstallClaudeCode({}));
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
