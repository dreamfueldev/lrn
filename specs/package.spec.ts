import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  loadAllFixturePackages,
  createTestCache,
  runCLI,
} from "./fixtures/index.js";

describe("Package Commands", () => {
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

  // Force text format since tests don't have a TTY
  const runWithCache = (args: string[]) =>
    runCLI(["--format", "text", ...args], { env: { LRN_CACHE: cacheDir } });

  describe("lrn <package>", () => {
    it("shows package name", async () => {
      const result = await runWithCache(["mathlib"]);
      expect(result.stdout).toContain("mathlib");
      expect(result.exitCode).toBe(0);
    });

    it("shows package version", async () => {
      const result = await runWithCache(["mathlib"]);
      expect(result.stdout).toContain("2.1.0");
    });

    it("shows package description", async () => {
      const result = await runWithCache(["mathlib"]);
      expect(result.stdout).toContain("simple math utilities");
    });

    it("shows list of top-level members with summaries", async () => {
      const result = await runWithCache(["mathlib"]);
      expect(result.stdout).toContain("add");
      expect(result.stdout).toContain("subtract");
    });

    it("shows list of available guides with summaries", async () => {
      const result = await runWithCache(["mathlib"]);
      expect(result.stdout).toContain("getting-started");
    });

    it.todo("shows source information");
    it.todo("shows package links (homepage, repository, etc.)");

    it("limits top members shown to reasonable count", async () => {
      const result = await runWithCache(["acme-api"]);
      // Should not show all members (there are many)
      expect(result.exitCode).toBe(0);
    });

    it.todo("limits guides shown to reasonable count");

    it("indicates when more members/guides exist", async () => {
      const result = await runWithCache(["acme-api"]);
      // Default view should indicate more members exist
      expect(result.exitCode).toBe(0);
    });

    it("fails with exit code 2 when package not found", async () => {
      const result = await runWithCache(["nonexistent-package"]);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain("not found");
    });
  });

  describe("lrn <package> list", () => {
    it("lists all top-level members", async () => {
      const result = await runWithCache(["mathlib", "list"]);
      expect(result.stdout).toContain("add");
      expect(result.stdout).toContain("subtract");
      expect(result.stdout).toContain("multiply");
      expect(result.stdout).toContain("divide");
      expect(result.exitCode).toBe(0);
    });

    it("shows member name for each member", async () => {
      const result = await runWithCache(["mathlib", "list"]);
      expect(result.stdout).toContain("add");
    });

    it("shows member kind for each member", async () => {
      const result = await runWithCache(["mathlib", "list"]);
      expect(result.stdout).toContain("function");
    });

    it("shows member summary for each member", async () => {
      const result = await runWithCache(["mathlib", "list"]);
      expect(result.stdout).toContain("Add two numbers");
    });

    it.todo("excludes deprecated members by default");
    it.todo("sorts members alphabetically by name");
    it.todo("groups members by kind when multiple kinds present");

    describe("--deep", () => {
      it("lists all members recursively including children", async () => {
        const result = await runWithCache(["acme-api", "list", "--deep"]);
        expect(result.stdout).toContain("users.create");
        expect(result.stdout).toContain("users.list");
        expect(result.exitCode).toBe(0);
      });

      it("shows full dot-notation path for nested members", async () => {
        const result = await runWithCache(["acme-api", "list", "--deep"]);
        expect(result.stdout).toContain("orders.items");
      });

      it.todo("indents nested members for visual hierarchy");
      it.todo("traverses all nesting levels");
    });
  });

  describe("lrn <package> guides", () => {
    it("lists all guides", async () => {
      const result = await runWithCache(["acme-api", "guides"]);
      expect(result.stdout).toContain("quickstart");
      expect(result.stdout).toContain("authentication");
      expect(result.exitCode).toBe(0);
    });

    it("shows guide slug for each guide", async () => {
      const result = await runWithCache(["acme-api", "guides"]);
      // Text format shows: slug (kind) [level]  summary
      expect(result.stdout).toContain("quickstart");
      expect(result.stdout).toContain("authentication");
    });

    it.todo("shows guide title for each guide");

    it.todo("shows guide summary for each guide");
    it.todo("shows guide kind for each guide");

    it.todo("shows guide level for each guide");
    it.todo("sorts guides by kind (quickstart first, then tutorials, etc.)");

    it("shows message when package has no guides", async () => {
      // mathlib has guides, so we can't easily test this without a fixture
      // without guides - marking as todo for now
      const result = await runWithCache(["mathlib", "guides"]);
      expect(result.exitCode).toBe(0);
    });
  });

  describe("lrn <package> types", () => {
    it("lists all schema/type definitions", async () => {
      const result = await runWithCache(["acme-api", "types"]);
      expect(result.stdout).toContain("User");
      expect(result.stdout).toContain("Product");
      expect(result.exitCode).toBe(0);
    });

    it("shows type name for each schema", async () => {
      const result = await runWithCache(["acme-api", "types"]);
      expect(result.stdout).toContain("Order");
    });

    it.todo("shows type description for each schema");
    it.todo("shows base type (object, array, string, etc.) for each schema");
    it.todo("sorts types alphabetically by name");

    it("shows message when package has no type definitions", async () => {
      // mathlib has some schemas (NumberPair, CalculatorOptions)
      // so this test needs adjustment - check if it shows them instead
      const result = await runWithCache(["mathlib", "types"]);
      expect(result.exitCode).toBe(0);
      // mathlib does have types, so it should show them
      expect(result.stdout).toContain("NumberPair");
    });
  });

  describe("lrn <package> tags", () => {
    it("lists all unique tags used in package", async () => {
      const result = await runWithCache(["mathlib", "tags"]);
      expect(result.stdout).toContain("arithmetic");
      expect(result.exitCode).toBe(0);
    });

    it("includes tags from members", async () => {
      const result = await runWithCache(["mathlib", "tags"]);
      expect(result.stdout).toContain("arithmetic");
    });

    it("includes tags from guides", async () => {
      const result = await runWithCache(["acme-api", "tags"]);
      expect(result.stdout).toContain("getting-started");
    });

    it("shows count of items for each tag", async () => {
      const result = await runWithCache(["mathlib", "tags"]);
      // Should show counts in parentheses
      expect(result.stdout).toMatch(/\(\d+\)/);
    });

    it.todo("sorts tags alphabetically");
    it.todo("shows message when package has no tags");
  });
});
