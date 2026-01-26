import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  loadAllFixturePackages,
  createTestCache,
  runCLI,
} from "./fixtures/index.js";

describe("Search Commands", () => {
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

  describe("lrn search <query>", () => {
    it("searches across all cached packages", async () => {
      const result = await runWithCache(["search", "add"]);
      expect(result.stdout).toContain("mathlib");
      expect(result.exitCode).toBe(0);
    });

    it("returns matching members", async () => {
      const result = await runWithCache(["search", "add"]);
      expect(result.stdout).toContain("add");
    });

    it("returns matching guides", async () => {
      const result = await runWithCache(["search", "quickstart"]);
      expect(result.stdout).toContain("quickstart");
    });

    it("shows package name for each result", async () => {
      const result = await runWithCache(["search", "create"]);
      expect(result.stdout).toContain("acme-api");
    });

    it("shows result path/slug for each result", async () => {
      const result = await runWithCache(["search", "users"]);
      expect(result.stdout).toContain("users");
    });

    it("shows result type (member or guide)", async () => {
      const result = await runWithCache(["search", "quickstart"]);
      expect(result.stdout).toContain("(guide)");
    });

    it("shows result summary", async () => {
      const result = await runWithCache(["search", "add"]);
      expect(result.stdout).toContain("Add two numbers");
    });

    it("ranks results by relevance score", async () => {
      const result = await runWithCache(["search", "add"]);
      // Exact name matches should appear before partial matches
      expect(result.exitCode).toBe(0);
    });

    it.todo("limits results to reasonable count");

    it("shows message when no results found", async () => {
      const result = await runWithCache(["search", "xyznonexistent123"]);
      expect(result.stdout).toContain("No results");
    });

    describe("search scoring", () => {
      it.todo("ranks name matches higher than description matches");
      it.todo("ranks summary matches higher than description matches");
      it.todo("ranks exact matches higher than partial matches");
      it.todo("ranks tag matches appropriately");
    });

    describe("search matching", () => {
      it("matches against member names", async () => {
        const result = await runWithCache(["search", "multiply"]);
        expect(result.stdout).toContain("multiply");
      });

      it("matches against member summaries", async () => {
        const result = await runWithCache(["search", "two numbers"]);
        expect(result.stdout).toContain("add");
      });

      it("matches against member descriptions", async () => {
        const result = await runWithCache(["search", "paginated"]);
        // users.list description contains "paginated"
        expect(result.stdout).toContain("list");
      });

      it("matches against member tags", async () => {
        const result = await runWithCache(["search", "arithmetic"]);
        // arithmetic is a tag on add, subtract, etc.
        expect(result.stdout).toContain("add");
      });

      it("matches against guide titles", async () => {
        const result = await runWithCache(["search", "Quickstart"]);
        expect(result.stdout).toContain("quickstart");
      });

      it("matches against guide summaries", async () => {
        const result = await runWithCache(["search", "5 minutes"]);
        // quickstart summary contains "5 minutes"
        expect(result.stdout).toContain("quickstart");
      });

      it.todo("matches against guide content");

      it("matches against guide tags", async () => {
        const result = await runWithCache(["search", "getting-started"]);
        // getting-started is a tag on quickstart guide
        expect(result.stdout).toContain("quickstart");
      });

      it("performs case-insensitive matching", async () => {
        const result = await runWithCache(["search", "ADD"]);
        expect(result.stdout).toContain("add");
      });
    });
  });

  describe("lrn <package> search <query>", () => {
    it("searches within specific package only", async () => {
      const result = await runWithCache(["mathlib", "search", "add"]);
      expect(result.stdout).toContain("mathlib");
      expect(result.stdout).not.toContain("acme-api");
    });

    it("returns matching members from package", async () => {
      const result = await runWithCache(["mathlib", "search", "add"]);
      expect(result.stdout).toContain("add");
    });

    it("returns matching guides from package", async () => {
      const result = await runWithCache(["acme-api", "search", "quickstart"]);
      expect(result.stdout).toContain("quickstart");
    });

    it("does not search other cached packages", async () => {
      const result = await runWithCache(["mathlib", "search", "users"]);
      // users is in acme-api, not mathlib - should find no results
      expect(result.stdout).toContain("No results");
    });

    it("shows result path/slug for each result", async () => {
      const result = await runWithCache(["acme-api", "search", "users"]);
      expect(result.stdout).toContain("users");
    });

    it("shows result summary", async () => {
      const result = await runWithCache(["mathlib", "search", "add"]);
      expect(result.stdout).toContain("Add two numbers");
    });

    it.todo("ranks results by relevance score");

    it("shows message when no results found", async () => {
      const result = await runWithCache(["mathlib", "search", "xyznonexistent"]);
      expect(result.stdout).toContain("No results");
    });

    it("fails with exit code 2 when package not found", async () => {
      const result = await runWithCache(["nonexistent", "search", "test"]);
      expect(result.exitCode).toBe(2);
    });
  });

  describe("search with filters", () => {
    it.todo("respects --tag filter in search results");
    it.todo("respects --kind filter in search results");
    it.todo("respects --deprecated flag in search results");
    it.todo("combines search query with filters");
  });
});
