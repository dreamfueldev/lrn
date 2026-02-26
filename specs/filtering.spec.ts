import { describe, it, expect, beforeAll, afterAll } from "bun:test";
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

    it("filters guides to those with specified tag", async () => {
      const result = await runWithCache(["acme-api", "guides", "--tag", "auth"]);
      expect(result.stdout).toContain("authentication");
      expect(result.stdout).not.toContain("quickstart");
      expect(result.stdout).not.toContain("webhooks");
      expect(result.exitCode).toBe(0);
    });

    it("performs case-insensitive tag matching", async () => {
      const result = await runWithCache(["mathlib", "list", "--tag", "Arithmetic"]);
      expect(result.stdout).toContain("add");
      expect(result.stdout).toContain("subtract");
      expect(result.exitCode).toBe(0);
    });

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

      it("returns items matching ANY of the specified tags (OR logic)", async () => {
        const result = await runWithCache(["mathlib", "list", "--tag", "arithmetic", "--tag", "algebra"]);
        expect(result.exitCode).toBe(0);
        // arithmetic: add, subtract, multiply, divide, oldSum
        expect(result.stdout).toContain("add");
        // algebra: sqrt, pow, Vector
        expect(result.stdout).toContain("sqrt");
      });

      it("can be combined with other filters", async () => {
        const result = await runWithCache(["mathlib", "list", "--tag", "arithmetic", "--kind", "function"]);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("add");
        // Calculator is a class, should not appear with --kind function
        expect(result.stdout).not.toContain("Calculator [class]");
      });
    });
  });

  describe("--kind <kind>", () => {
    it("filters members by kind: function", async () => {
      const result = await runWithCache(["mathlib", "list", "--kind", "function"]);
      expect(result.stdout).toContain("add");
      expect(result.exitCode).toBe(0);
    });

    it("filters members by kind: method", async () => {
      const result = await runWithCache(["acme-api", "list", "--kind", "method"]);
      expect(result.stdout).toContain("list [method]");
      expect(result.stdout).toContain("create [method]");
      // Should not contain other kinds
      expect(result.stdout).not.toContain("[namespace]");
    });

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

    it("filters members by kind: type", async () => {
      const result = await runWithCache(["mathlib", "list", "--kind", "type"]);
      expect(result.stdout).toContain("NumberPair");
      expect(result.stdout).toContain("CalculatorOptions");
      expect(result.stdout).toContain("[type]");
      // Should not contain other kinds
      expect(result.stdout).not.toContain("[function]");
    });

    it("filters members by kind: property", async () => {
      // Properties are nested in classes, need --deep to find them
      const result = await runWithCache(["mathlib", "list", "--kind", "property", "--deep"]);
      expect(result.stdout).toContain("value");
      expect(result.stdout).toContain("[property]");
    });

    it("filters members by kind: component", async () => {
      const result = await runWithCache(["uikit", "list", "--kind", "component"]);
      expect(result.stdout).toContain("Button");
      expect(result.stdout).toContain("Card");
      expect(result.stdout).toContain("[component]");
      expect(result.exitCode).toBe(0);
    });

    it("filters members by kind: command", async () => {
      const result = await runWithCache(["mycli", "list", "--kind", "command"]);
      expect(result.stdout).toContain("run");
      expect(result.stdout).toContain("build");
      expect(result.stdout).toContain("[command]");
      expect(result.exitCode).toBe(0);
    });

    it("filters members by kind: resource", async () => {
      const result = await runWithCache(["infra-aws", "list", "--kind", "resource"]);
      expect(result.stdout).toContain("aws_lambda_function");
      expect(result.stdout).toContain("aws_s3_bucket");
      expect(result.stdout).toContain("[resource]");
      expect(result.exitCode).toBe(0);
    });

    it("filters members by kind: constant", async () => {
      const result = await runWithCache(["mathlib", "list", "--kind", "constant"]);
      expect(result.stdout).toContain("PI");
      expect(result.stdout).toContain("[constant]");
      expect(result.exitCode).toBe(0);
    });
    it("returns empty list for unrecognized kind value", async () => {
      const result = await runWithCache(["mathlib", "list", "--kind", "bogus"]);
      expect(result.exitCode).toBe(0);
    });

    it("returns empty list when no items match kind", async () => {
      const result = await runWithCache(["mathlib", "list", "--kind", "namespace"]);
      // mathlib has no namespaces
      expect(result.exitCode).toBe(0);
    });

    it("only applies to member lists, not guides", async () => {
      const result = await runWithCache(["acme-api", "guides", "--kind", "method"]);
      expect(result.exitCode).toBe(0);
      // Guides should still appear despite --kind filter
      expect(result.stdout).toContain("quickstart");
    });
  });

  describe("--deprecated", () => {
    it("shows deprecated members when flag is present", async () => {
      const result = await runWithCache(["mathlib", "list", "--deprecated"]);
      expect(result.stdout).toContain("oldSum");
    });

    it("excludes deprecated members by default (without flag)", async () => {
      const result = await runWithCache(["mathlib", "list"]);
      expect(result.stdout).not.toContain("oldSum");
      expect(result.stdout).toContain("add");
      expect(result.exitCode).toBe(0);
    });

    it("shows deprecation notice for deprecated items", async () => {
      const result = await runWithCache(["mathlib", "list", "--deprecated"]);
      expect(result.stdout).toContain("(deprecated)");
    });

    it("filters to only deprecated functions with --deprecated --kind", async () => {
      const result = await runWithCache(["mathlib", "list", "--kind", "function", "--deprecated"]);
      expect(result.stdout).toContain("oldSum");
      expect(result.stdout).not.toContain("Calculator");
    });
  });

  describe("filter combinations", () => {
    it("combines --tag and --kind with AND logic", async () => {
      const result = await runWithCache(["acme-api", "list", "--tag", "users", "--kind", "method"]);
      expect(result.stdout).toContain("list [method]");
      expect(result.stdout).toContain("create [method]");
      // Should not contain namespaces
      expect(result.stdout).not.toContain("[namespace]");
    });

    it("combines --tag and --deprecated appropriately", async () => {
      const result = await runWithCache(["mathlib", "list", "--tag", "arithmetic", "--deprecated"]);
      expect(result.stdout).toContain("oldSum");
    });

    it("combines --kind and --deprecated appropriately", async () => {
      const result = await runWithCache(["mathlib", "list", "--kind", "function", "--deprecated"]);
      expect(result.stdout).toContain("oldSum");
      expect(result.stdout).not.toContain("[class]");
    });

    it("combines all three filters correctly", async () => {
      const result = await runWithCache(["mathlib", "list", "--kind", "function", "--tag", "arithmetic", "--deprecated"]);
      expect(result.stdout).toContain("oldSum");
    });
  });

  describe("filter application", () => {
    it("filters apply to lrn <package> list", async () => {
      const result = await runWithCache(["mathlib", "list", "--kind", "function"]);
      expect(result.exitCode).toBe(0);
    });

    it("filters apply to lrn <package> list --deep", async () => {
      const result = await runWithCache(["acme-api", "list", "--deep", "--tag", "users"]);
      expect(result.stdout).toContain("users.create");
      // Should only show user-tagged items
      expect(result.exitCode).toBe(0);
    });

    it("filters apply to lrn <package> guides (tag only)", async () => {
      const result = await runWithCache(["acme-api", "guides", "--tag", "security"]);
      expect(result.stdout).toContain("authentication");
      expect(result.stdout).not.toContain("webhooks");
      expect(result.exitCode).toBe(0);
    });

    it("filters apply to lrn search results", async () => {
      const result = await runWithCache(["search", "add", "--tag", "arithmetic"]);
      expect(result.stdout).toContain("add");
      expect(result.exitCode).toBe(0);
    });

    it("filters apply to lrn <package> search results", async () => {
      const result = await runWithCache(["mathlib", "search", "add", "--tag", "arithmetic"]);
      expect(result.stdout).toContain("add");
      expect(result.exitCode).toBe(0);
    });
    it("filters do not apply to single item show commands", async () => {
      const result = await runWithCache(["mathlib", "add", "--kind", "class"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("add");
    });
  });
});
