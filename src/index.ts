#!/usr/bin/env node

import { Command } from 'commander';
import { fetch, CrawlOptions } from '@just-every/crawl';
import { fetchMarkdown } from './internal/fetchMarkdown.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version
const packageJson = JSON.parse(
    readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

const program = new Command();

program
    .name('mcp')
    .description(
        'Markdown Content Preprocessor - Extract and convert web content to clean Markdown'
    )
    .version(packageJson.version);

program
    .command('fetch <url>')
    .description('Fetch a URL and convert to Markdown')
    .option('-p, --pages <number>', 'Maximum number of pages to crawl', '1')
    .option('-c, --concurrency <number>', 'Max concurrent requests', '3')
    .option('--no-robots', 'Ignore robots.txt')
    .option('--all-origins', 'Allow cross-origin crawling')
    .option('-u, --user-agent <string>', 'Custom user agent')
    .option('--cache-dir <path>', 'Cache directory', '.cache')
    .option('-t, --timeout <ms>', 'Request timeout in milliseconds', '30000')
    .option('--cookies-file <path>', 'Path to Netscape cookie file for authenticated pages')
    .option(
        '-o, --output <format>',
        'Output format: json, markdown, or both',
        'markdown'
    )
    .action(async (url: string, options) => {
        try {
            const pages = parseInt(options.pages, 10);
            const depth = pages > 1 ? 1 : 0; // If more than 1 page requested, crawl 1 level deep
            
            const crawlOptions: CrawlOptions = {
                depth: depth,
                maxConcurrency: parseInt(options.concurrency, 10),
                respectRobots: options.robots,
                sameOriginOnly: !options.allOrigins,
                userAgent: options.userAgent,
                cacheDir: options.cacheDir,
                timeout: parseInt(options.timeout, 10),
                cookiesFile: options.cookiesFile,
            };

            console.error(`Fetching ${url}...`);
            
            if (options.output === 'json') {
                const results = await fetch(url, crawlOptions);
                console.log(JSON.stringify(results, null, 2));
            } else if (options.output === 'markdown') {
                const result = await fetchMarkdown(url, {
                    ...crawlOptions,
                    maxPages: pages,
                });
                
                // Output the combined markdown
                if (result.markdown) {
                    console.log(result.markdown);
                }
                
                // Show error if any
                if (result.error) {
                    console.error(`Error: ${result.error}`);
                }
            } else if (options.output === 'both') {
                const results = await fetch(url, crawlOptions);
                results.forEach(result => {
                    console.log(`\n## URL: ${result.url}\n`);
                    if (result.markdown) {
                        console.log(result.markdown);
                    }
                    if (result.error) {
                        console.error(
                            `${result.markdown ? 'Warning' : 'Error'}: ${result.error}`
                        );
                    }
                });
            }
        } catch (error) {
            console.error(
                'Error:',
                error instanceof Error ? error.message : error
            );
            process.exit(1);
        }
    });

program
    .command('clear-cache')
    .description('Clear the cache directory')
    .option('--cache-dir <path>', 'Cache directory', '.cache')
    .action(async options => {
        try {
            const { rm } = await import('fs/promises');
            await rm(options.cacheDir, { recursive: true, force: true });
            console.log(`Cache cleared: ${options.cacheDir}`);
        } catch (error) {
            console.error('Error clearing cache:', error);
            process.exit(1);
        }
    });

program
    .command('serve')
    .description('Run as an MCP server')
    .action(async () => {
        // Import and run the serve module
        await import('./serve.js');
    });

program.parse();
