import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire, register } from 'node:module';
import { pathToFileURL } from 'node:url';

interface DualPackageManifest {
    module?: unknown;
    main?: unknown;
}

let loaderRegistered = false;

const CRAWL_GFM_IMPORT = "import { gfm } from 'turndown-plugin-gfm';";
const PATCHED_GFM_IMPORT_PATTERN =
    /\/\/ Patched by @just-every\/mcp-read-website-fast for Node ESM\/CJS interop\.\nimport \{ gfm \} from [^\n]+;/;

function getCrawlPackageJsonPath(): string {
    const requireFromHere = createRequire(import.meta.url);

    return requireFromHere.resolve('@just-every/crawl/package.json');
}

function getPatchedGfmImport(turndownPluginUrl: string): string {
    return [
        '// Patched by @just-every/mcp-read-website-fast for Node ESM/CJS interop.',
        `import { gfm } from ${JSON.stringify(turndownPluginUrl)};`,
    ].join('\n');
}

export function applyCrawlMarkdownInteropPatch(
    source: string,
    turndownPluginUrl: string
): string {
    const patchedImport = getPatchedGfmImport(turndownPluginUrl);

    if (source.includes(patchedImport) || source.includes(turndownPluginUrl)) {
        return source;
    }

    if (PATCHED_GFM_IMPORT_PATTERN.test(source)) {
        return source.replace(PATCHED_GFM_IMPORT_PATTERN, patchedImport);
    }

    if (!source.includes(CRAWL_GFM_IMPORT)) {
        return source;
    }

    return source.replace(CRAWL_GFM_IMPORT, patchedImport);
}

export function selectPreferredPackageEntry(
    manifest: DualPackageManifest,
    packageName: string
): string {
    if (typeof manifest.module === 'string' && manifest.module.length > 0) {
        return manifest.module;
    }

    if (typeof manifest.main === 'string' && manifest.main.length > 0) {
        return manifest.main;
    }

    throw new Error(`Could not determine entry file for ${packageName}`);
}

export function resolvePackageModuleUrlFromImporter(
    packageName: string,
    importerPackageJsonPath: string
): string {
    const importerRequire = createRequire(importerPackageJsonPath);
    const packageJsonPath = importerRequire.resolve(`${packageName}/package.json`);
    const manifest = JSON.parse(
        readFileSync(packageJsonPath, 'utf8')
    ) as DualPackageManifest;
    const entry = selectPreferredPackageEntry(manifest, packageName);

    return pathToFileURL(join(dirname(packageJsonPath), entry)).href;
}

export function resolveTurndownPluginEsmUrl(): string {
    const crawlPackageJsonPath = getCrawlPackageJsonPath();

    return resolvePackageModuleUrlFromImporter(
        'turndown-plugin-gfm',
        crawlPackageJsonPath
    );
}

export function resolveTurndownPluginCompatUrl(): string {
    return new URL('./turndownPluginGfmCompat.js', import.meta.url).href;
}

export function patchCrawlMarkdownInterop(): void {
    const crawlPackageJsonPath = getCrawlPackageJsonPath();
    const crawlMarkdownPath = join(
        dirname(crawlPackageJsonPath),
        'dist',
        'parser',
        'markdown.js'
    );
    const compatModuleUrl = resolveTurndownPluginCompatUrl();
    const source = readFileSync(crawlMarkdownPath, 'utf8');
    const patchedSource = applyCrawlMarkdownInteropPatch(source, compatModuleUrl);

    if (patchedSource === source) {
        return;
    }

    try {
        writeFileSync(crawlMarkdownPath, patchedSource, 'utf8');
    } catch {
        // Read-only installs can still rely on the loader fallback.
    }
}

export async function ensureTurndownPluginCompat(): Promise<void> {
    if (loaderRegistered) {
        return;
    }

    patchCrawlMarkdownInterop();
    register(new URL('./turndownPluginLoader.js', import.meta.url), import.meta.url);
    loaderRegistered = true;
}
