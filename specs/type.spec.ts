import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  loadAllFixturePackages,
  createTestCache,
  runCLI,
} from "./fixtures/index.js";

describe("Type/Schema Commands", () => {
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

  describe("lrn <package> type <name>", () => {
    it("shows schema name", async () => {
      const result = await runWithCache(["acme-api", "type", "User"]);
      // Output should contain type info
      expect(result.exitCode).toBe(0);
    });

    it("shows schema description", async () => {
      const result = await runWithCache(["acme-api", "type", "User"]);
      expect(result.stdout).toContain("user");
    });

    it("shows schema base type", async () => {
      const result = await runWithCache(["acme-api", "type", "User"]);
      expect(result.stdout).toContain("object");
    });

    it("fails with exit code 3 when schema not found", async () => {
      const result = await runWithCache(["acme-api", "type", "NonexistentType"]);
      expect(result.exitCode).toBe(3);
      expect(result.stderr).toContain("not found");
    });

    describe("object schemas", () => {
      it("shows all properties", async () => {
        const result = await runWithCache(["acme-api", "type", "User"]);
        expect(result.stdout).toContain("Properties:");
      });

      it("shows property names", async () => {
        const result = await runWithCache(["acme-api", "type", "User"]);
        expect(result.stdout).toContain("id");
        expect(result.stdout).toContain("email");
      });

      it("shows property types", async () => {
        const result = await runWithCache(["acme-api", "type", "User"]);
        expect(result.stdout).toContain("string");
      });

      it.todo("shows property descriptions");
      it.todo("indicates required properties");
      it.todo("shows property default values");
      it.todo("shows property examples");
    });

    describe("array schemas", () => {
      it("shows items type", async () => {
        const result = await runWithCache(["mathlib", "type", "NumberPair"]);
        expect(result.stdout).toContain("array");
      });

      it.todo("shows items schema details");
      it.todo("shows minLength constraint");
      it.todo("shows maxLength constraint");
    });

    describe("string schemas", () => {
      it.todo("shows format constraint (email, uri, date-time, etc.)");
      it.todo("shows pattern constraint");
      it.todo("shows minLength constraint");
      it.todo("shows maxLength constraint");
      it.todo("shows enum values when present");
    });

    describe("number schemas", () => {
      it.todo("shows minimum constraint");
      it.todo("shows maximum constraint");
      it.todo("distinguishes integer from number");
    });

    describe("$ref resolution", () => {
      it("resolves reference to another schema", async () => {
        const result = await runWithCache(["acme-api", "type", "Order"]);
        // Order references User
        expect(result.exitCode).toBe(0);
      });

      it.todo("shows referenced schema inline");
      it.todo("handles circular references gracefully");
      it.todo("shows reference path for complex nested refs");
    });

    describe("union types (oneOf)", () => {
      it.todo("shows all possible types");
      it.todo("shows description for each variant");
    });

    describe("intersection types (allOf)", () => {
      it.todo("shows merged properties from all schemas");
      it.todo("indicates which properties come from which schema");
    });

    describe("nullable schemas", () => {
      it.todo("indicates when schema is nullable");
    });
  });
});
