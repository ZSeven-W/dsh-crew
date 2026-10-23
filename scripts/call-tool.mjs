// Use the same Crew MCP protocol from a terminal when a client cannot refresh
// its tool list in an existing conversation. Input: {name, arguments} on stdin.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const request = JSON.parse(input);
const client = new Client({ name: 'crew-local-client', version: '1' });
const transport = new StdioClientTransport({ command: process.execPath,
  args: [fileURLToPath(new URL('../lib/server.mjs', import.meta.url))],
  env: { ...process.env }, stderr: 'inherit' });
try {
  await client.connect(transport);
  for (const item of Array.isArray(request) ? request : [request]) {
    const result = await client.callTool(item, undefined, { timeout: 120000 });
    process.stdout.write(JSON.stringify(result) + '\n');
    if (result.isError) { process.exitCode = 1; break; }
  }
} finally { await client.close(); }
