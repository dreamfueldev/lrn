import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  loadAllFixturePackages,
  createTestCache,
  runCLI,
} from "./fixtures/index.js";

describe("Filtering Options", () => {
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

  describe("--tag <tag>", () => {
    it("filters members to those with specified tag", async () => {
      const result = await runWithCache(["mathlib", "list", "--tag", "arithmetic"]);
      expect(result.stdout).toContain("add");
      expect(result.stdout).toContain("subtract");
      expect(result.exitCode).toBe(0);
    });

    it.todo("filters guides to those with specified tag");
    it.todo("performs case-insensitive tag matching");

    it("returns empty list when no items match tag", async () => {
      const result = await runWithCache(["mathlib", "list", "--tag", "nonexistenttag"]);
      expect(result.exitCode).toBe(0);
      // Should show empty or minimal output
    });

    describe("multiple tags", () => {
      it("supports --tag <tag1> --tag <tag2> syntax", async () => {
        const result = await runWithCache(["mathlib", "list", "--tag", "arithmetic", "--tag", "advanced"]);
        expect(result.exitCode).toBe(0);
      });

      it.todo("returns items matching ANY of the specified tags (OR logic)");
      it.todo("can be combined with other filters");
    });
  });

  describe("--kind <kind>", () => {
    it("filters members by kind: function", async () => {
      const result = await runWithCache(["mathlib", "list", "--kind", "function"]);
      expect(result.stdout).toContain("add");
      expect(result.exitCode).toBe(0);
    });

    it.todo("filters members by kind: method");

    it("filters members by kind: class", async () => {
      const result = await runWithCache(["mathlib", "list", "--kind", "class"]);
      expect(result.stdout).toContain("Calculator");
      // Should not contain functions
      expect(result.stdout).not.toContain("[function]");
    });

    it("filters members by kind: namespace", async () => {
      const result = await runWithCache(["acme-api", "list", "--kind", "namespace"]);
      expect(result.stdout).toContain("users");
    });

    it.todo("filters members by kind: constant");
    it.todo("filters members by kind: type");
    it.todo("filters members by kind: property");
    it.todo("returns error for invalid kind value");

    it("returns empty list when no items match kind", async () => {
      const result = await runWithCache(["mathlib", "list", "--kind", "namespace"]);
      // mathlib has no namespaces
      expect(result.exitCode).toBe(0);
    });

    it.todo("only applies to member lists, not guides");
  });

  describe("--deprecated", () => {
    it("shows deprecated members when flag is present", async () => {
      const result = await runWithCache(["mathlib", "list", "--deprecated"]);
      expect(result.stdout).toContain("oldSum");
    });

    it.todo("excludes deprecated members by default (without flag)");
    it.todo("shows deprecation notice for deprecated items");
    it.todo("can filter to ONLY deprecated with --deprecated --kind");
  });

  describe("filter combinations", () => {
    it.todo("combines --tag and --kind with AND logic");
    it.todo("combines --tag and --deprecated appropriately");
    it.todo("combines --kind and --deprecated appropriately");
    it.todo("combines all three filters correctly");
  });

  describe("filter application", () => {
    it("filters apply to lrn <package> list", async () => {
      const result = await runWithCache(["mathlib", "list", "--kind", "function"]);
      expect(result.exitCode).toBe(0);
    });

    it.todo("filters apply to lrn <package> list --deep");
    it.todo("filters apply to lrn <package> guides (tag only)");
    it.todo("filters apply to lrn search results");
    it.todo("filters apply to lrn <package> search results");
    it.todo("filters do not apply to single item show commands");
  });
});
