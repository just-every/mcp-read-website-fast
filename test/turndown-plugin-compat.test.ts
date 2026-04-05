import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  applyCrawlMarkdownInteropPatch,
  resolveTurndownPluginCompatUrl,
  resolvePackageModuleUrlFromImporter,
  resolveTurndownPluginEsmUrl,
  selectPreferredPackageEntry,
} from '../src/internal/turndownPluginCompat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

function writeJson(path: string, value: unknown) {
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function createInteropFixture() {
  const root = mkdtempSync(join(tmpdir(), 'turndown-interop-'));
  const nodeModulesDir = join(root, 'node_modules');
  const fakeCrawlDir = join(nodeModulesDir, 'fake-crawl');
  const fakePluginDir = join(nodeModulesDir, 'fake-turndown-plugin-gfm');

  mkdirSync(fakeCrawlDir, { recursive: true });
  mkdirSync(fakePluginDir, { recursive: true });

  writeJson(join(root, 'package.json'), {
    name: 'interop-app',
    private: true,
    type: 'module',
  });
  writeFileSync(
    join(root, 'app.mjs'),
    "import pluginType from 'fake-crawl'; console.log(pluginType);\n"
  );

  writeJson(join(fakeCrawlDir, 'package.json'), {
    name: 'fake-crawl',
    version: '1.0.0',
    type: 'module',
    main: './index.mjs',
  });
  writeFileSync(
    join(fakeCrawlDir, 'index.mjs'),
    "import { gfm } from 'fake-turndown-plugin-gfm'; export default typeof gfm;\n"
  );

  writeJson(join(fakePluginDir, 'package.json'), {
    name: 'fake-turndown-plugin-gfm',
    version: '1.0.0',
    main: './cjs.cjs',
    module: './esm.mjs',
  });
  writeFileSync(join(fakePluginDir, 'cjs.cjs'), 'module.exports = () => "cjs";\n');
  writeFileSync(join(fakePluginDir, 'esm.mjs'), 'export const gfm = () => "esm";\n');

  return {
    appPath: join(root, 'app.mjs'),
    crawlPackageJsonPath: join(fakeCrawlDir, 'package.json'),
    root,
  };
}

describe('turndown-plugin-gfm compatibility', () => {
  it('prefers the module entry when a package ships both CJS and ESM', () => {
    expect(
      selectPreferredPackageEntry(
        { module: './esm.mjs', main: './cjs.cjs' },
        'fake-turndown-plugin-gfm'
      )
    ).toBe('./esm.mjs');
  });

  it('applies the crawl markdown patch idempotently', () => {
    const originalSource = "import { gfm } from 'turndown-plugin-gfm';\nexport { gfm };\n";
    const patchedOnce = applyCrawlMarkdownInteropPatch(
      originalSource,
      'file:///tmp/turndown-plugin-gfm.es.js'
    );
    const patchedTwice = applyCrawlMarkdownInteropPatch(
      patchedOnce,
      'file:///tmp/turndown-plugin-gfm.es.js'
    );

    expect(patchedOnce).toContain('file:///tmp/turndown-plugin-gfm.es.js');
    expect(patchedTwice).toBe(patchedOnce);
  });

  it('reproduces the interop failure without a redirect and succeeds with the resolved ESM entry', () => {
    const fixture = createInteropFixture();
    const failingRun = spawnSync(process.execPath, [fixture.appPath], {
      cwd: fixture.root,
      encoding: 'utf8',
    });

    expect(failingRun.status).not.toBe(0);
    expect(failingRun.stderr).toContain("Named export 'gfm' not found");

    const redirectedUrl = resolvePackageModuleUrlFromImporter(
      'fake-turndown-plugin-gfm',
      fixture.crawlPackageJsonPath
    );
    const bootstrapPath = join(fixture.root, 'bootstrap.mjs');
    const loaderPath = join(fixture.root, 'loader.mjs');

    writeFileSync(
      loaderPath,
      [
        `const redirectedUrl = ${JSON.stringify(redirectedUrl)};`,
        'export async function resolve(specifier, context, defaultResolve) {',
        "  if (specifier === 'fake-turndown-plugin-gfm') {",
        '    return { shortCircuit: true, url: redirectedUrl };',
        '  }',
        '  return defaultResolve(specifier, context);',
        '}',
        '',
      ].join('\n')
    );
    writeFileSync(
      bootstrapPath,
      [
        "import { register } from 'node:module';",
        "register(new URL('./loader.mjs', import.meta.url), import.meta.url);",
        "await import('./app.mjs');",
        '',
      ].join('\n')
    );

    const passingRun = spawnSync(process.execPath, [bootstrapPath], {
      cwd: fixture.root,
      encoding: 'utf8',
    });

    expect(passingRun.status).toBe(0);
    expect(passingRun.stdout.trim()).toBe('function');
  });

  it('resolves the installed turndown plugin to its ESM entry', () => {
    const esmUrl = resolveTurndownPluginEsmUrl();
    expect(esmUrl).toBe(
      pathToFileURL(
        join(
          rootDir,
          'node_modules',
          'turndown-plugin-gfm',
          'lib',
          'turndown-plugin-gfm.es.js'
        )
      ).href
    );
  });

  it('resolves the local compat wrapper used by the runtime patch and loader fallback', () => {
    const compatUrl = resolveTurndownPluginCompatUrl();

    expect(compatUrl.startsWith(pathToFileURL(rootDir).href)).toBe(true);
    expect(compatUrl.endsWith('/internal/turndownPluginGfmCompat.js')).toBe(true);
  });
});
