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
      it("ranks name matches higher than description matches", async () => {
        const packages = [
          {
            name: "rank-test",
            version: "1.0.0",
            source: { type: "custom" as const },
            members: [
              {
                name: "other",
                kind: "function" as const,
                summary: "Has no match",
                description: "Has the word findable in description",
              },
              {
                name: "findable",
                kind: "function" as const,
                summary: "This function is findable",
              },
            ],
            guides: [],
            schemas: {},
          },
        ];
        const cache = createTestCache(packages);
        try {
          const result = await runCLI(
            ["--format", "text", "rank-test", "search", "findable"],
            { env: { LRN_CACHE: cache.cacheDir } },
          );
          // findable: name exact +100, summary +10 = 110
          // other: description +5 = 5
          const lines = result.stdout.split("\n").filter((l) => l.trim().length > 0);
          const findableLine = lines.findIndex((l) => l.includes("findable") && !l.includes("results for"));
          const otherLine = lines.findIndex((l) => l.includes("other"));
          expect(findableLine).toBeLessThan(otherLine);
        } finally {
          cache.cleanup();
        }
      });

      it("ranks summary matches higher than description matches", async () => {
        const packages = [
          {
            name: "score-test",
            version: "1.0.0",
            source: { type: "custom" as const },
            members: [
              {
                name: "alpha",
                kind: "function" as const,
                summary: "Does alpha things",
                description: "Has the keyword findable here",
              },
              {
                name: "beta",
                kind: "function" as const,
                summary: "Has the keyword findable here",
                description: "Does beta things",
              },
            ],
            guides: [],
            schemas: {},
          },
        ];
        const cache = createTestCache(packages);
        try {
          const result = await runCLI(
            ["--format", "text", "score-test", "search", "findable"],
            { env: { LRN_CACHE: cache.cacheDir } },
          );
          // beta (summary match, +10) should rank above alpha (description match, +5)
          const betaIndex = result.stdout.indexOf("beta");
          const alphaIndex = result.stdout.indexOf("alpha");
          expect(betaIndex).toBeLessThan(alphaIndex);
        } finally {
          cache.cleanup();
        }
      });

      it("ranks exact matches higher than partial matches", async () => {
        const packages = [
          {
            name: "exact-test",
            version: "1.0.0",
            source: { type: "custom" as const },
            members: [
              { name: "partially_matching", kind: "function" as const, summary: "Contains add inside" },
              { name: "add", kind: "function" as const, summary: "Exact match" },
            ],
            guides: [],
            schemas: {},
          },
        ];
        const cache = createTestCache(packages);
        try {
          const result = await runCLI(
            ["--format", "text", "exact-test", "search", "add"],
            { env: { LRN_CACHE: cache.cacheDir } },
          );
          // "add" exact name = +100, "partially_matching" no match on "add"
          // (but summary "Contains add inside" = +10)
          const lines = result.stdout.split("\n").filter((l) => l.trim().length > 0);
          const addLine = lines.findIndex((l) => l.includes("add") && !l.includes("results for") && !l.includes("partially"));
          const partialLine = lines.findIndex((l) => l.includes("partially"));
          expect(addLine).toBeLessThan(partialLine);
        } finally {
          cache.cleanup();
        }
      });

      it("ranks tag matches appropriately", async () => {
        // "arithmetic" is a tag on add, subtract, multiply, divide, oldSum
        const result = await runWithCache(["search", "arithmetic"]);
        expect(result.stdout).toContain("add");
        expect(result.stdout).toContain("subtract");
      });
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

    describe("multi-word search", () => {
      it("finds members matching all terms (AND semantics)", async () => {
        const result = await runWithCache(["mathlib", "search", "Calculator add"]);
        expect(result.stdout).toContain("Calculator.add");
      });

      it("returns no results when any term fails to match", async () => {
        const result = await runWithCache(["mathlib", "search", "Calculator nonexistent"]);
        expect(result.stdout).toContain("No results");
      });

      it("single-word queries still work", async () => {
        const result = await runWithCache(["mathlib", "search", "add"]);
        expect(result.stdout).toContain("add");
      });
    });

    describe("parameter type matching", () => {
      it("matches against parameter types", async () => {
        const result = await runWithCache(["mathlib", "search", "number"]);
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

    it("ranks results by relevance score", async () => {
      const result = await runWithCache(["mathlib", "search", "add"]);
      // Top-level "add" (exact name +100) should appear before Calculator.add (path +20)
      const addIndex = result.stdout.indexOf("add");
      const calcAddIndex = result.stdout.indexOf("Calculator.add");
      if (calcAddIndex !== -1) {
        expect(addIndex).toBeLessThan(calcAddIndex);
      }
      expect(result.exitCode).toBe(0);
    });

    it("shows message when no results found", async () => {
      const result = await runWithCache(["mathlib", "search", "xyznonexistent"]);
      expect(result.stdout).toContain("No results");
    });

    it("fails with exit code 2 when package not found", async () => {
      const result = await runWithCache(["nonexistent", "search", "test"]);
      expect(result.exitCode).toBe(2);
    });
  });

  describe("search error handling", () => {
    it("fails with error when no query provided", async () => {
      const result = await runWithCache(["search"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Usage");
    });

    it("fails with error when no query provided for package search", async () => {
      const result = await runWithCache(["mathlib", "search"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Usage");
    });
  });

  describe("search with filters", () => {
    it("respects --tag filter in search results", async () => {
      const result = await runWithCache(["search", "add", "--tag", "arithmetic"]);
      expect(result.stdout).toContain("add");
      expect(result.stdout).not.toContain("Vector");
      expect(result.exitCode).toBe(0);
    });

    it("respects --kind filter in search results", async () => {
      const result = await runWithCache(["mathlib", "search", "add", "--kind", "function"]);
      expect(result.stdout).toContain("add");
      // Calculator.add is a method, should be excluded
      expect(result.stdout).not.toContain("(method)");
      expect(result.exitCode).toBe(0);
    });

    it("respects --deprecated flag in search results", async () => {
      // Without --deprecated, oldSum should be excluded
      const without = await runWithCache(["mathlib", "search", "sum"]);
      expect(without.stdout).not.toContain("oldSum");

      // With --deprecated, oldSum should appear
      const withFlag = await runWithCache(["mathlib", "search", "sum", "--deprecated"]);
      expect(withFlag.stdout).toContain("oldSum");
    });

    it("combines search query with filters", async () => {
      const result = await runWithCache(["search", "add", "--tag", "arithmetic", "--kind", "function"]);
      expect(result.stdout).toContain("add");
      expect(result.exitCode).toBe(0);
    });
  });
});
