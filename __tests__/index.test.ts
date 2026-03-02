import { describe, it, expect, vi, beforeEach } from "vitest";
import { StripFeed, StripFeedError } from "../src/index";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

describe("StripFeed constructor", () => {
  it("accepts a string API key", () => {
    const sf = new StripFeed("sf_live_test123");
    expect(sf).toBeInstanceOf(StripFeed);
  });

  it("accepts a config object", () => {
    const sf = new StripFeed({
      apiKey: "sf_live_test123",
      baseUrl: "https://custom.api/v1",
      timeout: 5000,
    });
    expect(sf).toBeInstanceOf(StripFeed);
  });

  it("throws if apiKey is empty", () => {
    expect(() => new StripFeed("")).toThrow("apiKey is required");
  });

  it("throws if apiKey is missing from config", () => {
    expect(() => new StripFeed({ apiKey: "" })).toThrow("apiKey is required");
  });
});

describe("StripFeed.fetch", () => {
  it("calls the fetch endpoint with correct params", async () => {
    const mockResponse = {
      markdown: "# Hello",
      title: "Hello",
      tokens: 5,
      originalTokens: 50,
      savingsPercent: 90,
      cached: false,
      fetchMs: 100,
      format: "json",
      model: null,
      url: "https://example.com",
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const sf = new StripFeed("sf_live_test123");
    const result = await sf.fetch("https://example.com");

    expect(result.markdown).toBe("# Hello");
    expect(result.tokens).toBe(5);
    expect(result.savingsPercent).toBe(90);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/fetch?");
    expect(calledUrl).toContain("url=https%3A%2F%2Fexample.com");
    expect(calledUrl).toContain("format=json");

    const calledInit = mockFetch.mock.calls[0][1] as RequestInit;
    expect(
      (calledInit.headers as Record<string, string>)["Authorization"],
    ).toBe("Bearer sf_live_test123");
  });

  it("passes optional parameters", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ markdown: "" }),
    });

    const sf = new StripFeed("sf_live_test123");
    await sf.fetch("https://example.com", {
      selector: "article",
      model: "claude-sonnet-4-6",
      cache: false,
      ttl: 7200,
    });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("selector=article");
    expect(calledUrl).toContain("model=claude-sonnet-4-6");
    expect(calledUrl).toContain("cache=false");
    expect(calledUrl).toContain("ttl=7200");
  });

  it("passes max_tokens parameter", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ markdown: "", truncated: true }),
    });

    const sf = new StripFeed("sf_live_test123");
    await sf.fetch("https://example.com", { maxTokens: 5000 });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("max_tokens=5000");
  });

  it("throws StripFeedError on 401", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Invalid API key" }),
    });

    const sf = new StripFeed("sf_live_bad");
    await expect(sf.fetch("https://example.com")).rejects.toMatchObject({
      status: 401,
      message: "Invalid API key",
    });
  });

  it("throws StripFeedError on 403 (Pro plan required)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () =>
        Promise.resolve({
          error: "CSS selectors require a Pro plan",
        }),
    });

    const sf = new StripFeed("sf_live_free");
    await expect(
      sf.fetch("https://example.com", { selector: "article" }),
    ).rejects.toMatchObject({
      status: 403,
      message: "CSS selectors require a Pro plan",
    });
  });

  it("throws StripFeedError on 429", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: "Rate limit exceeded" }),
    });

    const sf = new StripFeed("sf_live_test123");
    await expect(sf.fetch("https://example.com")).rejects.toMatchObject({
      status: 429,
    });
  });

  it("uses custom baseUrl", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ markdown: "" }),
    });

    const sf = new StripFeed({
      apiKey: "sf_live_test123",
      baseUrl: "https://custom.api/v1",
    });
    await sf.fetch("https://example.com");

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl.startsWith("https://custom.api/v1/fetch?")).toBe(true);
  });
});

describe("StripFeed.fetchMarkdown", () => {
  it("returns only the markdown string", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          markdown: "# Hello World\n\nContent here.",
          tokens: 10,
        }),
    });

    const sf = new StripFeed("sf_live_test123");
    const md = await sf.fetchMarkdown("https://example.com");

    expect(md).toBe("# Hello World\n\nContent here.");
    expect(typeof md).toBe("string");
  });
});

describe("StripFeed.batch", () => {
  it("sends correct POST body with string URLs", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [],
          total: 2,
          success: 2,
          failed: 0,
          model: null,
        }),
    });

    const sf = new StripFeed("sf_live_test123");
    await sf.batch(["https://a.com", "https://b.com"]);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/batch");

    const calledInit = mockFetch.mock.calls[0][1] as RequestInit;
    expect(calledInit.method).toBe("POST");

    const body = JSON.parse(calledInit.body as string);
    expect(body.urls).toEqual(["https://a.com", "https://b.com"]);
  });

  it("sends correct POST body with mixed URLs", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [],
          total: 2,
          success: 2,
          failed: 0,
          model: "gpt-4o",
        }),
    });

    const sf = new StripFeed("sf_live_test123");
    await sf.batch(
      [
        "https://a.com",
        { url: "https://b.com", selector: "article" },
      ],
      { model: "gpt-4o" },
    );

    const body = JSON.parse(
      (mockFetch.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.urls).toEqual([
      "https://a.com",
      { url: "https://b.com", selector: "article" },
    ]);
    expect(body.model).toBe("gpt-4o");
  });

  it("throws StripFeedError on 403 for free plan", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () =>
        Promise.resolve({
          error: "Batch endpoint requires a Pro plan",
        }),
    });

    const sf = new StripFeed("sf_live_free");
    await expect(sf.batch(["https://a.com"])).rejects.toMatchObject({
      status: 403,
    });
  });

  it("returns batch result with success/failed counts", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          results: [
            { url: "https://a.com", status: 200, markdown: "# A", tokens: 5 },
            { url: "https://bad.com", status: 502, error: "Unreachable" },
          ],
          total: 2,
          success: 1,
          failed: 1,
          model: null,
        }),
    });

    const sf = new StripFeed("sf_live_test123");
    const result = await sf.batch(["https://a.com", "https://bad.com"]);

    expect(result.total).toBe(2);
    expect(result.success).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results[0].status).toBe(200);
    expect(result.results[1].status).toBe(502);
  });
});

describe("StripFeed.usage", () => {
  it("calls the usage endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        plan: "pro",
        usage: 1250,
        limit: 100000,
        remaining: 98750,
        resetsAt: "2026-04-01T00:00:00.000Z",
      }),
    });

    const sf = new StripFeed("sf_live_test123");
    const result = await sf.usage();

    expect(result.plan).toBe("pro");
    expect(result.usage).toBe(1250);
    expect(result.limit).toBe(100000);
    expect(result.remaining).toBe(98750);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/usage");
  });

  it("throws StripFeedError on 401", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Invalid API key" }),
    });

    const sf = new StripFeed("sf_live_bad");
    await expect(sf.usage()).rejects.toMatchObject({ status: 401 });
  });
});

describe("StripFeed.parseHeaders", () => {
  it("parses response headers correctly", () => {
    const headers = new Headers({
      "x-stripfeed-tokens": "1250",
      "x-stripfeed-original-tokens": "14200",
      "x-stripfeed-savings-percent": "91.2",
      "x-stripfeed-cache": "HIT",
      "x-stripfeed-fetch-ms": "0",
      "x-stripfeed-format": "markdown",
      "x-stripfeed-model": "claude-sonnet-4-6",
      "x-stripfeed-truncated": "true",
      "x-ratelimit-limit": "20",
      "x-ratelimit-remaining": "18",
      "x-ratelimit-reset": "1700000000",
    });

    const meta = StripFeed.parseHeaders(headers);

    expect(meta.tokens).toBe(1250);
    expect(meta.originalTokens).toBe(14200);
    expect(meta.savingsPercent).toBe(91.2);
    expect(meta.cached).toBe(true);
    expect(meta.fetchMs).toBe(0);
    expect(meta.format).toBe("markdown");
    expect(meta.model).toBe("claude-sonnet-4-6");
    expect(meta.rateLimit.limit).toBe(20);
    expect(meta.truncated).toBe(true);
    expect(meta.rateLimit.remaining).toBe(18);
  });

  it("handles missing headers with defaults", () => {
    const headers = new Headers();
    const meta = StripFeed.parseHeaders(headers);

    expect(meta.tokens).toBe(0);
    expect(meta.cached).toBe(false);
    expect(meta.model).toBeNull();
    expect(meta.selector).toBeNull();
  });
});

describe("StripFeedError", () => {
  it("has correct properties", () => {
    const err = new StripFeedError(429, "Rate limit exceeded");
    expect(err.status).toBe(429);
    expect(err.message).toBe("Rate limit exceeded");
    expect(err.name).toBe("StripFeedError");
    expect(err).toBeInstanceOf(Error);
  });
});
