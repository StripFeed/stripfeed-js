const BASE_URL = "https://www.stripfeed.dev/api/v1";

// --- Types ---

export type OutputFormat = "markdown" | "json" | "text" | "html";

export interface FetchOptions {
  /** CSS selector to extract specific elements (Pro plan) */
  selector?: string;
  /** Output format. Default: "markdown". json/text/html require Pro plan. */
  format?: OutputFormat;
  /** AI model ID for cost tracking (e.g. "claude-sonnet-4-6") */
  model?: string;
  /** Set to false to bypass cache and force fresh fetch */
  cache?: boolean;
  /** Custom cache TTL in seconds (default: 3600, max: 86400) */
  ttl?: number;
  /** Truncate output to fit within this token budget */
  maxTokens?: number;
}

export interface FetchResult {
  /** Clean Markdown content */
  markdown: string;
  /** Page title */
  title: string;
  /** Token count of clean output */
  tokens: number;
  /** Token count of original HTML */
  originalTokens: number;
  /** Percentage of tokens saved */
  savingsPercent: number;
  /** Whether the result was served from cache */
  cached: boolean;
  /** Processing time in ms (0 for cache hits) */
  fetchMs: number;
  /** Output format used */
  format: string;
  /** Model used for cost tracking */
  model: string | null;
  /** The URL that was fetched */
  url: string;
  /** Whether content was truncated by max_tokens */
  truncated: boolean;
  /** Clean HTML (only when format is "json") */
  html?: string;
  /** Plain text (only when format is "json") */
  text?: string;
}

export interface BatchItem {
  /** URL to fetch */
  url: string;
  /** CSS selector for this URL (Pro plan) */
  selector?: string;
}

export interface BatchOptions {
  /** AI model ID for cost tracking */
  model?: string;
}

export interface BatchResultItem {
  url: string;
  title?: string;
  markdown?: string;
  tokens?: number;
  originalTokens?: number;
  savingsPercent?: number;
  cached?: boolean;
  fetchMs?: number;
  status: number;
  error?: string;
}

export interface BatchResult {
  results: BatchResultItem[];
  total: number;
  success: number;
  failed: number;
  model: string | null;
}

export interface StripFeedConfig {
  /** Your StripFeed API key (sf_live_...) */
  apiKey: string;
  /** Custom base URL (default: https://www.stripfeed.dev/api/v1) */
  baseUrl?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
}

export interface ResponseMeta {
  tokens: number;
  originalTokens: number;
  savingsPercent: number;
  cached: boolean;
  fetchMs: number;
  format: string;
  model: string | null;
  truncated: boolean;
  selector: string | null;
  rateLimit: {
    limit: number;
    remaining: number;
    reset: number;
  };
}

export interface UsageResult {
  /** Current plan (free, pro, enterprise) */
  plan: string;
  /** Number of requests used this month */
  usage: number;
  /** Monthly request limit (null for unlimited) */
  limit: number | null;
  /** Remaining requests this month (null for unlimited) */
  remaining: number | null;
  /** ISO timestamp when usage resets */
  resetsAt: string;
}

// --- Error ---

export class StripFeedError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "StripFeedError";
  }
}

// --- Client ---

export class StripFeed {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: StripFeedConfig | string) {
    if (typeof config === "string") {
      this.apiKey = config;
      this.baseUrl = BASE_URL;
      this.timeout = 30_000;
    } else {
      this.apiKey = config.apiKey;
      this.baseUrl = config.baseUrl ?? BASE_URL;
      this.timeout = config.timeout ?? 30_000;
    }

    if (!this.apiKey) {
      throw new Error("StripFeed: apiKey is required");
    }
  }

  /**
   * Convert a single URL to clean Markdown.
   *
   * @example
   * ```ts
   * const sf = new StripFeed("sf_live_...");
   * const result = await sf.fetch("https://example.com");
   * console.log(result.markdown);
   * ```
   */
  async fetch(url: string, options?: FetchOptions): Promise<FetchResult> {
    const params = new URLSearchParams({ url });
    if (options?.format) params.set("format", options.format);
    if (options?.selector) params.set("selector", options.selector);
    if (options?.model) params.set("model", options.model);
    if (options?.cache === false) params.set("cache", "false");
    if (options?.ttl !== undefined) params.set("ttl", String(options.ttl));
    if (options?.maxTokens !== undefined) params.set("max_tokens", String(options.maxTokens));

    // Always request JSON format for the SDK to get structured data
    const requestFormat = options?.format ?? "json";
    params.set("format", requestFormat);

    const response = await this.request(
      `${this.baseUrl}/fetch?${params.toString()}`,
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new StripFeedError(
        response.status,
        (body as { error?: string }).error ?? `HTTP ${response.status}`,
      );
    }

    const data = (await response.json()) as FetchResult;
    return data;
  }

  /**
   * Fetch a URL and return only the Markdown string.
   *
   * @example
   * ```ts
   * const sf = new StripFeed("sf_live_...");
   * const markdown = await sf.fetchMarkdown("https://example.com");
   * ```
   */
  async fetchMarkdown(url: string, options?: Omit<FetchOptions, "format">): Promise<string> {
    const result = await this.fetch(url, { ...options, format: "json" });
    return result.markdown;
  }

  /**
   * Process up to 10 URLs in parallel (Pro plan required).
   *
   * @example
   * ```ts
   * const sf = new StripFeed("sf_live_...");
   * const result = await sf.batch([
   *   "https://example.com",
   *   { url: "https://docs.anthropic.com", selector: "article" },
   * ]);
   * ```
   */
  async batch(
    urls: (string | BatchItem)[],
    options?: BatchOptions,
  ): Promise<BatchResult> {
    const body = {
      urls: urls.map((item) =>
        typeof item === "string" ? item : { url: item.url, selector: item.selector },
      ),
      ...(options?.model ? { model: options.model } : {}),
    };

    const response = await this.request(`${this.baseUrl}/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new StripFeedError(
        response.status,
        (data as { error?: string }).error ?? `HTTP ${response.status}`,
      );
    }

    return (await response.json()) as BatchResult;
  }

  /**
   * Check current monthly API usage and plan limits.
   *
   * @example
   * ```ts
   * const sf = new StripFeed("sf_live_...");
   * const usage = await sf.usage();
   * console.log(`${usage.usage} / ${usage.limit} requests used`);
   * ```
   */
  async usage(): Promise<UsageResult> {
    const response = await this.request(`${this.baseUrl}/usage`);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new StripFeedError(
        response.status,
        (body as { error?: string }).error ?? `HTTP ${response.status}`,
      );
    }

    return (await response.json()) as UsageResult;
  }

  /**
   * Parse response headers into a structured metadata object.
   * Useful when you need rate limit info or cache status.
   */
  static parseHeaders(headers: Headers): ResponseMeta {
    return {
      tokens: Number(headers.get("x-stripfeed-tokens") ?? 0),
      originalTokens: Number(headers.get("x-stripfeed-original-tokens") ?? 0),
      savingsPercent: Number(headers.get("x-stripfeed-savings-percent") ?? 0),
      cached: headers.get("x-stripfeed-cache") === "HIT",
      fetchMs: Number(headers.get("x-stripfeed-fetch-ms") ?? 0),
      format: headers.get("x-stripfeed-format") ?? "markdown",
      model: headers.get("x-stripfeed-model"),
      truncated: headers.get("x-stripfeed-truncated") === "true",
      selector: headers.get("x-stripfeed-selector"),
      rateLimit: {
        limit: Number(headers.get("x-ratelimit-limit") ?? 0),
        remaining: Number(headers.get("x-ratelimit-remaining") ?? 0),
        reset: Number(headers.get("x-ratelimit-reset") ?? 0),
      },
    };
  }

  private async request(url: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      return await globalThis.fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          ...init?.headers,
        },
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new StripFeedError(0, "Request timed out");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

export default StripFeed;
