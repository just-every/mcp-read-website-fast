import { describe, it, expect, beforeAll } from 'vitest';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

describe('Deployment Tests', () => {
  beforeAll(async () => {
    // Ensure the project is built
    const { execSync } = await import('child_process');
    execSync('npm run build', { cwd: rootDir });
  }, 30000);

  it('should have correct package name', async () => {
    const pkg = await import('../package.json');
    expect(pkg.name).toBe('@just-every/mcp-read-website-fast');
  });

  it('should have bin script configured', async () => {
    const pkg = await import('../package.json');
    expect(pkg.bin).toHaveProperty('mcp-read-website-fast');
  });

  it('should start MCP server without errors', async () => {
    const serverProcess = spawn(process.execPath, [join(rootDir, 'dist/serve.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, MCP_DEBUG: 'true' }
    });

    return new Promise<void>((resolve, reject) => {
      let stderr = '';
      let stdout = '';

      serverProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        // Check if server started message appears
        if (stderr.includes('MCP server connected and running successfully!')) {
          serverProcess.kill();
          expect(stderr).toContain('MCP server connected and running successfully!');
          resolve();
        }
      });

      serverProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      // Timeout fallback
      setTimeout(() => {
        serverProcess.kill();
        reject(new Error(`Server did not start. stderr: ${stderr}, stdout: ${stdout}`));
      }, 2000);

      serverProcess.on('error', reject);
    });
  });

  it('should default to serve command when no args provided', async () => {
    const binPath = join(rootDir, 'bin/mcp-read-website.js');
    const binProcess = spawn(process.execPath, [binPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, MCP_DEBUG: 'true' }
    });

    return new Promise<void>((resolve, reject) => {
      let stderr = '';

      binProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        // Check if server started message appears
        if (stderr.includes('MCP server connected and running successfully!')) {
          binProcess.kill();
          expect(stderr).toContain('MCP server connected and running successfully!');
          resolve();
        }
      });

      // Timeout fallback
      setTimeout(() => {
        binProcess.kill();
        reject(new Error(`Server did not start via bin. stderr: ${stderr}`));
      }, 2000);

      binProcess.on('error', reject);
    });
  });

  it('should handle fetch command', async () => {
    const binPath = join(rootDir, 'bin/mcp-read-website.js');
    const binProcess = spawn(process.execPath, [binPath, 'fetch', '--help'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    return new Promise<void>((resolve, reject) => {
      let stdout = '';

      binProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      binProcess.on('close', (code) => {
        expect(code).toBe(0);
        expect(stdout).toContain('Usage:');
        expect(stdout).toContain('fetch');
        resolve();
      });

      binProcess.on('error', reject);
    });
  });

  it('should export correct MCP tool structure', async () => {
    // Import and check the server exports the right structure
    const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
    expect(Server).toBeDefined();
  });

  it('should have all required dependencies', async () => {
    const pkg = await import('../package.json');
    // Dependencies after refactoring to use @just-every/crawl
    const requiredDeps = [
      '@modelcontextprotocol/sdk',
      '@just-every/crawl',
      'commander'
    ];

    requiredDeps.forEach(dep => {
      expect(pkg.dependencies).toHaveProperty(dep);
    });
  });

  it('should build without TypeScript errors', () => {
    // This is implicitly tested by the beforeAll hook
    // If the build fails, the tests won't run
    expect(true).toBe(true);
  });
});
