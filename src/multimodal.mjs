// Multimodal bridge: gives the (text-only) DeepSeek model eyes and a brush by
// borrowing the vision / image-generation abilities of locally installed
// subscription CLIs (claude -p, codex exec, agy).
//
// Vision ladder (WPC11): native DeepSeek VL model deepseek-v4-flash-vision-exp
// (direct API call, key from DEEPSEEK_API_KEY or ~/.config/dsh-crew/.env — the
// same source the standalone dispatch uses) is preferred whenever a key is
// available; every failure degrades to the pre-existing CLI provider chain,
// which is kept byte-for-byte as the fallback. Image generation is untouched:
// the native model only ever looks at pictures.
//
// Tools are plain ToolDefinition-shaped objects (see @deepseek-ai/dsh-tools
// defineTool output) so the hub keeps its zero-@deepseek-imports realm
// discipline.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, isAbsolute, dirname } from 'node:path';
import { homedir } from 'node:os';
import { tr, setLang } from './i18n.mjs';

const CONFIG_DIR = join(homedir(), '.config', 'dsh-crew');
const CACHE_FILE = join(CONFIG_DIR, 'vision-cache.json');
const CACHE_CAP = 200;

// --- native DeepSeek vision backend ---------------------------------------
// Wire shape mirrors the DSH llm-deepseek adapter (dsh-v0.1.0-rc.8,
// packages/llm/llm-deepseek/src/serialize.ts): POST {base}/chat/completions
// with an OpenAI-style image_url content part carrying a base64 data URL.
const NATIVE_VISION_MODEL = 'deepseek-v4-flash-vision-exp';
const PUBLIC_DEEPSEEK_BASE = 'https://api.deepseek.com'; // $DEEPSEEK_BASE_URL overrides
const NATIVE_TIMEOUT_MS = 240_000;
// Provider ids a config file may name to pin the native path explicitly.
const NATIVE_VISION_PROVIDER_IDS = new Set(['native', 'deepseek-native']);

/**
 * Light .env loader — a copy of jobs.mjs loadDotEnv (duplicated on purpose so
 * the bridge keeps its import-clean, standalone discipline). Plain KEY=VALUE
 * lines only; a missing file yields {}.
 */
let dotEnv = null;
function loadDotEnv() {
  if (dotEnv) return dotEnv;
  dotEnv = {};
  try {
    for (const line of readFileSync(join(CONFIG_DIR, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && m[2]) dotEnv[m[1]] = m[2];
    }
  } catch {}
  return dotEnv;
}

/** Key for the native call: env wins, then ~/.config/dsh-crew/.env (same
 * precedence the standalone dispatch applies). */
function deepseekApiKey() {
  return String(process.env.DEEPSEEK_API_KEY ?? '').trim() || String(loadDotEnv().DEEPSEEK_API_KEY ?? '').trim();
}

function deepseekBaseUrl() {
  const base = String(process.env.DEEPSEEK_BASE_URL ?? '').trim().replace(/\/+$/, '');
  return base || PUBLIC_DEEPSEEK_BASE;
}

function run(cmd, args, { timeoutMs, cwd } = {}) {
  // spawn with stdin ignored: several agent CLIs (codex in particular) behave
  // differently when handed an open interactive stdin pipe.
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); }, timeoutMs ?? 180_000);
    child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { err += c; });
    child.on('error', (e) => { clearTimeout(timer); reject(new Error(`${cmd} spawn failed: ${e.message}`)); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (signal) reject(new Error(`${cmd} killed by ${signal} (timeout ${timeoutMs ?? 180_000}ms)\n${err.slice(-400)}`));
      else if (code !== 0) reject(new Error(`${cmd} exited ${code}\n${(err || out).slice(-400)}`));
      else resolve(out + (out === '' ? err : ''));
    });
  });
}

function cacheKey(parts) { return createHash('sha256').update(parts.join('\u0000')).digest('hex'); }
function readCache() { try { return JSON.parse(readFileSync(CACHE_FILE, 'utf8')); } catch { return {}; } }
function writeCache(cache) {
  try {
    const keys = Object.keys(cache);
    if (keys.length > CACHE_CAP) for (const k of keys.slice(0, keys.length - CACHE_CAP)) delete cache[k];
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(cache));
  } catch {}
}

const RESULT_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean' },
    tool: { type: 'string' },
    text: { type: 'string' },
    // Which backend actually answered, plus any native→CLI degradation reason
    // (e.g. "claude-code (native failed: HTTP 404 ...)").
    provider: { type: 'string' },
  },
  required: ['ok', 'tool', 'text'],
  additionalProperties: false,
};

async function describeViaClaude(model, imagePath, question) {
  const prompt = `Use your Read tool to view the image file at ${imagePath}, then answer concisely: ${question}. Reply with the answer only — no preamble.`;
  const { dirname } = await import('node:path');
  // NOTE: --allowedTools is variadic and would swallow a trailing prompt, so
  // the prompt rides directly on -p.
  return (await run('claude', ['-p', prompt, '--model', model, '--allowedTools', 'Read'], {
    timeoutMs: 180_000, cwd: dirname(imagePath),
  })).trim();
}

async function describeViaCodex(imagePath, question, model) {
  const prompt = `Look at the attached image and answer concisely: ${question}. Reply with the answer only.`;
  const modelArgs = model && model !== 'default' ? ['-c', `model="${model}"`] : [];
  const out = await run('codex', ['exec', '--skip-git-repo-check', ...modelArgs, '-i', imagePath, prompt], { timeoutMs: 180_000 });
  const lines = out.trim().split('\n').filter((l) => l.trim() !== '' && !l.startsWith('[20') && !/^(tokens used|codex$|user$|mcp:)/.test(l.trim()));
  return lines.slice(-12).join('\n').trim();
}

async function describeViaGrok(imagePath, question, model) {
  const { dirname, basename } = await import('node:path');
  const prompt = `View the image file at ./${basename(imagePath)} and answer concisely: ${question}. Reply with the answer only — no preamble.`;
  const modelArgs = model && model !== 'default' ? ['-m', model] : [];
  const out = await run('grok', [...modelArgs, '-p', prompt], { timeoutMs: 240_000, cwd: dirname(imagePath) });
  return out.trim();
}

async function describeViaAgy(imagePath, question, model) {
  const prompt = `View the image file at ${imagePath} and answer concisely: ${question}. Reply with the answer only — no preamble.`;
  const modelArgs = model && model !== 'default' ? ['--model', model] : [];
  try {
    return (await run('agy', [...modelArgs, '-p', prompt], { timeoutMs: 240_000 })).trim();
  } catch (err) {
    const msg = String(err?.message ?? err);
    if (/permission/i.test(msg)) {
      throw new Error(tr(
        'agy 需要 read_file 权限：在 Antigravity 的 settings.json 的 permissions.allow 里加入 read_file 规则，或改用其他视觉 provider。原始错误: ',
        'agy needs read_file permission: add a read_file rule to permissions.allow in Antigravity\'s settings.json, or pick another vision provider. Original error: ',
      ) + msg.slice(0, 160));
    }
    throw err;
  }
}

/** Shell-quote a value for interpolation into a custom command template. */
function shq(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }

const BUILTIN_VISION = ['claude-code', 'codex', 'grok', 'agy'];
const BUILTIN_IMAGEGEN = ['codex', 'agy', 'grok'];

/** Look up a user-defined provider entry by id. */
export function findCustomProvider(config, id) {
  return (config?.custom_providers ?? []).find((p) => p && p.id === id);
}

/** 'api' (OpenAI-compatible endpoint) or 'cli' (command template). Entries
 * created before the type field existed carry commands → cli. */
function entryType(entry) {
  return entry.type ?? ((entry.vision_command || entry.imagegen_command) ? 'cli' : 'api');
}

function extMime(p) {
  const e = p.toLowerCase().split('.').pop();
  return e === 'jpg' || e === 'jpeg' ? 'image/jpeg' : e === 'webp' ? 'image/webp' : e === 'gif' ? 'image/gif' : 'image/png';
}

async function fetchJson(url, { apiKey, body, timeoutMs }) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${url} → HTTP ${res.status}: ${text.slice(0, 300)}`);
    return JSON.parse(text);
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error(tr(`${url} 请求超时 (${timeoutMs}ms)`, `${url} timed out (${timeoutMs}ms)`));
    throw err;
  } finally { clearTimeout(t); }
}

function apiBase(entry) {
  const base = String(entry.base_url ?? '').trim().replace(/\/+$/, '');
  if (!base) throw new Error(tr(`自定义 provider "${entry.name ?? entry.id}" 未配置 Base URL`, `Custom provider "${entry.name ?? entry.id}" has no Base URL`));
  return base;
}

async function describeViaApi(entry, imagePath, question, model) {
  const base = apiBase(entry);
  const m = model && model !== 'default' ? model : entry.models?.[0];
  if (!m) throw new Error(tr(`自定义 provider "${entry.name ?? entry.id}" 未配置模型列表，无法确定视觉模型`, `Custom provider "${entry.name ?? entry.id}" has no models configured`));
  const b64 = readFileSync(imagePath).toString('base64');
  const data = await fetchJson(`${base}/chat/completions`, {
    apiKey: entry.api_key,
    timeoutMs: 240_000,
    body: {
      model: m,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `${question}\nReply with the answer only — no preamble.` },
          { type: 'image_url', image_url: { url: `data:${extMime(imagePath)};base64,${b64}` } },
        ],
      }],
    },
  });
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || text.trim() === '') throw new Error(tr(`${entry.name ?? entry.id} API 返回为空`, `${entry.name ?? entry.id} API returned an empty answer`));
  return text.trim();
}

async function describeViaNative(imagePath, question) {
  const b64 = readFileSync(imagePath).toString('base64');
  const data = await fetchJson(`${deepseekBaseUrl()}/chat/completions`, {
    apiKey: deepseekApiKey(),
    timeoutMs: NATIVE_TIMEOUT_MS,
    body: {
      model: NATIVE_VISION_MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: `${question}\nReply with the answer only — no preamble.` },
          { type: 'image_url', image_url: { url: `data:${extMime(imagePath)};base64,${b64}` } },
        ],
      }],
    },
  });
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || text.trim() === '') {
    throw new Error(tr('DeepSeek native 视觉 API 返回为空', 'DeepSeek native vision API returned an empty answer'));
  }
  return text.trim();
}

async function generateViaApi(entry, prompt, outputPath, size) {
  const base = apiBase(entry);
  // No fallback to the vision model list: a VL model would accept the call and
  // fail late (or bill for nothing). Image generation is opt-in per provider.
  const m = String(entry.imagegen_model ?? '').trim();
  if (!m) throw new Error(tr(
    `自定义 provider "${entry.name ?? entry.id}" 未配置生图模型（在设置 → DSH Crew → 自定义 Provider 的"生图模型"里填写）`,
    `Custom provider "${entry.name ?? entry.id}" has no image-gen model (fill in "Image-gen model" under Settings → DSH Crew → Custom providers)`));
  const body = { model: m, prompt, n: 1 };
  if (size && /^\d+x\d+$/.test(size)) body.size = size;
  const data = await fetchJson(`${base}/images/generations`, { apiKey: entry.api_key, timeoutMs: 480_000, body });
  const item = data?.data?.[0];
  let buf;
  if (item?.b64_json) buf = Buffer.from(item.b64_json, 'base64');
  else if (item?.url) {
    const r = await fetch(item.url);
    if (!r.ok) throw new Error(tr(`下载生成图失败: HTTP ${r.status}`, `Failed to download the generated image: HTTP ${r.status}`));
    buf = Buffer.from(await r.arrayBuffer());
  } else {
    throw new Error(tr(
      `${entry.name ?? entry.id} API 未返回图像数据: ${JSON.stringify(data).slice(0, 200)}`,
      `${entry.name ?? entry.id} API returned no image data: ${JSON.stringify(data).slice(0, 200)}`));
  }
  writeFileSync(outputPath, buf);
  return outputPath;
}

async function describeViaCustom(entry, imagePath, question, model) {
  const template = entry.vision_command;
  if (!template || !template.includes('{image}')) {
    throw new Error(tr(
      `自定义 provider "${entry.name ?? entry.id}" 的视觉命令未配置或缺少 {image} 占位符（可用 {image} {question} {model}，stdout 即答案）`,
      `Custom provider "${entry.name ?? entry.id}" has no vision command, or it lacks the {image} placeholder (available: {image} {question} {model}; stdout is the answer)`));
  }
  const cmd = template
    .replaceAll('{image}', shq(imagePath))
    .replaceAll('{question}', shq(question))
    .replaceAll('{model}', shq(model ?? 'default'));
  return (await run('/bin/bash', ['-lc', cmd], { timeoutMs: 240_000, cwd: dirname(imagePath) })).trim();
}

async function generateViaCustom(entry, prompt, outputPath, size) {
  const template = entry.imagegen_command;
  if (!template || !template.includes('{prompt}') || !template.includes('{output}')) {
    throw new Error(tr(
      `自定义 provider "${entry.name ?? entry.id}" 的生图命令未配置或缺少 {prompt}/{output} 占位符（可用 {prompt} {output} {size}，命令须把图片写到 {output}）`,
      `Custom provider "${entry.name ?? entry.id}" has no image-gen command, or it lacks the {prompt}/{output} placeholders (available: {prompt} {output} {size}; the command must write the image to {output})`));
  }
  const cmd = template
    .replaceAll('{prompt}', shq(prompt))
    .replaceAll('{output}', shq(outputPath))
    .replaceAll('{size}', shq(size ?? ''));
  const out = await run('/bin/bash', ['-lc', cmd], { timeoutMs: 480_000, cwd: dirname(outputPath) });
  if (!existsSync(outputPath)) {
    throw new Error(`custom command finished but ${outputPath} was not created. Tail:\n${out.trim().slice(-300)}`);
  }
  return outputPath;
}

async function generateViaCodex(prompt, outputPath, size) {
  // Run codex with cwd = the output directory and a relative save path, so the
  // write lands inside its sandbox's writable root regardless of policy.
  const { dirname, basename } = await import('node:path');
  const task = `$imagegen ${prompt}. Save exactly one image to ./${basename(outputPath)} in the current directory.${size ? ` Target size ${size}.` : ''}`;
  const out = await run('codex', ['exec', '--skip-git-repo-check', task], { timeoutMs: 480_000, cwd: dirname(outputPath) });
  if (!existsSync(outputPath)) {
    throw new Error(`codex finished but ${outputPath} was not created. Tail of output:\n${out.trim().slice(-400)}`);
  }
  return outputPath;
}

async function generateViaGrok(prompt, outputPath) {
  // Grok Build CLI: native generate_image tool, saves straight into cwd.
  const { dirname, basename } = await import('node:path');
  const p = `Use your generate_image tool to create: ${prompt}. Save it to ./${basename(outputPath)} in the current directory (convert to the requested format if needed). Reply with the saved path.`;
  const out = await run('grok', ['-p', p], { timeoutMs: 480_000, cwd: dirname(outputPath) });
  if (!existsSync(outputPath)) {
    throw new Error(`grok finished but ${outputPath} was not created. Tail:\n${out.trim().slice(-300)}`);
  }
  return outputPath;
}

async function generateViaAgy(prompt, outputPath) {
  // Antigravity CLI: native generate_image (Nano Banana) needs no permission
  // bypass, but saves into ~/.gemini/antigravity-cli/{brain,scratch}/... with a
  // sanitized name. A nonce in the requested filename lets us find the output.
  const { randomBytes } = await import('node:crypto');
  const { readdirSync, copyFileSync } = await import('node:fs');
  const nonce = randomBytes(4).toString('hex');
  const p = `Use ONLY your native generate_image tool — do not run shell commands or any other tools. Generate: ${prompt}. Save the file with a name containing ${nonce}. Reply with the saved path.`;
  await run('agy', ['-p', p], { timeoutMs: 480_000 });
  const root = join(homedir(), '.gemini', 'antigravity-cli');
  let fresh = 0;
  let found;
  try {
    for (const f of readdirSync(root, { recursive: true })) {
      const name = String(f);
      if (!/\.(png|jpe?g|webp)$/i.test(name)) continue;
      const p2 = join(root, name);
      const t = statSync(p2).mtimeMs;
      if (Date.now() - t > 8 * 60_000) continue;
      fresh += 1;
      // Only a nonce match is evidence the file answers THIS prompt. Falling
      // back to "the freshest image around" once shipped an unrelated file as
      // a successful generation (PATTERN-AUDIT D1) — an unverified match must
      // not be reported as success.
      if (name.includes(nonce)) { found = p2; break; }
    }
  } catch {}
  if (!found) {
    throw new Error(
      `agy finished but no saved image carries the nonce (${nonce}) under ~/.gemini/antigravity-cli` +
      (fresh > 0 ? ` — ${fresh} fresh image(s) were found but none verifiably answers this prompt; inspect them manually before trusting any` : ''));
  }
  copyFileSync(found, outputPath);
  return outputPath;
}

// --- connectivity test ------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** A small solid-colour PNG, built in memory so the test needs no fixture file. */
async function testPng(size = 64, rgb = [220, 40, 40]) {
  const { deflateSync } = await import('node:zlib');
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: size }, () => Buffer.from(rgb)))]);
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const TEST_QUESTION = 'What single colour fills this image? Answer with one word.';


/**
 * Probe a custom provider entry (as edited in the panel, saved or not) and
 * report per-step results. Image generation is never actually run — it would
 * cost money and minutes; only reachability and configuration are checked.
 * @returns {Promise<{ok: boolean, steps: Array<{name: string, ok: boolean, detail: string}>}>}
 */
export async function testProvider(entry, lang) {
  if (lang) setLang(lang);
  const steps = [];
  const push = (name, ok, detail) => { steps.push({ name, ok, detail: String(detail).slice(0, 400) }); return ok; };
  const type = entryType(entry ?? {});
  const tmp = join(CONFIG_DIR, 'test-image.png');

  if (type === 'api') {
    let base;
    try { base = apiBase(entry); } catch (err) { push(tr('配置', 'Configuration'), false, err.message); return { ok: false, steps }; }
    push(tr('配置', 'Configuration'), true, `${base}${entry.api_key ? tr(' · 带 API Key', ' · with API key') : tr(' · 无 Key（不发送 Authorization）', ' · no key (no Authorization header)')}`);

    // 1. Reachability + auth, via the optional /models endpoint.
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 20_000);
      const res = await fetch(`${base}/models`, {
        headers: entry.api_key ? { authorization: `Bearer ${entry.api_key}` } : {},
        signal: ctl.signal,
      }).finally(() => clearTimeout(t));
      const text = await res.text();
      if (res.ok) {
        let ids = [];
        try { ids = (JSON.parse(text).data ?? []).map((m) => m.id).filter(Boolean); } catch {}
        const missing = (entry.models ?? []).filter((m) => ids.length > 0 && !ids.includes(m));
        push(tr('连接 /models', 'Reach /models'), true, ids.length
          ? tr(`可达，返回 ${ids.length} 个模型${missing.length ? `；未列出: ${missing.join(', ')}` : ''}`,
            `reachable, ${ids.length} models returned${missing.length ? `; not listed: ${missing.join(', ')}` : ''}`)
          : tr('可达', 'reachable'));
      } else if (res.status === 401 || res.status === 403) {
        push(tr('连接 /models', 'Reach /models'), false, tr(`HTTP ${res.status}：鉴权失败，检查 API Key`, `HTTP ${res.status}: authentication failed, check the API key`));
        return { ok: false, steps };
      } else {
        push(tr('连接 /models', 'Reach /models'), true, tr(`HTTP ${res.status}（该端点可能未实现，继续实测视觉调用）`, `HTTP ${res.status} (endpoint may be unimplemented; continuing with a real vision call)`));
      }
    } catch (err) {
      push(tr('连接 /models', 'Reach /models'), false, err?.name === 'AbortError' ? tr('请求超时 (20s)', 'request timed out (20s)') : String(err.message ?? err));
      return { ok: false, steps };
    }

    // 2. Real vision round-trip on a tiny generated image.
    const model = entry.models?.[0];
    if (!model) { push(tr('视觉调用', 'Vision call'), false, tr('未配置模型列表', 'no models configured')); return { ok: false, steps }; }
    try {
      mkdirSync(CONFIG_DIR, { recursive: true });
      writeFileSync(tmp, await testPng());
      const answer = await describeViaApi(entry, tmp, TEST_QUESTION, model);
      push(tr('视觉调用', 'Vision call'), true, `${model} → “${answer.slice(0, 60)}”`);
    } catch (err) {
      push(tr('视觉调用', 'Vision call'), false, String(err.message ?? err));
      return { ok: false, steps };
    }

    if (String(entry.imagegen_model ?? '').trim()) {
      push(tr('生图配置', 'Image-gen setup'), true, tr(
        `模型 ${entry.imagegen_model.trim()}（未实际出图，避免产生费用与等待）`,
        `model ${entry.imagegen_model.trim()} (not actually run — that would cost money and time)`));
    } else {
      push(tr('生图配置', 'Image-gen setup'), true, tr(
        '未配置生图模型 → 该 provider 只提供视觉能力',
        'no image-gen model → this provider offers vision only'));
    }
    return { ok: true, steps };
  }

  // CLI: check the executables exist, then actually run the vision command.
  const bin = (cmd) => String(cmd).trim().split(/\s+/)[0];
  if (entry.vision_command) {
    try {
      const which = (await run('/bin/bash', ['-lc', `command -v ${shq(bin(entry.vision_command))}`], { timeoutMs: 15_000 })).trim();
      push(tr('视觉命令可执行', 'Vision command found'), true, which);
    } catch {
      push(tr('视觉命令可执行', 'Vision command found'), false, tr(`找不到可执行文件: ${bin(entry.vision_command)}`, `executable not found: ${bin(entry.vision_command)}`));
      return { ok: false, steps };
    }
    try {
      mkdirSync(CONFIG_DIR, { recursive: true });
      writeFileSync(tmp, await testPng());
      const answer = await describeViaCustom(entry, tmp, TEST_QUESTION, entry.models?.[0] ?? 'default');
      if (answer === '') { push(tr('视觉调用', 'Vision call'), false, tr('命令成功但没有输出', 'the command succeeded but printed nothing')); return { ok: false, steps }; }
      push(tr('视觉调用', 'Vision call'), true, `“${answer.slice(0, 60)}”`);
    } catch (err) {
      push(tr('视觉调用', 'Vision call'), false, String(err.message ?? err));
      return { ok: false, steps };
    }
  }
  if (entry.imagegen_command) {
    try {
      const which = (await run('/bin/bash', ['-lc', `command -v ${shq(bin(entry.imagegen_command))}`], { timeoutMs: 15_000 })).trim();
      push(tr('生图命令可执行', 'Image-gen command found'), true, tr(`${which}（未实际出图，避免长时间等待）`, `${which} (not actually run — that would take minutes)`));
    } catch {
      push(tr('生图命令可执行', 'Image-gen command found'), false, tr(`找不到可执行文件: ${bin(entry.imagegen_command)}`, `executable not found: ${bin(entry.imagegen_command)}`));
      return { ok: false, steps };
    }
  }
  if (steps.length === 0) push(tr('配置', 'Configuration'), false, tr('未填写任何命令', 'no command configured'));
  return { ok: steps.every((s) => s.ok), steps };
}

const modelListCache = new Map(); // provider -> { at, models }

/** List selectable models for CLIs that expose a `models` subcommand. */
export async function listVisionModels(provider, force = false, getConfig = null, lang = null) {
  if (lang) setLang(lang);
  if (!BUILTIN_VISION.includes(provider)) {
    const entry = getConfig ? findCustomProvider(getConfig(), provider) : null;
    const models = (entry?.models ?? []).map((m) => ({ value: String(m) }));
    // API providers must name a real model; only command-based ones have a
    // meaningful "let the CLI decide" option.
    return entryType(entry ?? {}) === 'api' ? models : [{ value: 'default', label: tr('default（CLI 默认）', 'default (CLI default)') }, ...models];
  }
  const cached = modelListCache.get(provider);
  if (!force && cached && Date.now() - cached.at < 60 * 60 * 1000) return cached.models;
  let models = [];
  if (provider === 'agy') {
    const out = await run('agy', ['models'], { timeoutMs: 60_000 });
    models = out.split('\n')
      .map((l) => l.split('\t'))
      .filter((parts) => parts.length >= 2 && /^[a-z0-9.-]+$/i.test(parts[0].trim()))
      .map((parts) => ({ value: parts[0].trim(), label: parts[1].trim() }));
  } else if (provider === 'grok') {
    const out = await run('grok', ['models'], { timeoutMs: 60_000 });
    models = out.split('\n')
      .map((l) => l.match(/^\s*[*-]\s+([a-z0-9.-]+)(\s+\(default\))?/i))
      .filter(Boolean)
      .map((m) => ({ value: m[1], label: m[1] + (m[2] ? tr('（默认）', ' (default)') : '') }));
  }
  const result = [{ value: 'default', label: tr('default（CLI 默认）', 'default (CLI default)') }, ...models];
  modelListCache.set(provider, { at: Date.now(), models: result });
  return result;
}

function envelope(tool, text) { return { ok: true, tool, text }; }

const VISION_PROVIDER_HINT = tr(
  `未知视觉 provider: PROVIDER（内置: ${BUILTIN_VISION.join(' / ')} / native，或在设置 → DSH Crew → 自定义 Provider 里添加）`,
  `Unknown vision provider: PROVIDER (built-in: ${BUILTIN_VISION.join(' / ')} / native, or add one under Settings → DSH Crew → Custom providers)`);

/**
 * Cache key for one vision answer. The leading 'v3' version tag plus the
 * backend discriminator make native results and CLI results different keys,
 * so a CLI-era entry ('v2' or the CLI backend) can never be served as a
 * native answer (and vice versa).
 */
function visionCacheKey({ backend, provider, model, imagePath, stat, question, custom, baseUrl }) {
  const parts = ['v3', backend, provider, model, imagePath, String(stat.size), String(stat.mtimeMs), question];
  if (baseUrl) parts.push(baseUrl);
  if (custom) parts.push(entryType(custom), custom.vision_command ?? '', custom.base_url ?? '');
  return cacheKey(parts);
}

/** Pre-existing CLI dispatch, byte-for-byte the old selection ladder. */
async function describeViaCli(provider, model, custom, imagePath, question) {
  if (custom) {
    return entryType(custom) === 'cli'
      ? describeViaCustom(custom, imagePath, question, model)
      : describeViaApi(custom, imagePath, question, model);
  }
  switch (provider) {
    case 'codex': return describeViaCodex(imagePath, question, model);
    case 'grok': return describeViaGrok(imagePath, question, model);
    case 'agy': return describeViaAgy(imagePath, question, model);
    default: return describeViaClaude(model, imagePath, question);
  }
}

/**
 * Core vision call with provenance, shared by the describe_image tool and the
 * pre-step transcriber.
 *
 * Ladder: native DeepSeek VL model (when DEEPSEEK_API_KEY is available) → the
 * existing CLI chain. The ladder covers the built-in CLI providers; explicit
 * custom providers keep their own configured path untouched. Every degradation
 * (no key, HTTP error, timeout, empty answer) is surfaced in the returned
 * `provider` string and on the console.
 *
 * @returns {Promise<{text: string, provider: string, model: string, cached: boolean}>}
 */
export async function describeFileWithProvenance(getConfig, imagePath, question) {
  const config = getConfig();
  const configured = config.vision_provider ?? 'claude-code';
  if (configured === 'off') throw new Error('vision bridge is disabled');
  const model = config.vision_model ?? 'haiku';
  const stat = statSync(imagePath);

  const isNativeId = NATIVE_VISION_PROVIDER_IDS.has(configured);
  const custom = BUILTIN_VISION.includes(configured) ? null : findCustomProvider(config, configured);
  if (!BUILTIN_VISION.includes(configured) && !isNativeId && !custom) {
    throw new Error(VISION_PROVIDER_HINT.replace('PROVIDER', configured));
  }
  // For an explicit 'native' id the CLI degradation target is the default
  // chain entry; for built-in CLI providers it is that provider itself.
  const cliProvider = isNativeId ? 'claude-code' : configured;
  const useNativeLadder = BUILTIN_VISION.includes(configured) || isNativeId;
  const cache = readCache();

  let nativeIssue = null;
  if (useNativeLadder) {
    const apiKey = deepseekApiKey();
    if (!apiKey) {
      nativeIssue = { skipped: true, reason: tr(
        '缺少 DEEPSEEK_API_KEY（环境变量或 ~/.config/dsh-crew/.env）',
        'no DEEPSEEK_API_KEY (env or ~/.config/dsh-crew/.env)') };
    } else {
      const key = visionCacheKey({ backend: 'native', provider: 'deepseek', model: NATIVE_VISION_MODEL, imagePath, stat, question, baseUrl: deepseekBaseUrl() });
      if (cache[key]) {
        return { text: cache[key], provider: `native · ${NATIVE_VISION_MODEL} (cached)`, model: NATIVE_VISION_MODEL, cached: true };
      }
      try {
        const started = Date.now();
        const text = await describeViaNative(imagePath, question);
        if (text === '') throw new Error('native returned an empty answer');
        cache[key] = text;
        writeCache(cache);
        console.warn(`dsh-crew: vision answered by native ${NATIVE_VISION_MODEL} in ${Date.now() - started}ms`);
        return { text, provider: `native · ${NATIVE_VISION_MODEL}`, model: NATIVE_VISION_MODEL, cached: false };
      } catch (err) {
        nativeIssue = { skipped: false, reason: String(err?.message ?? err) };
        console.warn(`dsh-crew: native vision failed, falling back to "${cliProvider}": ${nativeIssue.reason}`);
      }
    }
  }

  // Degradation target: the pre-existing CLI chain, exactly as before.
  const key = visionCacheKey({ backend: 'cli', provider: cliProvider, model, imagePath, stat, question, custom });
  let text = cache[key];
  const cached = Boolean(text);
  if (!text) {
    text = await describeViaCli(cliProvider, model, custom, imagePath, question);
    if (text === '') throw new Error(`${cliProvider} returned an empty answer`);
    cache[key] = text;
    writeCache(cache);
  }
  const provider = nativeIssue
    ? `${cliProvider} (native ${nativeIssue.skipped ? 'skipped' : 'failed'}: ${nativeIssue.reason.slice(0, 200)})`
    : cliProvider;
  return { text, provider, model, cached };
}

/** String-only view of the core call (kept for external callers). */
export async function describeFile(getConfig, imagePath, question) {
  const { text } = await describeFileWithProvenance(getConfig, imagePath, question);
  return text;
}

/**
 * @param getConfig () => global config (vision_provider, vision_model, imagegen_provider)
 */
export function createMultimodalTools(getConfig) {
  const describeImage = {
    name: 'describe_image',
    description: 'See an image through a vision-capable model (Claude / GPT / Grok / Gemini / custom CLI) and get an answer about it. Use whenever you need to understand an image file: screenshots, design renders, photos, diagrams. Ask a specific question for the most useful answer. Results are cached per image+question.',
    parameters: {
      type: 'object',
      properties: {
        image_path: { type: 'string', description: 'Absolute path to the image file (png/jpg/webp/gif)' },
        question: { type: 'string', description: 'What you want to know about the image. Default: a detailed description.' },
      },
      required: ['image_path'],
      additionalProperties: false,
    },
    output: {
      schema: RESULT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: value.text }],
    },
    async execute(args) {
      const config = getConfig();
      const provider = config.vision_provider ?? 'claude-code';
      if (provider === 'off') throw new Error(tr('视觉桥已关闭（设置 → DSH Crew → 视觉 provider）', 'the vision bridge is disabled (Settings → DSH Crew → Vision provider)'));
      const imagePath = String(args.image_path ?? '');
      if (!isAbsolute(imagePath) || !existsSync(imagePath)) throw new Error(`image_path must be an existing absolute path, got: ${imagePath}`);
      const question = typeof args.question === 'string' && args.question !== ''
        ? args.question
        : 'Describe this image in detail: layout, text content, notable elements.';
      const answer = await describeFileWithProvenance(getConfig, imagePath, question);
      // Same convention as generate_image: the provider (and any native→CLI
      // degradation reason) rides the text, plus a dedicated provider field.
      const text = answer.provider ? `${answer.text}\n(provider: ${answer.provider})` : answer.text;
      return { ok: true, tool: 'describe_image', text, provider: answer.provider };
    },
  };

  const generateImage = {
    name: 'generate_image',
    description: 'Generate a raster image from a text prompt via a subscription image model (codex → gpt-image-2, agy → Nano Banana, grok → Grok Imagine, custom → user-configured CLI). Provide a full visual description and an absolute output path. Note: output is a flat raster (no layers); for layered, editable design output use the OpenPencil pipeline instead.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Full visual description: subject, style, colors, composition, constraints' },
        output_path: { type: 'string', description: 'Absolute path to save the image (e.g. /path/to/hero.png)' },
        size: { type: 'string', description: 'Optional size hint, e.g. "1024x1024", "16:9"' },
        provider: { type: 'string', description: 'Override the configured image provider: codex | agy | grok | a custom provider id' },
      },
      required: ['prompt', 'output_path'],
      additionalProperties: false,
    },
    output: {
      schema: RESULT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: value.text }],
    },
    async execute(args) {
      const config = getConfig();
      const provider = args.provider ?? config.imagegen_provider ?? 'codex';
      if (provider === 'off') throw new Error(tr('生图已关闭（设置 → DSH Crew → 生图 provider）', 'image generation is disabled (Settings → DSH Crew → Image-gen provider)'));
      const outputPath = String(args.output_path ?? '');
      if (!isAbsolute(outputPath)) throw new Error(`output_path must be absolute, got: ${outputPath}`);
      const prompt = String(args.prompt ?? '').trim();
      if (prompt === '') throw new Error('prompt is required');
      const custom = BUILTIN_IMAGEGEN.includes(provider) ? null : findCustomProvider(config, provider);
      if (!BUILTIN_IMAGEGEN.includes(provider) && !custom) {
        throw new Error(tr(
          `未知生图 provider: ${provider}（内置: ${BUILTIN_IMAGEGEN.join(' / ')}，或在设置 → DSH Crew → 自定义 Provider 里添加）`,
          `Unknown image-gen provider: ${provider} (built-in: ${BUILTIN_IMAGEGEN.join(' / ')}, or add one under Settings → DSH Crew → Custom providers)`));
      }
      const saved = custom
        ? (entryType(custom) === 'cli'
          ? await generateViaCustom(custom, prompt, outputPath, args.size)
          : await generateViaApi(custom, prompt, outputPath, args.size))
        : provider === 'agy'
          ? await generateViaAgy(prompt, outputPath)
          : provider === 'grok'
            ? await generateViaGrok(prompt, outputPath)
            : await generateViaCodex(prompt, outputPath, args.size);
      const bytes = statSync(saved).size;
      return envelope('generate_image', `image saved: ${saved} (${Math.round(bytes / 1024)} KB, provider: ${provider})`);
    },
  };

  return [describeImage, generateImage];
}
