import { test } from 'node:test';
import assert from 'node:assert/strict';
import { probeProvider } from '../src/provider-probe.mjs';
const binding = { provider: 'configured-local', model: 'model' };
test('a completed structured no-op call verifies the configured route', async () => {
  let calls = 0;
  const result = await probeProvider({ async *stream(options) {
    calls++; assert.equal(options.provider, binding.provider); assert.equal(options.tools.length, 1);
    const nonce = /nonce ([a-f0-9]+)/.exec(options.messages[0].content[0].text)[1];
    yield { type: 'block-end', block: { type: 'tool-call', name: 'dsh_crew_probe_noop', arguments: JSON.stringify({ nonce }) } };
    yield { type: 'finish', reason: { kind: 'tool-calls' } };
  } }, binding);
  assert.equal(calls, 1); assert.equal(result.status, 'verified'); assert.equal(result.tool_call_verified, true);
});
test('prose, mismatched calls and failed completion never verify tools', async () => {
  for (const kind of ['completed', 'error']) {
    const result = await probeProvider({ async *stream() {
      yield { type: 'block-end', block: { type: 'tool-call', name: 'dsh_crew_probe_noop', arguments: '{"nonce":"wrong"}' } };
      yield { type: 'finish', reason: { kind } };
    } }, binding);
    assert.equal(result.tool_call_verified, false);
  }
});
test('unusable adapter errors are classified without leaking their bodies', async () => {
  const result = await probeProvider({ async *stream() { throw new Error('prepareCall missing; credential=secret'); } }, binding);
  assert.equal(result.status, 'route_error'); assert.equal(JSON.stringify(result).includes('secret'), false);
});
test('a hung adapter has a bounded observation window', async () => {
  const result = await probeProvider({ async *stream() { await new Promise(() => {}); } }, binding, { timeoutMs: 100 });
  assert.equal(result.status, 'timeout');
});
