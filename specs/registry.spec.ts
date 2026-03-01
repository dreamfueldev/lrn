import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { createTestCache, runCLI } from "./fixtures/index.js";
import {
  readCredentials,
  writeCredentials,
  deleteCredentials,
  requireToken,
} from "../src/credentials.js";
import { readCacheIndex, updateCacheIndex } from "../src/cache-index.js";
import { RegistryClient } from "../src/registry.js";
import { RegistryAuthError } from "../src/errors.js";
import { shouldAutoSelect } from "../src/resolve.js";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const originalFetch = globalThis.fetch;

// Helpers
function makeJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeResponse(body: string | ArrayBuffer, status = 200, contentType = "application/octet-stream"): Response {
  return new Response(body, {
    status,
    headers: { "content-type": contentType },
  });
}

describe("Registry Commands", () => {
  let cacheDir: string;
  let cleanup: () => void;
  let tempDir: string;

  beforeEach(() => {
    const cache = createTestCache([]);
    cacheDir = cache.cacheDir;
    cleanup = cache.cleanup;
    tempDir = mkdtempSync(join(tmpdir(), "lrn-registry-"));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    cleanup();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // --- Credentials ---

  describe("credentials", () => {
    it("reads and writes credentials", () => {
      const creds = { registry: "https://uselrn.dev", token: "tok_123", user: "Alice" };
      writeCredentials(cacheDir, creds);
      const read = readCredentials(cacheDir);
      expect(read).toEqual(creds);
    });

    it("returns null for missing credentials", () => {
      expect(readCredentials(cacheDir)).toBeNull();
    });

    it("returns null for corrupt credentials", () => {
      const { writeFileSync } = require("node:fs");
      writeFileSync(join(cacheDir, "credentials"), "not json");
      expect(readCredentials(cacheDir)).toBeNull();
    });

    it("sets file permissions to 0o600", () => {
      writeCredentials(cacheDir, { registry: "https://uselrn.dev", token: "t", user: "u" });
      const stats = statSync(join(cacheDir, "credentials"));
      // 0o600 = 384 decimal. On macOS, mode includes file type bits.
      expect(stats.mode & 0o777).toBe(0o600);
    });

    it("deletes credentials", () => {
      writeCredentials(cacheDir, { registry: "https://uselrn.dev", token: "t", user: "u" });
      deleteCredentials(cacheDir);
      expect(readCredentials(cacheDir)).toBeNull();
    });

    it("delete is no-op when already missing", () => {
      // Should not throw
      deleteCredentials(cacheDir);
    });

    it("requireToken throws when no credentials", () => {
      expect(() => requireToken(cacheDir)).toThrow(RegistryAuthError);
    });

    it("requireToken returns credentials when present", () => {
      const creds = { registry: "https://uselrn.dev", token: "tok", user: "Bob" };
      writeCredentials(cacheDir, creds);
      expect(requireToken(cacheDir)).toEqual(creds);
    });
  });

  // --- Cache Index ---

  describe("cache index", () => {
    it("returns empty index when missing", () => {
      const idx = readCacheIndex(cacheDir);
      expect(idx.packages).toEqual({});
    });

    it("creates and updates entries", () => {
      updateCacheIndex(cacheDir, "stripe.com/stripe", {
        version: "2024.1.0",
        pulledAt: "2024-01-01T00:00:00Z",
        checksum: "sha256:abc123",
      });

      const idx = readCacheIndex(cacheDir);
      expect(idx.packages["stripe.com/stripe"]).toEqual({
        version: "2024.1.0",
        pulledAt: "2024-01-01T00:00:00Z",
        checksum: "sha256:abc123",
      });
    });

    it("updates existing entries without clobbering others", () => {
      updateCacheIndex(cacheDir, "stripe.com/stripe", {
        version: "1.0.0",
        pulledAt: "2024-01-01T00:00:00Z",
        checksum: "sha256:aaa",
      });
      updateCacheIndex(cacheDir, "react.dev/react", {
        version: "18.0.0",
        pulledAt: "2024-02-01T00:00:00Z",
        checksum: "sha256:bbb",
      });

      const idx = readCacheIndex(cacheDir);
      expect(idx.packages["stripe.com/stripe"]).toBeDefined();
      expect(idx.packages["react.dev/react"]).toBeDefined();
    });
  });

  // --- lrn logout ---

  describe("lrn logout", () => {
    it("removes credentials and returns confirmation", async () => {
      writeCredentials(cacheDir, { registry: "https://uselrn.dev", token: "t", user: "u" });
      const result = await runCLI(["logout"], { env: { LRN_CACHE: cacheDir } });
      expect(result.stdout).toBe("Logged out.");
      expect(result.exitCode).toBe(0);
      expect(readCredentials(cacheDir)).toBeNull();
    });

    it("succeeds even when already logged out", async () => {
      const result = await runCLI(["logout"], { env: { LRN_CACHE: cacheDir } });
      expect(result.stdout).toBe("Logged out.");
      expect(result.exitCode).toBe(0);
    });
  });

  // --- lrn status ---

  describe("lrn status", () => {
    it("shows 'not logged in' when no credentials", async () => {
      const result = await runCLI(["status"], { env: { LRN_CACHE: cacheDir } });
      expect(result.stdout).toContain("Not logged in");
      expect(result.exitCode).toBe(0);
    });

    it("shows user and role when logged in", async () => {
      writeCredentials(cacheDir, { registry: "https://uselrn.dev", token: "tok_valid", user: "Alice" });

      globalThis.fetch = mock((url: string | URL | Request) => {
        const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
        if (u.includes("/me")) {
          return Promise.resolve(makeJson({ user: { name: "Alice", email: "a@b.com" }, role: "admin" }));
        }
        return Promise.resolve(makeJson({ error: "not found" }, 404));
      }) as typeof globalThis.fetch;

      const result = await runCLI(["status"], { env: { LRN_CACHE: cacheDir } });
      expect(result.stdout).toContain("User: Alice");
      expect(result.stdout).toContain("Role: admin");
      expect(result.exitCode).toBe(0);
    });

    it("handles expired session", async () => {
      writeCredentials(cacheDir, { registry: "https://uselrn.dev", token: "tok_expired", user: "Bob" });

      globalThis.fetch = mock((url: string | URL | Request) => {
        const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
        if (u.includes("/me")) {
          return Promise.resolve(makeJson({ error: "unauthorized" }, 401));
        }
        return Promise.resolve(makeJson({ error: "not found" }, 404));
      }) as typeof globalThis.fetch;

      const result = await runCLI(["status"], { env: { LRN_CACHE: cacheDir } });
      expect(result.stdout).toContain("Session expired");
      expect(result.exitCode).toBe(0);
      // Should clean up stale credentials
      expect(readCredentials(cacheDir)).toBeNull();
    });
  });

  // --- lrn login ---

  describe("lrn login", () => {
    it("completes device flow and stores credentials", async () => {
      let pollCount = 0;

      globalThis.fetch = mock((url: string | URL | Request, init?: RequestInit) => {
        const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

        if (u.includes("/api/auth/device/code")) {
          return Promise.resolve(
            makeJson({
              deviceCode: "dev_123",
              userCode: "ABCD-1234",
              verificationUri: "https://uselrn.dev/device",
              expiresIn: 300,
              interval: 0.01, // Very short interval for testing
            })
          );
        }

        if (u.includes("/api/auth/device/token")) {
          pollCount++;
          if (pollCount < 2) {
            return Promise.resolve(makeJson({ error: "authorization_pending" }, 400));
          }
          return Promise.resolve(makeJson({ token: "session_tok_abc" }));
        }

        if (u.includes("/api/auth/get-session")) {
          return Promise.resolve(
            makeJson({ user: { name: "TestUser", email: "test@example.com" } })
          );
        }

        return Promise.resolve(makeJson({ error: "not found" }, 404));
      }) as typeof globalThis.fetch;

      const result = await runCLI(["login"], { env: { LRN_CACHE: cacheDir } });
      expect(result.stdout).toContain("Logged in as TestUser");
      expect(result.exitCode).toBe(0);

      const creds = readCredentials(cacheDir);
      expect(creds).not.toBeNull();
      expect(creds!.token).toBe("session_tok_abc");
      expect(creds!.user).toBe("TestUser");
    });

    it("calls device code endpoint with lrn-cli client ID", async () => {
      let deviceCodeBody: string | undefined;

      globalThis.fetch = mock((url: string | URL | Request, init?: RequestInit) => {
        const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

        if (u.includes("/api/auth/device/code")) {
          deviceCodeBody = init?.body as string;
          return Promise.resolve(
            makeJson({
              deviceCode: "dev_456",
              userCode: "WXYZ-5678",
              verificationUri: "https://uselrn.dev/device",
              expiresIn: 300,
              interval: 0.01,
            })
          );
        }

        if (u.includes("/api/auth/device/token")) {
          return Promise.resolve(makeJson({ token: "tok_quick" }));
        }

        if (u.includes("/api/auth/get-session")) {
          return Promise.resolve(
            makeJson({ user: { name: "QuickUser", email: "q@b.com" } })
          );
        }

        return Promise.resolve(makeJson({ error: "not found" }, 404));
      }) as typeof globalThis.fetch;

      const result = await runCLI(["login"], { env: { LRN_CACHE: cacheDir } });
      expect(result.exitCode).toBe(0);
      expect(deviceCodeBody).toBeDefined();
      expect(JSON.parse(deviceCodeBody!).client_id).toBe("lrn-cli");
    });

    it("handles expired device code", async () => {
      globalThis.fetch = mock((url: string | URL | Request) => {
        const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

        if (u.includes("/api/auth/device/code")) {
          return Promise.resolve(
            makeJson({
              deviceCode: "dev_expired",
              userCode: "DEAD-BEEF",
              verificationUri: "https://uselrn.dev/device",
              expiresIn: 300,
              interval: 0.01,
            })
          );
        }

        if (u.includes("/api/auth/device/token")) {
          return Promise.resolve(makeJson({ error: "expired_token" }, 400));
        }

        return Promise.resolve(makeJson({ error: "not found" }, 404));
      }) as typeof globalThis.fetch;

      const result = await runCLI(["login"], { env: { LRN_CACHE: cacheDir } });
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("expired");
    });
  });

  // --- lrn pull ---

  describe("lrn pull", () => {
    it("requires authentication", async () => {
      const result = await runCLI(["pull", "stripe.com/stripe"], { env: { LRN_CACHE: cacheDir } });
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Not logged in");
    });

    it("requires package name argument", async () => {
      writeCredentials(cacheDir, { registry: "https://uselrn.dev", token: "tok", user: "u" });
      const result = await runCLI(["pull"], { env: { LRN_CACHE: cacheDir } });
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Missing package name");
    });

    it("downloads and caches a package", async () => {
      writeCredentials(cacheDir, { registry: "https://uselrn.dev", token: "tok_admin", user: "Admin" });

      // Create a minimal tar.gz containing a .lrn.json
      const tarData = await createTestTarGz({ name: "stripe", version: "2024.1.0", members: [], guides: [], schemas: {} });

      globalThis.fetch = mock((url: string | URL | Request) => {
        const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

        if (u.includes("/packages/stripe.com/stripe@")) {
          return Promise.resolve(
            makeJson({
              package: { domain: "stripe.com", name: "stripe" },
              version: {
                version: "2024.1.0",
                publishedAt: "2024-01-01T00:00:00Z",
                size: tarData.byteLength,
                checksum: `sha256:${computeSha256(tarData)}`,
                memberCount: 5,
                guideCount: 2,
              },
              downloadUrl: "https://r2.example.com/stripe-2024.1.0.tar.gz",
            })
          );
        }

        if (u.includes("/packages/stripe.com/stripe")) {
          return Promise.resolve(
            makeJson({
              package: { domain: "stripe.com", name: "stripe" },
              versions: [
                {
                  version: "2024.1.0",
                  publishedAt: "2024-01-01T00:00:00Z",
                  size: tarData.byteLength,
                  checksum: `sha256:${computeSha256(tarData)}`,
                  memberCount: 5,
                  guideCount: 2,
                },
              ],
            })
          );
        }

        if (u.includes("r2.example.com")) {
          return Promise.resolve(makeResponse(tarData));
        }

        return Promise.resolve(makeJson({ error: "not found" }, 404));
      }) as typeof globalThis.fetch;

      const result = await runCLI(["pull", "stripe.com/stripe"], { env: { LRN_CACHE: cacheDir } });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Pulled stripe.com/stripe@2024.1.0");

      // Verify file was cached
      const cachedPath = join(cacheDir, "packages", "stripe.com", "stripe", "2024.1.0.lrn.json");
      expect(existsSync(cachedPath)).toBe(true);

      // Verify cache index updated
      const idx = readCacheIndex(cacheDir);
      expect(idx.packages["stripe.com/stripe"]).toBeDefined();
      expect(idx.packages["stripe.com/stripe"]!.version).toBe("2024.1.0");
    });

    it("skips already-cached packages", async () => {
      writeCredentials(cacheDir, { registry: "https://uselrn.dev", token: "tok", user: "u" });

      // Pre-populate cache
      const pkgDir = join(cacheDir, "packages", "stripe.com", "stripe");
      mkdirSync(pkgDir, { recursive: true });
      const { writeFileSync } = require("node:fs");
      writeFileSync(join(pkgDir, "2024.1.0.lrn.json"), "{}");

      globalThis.fetch = mock(() => {
        throw new Error("Should not fetch when cached");
      }) as typeof globalThis.fetch;

      const result = await runCLI(["pull", "stripe.com/stripe@2024.1.0"], { env: { LRN_CACHE: cacheDir } });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("already cached");
    });

    it("re-downloads with --force", async () => {
      writeCredentials(cacheDir, { registry: "https://uselrn.dev", token: "tok_admin", user: "Admin" });

      // Pre-populate cache
      const pkgDir = join(cacheDir, "packages", "stripe.com", "stripe");
      mkdirSync(pkgDir, { recursive: true });
      const { writeFileSync } = require("node:fs");
      writeFileSync(join(pkgDir, "2024.1.0.lrn.json"), "{}");

      const tarData = await createTestTarGz({ name: "stripe", version: "2024.1.0", members: [], guides: [], schemas: {} });

      globalThis.fetch = mock((url: string | URL | Request) => {
        const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

        if (u.includes("/packages/stripe.com/stripe@")) {
          return Promise.resolve(
            makeJson({
              package: { domain: "stripe.com", name: "stripe" },
              version: {
                version: "2024.1.0",
                publishedAt: "2024-01-01T00:00:00Z",
                size: tarData.byteLength,
                checksum: `sha256:${computeSha256(tarData)}`,
                memberCount: 5,
                guideCount: 2,
              },
              downloadUrl: "https://r2.example.com/stripe.tar.gz",
            })
          );
        }

        if (u.includes("r2.example.com")) {
          return Promise.resolve(makeResponse(tarData));
        }

        return Promise.resolve(makeJson({ error: "not found" }, 404));
      }) as typeof globalThis.fetch;

      const result = await runCLI(["pull", "stripe.com/stripe@2024.1.0", "--force"], { env: { LRN_CACHE: cacheDir } });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Pulled stripe.com/stripe@2024.1.0");
    });

    it("returns 403 when downloadUrl is missing (non-admin)", async () => {
      writeCredentials(cacheDir, { registry: "https://uselrn.dev", token: "tok_user", user: "User" });

      globalThis.fetch = mock((url: string | URL | Request) => {
        const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

        if (u.includes("/packages/stripe.com/stripe@")) {
          return Promise.resolve(
            makeJson({
              package: { domain: "stripe.com", name: "stripe" },
              version: {
                version: "2024.1.0",
                publishedAt: "2024-01-01T00:00:00Z",
                size: 1000,
                checksum: "sha256:abc",
                memberCount: 5,
                guideCount: 2,
              },
              // No downloadUrl — non-admin
            })
          );
        }

        if (u.includes("/packages/stripe.com/stripe")) {
          return Promise.resolve(
            makeJson({
              package: { domain: "stripe.com", name: "stripe" },
              versions: [
                {
                  version: "2024.1.0",
                  publishedAt: "2024-01-01T00:00:00Z",
                  size: 1000,
                  checksum: "sha256:abc",
                  memberCount: 5,
                  guideCount: 2,
                },
              ],
            })
          );
        }

        return Promise.resolve(makeJson({ error: "not found" }, 404));
      }) as typeof globalThis.fetch;

      const result = await runCLI(["pull", "stripe.com/stripe"], { env: { LRN_CACHE: cacheDir } });
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("admin access");
    });

    it("handles 404 for missing package", async () => {
      writeCredentials(cacheDir, { registry: "https://uselrn.dev", token: "tok", user: "u" });

      globalThis.fetch = mock((url: string | URL | Request) => {
        const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
        if (u.includes("/packages/example.com/nonexistent")) {
          return Promise.resolve(makeJson({ error: "not_found" }, 404));
        }
        return Promise.resolve(makeJson({ error: "not found" }, 404));
      }) as typeof globalThis.fetch;

      const result = await runCLI(["pull", "example.com/nonexistent"], { env: { LRN_CACHE: cacheDir } });
      expect(result.exitCode).not.toBe(0);
    });

    it("verifies checksum and fails on mismatch", async () => {
      writeCredentials(cacheDir, { registry: "https://uselrn.dev", token: "tok_admin", user: "Admin" });

      const tarData = await createTestTarGz({ name: "stripe", version: "1.0.0", members: [], guides: [], schemas: {} });

      globalThis.fetch = mock((url: string | URL | Request) => {
        const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

        if (u.includes("/packages/stripe.com/stripe@")) {
          return Promise.resolve(
            makeJson({
              package: { domain: "stripe.com", name: "stripe" },
              version: {
                version: "1.0.0",
                publishedAt: "2024-01-01T00:00:00Z",
                size: tarData.byteLength,
                checksum: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
                memberCount: 1,
                guideCount: 0,
              },
              downloadUrl: "https://r2.example.com/stripe.tar.gz",
            })
          );
        }

        if (u.includes("r2.example.com")) {
          return Promise.resolve(makeResponse(tarData));
        }

        return Promise.resolve(makeJson({ error: "not found" }, 404));
      }) as typeof globalThis.fetch;

      const result = await runCLI(["pull", "stripe.com/stripe@1.0.0"], { env: { LRN_CACHE: cacheDir } });
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Checksum verification failed");
    });
  });

  // --- Registry client ---

  describe("RegistryClient", () => {
    it("maps 401 to RegistryAuthError", async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(makeJson({ error: "unauthorized" }, 401))
      ) as typeof globalThis.fetch;

      const client = new RegistryClient("https://uselrn.dev", "bad_token");
      await expect(client.getPackage("stripe.com/stripe")).rejects.toThrow("Not logged in");
    });

    it("maps 429 to RegistryRateLimitError", async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(makeJson({ error: "rate_limit" }, 429))
      ) as typeof globalThis.fetch;

      const client = new RegistryClient("https://uselrn.dev", "tok");
      await expect(client.getPackage("stripe.com/stripe")).rejects.toThrow("Rate limit");
    });

    it("maps 403 to RegistryForbiddenError", async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(makeJson({ error: "forbidden" }, 403))
      ) as typeof globalThis.fetch;

      const client = new RegistryClient("https://uselrn.dev", "tok");
      await expect(client.getPackage("stripe.com/stripe")).rejects.toThrow("admin access");
    });

    it("maps network failure to NetworkError", async () => {
      globalThis.fetch = mock(() =>
        Promise.reject(new TypeError("fetch failed"))
      ) as typeof globalThis.fetch;

      const client = new RegistryClient("https://uselrn.dev", "tok");
      await expect(client.getPackage("stripe.com/stripe")).rejects.toThrow("connect");
    });
  });

  // --- Fuzzy Resolution ---

  describe("fuzzy resolution", () => {
    it("shouldAutoSelect returns true for single result", () => {
      const results = [
        { domain: "dev.react", name: "react", fullName: "dev.react/react", description: "React", classification: "library", score: 350 },
      ];
      expect(shouldAutoSelect(results)).toBe(true);
    });

    it("shouldAutoSelect returns true for empty results", () => {
      expect(shouldAutoSelect([])).toBe(true);
    });

    it("shouldAutoSelect returns true when top score >= 2x second", () => {
      const results = [
        { domain: "dev.react", name: "react", fullName: "dev.react/react", description: "React", classification: "library", score: 350 },
        { domain: "com.reactnative", name: "react-native", fullName: "com.reactnative/react-native", description: "React Native", classification: "library", score: 60 },
      ];
      expect(shouldAutoSelect(results)).toBe(true);
    });

    it("shouldAutoSelect returns false when scores are close", () => {
      const results = [
        { domain: "com.better-auth", name: "better-auth", fullName: "com.better-auth/better-auth", description: "Auth framework", classification: "library", score: 90 },
        { domain: "com.firebase", name: "firebase-auth", fullName: "com.firebase/firebase-auth", description: "Firebase Auth", classification: "api", score: 85 },
      ];
      expect(shouldAutoSelect(results)).toBe(false);
    });

    it("lrn add with slash bypasses resolution", async () => {
      writeCredentials(cacheDir, { registry: "https://uselrn.dev", token: "tok_admin", user: "Admin" });

      const tarData = await createTestTarGz({ name: "react", version: "18.0.0", members: [], guides: [], schemas: {} });

      globalThis.fetch = mock((url: string | URL | Request) => {
        const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

        // Should never call /resolve since name has a slash
        if (u.includes("/resolve")) {
          throw new Error("Should not call resolve for domain/name input");
        }

        if (u.includes("/packages/dev.react/react@")) {
          return Promise.resolve(
            makeJson({
              package: { domain: "dev.react", name: "react" },
              version: {
                version: "18.0.0",
                publishedAt: "2024-01-01T00:00:00Z",
                size: tarData.byteLength,
                checksum: `sha256:${computeSha256(tarData)}`,
                memberCount: 1,
                guideCount: 0,
              },
              downloadUrl: "https://r2.example.com/react.tar.gz",
            })
          );
        }

        if (u.includes("/packages/dev.react/react")) {
          return Promise.resolve(
            makeJson({
              package: { domain: "dev.react", name: "react" },
              versions: [{
                version: "18.0.0",
                publishedAt: "2024-01-01T00:00:00Z",
                size: tarData.byteLength,
                checksum: `sha256:${computeSha256(tarData)}`,
                memberCount: 1,
                guideCount: 0,
              }],
            })
          );
        }

        if (u.includes("r2.example.com")) {
          return Promise.resolve(makeResponse(tarData));
        }

        return Promise.resolve(makeJson({ error: "not found" }, 404));
      }) as typeof globalThis.fetch;

      const savedCwd = process.cwd();
      process.chdir(tempDir);
      try {
        const result = await runCLI(["add", "dev.react/react"], { env: { LRN_CACHE: cacheDir } });
        expect(result.exitCode).toBe(0);
      } finally {
        process.chdir(savedCwd);
      }
    });

    it("lrn add without slash auto-selects clear winner", async () => {
      writeCredentials(cacheDir, { registry: "https://uselrn.dev", token: "tok_admin", user: "Admin" });

      const tarData = await createTestTarGz({ name: "react", version: "18.0.0", members: [], guides: [], schemas: {} });

      globalThis.fetch = mock((url: string | URL | Request) => {
        const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

        if (u.includes("/resolve")) {
          return Promise.resolve(
            makeJson({
              results: [
                { domain: "dev.react", name: "react", fullName: "dev.react/react", description: "React UI library", classification: "library", score: 350 },
                { domain: "com.reactnative", name: "react-native", fullName: "com.reactnative/react-native", description: "React Native", classification: "library", score: 60 },
              ],
            })
          );
        }

        if (u.includes("/packages/dev.react/react@")) {
          return Promise.resolve(
            makeJson({
              package: { domain: "dev.react", name: "react" },
              version: {
                version: "18.0.0",
                publishedAt: "2024-01-01T00:00:00Z",
                size: tarData.byteLength,
                checksum: `sha256:${computeSha256(tarData)}`,
                memberCount: 1,
                guideCount: 0,
              },
              downloadUrl: "https://r2.example.com/react.tar.gz",
            })
          );
        }

        if (u.includes("/packages/dev.react/react")) {
          return Promise.resolve(
            makeJson({
              package: { domain: "dev.react", name: "react" },
              versions: [{
                version: "18.0.0",
                publishedAt: "2024-01-01T00:00:00Z",
                size: tarData.byteLength,
                checksum: `sha256:${computeSha256(tarData)}`,
                memberCount: 1,
                guideCount: 0,
              }],
            })
          );
        }

        if (u.includes("r2.example.com")) {
          return Promise.resolve(makeResponse(tarData));
        }

        return Promise.resolve(makeJson({ error: "not found" }, 404));
      }) as typeof globalThis.fetch;

      const savedCwd = process.cwd();
      process.chdir(tempDir);
      try {
        const result = await runCLI(["add", "react"], { env: { LRN_CACHE: cacheDir } });
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("dev.react/react");
      } finally {
        process.chdir(savedCwd);
      }
    });

    it("lrn add without auth shows login prompt", async () => {
      // No credentials written
      const result = await runCLI(["add", "react"], { env: { LRN_CACHE: cacheDir } });
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Not logged in");
    });

    it("lrn add nonexistent shows no packages match", async () => {
      writeCredentials(cacheDir, { registry: "https://uselrn.dev", token: "tok", user: "u" });

      globalThis.fetch = mock((url: string | URL | Request) => {
        const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

        if (u.includes("/resolve")) {
          return Promise.resolve(makeJson({ results: [] }));
        }

        return Promise.resolve(makeJson({ error: "not found" }, 404));
      }) as typeof globalThis.fetch;

      const result = await runCLI(["add", "nonexistent-pkg-xyz"], { env: { LRN_CACHE: cacheDir } });
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("No packages match");
    });

    it("lrn search falls back to registry when no local results", async () => {
      writeCredentials(cacheDir, { registry: "https://uselrn.dev", token: "tok", user: "u" });

      globalThis.fetch = mock((url: string | URL | Request) => {
        const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;

        if (u.includes("/resolve")) {
          return Promise.resolve(
            makeJson({
              results: [
                { domain: "dev.react", name: "react", fullName: "dev.react/react", description: "React UI library", classification: "library", score: 350 },
              ],
            })
          );
        }

        return Promise.resolve(makeJson({ error: "not found" }, 404));
      }) as typeof globalThis.fetch;

      const result = await runCLI(["search", "xyznonexistent"], { env: { LRN_CACHE: cacheDir } });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Found in registry");
      expect(result.stdout).toContain("dev.react/react");
      expect(result.stdout).toContain("lrn add");
    });

    it("RegistryClient.resolve calls /resolve endpoint", async () => {
      let calledUrl = "";
      globalThis.fetch = mock((url: string | URL | Request) => {
        const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
        calledUrl = u;
        return Promise.resolve(
          makeJson({
            results: [
              { domain: "dev.react", name: "react", fullName: "dev.react/react", description: "React", classification: "library", score: 350 },
            ],
          })
        );
      }) as typeof globalThis.fetch;

      const client = new RegistryClient("https://uselrn.dev", "tok");
      const results = await client.resolve("react");
      expect(calledUrl).toContain("/resolve");
      expect(calledUrl).toContain("q=react");
      expect(results).toHaveLength(1);
      expect(results[0]!.fullName).toBe("dev.react/react");
    });
  });

  // --- Help ---

  describe("help text", () => {
    it("includes registry commands in main help", async () => {
      const result = await runCLI(["--help"]);
      expect(result.stdout).toContain("Registry Commands");
      expect(result.stdout).toContain("login");
      expect(result.stdout).toContain("logout");
      expect(result.stdout).toContain("status");
      expect(result.stdout).toContain("pull");
    });

    it("shows login help", async () => {
      const result = await runCLI(["login", "--help"]);
      expect(result.stdout).toContain("device flow");
    });

    it("shows pull help", async () => {
      const result = await runCLI(["pull", "--help"]);
      expect(result.stdout).toContain("--force");
    });
  });
});

// --- Helpers ---

function computeSha256(data: ArrayBuffer): string {
  const { createHash } = require("node:crypto");
  return createHash("sha256").update(Buffer.from(data)).digest("hex");
}

/**
 * Create a .tar.gz file containing a .lrn.json for testing.
 * Uses tar command to create a real archive.
 */
async function createTestTarGz(pkg: Record<string, unknown>): Promise<ArrayBuffer> {
  const { mkdtempSync, writeFileSync, readFileSync, rmSync } = require("node:fs");
  const { execSync } = require("node:child_process");
  const { tmpdir } = require("node:os");
  const { join } = require("node:path");

  const tmpDir = mkdtempSync(join(tmpdir(), "lrn-test-tar-"));
  const jsonPath = join(tmpDir, `${pkg.name}.lrn.json`);
  writeFileSync(jsonPath, JSON.stringify(pkg, null, 2));

  const tarPath = join(tmpDir, "package.tar.gz");
  execSync(`tar czf ${JSON.stringify(tarPath)} -C ${JSON.stringify(tmpDir)} ${pkg.name}.lrn.json`, {
    stdio: "ignore",
  });

  const data = readFileSync(tarPath);
  rmSync(tmpDir, { recursive: true, force: true });
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
}
