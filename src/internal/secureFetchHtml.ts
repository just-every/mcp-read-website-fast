import { fetch } from 'undici';
import { resolvePublicHttpUrl } from '../utils/urlPolicy.js';
import { createPinnedDnsAgent } from './pinnedDnsDispatcher.js';

const DEFAULT_USER_AGENT =
    'MCP/0.1 (+https://github.com/just-every/mcp-read-website-fast)';

export interface SecureFetchHtmlOptions {
    userAgent?: string;
    timeout?: number;
    maxRedirections?: number;
    cookieHeaderForUrl?: (url: string) => string | undefined;
}

export async function secureFetchHtml(
    url: string,
    options: SecureFetchHtmlOptions = {}
): Promise<{ html: string; finalUrl: string }> {
    const maxRedirections = options.maxRedirections ?? 5;
    let currentUrl = url;

    for (
        let redirectCount = 0;
        redirectCount <= maxRedirections;
        redirectCount += 1
    ) {
        const resolution = await resolvePublicHttpUrl(currentUrl);
        const dispatcher = createPinnedDnsAgent(resolution);

        try {
            const response = await fetch(currentUrl, {
                dispatcher,
                headers: {
                    'User-Agent': options.userAgent ?? DEFAULT_USER_AGENT,
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    DNT: '1',
                    Connection: 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                    ...(options.cookieHeaderForUrl?.(currentUrl)
                        ? { Cookie: options.cookieHeaderForUrl(currentUrl) }
                        : {}),
                },
                redirect: 'manual',
                signal: AbortSignal.timeout(options.timeout ?? 30000),
            });

            if (response.status >= 300 && response.status < 400) {
                const location = response.headers.get('location');
                await response.body?.cancel();
                if (!location) {
                    throw new Error(
                        `Redirect without Location header for ${currentUrl}`
                    );
                }

                currentUrl = new URL(location, currentUrl).href;
                continue;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} for ${currentUrl}`);
            }

            const contentType = response.headers.get('content-type');
            if (
                contentType &&
                !contentType.includes('text/html') &&
                !contentType.includes('application/xhtml+xml')
            ) {
                throw new Error(
                    `Non-HTML content type: ${contentType} for ${currentUrl}`
                );
            }

            return { html: await response.text(), finalUrl: currentUrl };
        } finally {
            await dispatcher.close();
        }
    }

    throw new Error(`Too many redirects for ${url}`);
}
