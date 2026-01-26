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

    it.todo("shows message when no packages are cached");

    it("sorts packages alphabetically by name", async () => {
      const result = await runWithCache([]);
      // acme-api should come before mathlib
      const acmeIndex = result.stdout.indexOf("acme-api");
      const mathlibIndex = result.stdout.indexOf("mathlib");
      expect(acmeIndex).toBeLessThan(mathlibIndex);
    });
  });

  describe("lrn sync", () => {
    it.todo("reads package specifications from lrn.config.json");
    it.todo("reads package specifications from package.json dependencies");
    it.todo("downloads packages from registry");
    it.todo("saves packages to local cache directory");
    it.todo("shows progress during sync");
    it.todo("shows summary of synced packages on completion");
    it.todo("skips packages already cached at correct version");
    it.todo("updates packages when newer version matches semver range");
    it.todo("handles packages with local path specification");
    it.todo("handles packages with remote URL specification");
    it.todo("fails gracefully when registry is unreachable");
    it.todo("fails gracefully when package not found in registry");
  });

  describe("lrn add <package>", () => {
    it.todo("adds package to local cache");
    it.todo("adds package to lrn.config.json");
    it.todo("uses latest version when no version specified");
    it.todo("shows confirmation message on success");
    it.todo("creates lrn.config.json if it does not exist");
    it.todo("fails gracefully when package not found in registry");

    describe("with version specifier", () => {
      it.todo("adds exact version with @1.0.0 syntax");
      it.todo("adds semver range with @^1.0.0 syntax");
      it.todo("adds tilde range with @~1.0.0 syntax");
      it.todo("fails gracefully when version not found");
    });
  });

  describe("lrn remove <package>", () => {
    it.todo("removes package from local cache");
    it.todo("removes package from lrn.config.json");
    it.todo("shows confirmation message on success");
    it.todo("fails gracefully when package not in cache");
    it.todo("does not modify lrn.config.json if package not listed");
  });

  describe("lrn versions <package>", () => {
    it.todo("lists all available versions from registry");
    it.todo("shows versions in descending order (newest first)");
    it.todo("indicates which version is latest");
    it.todo("indicates which version is currently cached");
    it.todo("fails gracefully when package not found in registry");
    it.todo("fails gracefully when registry is unreachable");
  });
});
