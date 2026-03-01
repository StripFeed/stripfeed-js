# CLAUDE.md

## Overview

Official TypeScript SDK for StripFeed. Thin wrapper over the StripFeed API with full types.

## Stack

- TypeScript, Node.js 18+
- Vitest for testing
- No runtime dependencies (uses native fetch)

## Commands

```bash
npm run build    # Compile TypeScript to dist/
npm run dev      # Watch mode
npm test         # Run tests
npm run test:watch  # Watch mode tests
```

## Architecture

Single file (`src/index.ts`). Exports:
- `StripFeed` class (default export) with `fetch()`, `fetchMarkdown()`, `batch()`
- `StripFeedError` for API errors
- Types: `FetchOptions`, `FetchResult`, `BatchItem`, `BatchResult`, `ResponseMeta`

Uses native `globalThis.fetch` (Node 18+). No external dependencies.

## CI/CD

GitHub Actions workflow (`.github/workflows/release.yml`):
- Triggers on push to main
- Runs tests, builds, checks if version tag exists
- If new version: publishes to npm, creates git tag + GitHub Release
- Requires `NPM_TOKEN` secret

To release: bump version in `package.json`, push to main.

## Git Rules

- All commits must use Claude as author:
  ```bash
  GIT_COMMITTER_NAME="Claude" GIT_COMMITTER_EMAIL="noreply@anthropic.com" git commit --author="Claude <noreply@anthropic.com>" -m "message"
  ```
- Never push without approval
- npm package: `stripfeed`
