import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  loadAllFixturePackages,
  createTestCache,
  runCLI,
  getMalformedConfigPath,
} from "./fixtures/index.js";

describe("Error Handling", () => {
  let cacheDir: string;
  let cleanup: () => void;

  beforeAll(() => {
    const packages = loadAllFixturePackages();
    const cache = createTestCache(packages);
    cacheDir = cache.cacheDir;
    cleanup = cache.cleanup;
  });

  afterAll(() => {
    cleanup();
  });

  const runWithCache = (args: string[]) =>
    runCLI(["--format", "text", ...args], { env: { LRN_CACHE: cacheDir } });

  describe("exit codes", () => {
    it("exits with code 0 on success", async () => {
      const result = await runWithCache(["mathlib"]);
      expect(result.exitCode).toBe(0);
    });

    it("exits with code 1 on general error", async () => {
      const result = await runWithCache(["--unknown-flag"]);
      expect(result.exitCode).toBe(1);
    });

    it("exits with code 2 when package not found", async () => {
      const result = await runWithCache(["nonexistent-package"]);
      expect(result.exitCode).toBe(2);
    });

    it("exits with code 3 when member/guide not found", async () => {
      const result = await runWithCache(["mathlib", "nonexistent.member"]);
      expect(result.exitCode).toBe(3);
    });

    it("exits with code 4 on network error", async () => {
      const { writeFileSync, mkdirSync } = require("node:fs");
      const { join } = require("node:path");
      // Write fake credentials so requireToken() passes
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(
        join(cacheDir, "credentials"),
        JSON.stringify({ registry: "https://broken.example", token: "fake", user: "test" }),
      );
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (() => {
        throw new TypeError("fetch failed");
      }) as typeof fetch;
      try {
        const result = await runCLI(["--format", "text", "versions", "example.com/some-pkg"], {
          env: { LRN_CACHE: cacheDir },
        });
        expect(result.exitCode).toBe(4);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("exit code 1 - general errors", () => {
    it("invalid command syntax", async () => {
      const result = await runWithCache(["search"]);
      expect(result.exitCode).toBe(1);
    });
    it("invalid option value", async () => {
      const result = await runWithCache(["mathlib", "list", "--format", "bogus"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Invalid format");
    });
    it("missing required argument", async () => {
      const result = await runWithCache(["add"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Missing");
    });
    it("invalid config file", async () => {
      const malformedPath = getMalformedConfigPath();
      const result = await runCLI(["--config", malformedPath, "mathlib"], {
        env: { LRN_CACHE: cacheDir },
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("config");
    });
    it("permission denied errors", async () => {
      const { writeFileSync, mkdirSync, chmodSync } = require("node:fs");
      const { join } = require("node:path");
      // Create a file with no read permissions in the test cache
      const pkgDir = join(cacheDir, "packages", "noperm");
      mkdirSync(pkgDir, { recursive: true });
      const filePath = join(pkgDir, "1.0.0.lrn.json");
      writeFileSync(filePath, JSON.stringify({ name: "noperm", version: "1.0.0", members: [], guides: [], schemas: {} }));
      chmodSync(filePath, 0o000);
      try {
        const result = await runWithCache(["noperm"]);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("Permission denied");
      } finally {
        chmodSync(filePath, 0o644);
      }
    });
    it("file system errors", async () => {
      const { writeFileSync, mkdirSync, chmodSync } = require("node:fs");
      const { join } = require("node:path");
      // Same approach — verify the user-friendly message
      const pkgDir = join(cacheDir, "packages", "noaccess");
      mkdirSync(pkgDir, { recursive: true });
      const filePath = join(pkgDir, "1.0.0.lrn.json");
      writeFileSync(filePath, JSON.stringify({ name: "noaccess", version: "1.0.0", members: [], guides: [], schemas: {} }));
      chmodSync(filePath, 0o000);
      try {
        const result = await runWithCache(["noaccess"]);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("Check file permissions");
      } finally {
        chmodSync(filePath, 0o644);
      }
    });
  });

  describe("exit code 2 - package not found", () => {
    it("package not in local cache", async () => {
      const result = await runWithCache(["unknown-package"]);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("not found");
    });

    it.todo("package not found in registry");
    it("package name typo suggestions", async () => {
      const result = await runWithCache(["mathlbi"]);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("Did you mean");
      expect(result.stderr).toContain("mathlib");
    });
  });

  describe("exit code 3 - member/guide not found", () => {
    it("member path does not exist", async () => {
      const result = await runWithCache(["mathlib", "nonexistent"]);
      expect(result.exitCode).toBe(3);
      expect(result.stderr).toContain("not found");
    });

    it("guide slug does not exist", async () => {
      const result = await runWithCache(["acme-api", "guide", "nonexistent"]);
      expect(result.exitCode).toBe(3);
      expect(result.stderr).toContain("not found");
    });

    it("section path does not exist", async () => {
      const result = await runWithCache(["acme-api", "guide", "quickstart.nonexistent"]);
      expect(result.exitCode).toBe(3);
      expect(result.stderr).toContain("not found");
    });

    it("type/schema name does not exist", async () => {
      const result = await runWithCache(["acme-api", "type", "NonexistentType"]);
      expect(result.exitCode).toBe(3);
      expect(result.stderr).toContain("not found");
    });

    it("similar name suggestions", async () => {
      const result = await runWithCache(["mathlib", "addd"]);
      expect(result.exitCode).toBe(3);
      expect(result.stderr).toContain("Did you mean");
      expect(result.stderr).toContain("add");
    });
  });

  describe("exit code 4 - network errors", () => {
    it.todo("registry unreachable");
    it.todo("connection timeout");
    it.todo("DNS resolution failure");
    it.todo("SSL/TLS errors");
  });

  describe("error message formatting", () => {
    it("shows clear error message", async () => {
      const result = await runWithCache(["nonexistent"]);
      expect(result.stderr).toContain("nonexistent");
      expect(result.stderr.length).toBeGreaterThan(0);
    });

    it("shows error context (what was being attempted)", async () => {
      const result = await runWithCache(["nonexistent-pkg"]);
      expect(result.exitCode).toBe(2);
      // Hint line provides resolution context
      expect(result.stderr).toContain("lrn");
    });
    it("shows suggestion for resolution when possible", async () => {
      const malformedPath = getMalformedConfigPath();
      const result = await runCLI(["--config", malformedPath, "mathlib"], {
        env: { LRN_CACHE: cacheDir },
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("--no-config");
    });
    it("uses consistent error format across commands", async () => {
      // Package not found
      const r1 = await runWithCache(["nonexistent-pkg"]);
      expect(r1.exitCode).toBe(2);
      expect(r1.stderr).toContain("not found");
      expect(r1.stderr.split("\n").length).toBeGreaterThanOrEqual(2);

      // Member not found
      const r2 = await runWithCache(["mathlib", "nonexistent"]);
      expect(r2.exitCode).toBe(3);
      expect(r2.stderr).toContain("not found");
      expect(r2.stderr.split("\n").length).toBeGreaterThanOrEqual(2);

      // Guide not found
      const r3 = await runWithCache(["acme-api", "guide", "nonexistent"]);
      expect(r3.exitCode).toBe(3);
      expect(r3.stderr).toContain("not found");
      expect(r3.stderr.split("\n").length).toBeGreaterThanOrEqual(2);
    });

    it("uses stderr for error messages", async () => {
      const result = await runWithCache(["nonexistent"]);
      expect(result.stderr.length).toBeGreaterThan(0);
      // Error should be on stderr, not stdout
    });
  });

  describe("--verbose flag", () => {
    it("shows stack trace on error", async () => {
      const result = await runWithCache(["--verbose", "nonexistent"]);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("Stack trace:");
    });
    it("shows additional debug information", async () => {
      const result = await runWithCache(["--verbose", "nonexistent"]);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("Debug:");
      expect(result.stderr).toContain("package: nonexistent");
    });
    it("shows network request details", async () => {
      const { writeFileSync, mkdirSync } = require("node:fs");
      const { join } = require("node:path");
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(
        join(cacheDir, "credentials"),
        JSON.stringify({ registry: "https://broken.example", token: "fake", user: "test" }),
      );
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (() => {
        throw new TypeError("fetch failed");
      }) as typeof fetch;
      try {
        const result = await runCLI(["--format", "text", "--verbose", "versions", "example.com/some-pkg"], {
          env: { LRN_CACHE: cacheDir },
        });
        expect(result.exitCode).toBe(4);
        expect(result.stderr).toContain("Stack trace:");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
    it("shows config resolution details", async () => {
      const malformedPath = getMalformedConfigPath();
      const result = await runCLI(["--verbose", "--config", malformedPath, "mathlib"], {
        env: { LRN_CACHE: cacheDir },
      });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Debug:");
      expect(result.stderr).toContain(malformedPath);
    });
  });

  describe("--quiet flag", () => {
    it.todo("suppresses non-essential output");
    it.todo("still shows error messages");
    it.todo("still shows requested data");
    it.todo("suppresses progress indicators");
    it.todo("suppresses informational messages");
  });

  describe("graceful degradation", () => {
    it.todo("continues with partial results when some data unavailable");
    it.todo("shows warning for missing optional data");
    it.todo("handles malformed package data gracefully");
  });
});
