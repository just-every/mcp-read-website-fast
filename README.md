[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/just-every-mcp-read-website-fast-badge.png)](https://mseep.ai/app/just-every-mcp-read-website-fast)

# @just-every/mcp-read-website-fast

Fast, token-efficient web content extraction for AI agents - converts websites to clean Markdown.

[![npm version](https://badge.fury.io/js/@just-every%2Fmcp-read-website-fast.svg)](https://www.npmjs.com/package/@just-every/mcp-read-website-fast)
[![GitHub Actions](https://github.com/just-every/mcp-read-website-fast/workflows/Release/badge.svg)](https://github.com/just-every/mcp-read-website-fast/actions)

## Overview

Existing MCP web crawlers are slow and consume large quantities of tokens. This pauses the development process and provides incomplete results as LLMs need to parse whole web pages.

This MCP package fetches web pages locally, strips noise, and converts content to clean Markdown while preserving links. Designed for Claude Code, IDEs and LLM pipelines with minimal token footprint. Crawl sites locally with minimal dependencies.

**Note:** This package now uses [@just-every/crawl](https://www.npmjs.com/package/@just-every/crawl) for its core crawling and markdown conversion functionality.

## Features

- **Fast startup** using official MCP SDK with lazy loading for optimal performance
- **Content extraction** using Mozilla Readability (same as Firefox Reader View)
- **HTML to Markdown** conversion with Turndown + GFM support
- **Smart caching** with SHA-256 hashed URLs
- **Polite crawling** with robots.txt support and rate limiting
- **Concurrent fetching** with configurable depth crawling
- **Stream-first design** for low memory usage
- **Link preservation** for knowledge graphs
- **Optional chunking** for downstream processing

## Installation

### Claude Code

```bash
claude mcp add read-website-fast -s user -- npx -y @just-every/mcp-read-website-fast
```

### VS Code

```bash
code --add-mcp '{"name":"read-website-fast","command":"npx","args":["-y","@just-every/mcp-read-website-fast"]}'
```

### Cursor

```bash
cursor://anysphere.cursor-deeplink/mcp/install?name=read-website-fast&config=eyJyZWFkLXdlYnNpdGUtZmFzdCI6eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkBqdXN0LWV2ZXJ5L21jcC1yZWFkLXdlYnNpdGUtZmFzdCJdfX0=
```

### JetBrains IDEs

Settings → Tools → AI Assistant → Model Context Protocol (MCP) → Add

Choose “As JSON” and paste:

```json
{"command":"npx","args":["-y","@just-every/mcp-read-website-fast"]}
```

Or, in the chat window, type /add and fill in the same JSON—both paths land the server in a single step. ￼

### Raw JSON (works in any MCP client)

```json
{
  "mcpServers": {
    "read-website-fast": {
      "command": "npx",
      "args": ["-y", "@just-every/mcp-read-website-fast"]
    }
  }
}
```

Drop this into your client’s mcp.json (e.g. .vscode/mcp.json, ~/.cursor/mcp.json, or .mcp.json for Claude).



## Features

- **Fast startup** using official MCP SDK with lazy loading for optimal performance
- **Content extraction** using Mozilla Readability (same as Firefox Reader View)
- **HTML to Markdown** conversion with Turndown + GFM support
- **Smart caching** with SHA-256 hashed URLs
- **Polite crawling** with robots.txt support and rate limiting
- **Concurrent fetching** with configurable depth crawling
- **Stream-first design** for low memory usage
- **Link preservation** for knowledge graphs
- **Optional chunking** for downstream processing

### Available Tools

- `read_website` - Fetches a webpage and converts it to clean markdown
  - Parameters:
    - `url` (required): The HTTP/HTTPS URL to fetch
    - `depth` (optional): Crawl depth (0 = single page)
    - `respectRobots` (optional): Whether to respect robots.txt

### Available Resources

- `read-website-fast://status` - Get cache statistics
- `read-website-fast://clear-cache` - Clear the cache directory

## Development Usage

### Install

```bash
npm install
npm run build
```

### Single page fetch
```bash
npm run dev fetch https://example.com/article
```

### Crawl with depth
```bash
npm run dev fetch https://example.com --depth 2 --concurrency 5
```

### Output formats
```bash
# Markdown only (default)
npm run dev fetch https://example.com

# JSON output with metadata
npm run dev fetch https://example.com --output json

# Both URL and markdown
npm run dev fetch https://example.com --output both
```

### CLI Options

- `-d, --depth <number>` - Crawl depth (0 = single page, default: 0)
- `-c, --concurrency <number>` - Max concurrent requests (default: 3)
- `--no-robots` - Ignore robots.txt
- `--all-origins` - Allow cross-origin crawling
- `-u, --user-agent <string>` - Custom user agent
- `--cache-dir <path>` - Cache directory (default: .cache)
- `-t, --timeout <ms>` - Request timeout in milliseconds (default: 30000)
- `-o, --output <format>` - Output format: json, markdown, or both (default: markdown)

### Clear cache
```bash
npm run dev clear-cache
```

## Auto-Restart Feature

The MCP server includes automatic restart capability by default for improved reliability:

- Automatically restarts the server if it crashes
- Handles unhandled exceptions and promise rejections
- Implements exponential backoff (max 10 attempts in 1 minute)
- Logs all restart attempts for monitoring
- Gracefully handles shutdown signals (SIGINT, SIGTERM)

For development/debugging without auto-restart:
```bash
# Run directly without restart wrapper
npm run serve:dev
```

## Architecture

```
mcp/
├── src/
│   ├── crawler/        # URL fetching, queue management, robots.txt
│   ├── parser/         # DOM parsing, Readability, Turndown conversion
│   ├── cache/          # Disk-based caching with SHA-256 keys
│   ├── utils/          # Logger, chunker utilities
│   ├── index.ts        # CLI entry point
│   ├── serve.ts        # MCP server entry point
│   └── serve-restart.ts # Auto-restart wrapper
```

## Development

```bash
# Run in development mode
npm run dev fetch https://example.com

# Build for production
npm run build

# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## Troubleshooting

### Cache Issues
```bash
npm run dev clear-cache
```

### Timeout Errors
- Increase timeout with `-t` flag
- Check network connectivity
- Verify URL is accessible

### Content Not Extracted
- Some sites block automated access
- Try custom user agent with `-u` flag
- Check if site requires JavaScript (not supported)

## License

MIT