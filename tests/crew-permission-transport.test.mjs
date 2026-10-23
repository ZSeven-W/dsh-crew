import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// The HTTP destination is an isolated fake hub: these tests create no DSH
// agents, make no model calls, and grant no live session additional access.
for (const entry of ['src/server.mjs', 'lib/server.mjs']) {
  test(`${entry}: saved-default omission and explicit permission cross both MCP dispatch paths`, async () => {
    const seen = [];
    const jobs = new Map();
    const server = createServer(async (request, response) => {
      let body = '';
      for await (const chunk of request) body += chunk;
      const path = new URL(request.url, 'http://localhost').pathname;
      let data;
      if (path.endsWith('/ping')) data = { ok: true, service: 'dsh-crew-hub' };
      else if (path.endsWith('/providers')) data = { ok: true, providers: [] };
      else if (path.endsWith('/jobs') && request.method === 'POST') {
        const spec = JSON.parse(body);
        seen.push(spec);
        const job = { id: `fixture-${seen.length}`, status: 'done', result: 'fixture', cwd: spec.cwd };
        jobs.set(job.id, job);
        data = { ok: true, job };
      } else data = { ok: true, job: jobs.get(path.split('/').at(-1)) };
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(data));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const workspace = await mkdtemp(join(tmpdir(), 'crew-permission-test-'));
    const client = new Client({ name: 'crew-permission-test', version: '1' });
    const transport = new StdioClientTransport({
      command: process.execPath, args: [resolve(entry)],
      env: { ...process.env, DSHPLUGIN_CREW_HUB: `http://127.0.0.1:${server.address().port}` },
      stderr: 'pipe',
    });
    try {
      await client.connect(transport);
      const listed = await client.listTools();
      assert.ok(listed.tools.find(tool => tool.name === 'dsh_worker_config').inputSchema.properties.permission_preset);
      const configure = async extra => {
        const result = await client.callTool({ name: 'dsh_worker_config', arguments: { mode: 'hub', escalate_on_failure: false, ...extra } });
        assert.notEqual(result.isError, true);
      };
      const dispatch = async name => {
        const result = await client.callTool({ name, arguments: { task: 'isolated transport fixture', cwd: workspace } });
        assert.notEqual(result.isError, true);
        const view = JSON.parse(result.content[0].text);
        assert.equal(view.status, 'done');
        if (name === 'dsh_spawn_worker') await client.callTool({ name: 'dsh_worker_result', arguments: { job_id: view.id } });
      };
      await configure({});
      await dispatch('dsh_run_worker');
      assert.equal(Object.hasOwn(seen.at(-1), 'permissionPreset'), false);
      await configure({ permission_preset: 'danger-full-access' });
      await dispatch('dsh_run_worker');
      assert.equal(seen.at(-1).permissionPreset, 'danger-full-access');
      await dispatch('dsh_spawn_worker');
      assert.equal(seen.at(-1).permissionPreset, 'danger-full-access');
      await configure({ permission_preset: 'default' });
      await dispatch('dsh_run_worker');
      assert.equal(seen.at(-1).permissionPreset, 'default');
      await configure({ reset: true });
      await dispatch('dsh_run_worker');
      assert.equal(Object.hasOwn(seen.at(-1), 'permissionPreset'), false);
    } finally {
      await client.close();
      await new Promise(resolve => server.close(resolve));
      const safeParent = resolve(tmpdir());
      assert.equal(resolve(workspace).startsWith(safeParent + '\\') || resolve(workspace).startsWith(safeParent + '/'), true);
      await rm(workspace, { recursive: true, force: true });
    }
  });
}
