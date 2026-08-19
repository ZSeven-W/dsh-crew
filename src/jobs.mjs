// Job manager: each job runs one dsh-jsonrpc-agent runtime via the DSH SDK.
// Progress derived from session.event notifications; status mirrored to a
// JSON file so the Claude Code statusline (and anything else) can render it.

import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { createShardWriter } from './status-shard.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_DIR = join(homedir(), '.config', 'dsh-crew');
const STATUS_FILE = join(CONFIG_DIR, 'status.json');
const RUNTIME_BIN = join(ROOT, 'node_modules', '.bin', 'dsh-jsonrpc-agent');
const CORDIS = join(ROOT, 'worker.cordis.yml');

export const TIERS = {
  flash: { model: 'deepseek-v4-flash', label: 'V4 Flash' },
  pro: { model: 'deepseek-v4-pro', label: 'V4 Pro' },
};

function loadDotEnv() {
  const out = {};
  try {
    for (const line of readFileSync(join(CONFIG_DIR, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && m[2]) out[m[1]] = m[2];
    }
  } catch {}
  return out;
}

const jobs = new Map();
let nextId = 1;
const shard = createShardWriter('mcp');

function publishStatus() {
  shard.publish([...jobs.values()].map((j) => ({
    id: j.id, tier: j.tier, model: j.model, effort: j.effort, status: j.status, source: j.source,
    task: j.task.slice(0, 300), cwd: j.cwd, turn: j.turn, step: j.step, toolCalls: j.toolCalls,
    currentTool: j.currentTool, tokens: j.tokens,
    startedAt: j.startedAt, endedAt: j.endedAt,
  })));
}

export function jobView(j, { withResult = false } = {}) {
  const v = {
    id: j.id, tier: j.tier, model: j.model, effort: j.effort, status: j.status, source: j.source,
    task: j.task.slice(0, 300), turn: j.turn, step: j.step, currentTool: j.currentTool,
    tokens: j.tokens, toolCalls: j.toolCalls, startedAt: j.startedAt, endedAt: j.endedAt,
  };
  if (withResult) { v.result = j.result; v.error = j.error; v.stopReason = j.stopReason; }
  return v;
}

export function listJobs() { return [...jobs.values()]; }
export function getJob(id) { return jobs.get(id); }

export async function startJob({ task, tier = 'flash', effort = 'max', cwd, maxTokens = 49_152, timeoutMs = 1_800_000, source = 'api' }) {
  const tierInfo = TIERS[tier];
  if (!tierInfo) throw new Error(`unknown tier "${tier}" (expected: ${Object.keys(TIERS).join(', ')})`);
  if (!['off', 'high', 'max'].includes(effort)) throw new Error(`unknown effort "${effort}" (expected: off, high, max)`);

  // The DSH SDK is only needed by the standalone dispatch path, so it is
  // loaded lazily here instead of being a top-level import. The bundled MCP
  // server keeps every @deepseek-ai/* package external (see scripts/build-mcp.mjs):
  // hub mode never touches the SDK, and an installed copy without the package
  // fails on this line - with a hint - instead of dying at module load.
  let DeepSeekHarness;
  try {
    ({ DeepSeekHarness } = await import('@deepseek-ai/dsh-sdk-client'));
  } catch (err) {
    if (err?.code === 'ERR_MODULE_NOT_FOUND') {
      const hint = new Error(`@deepseek-ai/dsh-sdk-client not installed; standalone dispatch requires it - run pnpm install in ${ROOT}, or use hub mode (dsh_worker_config mode=hub) so jobs run inside a DSH instance`);
      hint.code = 'ERR_MODULE_NOT_FOUND';
      throw hint;
    }
    throw err;
  }

  if (!existsSync(RUNTIME_BIN)) throw new Error(`dsh-jsonrpc-agent not installed at ${RUNTIME_BIN}; run pnpm install in ${ROOT}`);
  const workspace = resolve(cwd ?? process.cwd());
  const id = `job-${nextId++}-${Date.now().toString(36)}`;
  const dotEnv = loadDotEnv();
  if (!process.env.DEEPSEEK_API_KEY && !dotEnv.DEEPSEEK_API_KEY) {
    throw new Error(`DEEPSEEK_API_KEY not found in env or ${join(CONFIG_DIR, '.env')}`);
  }

  const harness = new DeepSeekHarness({
    launch: {
      command: RUNTIME_BIN,
      args: [CORDIS],
      cwd: workspace,
      env: {
        ...process.env,
        ...dotEnv,
        DSH_CWD: workspace,
        DSH_SESSION_ROOT: join(CONFIG_DIR, 'sessions'),
        DSH_REASONING_EFFORT: effort,
      },
      requestTimeoutMs: timeoutMs,
    },
    cwd: workspace,
    provider: 'deepseek-official',
    model: tierInfo.model,
    maxTokens,
  });

  const job = {
    id, tier, model: tierInfo.model, effort, task, source, cwd: workspace,
    status: 'running', turn: 0, step: 0, currentTool: null, toolCalls: 0,
    tokens: { input: 0, output: 0, reasoning: 0 },
    startedAt: new Date().toISOString(), endedAt: null,
    result: null, error: null, stopReason: null, harness,
    waiters: [],
  };
  jobs.set(id, job);

  const sessionId = id;
  const onNotification = (n) => {
    if (n.method === 'session.status') return;
    if (n.method !== 'session.event') return;
    if (n.params?.sessionId && n.params.sessionId !== sessionId) return;
    const e = n.params.event;
    if (!e?.type) return;
    switch (e.type) {
      case 'step/start': job.turn = e.data?.turn ?? job.turn; job.step = e.data?.step ?? job.step; break;
      case 'tool/call': job.currentTool = e.data?.name ?? null; job.toolCalls += 1; break;
      case 'tool/result': job.currentTool = null; break;
      case 'assistant/message': {
        const u = e.data?.usage;
        if (u) {
          job.tokens.input += u.inputTokens ?? 0;
          job.tokens.output += u.outputTokens ?? 0;
          job.tokens.reasoning += u.reasoningTokens ?? 0;
        }
        break;
      }
      case 'turn/end': job.stopReason = e.data?.reason?.kind ?? null; break;
    }
    publishStatus();
  };

  job.promise = harness
    .run(task, { sessionId, onNotification })
    .then((result) => {
      job.result = result.finalResponse ?? '';
      const lastEnd = [...(result.events ?? [])].reverse().find((ev) => ev?.type === 'turn/end');
      job.stopReason = lastEnd?.data?.reason?.kind ?? job.stopReason;
      job.status = job.stopReason === 'completed' ? 'done' : 'failed';
      if (job.status === 'failed' && !job.error) job.error = `turn ended with reason: ${job.stopReason ?? 'unknown'}`;
    })
    .catch((err) => {
      job.status = job.status === 'cancelled' ? 'cancelled' : 'failed';
      job.error = err?.message ?? String(err);
    })
    .finally(async () => {
      job.endedAt = new Date().toISOString();
      job.currentTool = null;
      try { await harness.close(); } catch {}
      publishStatus();
      for (const w of job.waiters.splice(0)) w();
    });

  publishStatus();
  return job;
}

export async function waitJob(id, timeoutMs) {
  const job = jobs.get(id);
  if (!job) throw new Error(`no such job: ${id}`);
  if (job.status !== 'running') return job;
  await Promise.race([
    new Promise((res) => job.waiters.push(res)),
    timeoutMs ? new Promise((res) => setTimeout(res, timeoutMs)) : new Promise(() => {}),
  ]);
  return job;
}

export async function cancelJob(id) {
  const job = jobs.get(id);
  if (!job) throw new Error(`no such job: ${id}`);
  if (job.status !== 'running') return job;
  job.status = 'cancelled';
  job.error = 'cancelled by request';
  try { await job.harness.close(); } catch {}
  publishStatus();
  return job;
}
