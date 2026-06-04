import pLimit from 'p-limit';
import type { CrawlResult } from '@just-every/crawl';
import type { CookieEntry } from '@just-every/crawl/dist/crawler/cookies.js';
import { DiskCache } from '@just-every/crawl/dist/cache/disk.js';
import {
    normalizeUrl,
    isSameOrigin,
} from '@just-every/crawl/dist/cache/normalize.js';
import {
    parseNetscapeCookieFile,
    buildCookieHeaderForUrl,
} from '@just-every/crawl/dist/crawler/cookies.js';
import {
    isAllowedByRobots,
    getCrawlDelay,
} from '@just-every/crawl/dist/crawler/robots.js';
import { htmlToDom, extractLinks } from '@just-every/crawl/dist/parser/dom.js';
import { extractArticle } from '@just-every/crawl/dist/parser/article.js';
import { formatArticleMarkdown } from '@just-every/crawl/dist/parser/markdown.js';
import { assertPublicHttpUrl } from '../utils/urlPolicy.js';
import { secureFetchHtml } from './secureFetchHtml.js';
import type { FetchMarkdownOptions } from './fetchMarkdown.js';

export async function secureCrawl(
    startUrl: string,
    options: FetchMarkdownOptions = {}
): Promise<CrawlResult[]> {
    const crawler = new SecureCrawler(options);
    await crawler.init();
    return crawler.crawl(startUrl);
}

class SecureCrawler {
    private readonly visited = new Set<string>();
    private queue: string[] = [];
    private readonly limit;
    private readonly cache: DiskCache;
    private readonly options: Required<
        Pick<
            FetchMarkdownOptions,
            | 'depth'
            | 'maxConcurrency'
            | 'respectRobots'
            | 'sameOriginOnly'
            | 'cacheDir'
            | 'timeout'
        >
    > &
        Pick<FetchMarkdownOptions, 'userAgent' | 'cookiesFile'>;
    private readonly results: CrawlResult[] = [];
    private cookieJar: CookieEntry[] | undefined;

    constructor(options: FetchMarkdownOptions = {}) {
        this.options = {
            depth: options.depth ?? 0,
            maxConcurrency: options.maxConcurrency ?? 3,
            respectRobots: options.respectRobots ?? true,
            sameOriginOnly: options.sameOriginOnly ?? true,
            userAgent: options.userAgent,
            cacheDir: options.cacheDir ?? '.cache',
            timeout: options.timeout ?? 30000,
            cookiesFile: options.cookiesFile,
        };
        this.limit = pLimit(this.options.maxConcurrency);
        this.cache = new DiskCache(this.options.cacheDir);

        if (options.cookiesFile) {
            this.cookieJar = parseNetscapeCookieFile(options.cookiesFile);
        }
    }

    async init(): Promise<void> {
        await this.cache.init();
    }

    async crawl(startUrl: string): Promise<CrawlResult[]> {
        const normalizedUrl = normalizeUrl(startUrl);
        await assertPublicHttpUrl(normalizedUrl);
        this.queue.push(normalizedUrl);
        await this.processQueue(0);
        return this.results;
    }

    private async processQueue(currentDepth: number): Promise<void> {
        if (currentDepth > this.options.depth) {
            return;
        }

        const urls = [...this.queue];
        this.queue = [];
        const tasks = urls.map(url =>
            this.limit(() => this.processUrl(url, currentDepth))
        );
        await Promise.all(tasks);

        if (this.queue.length > 0) {
            await this.processQueue(currentDepth + 1);
        }
    }

    private async processUrl(url: string, depth: number): Promise<void> {
        const normalizedUrl = normalizeUrl(url);
        if (this.visited.has(normalizedUrl)) {
            return;
        }
        this.visited.add(normalizedUrl);

        try {
            await assertPublicHttpUrl(normalizedUrl);

            const cached = await this.cache.get(normalizedUrl);
            if (cached) {
                this.results.push({
                    url: normalizedUrl,
                    markdown: cached.markdown,
                    title: cached.title,
                });
                return;
            }

            if (this.options.respectRobots) {
                const allowed = await isAllowedByRobots(
                    normalizedUrl,
                    this.options.userAgent
                );
                if (!allowed) {
                    this.results.push({
                        url: normalizedUrl,
                        markdown: '',
                        error: 'Blocked by robots.txt',
                    });
                    return;
                }

                const delay = await getCrawlDelay(
                    normalizedUrl,
                    this.options.userAgent
                );
                if (delay > 0) {
                    await new Promise(resolve =>
                        setTimeout(resolve, delay * 1000)
                    );
                }
            }

            const { html, finalUrl } = await secureFetchHtml(normalizedUrl, {
                userAgent: this.options.userAgent,
                timeout: this.options.timeout,
                cookieHeaderForUrl: redirectedUrl =>
                    this.cookieJar
                        ? buildCookieHeaderForUrl(redirectedUrl, this.cookieJar)
                        : undefined,
            });

            if (!html.trim()) {
                this.results.push({
                    url: finalUrl,
                    markdown: '',
                    error: 'Empty response from server',
                });
                return;
            }

            const dom = htmlToDom(html, finalUrl);
            const article = extractArticle(dom);
            if (!article) {
                this.results.push({
                    url: finalUrl,
                    markdown: '',
                    error: 'Failed to extract article content',
                });
                return;
            }

            if (!article.content || article.content.trim().length < 50) {
                this.results.push({
                    url: finalUrl,
                    markdown:
                        `# ${article.title || 'Page Content'}\n\n` +
                        '*Note: This page appears to be JavaScript-rendered. Limited content extracted.*\n\n' +
                        (article.textContent
                            ? `${article.textContent.substring(0, 1000)}...`
                            : 'No text content available'),
                    title: article.title || finalUrl,
                    error: 'Limited content extracted (JavaScript-rendered page)',
                });
                return;
            }

            const markdown = formatArticleMarkdown(article);
            await this.cache.put(finalUrl, markdown, article.title);

            let links: string[] = [];
            if (depth < this.options.depth) {
                links = extractLinks(dom);
                if (this.options.sameOriginOnly) {
                    links = links.filter(link => isSameOrigin(finalUrl, link));
                }

                for (const link of links) {
                    const normalized = normalizeUrl(link);
                    if (!this.visited.has(normalized)) {
                        await assertPublicHttpUrl(normalized);
                        this.queue.push(normalized);
                    }
                }
            }

            this.results.push({
                url: finalUrl,
                markdown,
                title: article.title,
                links: links.length > 0 ? links : undefined,
            });
        } catch (error) {
            this.results.push({
                url: normalizedUrl,
                markdown: '',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
}
