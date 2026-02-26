import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  loadAllFixturePackages,
  createTestCache,
  runCLI,
} from "./fixtures/index.js";

describe("Version Selection", () => {
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

  describe("<package>@<version> syntax", () => {
    it("parses package name and version from @ syntax", async () => {
      const result = await runWithCache(["mathlib@2.1.0"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("mathlib");
    });

    it("supports package names with scopes (@org/package@1.0.0)", async () => {
      const packages = [
        {
          name: "@myorg/utils",
          version: "1.0.0",
          source: { type: "custom" as const },
          members: [
            { name: "helper", kind: "function" as const, summary: "A helper" },
          ],
          guides: [],
          schemas: {},
        },
      ];
      const cache = createTestCache(packages);
      try {
        const result = await runCLI(["--format", "text", "@myorg/utils@1.0.0"], {
          env: { LRN_CACHE: cache.cacheDir },
        });
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("@myorg/utils");
      } finally {
        cache.cleanup();
      }
    });

    it.todo("treats text after @ as version specifier");
  });

  describe("exact version", () => {
    it.todo("uses exact version with @1.0.0 syntax");
    it.todo("uses exact version with @2024.1.0 syntax (calver)");
    it.todo("fails when exact version not available");
  });

  describe("semver ranges", () => {
    it.todo("resolves ^1.0.0 to latest compatible version");
    it.todo("resolves ~1.0.0 to latest patch version");
    it.todo("resolves >=1.0.0 to latest matching version");
    it.todo("resolves 1.x to latest 1.x version");
    it.todo("resolves * to latest version");
    it.todo("fails when no version matches range");
  });

  describe("version resolution from config", () => {
    it.todo("uses version from lrn.config.json when no @ specified");
    it.todo("command-line @ version overrides config version");
    it.todo("uses latest when not in config and no @ specified");
  });

  describe("cached versions", () => {
    it.todo("uses cached version if it satisfies specifier");
    it.todo("downloads new version if cached version does not satisfy");
    it.todo("shows which version is being used");
  });

  describe("version display", () => {
    it("shows version in package overview output", async () => {
      const result = await runWithCache(["mathlib"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("2.1.0");
    });

    it.todo("shows version in list output header");

    it("shows version in JSON output", async () => {
      const result = await runCLI(["--format", "json", "mathlib"], {
        env: { LRN_CACHE: cacheDir },
      });
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.version).toBe("2.1.0");
    });
  });
});
