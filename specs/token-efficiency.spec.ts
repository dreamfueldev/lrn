import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  loadAllFixturePackages,
  createTestCache,
  runCLI,
} from "./fixtures/index.js";

let cacheDir: string;
let cleanup: () => void;

beforeAll(() => {
  const packages = loadAllFixturePackages();
  const result = createTestCache(packages);
  cacheDir = result.cacheDir;
  cleanup = result.cleanup;
});

afterAll(() => cleanup());

function cli(args: string[]) {
  return runCLI(args, { env: { LRN_CACHE: cacheDir } });
}

describe("overview truncation removed", () => {
  it("shows all members for mathlib (>10 members)", async () => {
    const { stdout } = await cli(["mathlib"]);
    expect(stdout).toContain("CalculatorOptions");
    expect(stdout).not.toContain("... and");
  });

  it("shows all members for acme-api", async () => {
    const { stdout } = await cli(["acme-api"]);
    expect(stdout).toContain("authenticate");
    expect(stdout).not.toContain("... and");
  });
});

describe("--signatures flag", () => {
  it("shows signatures instead of summaries", async () => {
    const { stdout } = await cli(["mathlib", "list", "--signatures"]);
    expect(stdout).toContain("(a: number, b: number) => number");
  });

  it("works with --deep", async () => {
    const { stdout } = await cli(["acme-api", "list", "--deep", "--signatures"]);
    expect(stdout).toContain("[");
  });

  it("works with --tag filter", async () => {
    const { stdout } = await cli(["mathlib", "list", "--signatures", "--tag", "arithmetic"]);
    expect(stdout).toContain("(a: number, b: number) => number");
  });

  it("json output still works with --signatures", async () => {
    const { stdout } = await cli(["mathlib", "list", "--signatures", "--json"]);
    const data = JSON.parse(stdout);
    expect(Array.isArray(data)).toBe(true);
  });

  it("appears in list --help", async () => {
    const { stdout } = await cli(["list", "--help"]);
    expect(stdout!).toContain("--signatures");
  });
});

describe("multi-member query", () => {
  it("shows multiple members with comma syntax", async () => {
    const { stdout } = await cli(["mathlib", "add,subtract"]);
    expect(stdout).toContain("add [function]");
    expect(stdout).toContain("subtract [function]");
  });

  it("includes error for nonexistent member but still shows others", async () => {
    const { stdout } = await cli(["mathlib", "add,nonexistent,subtract"]);
    expect(stdout).toContain("add [function]");
    expect(stdout).toContain('Error: member "nonexistent" not found');
    expect(stdout).toContain("subtract [function]");
  });

  it("single member still works (no comma)", async () => {
    const { stdout } = await cli(["mathlib", "add"]);
    expect(stdout).toContain("add [function]");
  });

  it("works with nested paths", async () => {
    const { stdout } = await cli(["acme-api", "users.create,products.list"]);
    expect(stdout).toContain("create [method]");
    expect(stdout).toContain("list [method]");
  });
});

describe("--with-guides flag", () => {
  it("appends guides to list output", async () => {
    const { stdout } = await cli(["acme-api", "list", "--with-guides"]);
    expect(stdout).toContain("Guides:");
    expect(stdout).toContain("quickstart");
    expect(stdout).toContain("authentication");
    expect(stdout).toContain("webhooks");
  });

  it("works with --deep", async () => {
    const { stdout } = await cli(["acme-api", "list", "--deep", "--with-guides"]);
    expect(stdout).toContain("Guides:");
    expect(stdout).toContain("quickstart");
  });

  it("appears in list --help", async () => {
    const { stdout } = await cli(["list", "--help"]);
    expect(stdout!).toContain("--with-guides");
  });
});
