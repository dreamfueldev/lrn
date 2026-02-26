import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadAllFixturePackages,
  createTestCache,
  runCLI,
} from "./fixtures/index.js";

describe("Configuration", () => {
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

  const runWithCache = (args: string[], extraEnv: Record<string, string> = {}) =>
    runCLI(args, { env: { LRN_CACHE: cacheDir, ...extraEnv } });

  describe("LRN_CACHE environment variable", () => {
    it("uses LRN_CACHE to find packages", async () => {
      const result = await runWithCache(["mathlib"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("mathlib");
    });

    it("shows empty list when cache has no packages", async () => {
      const emptyDir = mkdtempSync(join(tmpdir(), "lrn-empty-"));
      try {
        const result = await runCLI([], { env: { LRN_CACHE: emptyDir } });
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("No packages found");
      } finally {
        rmSync(emptyDir, { recursive: true, force: true });
      }
    });
  });

  describe("--no-config flag", () => {
    it("still respects LRN_CACHE env var", async () => {
      const result = await runWithCache(["--no-config", "mathlib"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("mathlib");
    });
  });

  describe("--config flag", () => {
    it("fails with clear error when config file not found", async () => {
      const result = await runWithCache(["--config", "/nonexistent/config.json", "mathlib"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("not found");
    });

    it("fails with clear error when config file has invalid JSON", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "lrn-config-"));
      const badConfig = join(tempDir, "bad.json");
      writeFileSync(badConfig, "not valid json{{{");
      try {
        const result = await runWithCache(["--config", badConfig, "mathlib"]);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("Invalid JSON");
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("loads valid config file", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "lrn-config-"));
      const configPath = join(tempDir, "lrn.config.json");
      writeFileSync(configPath, JSON.stringify({ registry: "https://example.com" }));
      try {
        // Should not error — config is valid
        const result = await runWithCache(["--config", configPath]);
        expect(result.exitCode).toBe(0);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("rejects invalid defaultFormat in config", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "lrn-config-"));
      const configPath = join(tempDir, "lrn.config.json");
      writeFileSync(configPath, JSON.stringify({ defaultFormat: "xml" }));
      try {
        const result = await runWithCache(["--config", configPath]);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("Invalid defaultFormat");
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("rejects invalid package spec in config", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "lrn-config-"));
      const configPath = join(tempDir, "lrn.config.json");
      writeFileSync(configPath, JSON.stringify({ packages: { foo: 42 } }));
      try {
        const result = await runWithCache(["--config", configPath]);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("Invalid package specification");
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("rejects package spec with no valid keys", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "lrn-config-"));
      const configPath = join(tempDir, "lrn.config.json");
      writeFileSync(configPath, JSON.stringify({ packages: { foo: { bad: true } } }));
      try {
        const result = await runWithCache(["--config", configPath]);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain("Must have version, path, or url");
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("accepts valid package spec with version", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "lrn-config-"));
      const configPath = join(tempDir, "lrn.config.json");
      writeFileSync(configPath, JSON.stringify({ packages: { foo: "^1.0.0" } }));
      try {
        const result = await runWithCache(["--config", configPath]);
        expect(result.exitCode).toBe(0);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("accepts valid package spec with path", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "lrn-config-"));
      const configPath = join(tempDir, "lrn.config.json");
      writeFileSync(configPath, JSON.stringify({ packages: { foo: { path: "./foo.json" } } }));
      try {
        const result = await runWithCache(["--config", configPath]);
        expect(result.exitCode).toBe(0);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe("LRN_FORMAT environment variable", () => {
    it("overrides default output format", async () => {
      const result = await runWithCache(["mathlib"], { LRN_FORMAT: "json" });
      expect(result.exitCode).toBe(0);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    });

    it("ignores invalid format value", async () => {
      const result = await runWithCache(["mathlib"], { LRN_FORMAT: "invalid" });
      expect(result.exitCode).toBe(0);
      // Falls back to text format
      expect(() => JSON.parse(result.stdout)).toThrow();
    });

    it("is overridden by --format flag", async () => {
      const result = await runWithCache(["--format", "text", "mathlib"], { LRN_FORMAT: "json" });
      expect(result.exitCode).toBe(0);
      // --format text wins over LRN_FORMAT=json
      expect(() => JSON.parse(result.stdout)).toThrow();
    });
  });

  describe("--registry flag", () => {
    it("overrides registry from config", async () => {
      // Just verify it doesn't crash — registry isn't used for local packages
      const result = await runWithCache(["--registry", "https://custom.example.com", "mathlib"]);
      expect(result.exitCode).toBe(0);
    });
  });

  describe("cache error handling", () => {
    it("handles corrupted package JSON file", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "lrn-cache-corrupt-"));
      const pkgDir = join(tempDir, "packages", "badpkg");
      mkdirSync(pkgDir, { recursive: true });
      writeFileSync(join(pkgDir, ".lrn.json"), "not valid json{{{");
      try {
        const result = await runCLI(["badpkg"], {
          env: { LRN_CACHE: join(tempDir, "packages") },
        });
        // Should fail gracefully — package can't be loaded
        expect(result.exitCode).not.toBe(0);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("handles empty package directory", async () => {
      const tempDir = mkdtempSync(join(tmpdir(), "lrn-cache-empty-"));
      const pkgDir = join(tempDir, "packages", "emptypkg");
      mkdirSync(pkgDir, { recursive: true });
      try {
        const result = await runCLI(["emptypkg"], {
          env: { LRN_CACHE: join(tempDir, "packages") },
        });
        expect(result.exitCode).not.toBe(0);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe("LRN_REGISTRY environment variable", () => {
    it("overrides default registry", async () => {
      const result = await runWithCache(["mathlib"], { LRN_REGISTRY: "https://custom.example.com" });
      expect(result.exitCode).toBe(0);
    });
  });
});
