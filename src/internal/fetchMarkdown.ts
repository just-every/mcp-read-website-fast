import { fetch, CrawlOptions } from '@just-every/crawl';
import { extractMarkdownLinks, filterSameOriginLinks } from '../utils/extractMarkdownLinks.js';

export interface FetchMarkdownOptions {
    depth?: number;
    maxConcurrency?: number;
    respectRobots?: boolean;
    sameOriginOnly?: boolean;
    userAgent?: string;
    cacheDir?: string;
    timeout?: number;
    maxPages?: number;
    cookiesFile?: string;
}

export interface FetchMarkdownResult {
    markdown: string;
    title?: string;
    links?: string[];
    error?: string;
}

export async function fetchMarkdown(
    url: string,
    options: FetchMarkdownOptions = {}
): Promise<FetchMarkdownResult> {
    try {
        const maxPages = options.maxPages ?? 1;
        const visited = new Set<string>();
        const toVisit = [url];
        const allResults: any[] = [];
        
        // If we want multiple pages, we need to crawl iteratively
        while (toVisit.length > 0 && allResults.length < maxPages) {
            const currentUrl = toVisit.shift()!;
            
            // Skip if already visited
            if (visited.has(currentUrl)) continue;
            visited.add(currentUrl);
            
            // Fetch single page
            const crawlOptions: CrawlOptions = {
                depth: 0, // Always single page
                maxConcurrency: options.maxConcurrency ?? 3,
                respectRobots: options.respectRobots ?? true,
                sameOriginOnly: options.sameOriginOnly ?? true,
                userAgent: options.userAgent,
                cacheDir: options.cacheDir ?? '.cache',
                timeout: options.timeout ?? 30000,
                cookiesFile: options.cookiesFile,
            };

            const results = await fetch(currentUrl, crawlOptions);
            
            if (results && results.length > 0) {
                const result = results[0];
                allResults.push(result);
                
                // Extract links from markdown if we need more pages
                if (allResults.length < maxPages && result.markdown) {
                    const links = extractMarkdownLinks(result.markdown, currentUrl);
                    const filteredLinks = options.sameOriginOnly !== false 
                        ? filterSameOriginLinks(links, currentUrl)
                        : links;
                    
                    // Add new links to visit queue
                    for (const link of filteredLinks) {
                        if (!visited.has(link) && !toVisit.includes(link)) {
                            toVisit.push(link);
                        }
                    }
                }
            }
        }
        
        if (allResults.length === 0) {
            return {
                markdown: '',
                error: 'No results returned',
            };
        }

        // Process results as before
        const pagesToReturn = allResults;

        // Combine all pages into a single markdown document
        const combinedMarkdown = pagesToReturn
            .map((result, index) => {
                if (result.error) {
                    return `<!-- Error fetching ${result.url}: ${result.error} -->`;
                }
                
                let pageContent = '';
                
                // Add page separator for multiple pages
                if (pagesToReturn.length > 1 && index > 0) {
                    pageContent += '\n\n---\n\n';
                }
                
                // Add source URL as a comment
                pageContent += `<!-- Source: ${result.url} -->\n`;
                
                // Add the content
                pageContent += result.markdown || '';
                
                return pageContent;
            })
            .join('\n');

        // Return combined results
        return {
            markdown: combinedMarkdown,
            title: pagesToReturn[0].title,
            links: pagesToReturn.flatMap(r => r.links || []),
            error: pagesToReturn.some(r => r.error) 
                ? `Some pages had errors: ${pagesToReturn.filter(r => r.error).map(r => r.url).join(', ')}`
                : undefined,
        };
    } catch (error) {
        return {
            markdown: '',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
