// Vision route: lets users paste images into DSH conversations on the
// text-only DeepSeek models.
//
// Two cooperating pieces:
// 1. A duck-typed LLM adapter registered as provider "deepseek-vision" that
//    advertises image input modality (passing the api-proxy admission gate)
//    and delegates every stream straight back to "deepseek-official".
//    registerAdapter does no instanceof check, so a plain object keeps the
//    zero-@deepseek-imports realm discipline.
// 2. A global agent/pre-step waterfall that appends a text transcription (via
//    the multimodal describeFile pipeline) after each ImageBlock. The image
//    block itself stays in history so the conversation still shows the picture;
//    the adapter above drops image blocks on the way to the model, which is
//    what keeps the DeepSeek serializer (it throws on any image block) happy.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { describeFileWithProvenance } from './multimodal.mjs';
import { tr } from './i18n.mjs';

const VISION_PROVIDER = 'deepseek-vision';
const DELEGATE = 'deepseek-official';
const ATTACH_DIR = join(homedir(), '.config', 'dsh-crew', 'attachments');

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

const TRANSCRIPT_PREFIX = (name) => tr(`[图片「${name}」已由视觉桥转写]`, `[Image "${name}" transcribed by the vision bridge]`);
// Both locales' prefixes must be recognised: the user may switch language after
// a transcription was written, and re-transcribing would duplicate it.
const TRANSCRIPT_MARKERS = ['[图片「', '[Image "'];

/** True when `block` is a transcription this route wrote for `imageBlock`. */
function isTranscriptFor(block, imageBlock) {
  if (block?.type !== 'text' || typeof block.text !== 'string') return false;
  const name = imageBlock?.attachment?.name;
  if (name && (block.text.startsWith(`[图片「${name}」`) || block.text.startsWith(`[Image "${name}"`))) return true;
  return TRANSCRIPT_MARKERS.some((m) => block.text.startsWith(m));
}

/**
 * Images live on in history for the UI, but never reach the model: the
 * transcription that follows each one already carries the content, so the image
 * block is dropped rather than replaced with a placeholder.
 */
function stripImages(content) {
  if (!Array.isArray(content)) return content;
  if (!content.some((b) => b?.type === 'image')) return content;
  const out = content.filter((b) => b?.type !== 'image');
  return out.length > 0 ? out : [{ type: 'text', text: tr('[图片已由视觉桥转写，详见随后的描述]', '[image transcribed by the vision bridge — see the description that follows]') }];
}

export function installVisionRoute(ctx, getConfig) {
  const llm = ctx.llm;
  const disposers = [];

  const adapter = {
    providerInfo: (p) => ({ id: p, name: tr('DeepSeek (视觉)', 'DeepSeek (Vision)') }),
    providerRetryPolicy: () => undefined,
    async listModels(p) {
      const models = await llm.listModels(DELEGATE);
      return models.map((m) => ({ ...m, provider: p, name: `${m.name} ◉`, inputModalities: ['text', 'image'] }));
    },
    async resolveModel(p, model, signal) {
      const base = await llm.resolveModelInfo(DELEGATE, model, signal);
      return { ...base, provider: p, name: `${base.name} ◉`, inputModalities: ['text', 'image'] };
    },
    async *stream(options) {
      // Safety net: any image block that survived pre-step would make the
      // DeepSeek serializer throw — strip defensively.
      // NOTE: routing reads top-level options.provider (adapterStream uses
      // this.registration(options.provider)); rewriting anything else
      // self-recurses into this adapter.
      const messages = options.messages?.map((m) => ({ ...m, content: stripImages(m.content) })) ?? options.messages;
      yield* llm.stream({ ...options, provider: DELEGATE, ...(messages === undefined ? {} : { messages }) });
    },
  };
  const handle = llm.registerAdapter([VISION_PROVIDER], adapter);
  disposers.push(() => handle());

  // Transcribe pending images before the step enters history. Applies to every
  // agent in this host: on a DS-only deployment any surviving image block is a
  // hard error downstream, so rewriting is strictly better than crashing.
  disposers.push(ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next();
    if (decision.kind !== 'enter') return decision;
    if (getConfig().vision_provider === 'off') return decision;
    let changed = false;
    const rewritten = [];
    for (const message of decision.messages) {
      if (!Array.isArray(message.content) || !message.content.some((b) => b?.type === 'image')) {
        rewritten.push(message);
        continue;
      }
      const content = [];
      for (const [i, block] of message.content.entries()) {
        if (block?.type !== 'image') { content.push(block); continue; }
        content.push(block); // keep the image so the conversation still shows it
        // Steps replay the whole history: skip anything already transcribed,
        // otherwise every step would append another copy.
        if (isTranscriptFor(message.content[i + 1], block)) continue;
        changed = true;
        try {
          const stored = await ctx.attachments.readImage(block.attachment, payload.signal);
          const sha = createHash('sha256').update(stored.data).digest('hex').slice(0, 12);
          const ext = EXT[block.attachment?.mediaType] ?? 'png';
          mkdirSync(ATTACH_DIR, { recursive: true });
          const path = join(ATTACH_DIR, `${sha}.${ext}`);
          if (!existsSync(path)) writeFileSync(path, stored.data);
          const name = block.attachment?.name ?? `${sha}.${ext}`;
          const { text: desc, provider } = await describeFileWithProvenance(getConfig, path, tr(
            '详细描述这张图片：整体内容、布局结构、可见文字（逐字）、颜色与显著元素。',
            'Describe this image in detail: overall content, layout, any visible text (verbatim), colours and notable elements.'));
          ctx.logger?.info?.(`dsh-crew: vision transcript for ${path} via ${provider}`);
          content.push({
            type: 'text',
            text: `${TRANSCRIPT_PREFIX(name)}\n${desc}\n${tr(
              `[原图: ${path} — 需要更多细节可用 describe_image 工具带具体问题查看]`,
              `[Original: ${path} — for more detail, ask the describe_image tool a specific question]`)}`,
          });
        } catch (err) {
          // Same prefix as a successful transcription so the dedup check above
          // treats it as handled — otherwise a broken provider would append a
          // fresh failure notice on every step.
          content.push({
            type: 'text',
            text: `${TRANSCRIPT_PREFIX(block.attachment?.name ?? tr('图片', 'image'))}\n${tr(`[转写失败: ${err?.message ?? err}]`, `[transcription failed: ${err?.message ?? err}]`)}`,
          });
        }
      }
      rewritten.push({ ...message, content });
    }
    return changed ? { kind: 'enter', messages: rewritten } : decision;
  }));

  ctx.logger?.info?.('dsh-crew: vision route registered (provider "deepseek-vision" + pre-step transcription)');
  return () => { for (const d of disposers.reverse()) { try { d(); } catch {} } };
}
