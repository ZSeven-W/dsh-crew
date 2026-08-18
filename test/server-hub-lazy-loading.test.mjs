import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOADER = resolve(ROOT, 'test/fixtures/reject-standalone-jobs-loader.mjs');

function waitForResponse(child, id) {
  return new Promise((resolveResponse, reject) => {
    let buffer = '';
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`timed out waiting for MCP response ${id}`));
    }, 5_000);

    const onData = (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const message = JSON.parse(line);
        if (message.id === id) {
          cleanup();
          resolveResponse(message);
          return;
        }
      }
    };
    const onExit = (code, signal) => {
      cleanup();
      reject(new Error(`MCP server exited before response ${id}: code=${code} signal=${signal}`));
    };
    const cleanup = () => {
      clearTimeout(timeout);
      child.stdout.off('data', onData);
      child.off('exit', onExit);
    };

    child.stdout.on('data', onData);
    child.on('exit', onExit);
  });
}

function send(child, message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

test('MCP starts and exposes hub tools without loading standalone jobs', async (t) => {
  const requests = [];
  const hub = createServer((request, response) => {
    requests.push({ method: request.method, url: request.url });
    response.setHeader('content-type', 'application/json');
    if (request.method === 'GET' && request.url === '/_dsh/dsh-crew/ping') {
      response.end(JSON.stringify({ ok: true, service: 'dsh-crew-hub' }));
      return;
    }
    if (request.method === 'POST' && request.url === '/_dsh/dsh-crew/jobs') {
      response.end(JSON.stringify({ ok: true, job: { id: 'hub-test' } }));
      return;
    }
    if (request.method === 'GET' && request.url?.startsWith('/_dsh/dsh-crew/jobs/hub-test?wait=')) {
      response.end(JSON.stringify({
        ok: true,
        job: {
          id: 'hub-test',
          model: 'deepseek-v4-flash',
          status: 'done',
          result: 'ok',
        },
      }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ ok: false, error: 'not found' }));
  });
  hub.listen(0, '127.0.0.1');
  await once(hub, 'listening');
  const address = hub.address();
  assert.ok(address && typeof address !== 'string');

  const home = await mkdtemp(resolve(tmpdir(), 'dsh-crew-test-'));
  const configDir = resolve(home, '.config/dsh-crew');
  await mkdir(configDir, { recursive: true });
  await writeFile(resolve(configDir, 'config.json'), JSON.stringify({
    mode: 'hub',
    hub_url: `http://127.0.0.1:${address.port}`,
  }));

  const child = spawn(process.execPath, [
    '--experimental-loader',
    LOADER,
    resolve(ROOT, 'src/server.mjs'),
  ], {
    cwd: ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, HOME: home },
  });

  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  t.after(async () => {
    if (child.exitCode === null) child.kill('SIGTERM');
    if (child.exitCode === null) await once(child, 'exit');
    await new Promise((resolveClose, rejectClose) => {
      hub.close((error) => error ? rejectClose(error) : resolveClose());
    });
    await rm(home, { recursive: true, force: true });
  });

  const initializeResponse = waitForResponse(child, 1);
  send(child, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'dsh-crew-test', version: '1.0.0' },
    },
  });
  const initialized = await initializeResponse;
  assert.equal(initialized.error, undefined, stderr);

  send(child, { jsonrpc: '2.0', method: 'notifications/initialized' });
  const toolsResponse = waitForResponse(child, 2);
  send(child, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const tools = await toolsResponse;
  assert.equal(tools.error, undefined, stderr);
  assert.ok(tools.result.tools.some((tool) => tool.name === 'dsh_run_worker'));

  const callResponse = waitForResponse(child, 3);
  send(child, {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'dsh_run_worker',
      arguments: {
        task: 'Reply with exactly the word: ok',
        tier: 'flash',
        effort: 'off',
        cwd: ROOT,
      },
    },
  });
  const call = await callResponse;
  assert.equal(call.error, undefined, stderr);
  const result = JSON.parse(call.result.content[0].text);
  assert.equal(result.model, 'deepseek-v4-flash');
  assert.equal(result.status, 'done');
  assert.equal(result.result, 'ok');
  assert.deepEqual(requests.map(({ method, url }) => `${method} ${url}`), [
    'GET /_dsh/dsh-crew/ping',
    'POST /_dsh/dsh-crew/jobs',
    'GET /_dsh/dsh-crew/jobs/hub-test?wait=1800',
  ]);
});
