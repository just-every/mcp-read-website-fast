import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execSync, spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

describe('fetch integration', () => {
  let server: Server;
  let serverUrl = '';

  beforeAll(async () => {
    execSync('npm run build', { cwd: rootDir });

    server = createServer((_, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end([
        '<!doctype html>',
        '<html>',
        '<head><title>Compat Smoke</title></head>',
        '<body>',
        '<main>',
        '<article>',
        '<h1>Compat Smoke</h1>',
        '<p>Fetch path works.</p>',
        '</article>',
        '</main>',
        '</body>',
        '</html>',
      ].join(''));
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

  it('fetches markdown through the built CLI without turndown interop errors', async () => {
    const cli = spawn(process.execPath, [join(rootDir, 'dist/index.js'), 'fetch', serverUrl], {
      cwd: rootDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    cli.stdout.on('data', data => {
      stdout += data.toString();
    });
    cli.stderr.on('data', data => {
      stderr += data.toString();
    });

    const [exitCode] = (await once(cli, 'close')) as [number | null];

    expect(exitCode).toBe(0);
    expect(stdout).toContain('<!-- Source:');
    expect(stderr).not.toContain("does not provide an export named 'gfm'");
    expect(stderr).not.toContain("Cannot access 'gfm' before initialization");
  }, 15000);
});
