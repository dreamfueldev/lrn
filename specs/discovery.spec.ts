import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  loadAllFixturePackages,
  createTestCache,
  runCLI,
} from "./fixtures/index.js";

describe("Discovery Commands", () => {
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

  describe("lrn (no arguments)", () => {
    it("lists all cached packages", async () => {
      const result = await runWithCache([]);
      expect(result.stdout).toContain("mathlib");
      expect(result.stdout).toContain("acme-api");
      expect(result.exitCode).toBe(0);
    });

    it("shows package name for each cached package", async () => {
      const result = await runWithCache([]);
      expect(result.stdout).toContain("mathlib");
      expect(result.stdout).toContain("acme-api");
    });

    it("shows package version for each cached package", async () => {
      const result = await runWithCache([]);
      expect(result.stdout).toContain("2.1.0");
      expect(result.stdout).toContain("2024.1.0");
    });

    it("shows package summary for each cached package", async () => {
      const result = await runWithCache([]);
      expect(result.stdout).toContain("simple math utilities");
      expect(result.stdout).toContain("REST API");
    });

    it("shows message when no packages are cached", async () => {
      const emptyCache = createTestCache([]);
      try {
        const result = await runCLI(["--format", "text"], {
          env: { LRN_CACHE: emptyCache.cacheDir },
        });
        expect(result.stdout).toContain("No packages");
        expect(result.exitCode).toBe(0);
      } finally {
        emptyCache.cleanup();
      }
    });

    it("sorts packages alphabetically by name", async () => {
      const result = await runWithCache([]);
      // acme-api should come before mathlib
      const acmeIndex = result.stdout.indexOf("acme-api");
      const mathlibIndex = result.stdout.indexOf("mathlib");
      expect(acmeIndex).toBeLessThan(mathlibIndex);
    });
  });

  describe("lrn sync", () => {
    it.todo("downloads packages from registry");
    it.todo("saves packages to local cache directory");
    it.todo("shows progress during sync");
    it.todo("skips packages already cached at correct version");
    it.todo("updates packages when newer version matches semver range");
    it.todo("handles packages with remote URL specification");
    it.todo("fails gracefully when registry is unreachable");
    it.todo("fails gracefully when package not found in registry");
  });
});
