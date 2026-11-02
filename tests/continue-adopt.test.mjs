// Continue after a host restart: the new MCP session has an empty job set.
//
// Without `adopt` the tool must answer with a readable error (it used to throw
// "text2 is not a function", because its `text` parameter shadowed the text()
// helper). With `adopt: true` it must reach the hub and send the prompt. A fake
// hub stands in; no live hub, no DSH host and no provider is used.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const API = '/_dsh/dsh-crew';

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

function close(server) {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
}

test('continue refuses a job from an earlier session readably, and adopt: true continues it', { timeout: 20_000 }, async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'crew-continue-adopt-'));
  const EARLIER = 'hub-earlier-1';
  const CONTINUED = 'hub-earlier-2';
  const requests = [];
  const view = (id, status, extra = {}) => ({
    id, sessionId: 'session-earlier', tier: 'flash', model: 'fixture-model', provider: 'fixture',
    effort: 'off', status, source: 'claude-code', task: 'fixture', cwd: root, turn: 0, step: 0,
    currentTool: null, toolCalls: 0, tokens: { input: 0, output: 0, reasoning: 0 }, mode: 'hub',
    messages: { delivered: 0, pending: 0, refused: 0 }, continued_from: null,
    lease_expires_at: null, startedAt: new Date().toISOString(),
    endedAt: status === 'running' ? null : new Date().toISOString(),
    result: status === 'done' ? 'earlier result' : null, error: null,
    stopReason: status === 'done' ? 'completed' : null, ...extra,
  });
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const url = new URL(req.url, 'http://localhost');
      requests.push({ method: req.method, path: url.pathname, body });
      const send = (status, value) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(value));
      };
      if (url.pathname === `${API}/ping`) return send(200, { ok: true, service: 'dsh-crew-hub' });
      if (req.method === 'GET' && url.pathname === `${API}/jobs/${EARLIER}`) {
        return send(200, { ok: true, job: view(EARLIER, 'cancelled') });
      }
      if (req.method === 'POST' && url.pathname === `${API}/jobs/${EARLIER}/continue`) {
        return send(200, { ok: true, job: view(CONTINUED, 'running', { continued_from: EARLIER }) });
      }
      if (req.method === 'GET' && url.pathname === `${API}/jobs/${CONTINUED}`) {
        return send(200, { ok: true, job: view(CONTINUED, 'done', { continued_from: EARLIER }) });
      }
      if (req.method === 'GET' && url.pathname === `${API}/jobs`) {
        return send(200, { ok: true, jobs: [view(EARLIER, 'cancelled'), view(CONTINUED, 'done', { continued_from: EARLIER })] });
      }
      return send(404, { ok: false, error: 'unknown route' });
    });
  });
  const port = await listen(server);
  let client;
  t.after(async () => {
    await client?.close().catch(() => {});
    await close(server);
    rmSync(root, { recursive: true, force: true });
  });

  const env = Object.fromEntries(Object.entries(process.env).filter(([, value]) => typeof value === 'string'));
  client = new Client({ name: 'continue-adopt', version: '1' });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../src/server.mjs', import.meta.url))],
    env: { ...env, CLAUDECODE: '1', DSHPLUGIN_CREW_CONFIG_DIR: root,
      DSHPLUGIN_CREW_HUB: `http://127.0.0.1:${port}` },
  }));

  // This session never spawned EARLIER, as after a host restart.
  const refused = await client.callTool({ name: 'dsh_worker_continue', arguments: {
    job_id: EARLIER, text: 'follow up after the restart',
  } });
  assert.notEqual(refused.isError, true, refused.content?.[0]?.text);
  assert.match(refused.content[0].text, /no such job in this session: hub-earlier-1 \(pass adopt: true/);
  assert.equal(requests.some((request) => request.path.endsWith('/continue')), false,
    'a refused continue must not reach the hub');

  const adopted = await client.callTool({ name: 'dsh_worker_continue', arguments: {
    job_id: EARLIER, text: 'follow up after the restart', adopt: true,
  } });
  assert.notEqual(adopted.isError, true, adopted.content?.[0]?.text);
  assert.match(adopted.content[0].text, /"id": "hub-earlier-2"/);
  assert.match(adopted.content[0].text, /"continued_from": "hub-earlier-1"/);

  const continueRequest = requests.find((request) => request.method === 'POST'
    && request.path === `${API}/jobs/${EARLIER}/continue`);
  assert.ok(continueRequest, 'adopt: true must reach the hub continue route');
  assert.equal(JSON.parse(continueRequest.body).text, 'follow up after the restart');

  // The continuation joins this session like a spawned job.
  const status = await client.callTool({ name: 'dsh_worker_status', arguments: {} });
  assert.match(status.content[0].text, /hub-earlier-2/);
});
