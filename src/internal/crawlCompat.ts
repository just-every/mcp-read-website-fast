import type { CrawlOptions } from '@just-every/crawl';
import { ensureTurndownPluginCompat } from './turndownPluginCompat.js';

export type { CrawlOptions };

type CrawlModule = typeof import('@just-every/crawl');

let crawlModulePromise: Promise<CrawlModule> | undefined;

export async function loadCrawlModule(): Promise<CrawlModule> {
    if (!crawlModulePromise) {
        crawlModulePromise = (async () => {
            await ensureTurndownPluginCompat();
            return import('@just-every/crawl');
        })();
    }

    return crawlModulePromise;
}
