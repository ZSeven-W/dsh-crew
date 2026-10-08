import { randomBytes } from 'node:crypto';

/** One bounded, side-effect-free host LLM request; never starts a worker. */
export async function probeProvider(llm, binding, { timeoutMs = 20000 } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) throw new Error('probe timeout must be 100..30000 ms');
  const nonce = randomBytes(12).toString('hex');
  const controller = new AbortController();
  let timer;
  const collect = async () => {
    let finish, matched = false;
    for await (const chunk of llm.stream({ ...binding, maxTokens: 256, signal: controller.signal,
      messages: [{ role: 'user', content: [{ type: 'text', text: `Call dsh_crew_probe_noop exactly once with nonce ${nonce}. This tool has no side effects. Do not answer with prose.` }] }],
      tools: [{ name: 'dsh_crew_probe_noop', description: 'A capability check with no filesystem or network effects.', parameters: {
        type: 'object', properties: { nonce: { type: 'string' } }, required: ['nonce'], additionalProperties: false,
      } }],
    })) {
      if (chunk.type === 'block-end' && chunk.block?.type === 'tool-call' && chunk.block.name === 'dsh_crew_probe_noop') {
        try { const args = JSON.parse(chunk.block.arguments); if (args?.nonce === nonce && Object.keys(args).length === 1) matched = true; } catch {}
      }
      if (chunk.type === 'finish') finish = chunk.reason?.kind;
    }
    if (!finish || finish === 'error' || finish === 'aborted') return { route_callable: false, tool_call_verified: false, status: 'route_error' };
    return { route_callable: true, tool_call_verified: matched, status: matched ? 'verified' : 'no_tool_call' };
  };
  try {
    const outcome = await Promise.race([collect(), new Promise(resolve => {
      timer = setTimeout(() => { controller.abort(); resolve({ route_callable: false, tool_call_verified: false, status: 'timeout' }); }, timeoutMs);
    })]);
    return { ...binding, checked_at: new Date().toISOString(), ...outcome };
  } catch {
    // Provider exception bodies can contain endpoint credentials. Expose the
    // observed failure category, not raw transport headers or error bodies.
    return { ...binding, checked_at: new Date().toISOString(), route_callable: false, tool_call_verified: false, status: 'route_error' };
  } finally { clearTimeout(timer); controller.abort(); }
}
