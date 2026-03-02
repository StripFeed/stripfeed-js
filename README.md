# StripFeed SDK for TypeScript

[![npm version](https://img.shields.io/npm/v/stripfeed)](https://www.npmjs.com/package/stripfeed)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Official TypeScript/JavaScript SDK for [StripFeed](https://www.stripfeed.dev) - convert any URL to clean, token-efficient Markdown for AI agents, RAG pipelines, and LLM workflows.

## Install

```bash
npm install stripfeed
```

## Quick Start

```typescript
import StripFeed from "stripfeed";

const sf = new StripFeed("sf_live_your_api_key");

// Fetch a URL as Markdown
const result = await sf.fetch("https://docs.anthropic.com");
console.log(result.markdown);
console.log(`Tokens: ${result.tokens} (saved ${result.savingsPercent}%)`);
```

## Usage

### Fetch a single URL

```typescript
const result = await sf.fetch("https://example.com", {
  selector: "article",           // CSS selector (Pro)
  format: "json",                // json, text, html (Pro)
  model: "claude-sonnet-4-6",    // cost tracking
  cache: false,                  // bypass cache
  ttl: 7200,                     // custom cache TTL in seconds
  maxTokens: 5000,               // truncate to token budget
});
```

### Get just the Markdown

```typescript
const markdown = await sf.fetchMarkdown("https://example.com");
```

### Batch fetch (Pro)

```typescript
const result = await sf.batch(
  [
    "https://example.com",
    { url: "https://docs.anthropic.com", selector: "article" },
  ],
  { model: "claude-sonnet-4-6" },
);

for (const item of result.results) {
  console.log(`${item.url}: ${item.tokens} tokens`);
}
```

### Robust selector strategy for changing websites

When a website's content structure changes frequently, use a fallback chain of selectors to extract content without manual intervention:

```typescript
import { StripFeed, StripFeedError } from "stripfeed";

const sf = new StripFeed("sf_live_your_api_key");

// Define a list of selectors from most specific to least specific.
// If the site redesigns, the first selector may break but broader ones still work.
const selectors = ["article.post-content", "article", "main", ".content", "#main"];

async function fetchWithFallback(url: string): Promise<string> {
  for (const selector of selectors) {
    try {
      const result = await sf.fetch(url, { selector });
      // If content is too short, the selector probably matched a wrong element
      if (result.markdown.length > 100) {
        return result.markdown;
      }
    } catch (err) {
      // 422 means selector matched nothing on the page, try the next one
      if (err instanceof StripFeedError && err.status === 422) {
        continue;
      }
      throw err; // Re-throw non-selector errors (401, 429, 502, etc.)
    }
  }
  // If no selector worked, fetch without selector (gets full page content)
  const result = await sf.fetch(url);
  return result.markdown;
}
```

**Tips for resilient extraction:**
- Order selectors from most specific (`article.post-body`) to broadest (`main`)
- Use semantic HTML tags (`article`, `main`) over class names, as they survive redesigns
- Check `result.markdown.length` or `result.tokens` to detect selector mismatches
- Fall back to a no-selector fetch as a last resort (StripFeed's Readability engine auto-extracts the main content)
- Use `cache: false` for monitoring scenarios where freshness matters
- Combine with `maxTokens` to cap output size regardless of what the selector captures

### Error handling

```typescript
import { StripFeed, StripFeedError } from "stripfeed";

try {
  const result = await sf.fetch("https://example.com");
} catch (err) {
  if (err instanceof StripFeedError) {
    console.error(`API error ${err.status}: ${err.message}`);
  }
}
```

### Configuration

```typescript
const sf = new StripFeed({
  apiKey: "sf_live_your_api_key",
  baseUrl: "https://custom.api/v1",  // optional
  timeout: 10_000,                    // optional, default 30s
});
```

## API Reference

### `new StripFeed(apiKey)` or `new StripFeed(config)`

Create a new client. Pass a string API key or a config object.

### `sf.fetch(url, options?): Promise<FetchResult>`

Fetch a URL and return structured result with markdown, tokens, metadata.

### `sf.fetchMarkdown(url, options?): Promise<string>`

Shorthand that returns only the markdown string.

### `sf.batch(urls, options?): Promise<BatchResult>`

Fetch up to 10 URLs in parallel. Pro plan required.

### `sf.usage(): Promise<UsageResult>`

Check current monthly API usage and plan limits.

### `StripFeed.parseHeaders(headers): ResponseMeta`

Parse StripFeed response headers into a typed object.

## Links

- [API Docs](https://www.stripfeed.dev/docs)
- [Dashboard](https://www.stripfeed.dev/dashboard)
- [Python SDK](https://pypi.org/project/stripfeed/)
- [MCP Server](https://www.npmjs.com/package/@stripfeed/mcp-server)
- [GitHub](https://github.com/StripFeed/stripfeed-js)

## License

MIT
