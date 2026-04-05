import type { Resource, Tool } from '@modelcontextprotocol/sdk/types.js';

export const READ_WEBSITE_TOOL: Tool = {
    name: 'read_website',
    description:
        'Fast, token-efficient web content extraction - ideal for reading documentation, analyzing content, and gathering information from websites. Converts to clean Markdown while preserving links and structure.',
    inputSchema: {
        type: 'object',
        properties: {
            url: {
                type: 'string',
                description: 'HTTP/HTTPS URL to fetch and convert to markdown',
            },
            pages: {
                type: 'number',
                description: 'Maximum number of pages to crawl (default: 1)',
                default: 1,
                minimum: 1,
                maximum: 100,
            },
            cookiesFile: {
                type: 'string',
                description: 'Path to Netscape cookie file for authenticated pages',
            },
        },
        required: ['url'],
    },
    annotations: {
        title: 'Read Website',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
    },
};

export const RESOURCES: Resource[] = [
    {
        uri: 'read-website-fast://status',
        name: 'Cache Status',
        mimeType: 'application/json',
        description: 'Get cache status information',
    },
    {
        uri: 'read-website-fast://clear-cache',
        name: 'Clear Cache',
        mimeType: 'application/json',
        description: 'Clear the cache directory',
    },
];
