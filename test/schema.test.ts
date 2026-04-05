import { beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

describe('MCP schema compatibility', () => {
  beforeAll(() => {
    execSync('npm run build', { cwd: rootDir });
  }, 30000);

  it('advertises a strict-validator-safe cookiesFile schema', async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [join(rootDir, 'dist/serve.js')],
      cwd: rootDir,
      stderr: 'pipe',
    });
    const client = new Client({ name: 'schema-check', version: '0.0.0' });

    await client.connect(transport);
    const response = await client.listTools();
    await client.close();

    const readWebsite = response.tools.find(tool => tool.name === 'read_website');
    expect(readWebsite).toBeDefined();
    expect(readWebsite?.inputSchema.required).toEqual(['url']);
    expect(JSON.stringify(readWebsite?.inputSchema)).not.toContain('"optional"');
  });
});
