# StripFeed SDK for TypeScript

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
