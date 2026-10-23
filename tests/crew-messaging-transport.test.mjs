// Isolated transport tests for dsh_worker_message: a real MCP stdio server
// process, a real StdioClientTransport, and a fake loopback Hub on 127.0.0.1.
//
// Nothing here dispatches a worker, calls a model, or reaches a real DSH host:
// the fake Hub answers the documented jobs API and records exactly what the
// client sent. Workspace and lock state stay in the child MCP process (the cwd
// lock is process memory) and the only file touched is a fresh mkdtemp cwd.

import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const SAFE_PARENT = resolve(tmpdir());
const WORKSPACE = await mkdtemp(join(SAFE_PARENT, 'crew-messaging-transport-'));
const API = '/_dsh/dsh-crew';

after(async () => {
  assert.equal(resolve(WORKSPACE).startsWith(SAFE_PARENT), true);
  await rm(WORKSPACE, { recursive: true, force: true });
});

function sendJson(response, status, data) {
  const body = JSON.stringify(data);
  response.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
  response.end(body);
}

/** A loopback Hub stand-in implementing only the jobs endpoints Crew uses. */
async function fakeHub() {
  const requests = [];
  const messages = [];
  const jobs = new Map();
  let responder = null;

  const server = createServer(async (request, response) => {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    const url = new URL(request.url, 'http://localhost');
    const entry = {
      method: request.method,
      path: url.pathname,
      search: url.search,
      contentType: request.headers['content-type'],
      body: raw === '' ? null : JSON.parse(raw),
    };
    requests.push(entry);
    if (!entry.path.startsWith(API)) return sendJson(response, 404, { ok: false, error: 'unknown endpoint' });

    const rest = entry.path.slice(API.length);
    if (rest === '/ping') return sendJson(response, 200, { ok: true, service: 'dsh-crew-hub' });
    if (rest === '/providers') return sendJson(response, 200, { ok: true, providers: [] });
    if (rest === '/jobs' && entry.method === 'GET') return sendJson(response, 200, { ok: true, jobs: [...jobs.values()] });
    if (rest === '/jobs' && entry.method === 'POST') {
      const job = { id: `hub-spawn-${jobs.size + 1}`, status: 'running', cwd: entry.body?.cwd ?? null };
      jobs.set(job.id, job);
      return sendJson(response, 200, { ok: true, job });
    }

    const match = /^\/jobs\/([^/]+)(\/messages|\/cancel)?$/.exec(rest);
    if (match === null) return sendJson(response, 404, { ok: false, error: 'unknown jobs endpoint' });
    const id = decodeURIComponent(match[1]);
    const job = jobs.get(id);
    const route = match[2] ?? '';

    if (route === '/messages' && entry.method === 'POST') {
      messages.push({ id, ...entry });
      const override = responder?.({ id, job, entry });
      if (override !== undefined && override !== null) return sendJson(response, override.status ?? 200, override.data);
      if (job === undefined) return sendJson(response, 404, { ok: false, error: 'no such job' });
      job.lastMessage = { id: `message-${messages.length}`, delivery: entry.body?.delivery ?? 'steer', acceptedAt: new Date().toISOString() };
      // A continued job is running again until its turn settles (hub semantics).
      if (job.status !== 'running') { job.history = [...(job.history ?? []), { status: job.status, result: job.result ?? null }]; job.status = 'running'; job.result = null; }
      return sendJson(response, 200, { ok: true, job });
    }
    if (route === '/cancel' && entry.method === 'POST') {
      if (job === undefined) return sendJson(response, 404, { ok: false, error: 'no such job' });
      job.status = 'cancelled';
      return sendJson(response, 200, { ok: true, job });
    }
    if (job === undefined) return sendJson(response, 404, { ok: false, error: 'no such job' });
    return sendJson(response, 200, { ok: true, job });
  });

  await new Promise(done => server.listen(0, '127.0.0.1', done));
  return {
    port: server.address().port,
    requests,
    messages,
    jobs,
    respondWith(next) { responder = next; },
    close: () => new Promise(done => server.close(done)),
  };
}

async function withMcp(entry, hubUrl, body) {
  const client = new Client({ name: 'crew-messaging-transport-test', version: '1' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [resolve(entry)],
    env: { ...process.env, DSHPLUGIN_CREW_HUB: hubUrl },
    stderr: 'pipe',
  });
  await client.connect(transport);
  try {
    return await body(client);
  } finally {
    await client.close();
  }
}

function view(result) {
  assert.notEqual(result.isError, true, `unexpected error result: ${result.content?.[0]?.text}`);
  return JSON.parse(result.content[0].text);
}

function refusal(result) {
  assert.equal(result.isError, true, `expected an error result, got: ${result.content?.[0]?.text}`);
  return result.content[0].text;
}

/**
 * A refusal may come back either as an isError tool result (the tool answered)
 * or as a JSON-RPC validation error (the arguments never reached the tool).
 */
async function refusedText(call) {
  try {
    const result = await call();
    assert.equal(result.isError, true, `expected a refusal, got: ${result.content?.[0]?.text}`);
    return result.content[0].text;
  } catch (error) {
    return String(error?.message ?? error);
  }
}

const ENTRIES = ['src/server.mjs', 'lib/server.mjs'];

for (const entry of ENTRIES) {
  const bundled = entry.startsWith('lib/');
  let stale = false;
  if (bundled) {
    const source = await readFile(resolve(entry), 'utf8').catch(() => '');
    stale = !(source.includes('dsh_worker_message') && source.includes('/messages'));
  }

  test(`${entry}: dsh_worker_message round-trips through the Hub jobs API`, {
    skip: stale ? 'lib/server.mjs predates dsh_worker_message: run `npm run build:mcp`, then re-run this test to verify the bundle' : false,
  }, async (context) => {
    const hub = await fakeHub();
    const hubUrl = `http://127.0.0.1:${hub.port}`;
    try {
      await withMcp(entry, hubUrl, async (client) => {
        await context.test('advertises the documented message contract', async () => {
          const listed = await client.listTools();
          const tool = listed.tools.find(item => item.name === 'dsh_worker_message');
          assert.ok(tool, 'dsh_worker_message must be exposed');
          const schema = tool.inputSchema;
          assert.deepEqual([...schema.required].sort(), ['job_id', 'message']);
          assert.equal(schema.properties.message.minLength, 1);
          assert.equal(schema.properties.message.maxLength, 60000);
          assert.deepEqual(schema.properties.delivery.enum, ['steer', 'followup']);
          assert.equal(schema.properties.delivery.default, 'steer');
          assert.match(tool.description, /same session|SAME/);
        });

        await context.test('a steer reaches the running job as a POST and returns the receipt', async () => {
          hub.jobs.set('hub-1', { id: 'hub-1', status: 'running', cwd: WORKSPACE, sessionId: 'session-1' });
          const before = hub.messages.length;
          const accepted = view(await client.callTool({
            name: 'dsh_worker_message', arguments: { job_id: 'hub-1', message: 'look at src/a.mjs' },
          }));
          assert.equal(hub.messages.length, before + 1);
          const sent = hub.messages.at(-1);
          assert.equal(sent.id, 'hub-1');
          assert.equal(sent.path, `${API}/jobs/hub-1/messages`);
          assert.equal(sent.method, 'POST');
          assert.equal(sent.contentType, 'application/json');
          assert.deepEqual(sent.body, { message: 'look at src/a.mjs', delivery: 'steer' });
          assert.equal(accepted.id, 'hub-1');
          assert.equal(accepted.status, 'running');
          assert.equal(accepted.lastMessage.delivery, 'steer');
        });

        await context.test('an explicit followup is forwarded verbatim', async () => {
          const accepted = view(await client.callTool({
            name: 'dsh_worker_message',
            arguments: { job_id: 'hub-1', message: 'then run the tests', delivery: 'followup' },
          }));
          assert.deepEqual(hub.messages.at(-1).body, { message: 'then run the tests', delivery: 'followup' });
          assert.equal(accepted.lastMessage.delivery, 'followup');
        });

        await context.test('continuing a settled job re-holds its workspace and reports the result later', async () => {
          hub.jobs.set('hub-2', { id: 'hub-2', status: 'done', cwd: WORKSPACE, sessionId: 'session-2', result: 'first pass' });
          const accepted = view(await client.callTool({
            name: 'dsh_worker_message', arguments: { job_id: 'hub-2', message: 'one more pass' },
          }));
          assert.equal(accepted.id, 'hub-2');
          assert.equal(accepted.status, 'running');
          assert.equal(hub.messages.at(-1).id, 'hub-2');

          const status = JSON.parse((await client.callTool({ name: 'dsh_worker_status', arguments: {} })).content[0].text);
          const lock = status.find(item => item.kind === 'cwd-lock' && item.holder?.jobId === 'hub-2');
          assert.ok(lock, 'the continued worker must hold its workspace again');

          const refused = JSON.parse((await client.callTool({
            name: 'dsh_run_worker', arguments: { task: 'second writer', cwd: WORKSPACE },
          })).content[0].text);
          assert.equal(refused.rejected_by, 'cwd-lock');
          assert.match(refused.error, /already held by a running worker/);
          assert.equal(hub.requests.filter(item => item.path === `${API}/jobs` && item.method === 'POST').length, 0,
            'a refused dispatch must never reach the Hub');

          hub.jobs.get('hub-2').status = 'done';
          hub.jobs.get('hub-2').result = 'finished the second pass';
          const result = view(await client.callTool({ name: 'dsh_worker_result', arguments: { job_id: 'hub-2' } }));
          assert.equal(result.result, 'finished the second pass');

          const after = JSON.parse((await client.callTool({ name: 'dsh_worker_status', arguments: {} })).content[0].text);
          assert.equal(after.some(item => item.kind === 'cwd-lock' && item.holder?.jobId === 'hub-2'), false,
            'observing the settled state releases the workspace');
        });

        await context.test('unknown jobs and Hub refusals surface as errors, not as accepted messages', async () => {
          const beforeUnknown = hub.messages.length;
          const unknown = refusal(await client.callTool({
            name: 'dsh_worker_message', arguments: { job_id: 'hub-missing', message: 'hello' },
          }));
          assert.match(unknown, /no such job/);
          assert.equal(hub.messages.length, beforeUnknown, 'a missing job never receives a message body');

          hub.jobs.set('hub-3', { id: 'hub-3', status: 'running', cwd: WORKSPACE });
          hub.respondWith(({ id, entry }) => (id === 'hub-3' && entry.body.message.trim() === ''
            ? { status: 400, data: { ok: false, error: 'message must contain 1 to 60000 characters' } }
            : null));
          const blank = refusal(await client.callTool({
            name: 'dsh_worker_message', arguments: { job_id: 'hub-3', message: '   ' },
          }));
          assert.match(blank, /message must contain 1 to 60000 characters/);
          hub.respondWith(null);
        });

        await context.test('an empty payload or a non-Hub id never reaches the Hub', async () => {
          const before = hub.messages.length;
          const empty = await refusedText(() => client.callTool({
            name: 'dsh_worker_message', arguments: { job_id: 'hub-1', message: '' },
          }));
          assert.match(empty, /message|validation|too_small/i);
          const missing = await refusedText(() => client.callTool({
            name: 'dsh_worker_message', arguments: { job_id: 'hub-1' },
          }));
          assert.match(missing, /message|validation|required/i);
          const standalone = refusal(await client.callTool({
            name: 'dsh_worker_message', arguments: { job_id: 'job-standalone-1', message: 'hello' },
          }));
          assert.match(standalone, /requires a Hub worker job/);
          assert.equal(hub.messages.length, before);
        });

        await context.test('a disabled session refuses to message a worker', async () => {
          await client.callTool({ name: 'dsh_worker_config', arguments: { mode: 'hub', enabled: false } });
          const before = hub.messages.length;
          const disabled = await client.callTool({
            name: 'dsh_worker_message', arguments: { job_id: 'hub-1', message: 'hello' },
          });
          assert.equal(disabled.isError, true);
          assert.match(disabled.content[0].text, /worker dispatch is disabled/);
          assert.equal(hub.messages.length, before);
          await client.callTool({ name: 'dsh_worker_config', arguments: { enabled: true } });
        });
      });
    } finally {
      await hub.close();
    }
  });

  test(`${entry}: messaging without a reachable Hub is reported as unreachable`, {
    skip: stale ? 'lib/server.mjs predates dsh_worker_message: run `npm run build:mcp` first' : false,
  }, async () => {
    // A port that was just released: nothing listens there.
    const probe = createServer(() => {});
    await new Promise(done => probe.listen(0, '127.0.0.1', done));
    const closedPort = probe.address().port;
    await new Promise(done => probe.close(done));

    await withMcp(entry, `http://127.0.0.1:${closedPort}`, async (client) => {
      const unreachable = refusal(await client.callTool({
        name: 'dsh_worker_message', arguments: { job_id: 'hub-1', message: 'hello' },
      }));
      assert.match(unreachable, /hub not reachable/);
    });
  });
}
