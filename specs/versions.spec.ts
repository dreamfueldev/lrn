import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { createTestCache, runCLI } from "./fixtures/index.js";
import { writeCredentials } from "../src/credentials.js";
import { updateCacheIndex } from "../src/cache-index.js";

const originalFetch = globalThis.fetch;

function makeJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const PACKAGE_INFO = {
  package: { domain: "stripe.com", name: "stripe", description: "Stripe API documentation" },
  versions: [
    { version: "2024.2.0", publishedAt: "2024-06-01T00:00:00Z", size: 524288, checksum: "sha256:aaa", memberCount: 10, guideCount: 3 },
    { version: "2024.1.0", publishedAt: "2024-01-15T00:00:00Z", size: 512000, checksum: "sha256:bbb", memberCount: 8, guideCount: 2 },
    { version: "2023.6.0", publishedAt: "2023-06-01T00:00:00Z", size: 480000, checksum: "sha256:ccc", memberCount: 6, guideCount: 1 },
  ],
};

describe("lrn versions", () => {
  let cacheDir: string;
  let cleanup: () => void;

  beforeEach(() => {
    const cache = createTestCache([]);
    cacheDir = cache.cacheDir;
    cleanup = cache.cleanup;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    cleanup();
  });

  it("requires package name argument", async () => {
    writeCredentials(cacheDir, { registry: "https://uselrn.dev", token: "tok", user: "u" });
    const result = await runCLI(["versions"], { env: { LRN_CACHE: cacheDir } });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Missing package name");
  });

  it("requires authentication", async () => {
    const result = await runCLI(["versions", "stripe.com/stripe"], { env: { LRN_CACHE: cacheDir } });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Not logged in");
  });

  it("lists versions in descending order with latest marker", async () => {
    writeCredentials(cacheDir, { registry: "https://uselrn.dev", token: "tok", user: "u" });

    globalThis.fetch = mock((url: string | URL | Request) => {
      const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (u.includes("/packages/stripe.com/stripe")) {
        return Promise.resolve(makeJson(PACKAGE_INFO));
      }
      return Promise.resolve(makeJson({ error: "not found" }, 404));
    }) as typeof globalThis.fetch;

    const result = await runCLI(["versions", "stripe.com/stripe"], { env: { LRN_CACHE: cacheDir } });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("stripe.com/stripe — Stripe API documentation");
    expect(result.stdout).toContain("2024.2.0  (latest)");
    expect(result.stdout).toContain("2024.1.0");
    expect(result.stdout).toContain("2023.6.0");
  });

  it("marks cached version", async () => {
    writeCredentials(cacheDir, { registry: "https://uselrn.dev", token: "tok", user: "u" });
    updateCacheIndex(cacheDir, "stripe.com/stripe", {
      version: "2024.1.0",
      pulledAt: "2024-01-15T00:00:00Z",
      checksum: "sha256:bbb",
    });

    globalThis.fetch = mock((url: string | URL | Request) => {
      const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (u.includes("/packages/stripe.com/stripe")) {
        return Promise.resolve(makeJson(PACKAGE_INFO));
      }
      return Promise.resolve(makeJson({ error: "not found" }, 404));
    }) as typeof globalThis.fetch;

    const result = await runCLI(["versions", "stripe.com/stripe"], { env: { LRN_CACHE: cacheDir } });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("2024.1.0  * cached");
  });

  it("shows count summary", async () => {
    writeCredentials(cacheDir, { registry: "https://uselrn.dev", token: "tok", user: "u" });

    globalThis.fetch = mock((url: string | URL | Request) => {
      const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (u.includes("/packages/stripe.com/stripe")) {
        return Promise.resolve(makeJson(PACKAGE_INFO));
      }
      return Promise.resolve(makeJson({ error: "not found" }, 404));
    }) as typeof globalThis.fetch;

    const result = await runCLI(["versions", "stripe.com/stripe"], { env: { LRN_CACHE: cacheDir } });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("3 versions available.");
  });

  it("returns structured JSON with --json flag", async () => {
    writeCredentials(cacheDir, { registry: "https://uselrn.dev", token: "tok", user: "u" });
    updateCacheIndex(cacheDir, "stripe.com/stripe", {
      version: "2024.1.0",
      pulledAt: "2024-01-15T00:00:00Z",
      checksum: "sha256:bbb",
    });

    globalThis.fetch = mock((url: string | URL | Request) => {
      const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (u.includes("/packages/stripe.com/stripe")) {
        return Promise.resolve(makeJson(PACKAGE_INFO));
      }
      return Promise.resolve(makeJson({ error: "not found" }, 404));
    }) as typeof globalThis.fetch;

    const result = await runCLI(["versions", "stripe.com/stripe", "--json"], { env: { LRN_CACHE: cacheDir } });
    expect(result.exitCode).toBe(0);

    const parsed = JSON.parse(result.stdout);
    expect(parsed.package).toBe("stripe.com/stripe");
    expect(parsed.versions).toHaveLength(3);
    expect(parsed.versions[0].version).toBe("2024.2.0");
    expect(parsed.versions[0].latest).toBe(true);
    expect(parsed.versions[0].cached).toBe(false);
    expect(parsed.versions[1].version).toBe("2024.1.0");
    expect(parsed.versions[1].latest).toBe(false);
    expect(parsed.versions[1].cached).toBe(true);
    expect(parsed.versions[2].latest).toBe(false);
    expect(parsed.versions[2].cached).toBe(false);
  });

  it("handles 404 for unknown package", async () => {
    writeCredentials(cacheDir, { registry: "https://uselrn.dev", token: "tok", user: "u" });

    globalThis.fetch = mock(() => {
      return Promise.resolve(makeJson({ error: "not_found" }, 404));
    }) as typeof globalThis.fetch;

    const result = await runCLI(["versions", "example.com/nonexistent"], { env: { LRN_CACHE: cacheDir } });
    expect(result.exitCode).not.toBe(0);
  });

  it("handles network failure", async () => {
    writeCredentials(cacheDir, { registry: "https://uselrn.dev", token: "tok", user: "u" });

    globalThis.fetch = mock(() => {
      return Promise.reject(new TypeError("fetch failed"));
    }) as typeof globalThis.fetch;

    const result = await runCLI(["versions", "stripe.com/stripe"], { env: { LRN_CACHE: cacheDir } });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("connect");
  });
});
