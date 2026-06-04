import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

describe('MCP SSRF protection', () => {
    let server: Server;
    let serverUrl = '';
    let hitCount = 0;

    beforeAll(async () => {
        execSync('npm run build', { cwd: rootDir });

        server = createServer((_, res) => {
            hitCount += 1;
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            res.end('<!doctype html><html><body>internal secret</body></html>');
        });

        server.listen(0, '127.0.0.1');
        await once(server, 'listening');

        const address = server.address();
        if (!address || typeof address === 'string') {
            throw new Error('Failed to determine test server address');
        }

        serverUrl = `http://127.0.0.1:${address.port}`;
    }, 30000);

    afterAll(async () => {
        server.close();
        await once(server, 'close');
    });

    it('rejects loopback read_website targets before fetching', async () => {
        const transport = new StdioClientTransport({
            command: process.execPath,
            args: [join(rootDir, 'dist/serve.js')],
            cwd: rootDir,
            stderr: 'pipe',
        });
        const client = new Client({ name: 'ssrf-check', version: '0.0.0' });

        await client.connect(transport);
        await expect(
            client.callTool({
                name: 'read_website',
                arguments: { url: serverUrl, pages: 1 },
            })
        ).rejects.toThrow('IP address is not allowed');
        await client.close();

        expect(hitCount).toBe(0);
    }, 15000);
});
