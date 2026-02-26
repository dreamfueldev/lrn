import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  loadAllFixturePackages,
  createTestCache,
  runCLI,
} from "./fixtures/index.js";

describe("Member Commands", () => {
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

  describe("lrn <package> <member.path>", () => {
    it("shows member name", async () => {
      const result = await runWithCache(["mathlib", "add"]);
      expect(result.stdout).toContain("add");
      expect(result.exitCode).toBe(0);
    });

    it("shows member kind", async () => {
      const result = await runWithCache(["mathlib", "add"]);
      expect(result.stdout).toContain("function");
    });

    it("shows member summary", async () => {
      const result = await runWithCache(["mathlib", "add"]);
      expect(result.stdout).toContain("Add two numbers");
    });

    it("shows member description", async () => {
      const result = await runWithCache(["mathlib", "add"]);
      expect(result.stdout).toContain("sum of two numbers");
    });

    it("shows member signature", async () => {
      const result = await runWithCache(["mathlib", "add"]);
      expect(result.stdout).toContain("(a: number, b: number) => number");
    });

    it("shows member parameters with names", async () => {
      const result = await runWithCache(["mathlib", "add"]);
      expect(result.stdout).toContain("Parameters:");
      expect(result.stdout).toMatch(/\ba\b/);
      expect(result.stdout).toMatch(/\bb\b/);
    });

    it("shows member parameters with types", async () => {
      const result = await runWithCache(["mathlib", "add"]);
      expect(result.stdout).toContain("number");
    });

    it("shows member parameters with descriptions", async () => {
      const result = await runWithCache(["mathlib", "add"]);
      expect(result.stdout).toContain("first number");
    });

    it("shows member parameters with required indicator", async () => {
      const result = await runWithCache(["mathlib", "add"]);
      expect(result.stdout).toContain("required");
    });

    it("shows member parameters with default values", async () => {
      const result = await runWithCache(["mathlib", "Calculator"]);
      expect(result.stdout).toContain("initialValue");
      expect(result.stdout).toContain("= 0");
    });

    it("shows member return type", async () => {
      const result = await runWithCache(["mathlib", "add"]);
      expect(result.stdout).toContain("Returns:");
      expect(result.stdout).toContain("number");
    });

    it("shows member return description", async () => {
      const result = await runWithCache(["mathlib", "add"]);
      expect(result.stdout).toContain("sum of a and b");
    });

    it("shows member examples", async () => {
      const result = await runWithCache(["mathlib", "add"]);
      expect(result.stdout).toContain("Examples:");
      expect(result.stdout).toContain("add(2, 3)");
    });

    it("shows member tags", async () => {
      const result = await runWithCache(["mathlib", "add"]);
      expect(result.stdout).toContain("Tags:");
      expect(result.stdout).toContain("arithmetic");
    });

    it("shows deprecation notice when deprecated", async () => {
      const result = await runWithCache(["mathlib", "oldSum"]);
      expect(result.stdout).toContain("deprecated");
      expect(result.stdout).toContain("add");
    });

    it("shows since version when present in JSON output", async () => {
      const result = await runCLI(["--format", "json", "mathlib", "sqrt"], {
        env: { LRN_CACHE: cacheDir },
      });
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed.since).toBe("2.0.0");
    });

    it("shows related content (see references)", async () => {
      const result = await runWithCache(["mathlib", "CalculatorOptions"]);
      expect(result.stdout).toContain("See also:");
      expect(result.stdout).toContain("Calculator");
    });

    it("fails with exit code 3 when member not found", async () => {
      const result = await runWithCache(["mathlib", "nonexistent"]);
      expect(result.exitCode).toBe(3);
      expect(result.stderr).toContain("not found");
    });

    describe("HTTP endpoint members", () => {
      it("shows HTTP method", async () => {
        const result = await runWithCache(["acme-api", "users.create"]);
        expect(result.stdout).toContain("POST");
      });

      it("shows HTTP path", async () => {
        const result = await runWithCache(["acme-api", "users.create"]);
        expect(result.stdout).toContain("/users");
      });

      it("shows path parameters", async () => {
        const result = await runWithCache(["acme-api", "users.get"]);
        expect(result.stdout).toContain("Path Parameters:");
        expect(result.stdout).toContain("{id}");
      });

      it("shows query parameters", async () => {
        const result = await runWithCache(["acme-api", "users.list"]);
        expect(result.stdout).toContain("Query Parameters:");
        expect(result.stdout).toContain("page");
        expect(result.stdout).toContain("limit");
        expect(result.stdout).toContain("status");
      });

      it("shows body parameters", async () => {
        const result = await runWithCache(["acme-api", "users.create"]);
        expect(result.stdout).toContain("email");
        expect(result.stdout).toContain("name");
        expect(result.stdout).toContain("role");
      });

      it("shows response schemas by status code", async () => {
        const result = await runWithCache(["acme-api", "users.list"]);
        expect(result.stdout).toContain("Responses:");
        expect(result.stdout).toContain("200");
        expect(result.stdout).toContain("Successful response");
        expect(result.stdout).toContain("UserList");
        expect(result.stdout).toContain("401");
      });

      it("shows required scopes/permissions", async () => {
        const result = await runWithCache(["acme-api", "products.create"]);
        expect(result.stdout).toContain("Scopes:");
        expect(result.stdout).toContain("products:write");
      });
    });

    describe("nested members", () => {
      it("resolves single-level path (e.g., users)", async () => {
        const result = await runWithCache(["acme-api", "users"]);
        expect(result.stdout).toContain("users");
        expect(result.stdout).toContain("namespace");
        expect(result.exitCode).toBe(0);
      });

      it("resolves multi-level path (e.g., users.create)", async () => {
        const result = await runWithCache(["acme-api", "users.create"]);
        expect(result.stdout).toContain("create");
        expect(result.exitCode).toBe(0);
      });

      it("resolves space-separated path (e.g., users create)", async () => {
        const dotted = await runWithCache(["acme-api", "users.create"]);
        const spaced = await runWithCache(["acme-api", "users", "create"]);
        expect(spaced.stdout).toEqual(dotted.stdout);
        expect(spaced.exitCode).toBe(0);
      });

      it("resolves deeply nested path (e.g., orders.items.add)", async () => {
        const result = await runWithCache(["acme-api", "orders.items.add"]);
        expect(result.stdout).toContain("add");
        expect(result.exitCode).toBe(0);
      });

      it("resolves deeply nested space-separated path (e.g., orders items add)", async () => {
        const dotted = await runWithCache(["acme-api", "orders.items.add"]);
        const spaced = await runWithCache(["acme-api", "orders", "items", "add"]);
        expect(spaced.stdout).toEqual(dotted.stdout);
        expect(spaced.exitCode).toBe(0);
      });

      it("shows children for namespace members", async () => {
        const result = await runWithCache(["acme-api", "users"]);
        expect(result.stdout).toContain("Members:");
        expect(result.stdout).toContain("create");
        expect(result.stdout).toContain("list");
      });

      it("shows methods for class members", async () => {
        const result = await runWithCache(["mathlib", "Calculator"]);
        expect(result.stdout).toContain("Members:");
        expect(result.stdout).toContain("add [method]");
        expect(result.stdout).toContain("multiply [method]");
      });
    });
  });

  describe("lrn <package> <member.path> --summary", () => {
    it("shows only the member name for single member", async () => {
      const result = await runWithCache(["--format", "summary", "mathlib", "add"]);
      expect(result.stdout.trim()).toBe("add");
    });

    it("shows one name per line without kind indicators for list", async () => {
      const result = await runWithCache(["--format", "summary", "mathlib", "list"]);
      expect(result.stdout).toContain("add");
      expect(result.stdout).toContain("subtract");
      expect(result.stdout).not.toContain("[function]");
      expect(result.stdout).not.toContain("[class]");
    });

    it("excludes description", async () => {
      const result = await runWithCache(["--format", "summary", "mathlib", "add"]);
      expect(result.stdout).not.toContain("sum of two numbers");
    });

    it("excludes parameters", async () => {
      const result = await runWithCache(["--format", "summary", "mathlib", "add"]);
      expect(result.stdout).not.toContain("Parameters:");
    });

    it("excludes examples", async () => {
      const result = await runWithCache(["--format", "summary", "mathlib", "add"]);
      expect(result.stdout).not.toContain("Examples:");
    });
  });

  describe("lrn <package> <member.path> --signature", () => {
    it("shows only the type signature", async () => {
      const result = await runWithCache(["mathlib", "add", "--signature"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("(a: number, b: number) => number");
    });

    it("excludes description", async () => {
      const result = await runWithCache(["mathlib", "add", "--signature"]);
      expect(result.stdout).not.toContain("sum of two numbers");
    });

    it("excludes parameters", async () => {
      const result = await runWithCache(["mathlib", "add", "--signature"]);
      expect(result.stdout).not.toContain("Parameters:");
    });

    it("excludes examples", async () => {
      const result = await runWithCache(["mathlib", "add", "--signature"]);
      expect(result.stdout).not.toContain("Examples:");
    });

    it("shows message when member has no signature", async () => {
      const result = await runWithCache(["acme-api", "users", "--signature"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("No signature available.");
    });
  });

  describe("lrn <package> <member.path> --examples", () => {
    it("shows only the examples", async () => {
      const result = await runWithCache(["mathlib", "add", "--examples"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("add(2, 3)");
      expect(result.stdout).not.toContain("Parameters:");
    });

    it("shows example title when present", async () => {
      const result = await runWithCache(["mathlib", "add", "--examples"]);
      expect(result.stdout).toContain("Basic usage");
    });

    it("shows example code with language hint", async () => {
      const result = await runWithCache(["mathlib", "add", "--examples"]);
      expect(result.stdout).toContain("typescript");
    });

    it("shows example description when present", async () => {
      // Create a package with example description
      const packages = [
        {
          name: "desc-test",
          version: "1.0.0",
          source: { type: "custom" as const },
          members: [
            {
              name: "fn",
              kind: "function" as const,
              examples: [
                {
                  title: "Demo",
                  language: "typescript",
                  code: "fn()",
                  description: "This example shows basic usage",
                },
              ],
            },
          ],
          guides: [],
          schemas: {},
        },
      ];
      const cache = createTestCache(packages);
      try {
        const result = await runCLI(["--format", "text", "desc-test", "fn", "--examples"], {
          env: { LRN_CACHE: cache.cacheDir },
        });
        expect(result.stdout).toContain("This example shows basic usage");
      } finally {
        cache.cleanup();
      }
    });

    it("shows all examples when multiple exist", async () => {
      const result = await runWithCache(["mathlib", "Calculator", "--examples"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Method chaining");
    });

    it("shows message when member has no examples", async () => {
      const result = await runWithCache(["mathlib", "subtract", "--examples"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("No examples available.");
    });
  });

  describe("lrn <package> <member.path> --parameters", () => {
    it("shows only the parameters", async () => {
      const result = await runWithCache(["mathlib", "add", "--parameters"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("a");
      expect(result.stdout).toContain("b");
      expect(result.stdout).not.toContain("Examples:");
      expect(result.stdout).not.toContain("[function]");
    });

    it("shows parameter name", async () => {
      const result = await runWithCache(["mathlib", "add", "--parameters"]);
      expect(result.stdout).toContain("a");
      expect(result.stdout).toContain("b");
    });

    it("shows parameter type", async () => {
      const result = await runWithCache(["mathlib", "add", "--parameters"]);
      expect(result.stdout).toContain("number");
    });

    it("shows parameter description", async () => {
      const result = await runWithCache(["mathlib", "add", "--parameters"]);
      expect(result.stdout).toContain("first number");
    });

    it("shows parameter required status", async () => {
      const result = await runWithCache(["mathlib", "add", "--parameters"]);
      expect(result.stdout).toContain("required");
    });

    it("shows parameter default value", async () => {
      const result = await runWithCache(["mathlib", "Calculator", "--parameters"]);
      expect(result.stdout).toContain("default:");
      expect(result.stdout).toContain("0");
    });

    it("shows message when member has no parameters", async () => {
      const result = await runWithCache(["mathlib", "PI", "--parameters"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("No parameters available.");
    });
  });
});
