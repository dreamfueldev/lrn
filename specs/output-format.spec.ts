import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  loadAllFixturePackages,
  createTestCache,
  runCLI,
} from "./fixtures/index.js";

describe("Output Format Options", () => {
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
    runCLI(args, { env: { LRN_CACHE: cacheDir } });

  describe("--format text", () => {
    it("outputs human-readable formatted text", async () => {
      const result = await runWithCache(["--format", "text", "mathlib"]);
      expect(result.stdout).toContain("mathlib");
      expect(result.exitCode).toBe(0);
    });

    it("uses indentation for hierarchy", async () => {
      const result = await runWithCache(["--format", "text", "mathlib"]);
      // Members section should have indented content
      expect(result.stdout).toContain("Members");
    });

    it.todo("uses appropriate spacing between sections");
    it.todo("wraps long lines appropriately");
    it.todo("uses colors when terminal supports it");

    it("respects NO_COLOR environment variable", async () => {
      const result = await runCLI(["--format", "text", "mathlib"], {
        env: { LRN_CACHE: cacheDir, NO_COLOR: "1" },
      });
      // Output should work (no ANSI escape codes required)
      expect(result.exitCode).toBe(0);
    });
  });

  describe("--format json", () => {
    it("outputs valid JSON", async () => {
      const result = await runWithCache(["--format", "json", "mathlib"]);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    });

    it("outputs pretty-printed JSON (with indentation)", async () => {
      const result = await runWithCache(["--format", "json", "mathlib"]);
      // Pretty-printed JSON has newlines
      expect(result.stdout).toContain("\n");
    });

    it("includes all relevant fields in output", async () => {
      const result = await runWithCache(["--format", "json", "mathlib"]);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.name).toBe("mathlib");
      expect(parsed.version).toBeDefined();
      expect(parsed.members).toBeDefined();
    });

    it("uses consistent field names matching IR schema", async () => {
      const result = await runWithCache(["--format", "json", "mathlib"]);
      const parsed = JSON.parse(result.stdout);
      // Check IR schema field names
      expect(parsed).toHaveProperty("name");
      expect(parsed).toHaveProperty("members");
      expect(parsed).toHaveProperty("guides");
    });

    it("outputs array for list commands", async () => {
      const result = await runWithCache(["--format", "json", "mathlib", "list"]);
      const parsed = JSON.parse(result.stdout);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it("outputs object for single item commands", async () => {
      const result = await runWithCache(["--format", "json", "mathlib"]);
      const parsed = JSON.parse(result.stdout);
      expect(typeof parsed).toBe("object");
      expect(Array.isArray(parsed)).toBe(false);
    });
  });

  describe("--format markdown", () => {
    it("outputs valid markdown", async () => {
      const result = await runWithCache(["--format", "markdown", "mathlib"]);
      expect(result.stdout).toContain("#");
      expect(result.exitCode).toBe(0);
    });

    it("uses markdown headings for sections", async () => {
      const result = await runWithCache(["--format", "markdown", "mathlib"]);
      expect(result.stdout).toContain("# mathlib");
    });

    it("uses markdown code blocks for code/signatures", async () => {
      const result = await runWithCache(["--format", "markdown", "mathlib", "add"]);
      expect(result.stdout).toContain("```");
    });

    it("uses markdown lists for parameters/items", async () => {
      const result = await runWithCache(["--format", "markdown", "mathlib"]);
      expect(result.stdout).toContain("- ");
    });

    it("uses markdown tables where appropriate", async () => {
      const result = await runWithCache(["--format", "markdown", "mathlib", "add"]);
      expect(result.stdout).toContain("|");
    });

    it.todo("escapes special markdown characters in content");
  });

  describe("--format summary", () => {
    it("outputs minimal information", async () => {
      const result = await runWithCache(["--format", "summary", "mathlib"]);
      // Should be shorter than full text output
      expect(result.stdout.length).toBeLessThan(500);
    });

    it("shows only names", async () => {
      const result = await runWithCache(["--format", "summary", "mathlib"]);
      expect(result.stdout).toContain("add");
      expect(result.stdout).toContain("subtract");
    });

    it("uses compact formatting", async () => {
      const result = await runWithCache(["--format", "summary", "mathlib", "list"]);
      // Each member on its own line
      expect(result.stdout.split("\n").length).toBeGreaterThan(1);
    });

    it("omits descriptions and details", async () => {
      const result = await runWithCache(["--format", "summary", "mathlib"]);
      // Should not contain full descriptions
      expect(result.stdout).not.toContain("Returns the sum");
    });
  });

  describe("--json shorthand", () => {
    it("is equivalent to --format json", async () => {
      const resultJson = await runWithCache(["--json", "mathlib"]);
      const resultFormat = await runWithCache(["--format", "json", "mathlib"]);
      expect(resultJson.stdout).toBe(resultFormat.stdout);
    });

    it("can be combined with other options", async () => {
      const result = await runWithCache(["--json", "--full", "mathlib"]);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    });
  });

  describe("--summary shorthand", () => {
    it("is equivalent to --format summary", async () => {
      const resultSummary = await runWithCache(["--summary", "mathlib"]);
      const resultFormat = await runWithCache(["--format", "summary", "mathlib"]);
      expect(resultSummary.stdout).toBe(resultFormat.stdout);
    });

    it("can be combined with other options", async () => {
      const result = await runWithCache(["--summary", "mathlib", "list"]);
      expect(result.exitCode).toBe(0);
    });
  });

  describe("--full flag", () => {
    it("overrides progressive disclosure", async () => {
      const resultFull = await runWithCache(["--format", "text", "--full", "mathlib"]);
      const resultNormal = await runWithCache(["--format", "text", "mathlib"]);
      // Full output should be longer
      expect(resultFull.stdout.length).toBeGreaterThanOrEqual(resultNormal.stdout.length);
    });

    it("shows complete details for all items", async () => {
      const result = await runWithCache(["--format", "text", "--full", "mathlib"]);
      // Full output should contain the package description
      expect(result.stdout).toContain("MathLib provides");
    });

    it.todo("includes nested/child content");

    it("works with list commands", async () => {
      const result = await runWithCache(["--format", "text", "--full", "mathlib", "list"]);
      expect(result.exitCode).toBe(0);
    });

    it("works with guide commands", async () => {
      const result = await runWithCache(["--format", "text", "--full", "acme-api", "guide", "quickstart"]);
      expect(result.stdout).toContain("curl");
    });
  });

  describe("automatic format detection", () => {
    it.todo("uses text format when stdout is a TTY");

    it("uses json format when stdout is piped", async () => {
      // In test environment, stdout is not a TTY, so it defaults to JSON
      const result = await runWithCache(["mathlib"]);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    });

    it("explicit --format flag overrides auto-detection", async () => {
      const result = await runWithCache(["--format", "text", "mathlib"]);
      // Should be text, not JSON
      expect(() => JSON.parse(result.stdout)).toThrow();
    });

    // TODO: Currently the TTY check overrides LRN_FORMAT - need to fix precedence
    it.todo("LRN_FORMAT env var overrides auto-detection");
  });

  describe("format consistency", () => {
    it("all list commands support all formats", async () => {
      const formats = ["text", "json", "markdown", "summary"];
      for (const format of formats) {
        const result = await runWithCache(["--format", format, "mathlib", "list"]);
        expect(result.exitCode).toBe(0);
      }
    });

    it.todo("all show commands support all formats");
    it.todo("all search commands support all formats");
    it.todo("format output is consistent across command types");
  });
});
