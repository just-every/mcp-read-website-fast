import { createRequire } from 'node:module';

type GfmPlugin = (service: unknown) => void;

const requireFromHere = createRequire(import.meta.url);

function loadTurndownPluginGfmModule(): {
    default?: { gfm?: GfmPlugin };
    gfm?: GfmPlugin;
} {
    try {
        return requireFromHere('turndown-plugin-gfm') as {
            default?: { gfm?: GfmPlugin };
            gfm?: GfmPlugin;
        };
    } catch {
        const crawlPackageJsonPath = requireFromHere.resolve(
            '@just-every/crawl/package.json'
        );
        const requireFromCrawl = createRequire(crawlPackageJsonPath);

        return requireFromCrawl('turndown-plugin-gfm') as {
            default?: { gfm?: GfmPlugin };
            gfm?: GfmPlugin;
        };
    }
}

const turndownPluginGfmModule = loadTurndownPluginGfmModule();

export const gfm =
    turndownPluginGfmModule.gfm ?? turndownPluginGfmModule.default?.gfm;

if (typeof gfm !== 'function') {
    throw new Error('turndown-plugin-gfm did not provide a usable gfm export');
}
