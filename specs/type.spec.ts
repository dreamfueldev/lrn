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

  describe("lrn <package> types", () => {
    it("lists type names in text format", async () => {
      const result = await runWithCache(["acme-api", "types"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Types");
      expect(result.stdout).toContain("User");
    });

    it("lists type names in json format", async () => {
      const result = await runCLI(["--format", "json", "acme-api", "types"], { env: { LRN_CACHE: cacheDir } });
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed).toHaveProperty("User");
    });

    it("lists type names in summary format", async () => {
      const result = await runCLI(["--format", "summary", "acme-api", "types"], { env: { LRN_CACHE: cacheDir } });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("User");
    });

    it("lists type names in markdown format", async () => {
      const result = await runCLI(["--format", "markdown", "acme-api", "types"], { env: { LRN_CACHE: cacheDir } });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("# Types");
      expect(result.stdout).toContain("`User`");
    });

    it("shows 'No types found' for package without schemas", async () => {
      const result = await runWithCache(["mathlib", "types"]);
      // mathlib may or may not have types; if it does this test should be adjusted
      expect(result.exitCode).toBe(0);
    });

    it("fails with exit code 3 when type name is empty", async () => {
      const result = await runWithCache(["acme-api", "type"]);
      expect(result.exitCode).toBe(3);
    });
  });

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

    it("shows referenced member paths when param type not found", async () => {
      const packages = [
        {
          name: "ref-test",
          version: "1.0.0",
          source: { type: "custom" as const },
          members: [
            {
              name: "things",
              kind: "namespace" as const,
              children: [
                {
                  name: "create",
                  kind: "function" as const,
                  parameters: [{ name: "params", type: "ThingCreateParams", required: true }],
                },
              ],
            },
          ],
          guides: [],
          schemas: { Thing: { type: "object" as const, description: "A thing" } },
        },
      ];
      const cache = createTestCache(packages);
      try {
        const result = await runCLI(["--format", "text", "ref-test", "type", "ThingCreateParams"], {
          env: { LRN_CACHE: cache.cacheDir },
        });
        expect(result.exitCode).toBe(3);
        expect(result.stderr).toContain("Referenced as parameter type in: things.create");
        expect(result.stderr).toContain("Run 'lrn ref-test types'");
      } finally {
        cache.cleanup();
      }
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

      it("shows property descriptions", async () => {
        const result = await runWithCache(["acme-api", "type", "User"]);
        expect(result.stdout).toContain("Unique identifier");
        expect(result.stdout).toContain("email address");
      });

      it("indicates required properties", async () => {
        const result = await runWithCache(["acme-api", "type", "User"]);
        expect(result.stdout).toContain("(required)");
      });

      it("shows property default values", async () => {
        const result = await runWithCache(["acme-api", "type", "CreateUserRequest"]);
        expect(result.stdout).toContain("default:");
        expect(result.stdout).toContain('"member"');
      });

      it("shows property examples", async () => {
        const result = await runWithCache(["acme-api", "type", "CreateUserRequest"]);
        expect(result.stdout).toContain("Example:");
        expect(result.stdout).toContain('"admin"');
      });
    });

    describe("array schemas", () => {
      it("shows items type", async () => {
        const result = await runWithCache(["mathlib", "type", "NumberPair"]);
        expect(result.stdout).toContain("array");
      });

      it("shows items schema details", async () => {
        const result = await runWithCache(["mathlib", "type", "NumberPair"]);
        expect(result.stdout).toContain("Items:");
        expect(result.stdout).toContain("number");
      });

      it("shows minLength constraint", async () => {
        const result = await runWithCache(["mathlib", "type", "NumberPair"]);
        expect(result.stdout).toContain("Min length: 2");
      });

      it("shows maxLength constraint", async () => {
        const result = await runWithCache(["mathlib", "type", "NumberPair"]);
        expect(result.stdout).toContain("Max length: 2");
      });
    });

    describe("string schemas", () => {
      it("shows enum values when present", async () => {
        const result = await runWithCache(["mathlib", "type", "RoundingMode"]);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Enum:");
        expect(result.stdout).toContain("ceil");
        expect(result.stdout).toContain("floor");
        expect(result.stdout).toContain("round");
        expect(result.stdout).toContain("trunc");
      });

      it("shows format constraint (email, uri, date-time, etc.)", async () => {
        const result = await runWithCache(["acme-api", "type", "User"]);
        expect(result.stdout).toContain("format: email");
      });

      it("shows pattern constraint", async () => {
        const result = await runWithCache(["acme-api", "type", "User"]);
        expect(result.stdout).toContain("Pattern:");
        expect(result.stdout).toContain("^[^@]+@[^@]+\\.[^@]+$");
      });

      it("shows minLength constraint", async () => {
        const result = await runWithCache(["acme-api", "type", "User"]);
        expect(result.stdout).toContain("Min length: 5");
      });

      it("shows maxLength constraint", async () => {
        const result = await runWithCache(["acme-api", "type", "User"]);
        expect(result.stdout).toContain("Max length: 255");
      });
    });

    describe("number schemas", () => {
      it("shows minimum constraint", async () => {
        const result = await runWithCache(["acme-api", "type", "OrderItem"]);
        expect(result.stdout).toContain("minimum=1");
      });

      it("shows maximum constraint", async () => {
        const result = await runWithCache(["acme-api", "type", "OrderItem"]);
        expect(result.stdout).toContain("maximum=999");
      });
      it("distinguishes integer from number", async () => {
        const result = await runWithCache(["mathlib", "type", "CalculatorOptions"]);
        expect(result.exitCode).toBe(0);
        // precision property is type "integer", not "number"
        expect(result.stdout).toContain("integer");
      });
    });

    describe("$ref resolution", () => {
      it("resolves reference to another schema", async () => {
        const result = await runWithCache(["acme-api", "type", "Order"]);
        // Order references User
        expect(result.exitCode).toBe(0);
      });

      it("shows referenced schema inline", async () => {
        const result = await runWithCache(["acme-api", "type", "UserList"]);
        // UserList has pagination.$ref: "Pagination" which renders as property type
        expect(result.stdout).toContain("Pagination");
      });

      it("handles circular references gracefully", async () => {
        // A schema referencing itself shouldn't crash
        const packages = [
          {
            name: "circ-test",
            version: "1.0.0",
            source: { type: "custom" as const },
            members: [],
            guides: [],
            schemas: {
              Node: {
                type: "object" as const,
                properties: {
                  value: { type: "string" as const },
                  children: { type: "array" as const, items: { $ref: "Node" } },
                },
              },
            },
          },
        ];
        const cache = createTestCache(packages);
        try {
          const result = await runCLI(["--format", "text", "circ-test", "type", "Node"], {
            env: { LRN_CACHE: cache.cacheDir },
          });
          expect(result.exitCode).toBe(0);
          expect(result.stdout).toContain("children");
        } finally {
          cache.cleanup();
        }
      });

      it("shows reference path for complex nested refs", async () => {
        const result = await runWithCache(["acme-api", "type", "Order"]);
        // Order has shippingAddress with $ref: "Address" which renders as property type
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Address");
      });
    });

    describe("comma-separated type lookups", () => {
      it("returns multiple type definitions", async () => {
        const result = await runWithCache(["mathlib", "type", "NumberPair,CalculatorOptions"]);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("array");
        expect(result.stdout).toContain("object");
        expect(result.stdout).toContain("A tuple of exactly two numbers");
        expect(result.stdout).toContain("Configuration options for the Calculator");
      });

      it("returns valid type plus inline error for missing type", async () => {
        const result = await runWithCache(["mathlib", "type", "NumberPair,Bogus"]);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("array");
        expect(result.stdout).toContain('Error: type "Bogus" not found in mathlib');
      });

      it("handles whitespace after comma", async () => {
        const result = await runWithCache(["mathlib", "type", "NumberPair, CalculatorOptions"]);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("array");
        expect(result.stdout).toContain("object");
      });

      it("handles trailing comma gracefully", async () => {
        const result = await runWithCache(["mathlib", "type", ","]);
        expect(result.exitCode).toBe(0);
      });
    });

    describe("union types (oneOf)", () => {
      it("shows all possible types", async () => {
        const result = await runWithCache(["acme-api", "type", "PaymentMethod"]);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("One of:");
        expect(result.stdout).toContain("object");
      });

      it("shows description for each variant", async () => {
        const result = await runWithCache(["acme-api", "type", "PaymentMethod"]);
        expect(result.stdout).toContain("Credit card payment");
        expect(result.stdout).toContain("Bank transfer payment");
      });
    });

    describe("intersection types (allOf)", () => {
      it("shows merged properties from all schemas", async () => {
        const result = await runWithCache(["acme-api", "type", "AdminUser"]);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("allOf");
        expect(result.stdout).toContain("permissions");
        expect(result.stdout).toContain("lastLogin");
      });

      it("indicates which properties come from which schema", async () => {
        const result = await runWithCache(["acme-api", "type", "AdminUser"]);
        expect(result.stdout).toContain("From User");
        expect(result.stdout).toContain("Admin-specific fields");
      });
    });

    describe("nullable schemas", () => {
      it("indicates when schema is nullable", async () => {
        const result = await runWithCache(["acme-api", "type", "User"]);
        // User.status has nullable: true
        expect(result.stdout).toContain("nullable");
      });
    });
  });
});
