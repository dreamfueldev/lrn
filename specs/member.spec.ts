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

    it.todo("shows since version when present");

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

      it.todo("shows path parameters");
      it.todo("shows query parameters");
      it.todo("shows request body schema");
      it.todo("shows response schemas by status code");
      it.todo("shows required scopes/permissions");
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

      it("resolves deeply nested path (e.g., orders.items.add)", async () => {
        const result = await runWithCache(["acme-api", "orders.items.add"]);
        expect(result.stdout).toContain("add");
        expect(result.exitCode).toBe(0);
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
    it.todo("shows only the one-line summary");
    it.todo("excludes description");
    it.todo("excludes parameters");
    it.todo("excludes examples");
    it.todo("excludes other details");
  });

  describe("lrn <package> <member.path> --signature", () => {
    it.todo("shows only the type signature");
    it.todo("excludes description");
    it.todo("excludes parameters");
    it.todo("excludes examples");
    it.todo("shows message when member has no signature");
  });

  describe("lrn <package> <member.path> --examples", () => {
    it.todo("shows only the examples");
    it.todo("shows example title when present");
    it.todo("shows example code with language hint");
    it.todo("shows example description when present");
    it.todo("shows all examples when multiple exist");
    it.todo("shows message when member has no examples");
  });

  describe("lrn <package> <member.path> --parameters", () => {
    it.todo("shows only the parameters");
    it.todo("shows parameter name");
    it.todo("shows parameter type");
    it.todo("shows parameter description");
    it.todo("shows parameter required status");
    it.todo("shows parameter default value");
    it.todo("shows message when member has no parameters");
  });
});
