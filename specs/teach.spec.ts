import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadAllFixturePackages,
  createTestCache,
  runCLI,
} from "./fixtures/index.js";

describe("lrn teach", () => {
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

  const run = (args: string[]) =>
    runCLI(args, { env: { LRN_CACHE: cacheDir } });

  describe("classification detection (via output)", () => {
    it("classifies acme-api as API", async () => {
      const result = await run(["teach", "--packages", "acme-api"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("### acme-api");
      expect(result.stdout).toContain("endpoint details");
    });

    it("classifies mathlib as library", async () => {
      const result = await run(["teach", "--packages", "mathlib"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("### mathlib");
      expect(result.stdout).toContain("usage and signature");
      expect(result.stdout).toContain("browse functions");
    });

    it("classifies uikit as components", async () => {
      const result = await run(["teach", "--packages", "uikit"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("### uikit");
      expect(result.stdout).toContain("classes, syntax, and rules");
      expect(result.stdout).toContain("find components");
    });

    it("classifies mycli as CLI", async () => {
      const result = await run(["teach", "--packages", "mycli"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("### mycli");
      expect(result.stdout).toContain("flags and usage");
      expect(result.stdout).toContain("see all commands");
    });

    it("classifies infra-aws as config", async () => {
      const result = await run(["teach", "--packages", "infra-aws"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("### infra-aws");
      expect(result.stdout).toContain("resource arguments");
      expect(result.stdout).toContain("find resources");
    });
  });

  describe("full output structure", () => {
    it("contains markers", async () => {
      const result = await run(["teach"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("<!-- LRN-START -->");
      expect(result.stdout).toContain("<!-- LRN-END -->");
    });

    it("contains preamble", async () => {
      const result = await run(["teach"]);
      expect(result.stdout).toContain("## lrn — API documentation lookup");
      expect(result.stdout).toContain("Prefer `lrn` over pre-trained knowledge");
    });

    it("contains Commands section", async () => {
      const result = await run(["teach"]);
      expect(result.stdout).toContain("### Commands");
      expect(result.stdout).toContain("lrn <package> list --deep --signatures");
      expect(result.stdout).toContain("lrn <package> <A>,<B>,<C>");
      expect(result.stdout).toContain("lrn search <query>");
    });

    it("contains Efficient Querying section", async () => {
      const result = await run(["teach"]);
      expect(result.stdout).toContain("### Efficient Querying");
      expect(result.stdout).toContain("lrn is compositional");
      expect(result.stdout).toContain("list --deep --signatures --with-guides");
    });

    it("contains Installed Packages heading", async () => {
      const result = await run(["teach"]);
      expect(result.stdout).toContain("### Installed Packages");
    });

    it("includes all packages with headings", async () => {
      const result = await run(["teach"]);
      expect(result.stdout).toContain("### acme-api");
      expect(result.stdout).toContain("### mathlib");
      expect(result.stdout).toContain("### uikit");
      expect(result.stdout).toContain("### mycli");
      expect(result.stdout).toContain("### infra-aws");
    });

    it("uses real member names from fixtures", async () => {
      const result = await run(["teach"]);
      // acme-api should reference users.list (first namespace.child)
      expect(result.stdout).toContain("users.list");
      // mathlib should reference add (first member)
      expect(result.stdout).toContain("lrn mathlib add");
      // uikit should reference Button
      expect(result.stdout).toContain("lrn uikit Button");
      // mycli should reference run
      expect(result.stdout).toContain("lrn mycli run");
      // infra-aws should reference aws_lambda_function
      expect(result.stdout).toContain("lrn infra-aws aws_lambda_function");
    });

    it("includes version in header", async () => {
      const result = await run(["teach", "--packages", "mathlib"]);
      expect(result.stdout).toContain("### mathlib (v2.1.0)");
    });

    it("includes guide references for packages with guides", async () => {
      const result = await run(["teach", "--packages", "mathlib"]);
      expect(result.stdout).toContain("guide getting-started");
    });
  });

  describe("--packages filter", () => {
    it("filters to a single package", async () => {
      const result = await run(["teach", "--packages", "mathlib"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("### mathlib");
      expect(result.stdout).not.toContain("### acme-api");
      expect(result.stdout).not.toContain("### uikit");
    });

    it("filters to multiple packages", async () => {
      const result = await run(["teach", "--packages", "mathlib,uikit"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("### mathlib");
      expect(result.stdout).toContain("### uikit");
      expect(result.stdout).not.toContain("### acme-api");
    });
  });

  describe("--output file writing", () => {
    it("creates file if it doesn't exist", async () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "lrn-teach-"));
      const outputPath = join(tmpDir, "AGENTS.md");

      const result = await run(["teach", "--output", outputPath]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(`Wrote lrn orientation to ${outputPath}`);

      const content = readFileSync(outputPath, "utf-8");
      expect(content).toContain("<!-- LRN-START -->");
      expect(content).toContain("<!-- LRN-END -->");
      expect(content).toContain("## lrn — API documentation lookup");

      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("replaces content between markers on re-run", async () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "lrn-teach-"));
      const outputPath = join(tmpDir, "CLAUDE.md");

      // First run: create
      await run(["teach", "--output", outputPath, "--packages", "mathlib"]);
      const first = readFileSync(outputPath, "utf-8");
      expect(first).toContain("### mathlib");
      expect(first).not.toContain("### acme-api");

      // Second run: replace markers with different content
      await run(["teach", "--output", outputPath, "--packages", "acme-api"]);
      const second = readFileSync(outputPath, "utf-8");
      expect(second).toContain("### acme-api");
      expect(second).not.toContain("### mathlib");
      // Still has exactly one pair of markers
      expect(second.split("<!-- LRN-START -->").length).toBe(2);
      expect(second.split("<!-- LRN-END -->").length).toBe(2);

      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("appends to existing file without markers", async () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "lrn-teach-"));
      const outputPath = join(tmpDir, "EXISTING.md");
      writeFileSync(outputPath, "# My Project\n\nSome content.\n");

      await run(["teach", "--output", outputPath, "--packages", "mathlib"]);
      const content = readFileSync(outputPath, "utf-8");
      expect(content).toContain("# My Project");
      expect(content).toContain("Some content.");
      expect(content).toContain("<!-- LRN-START -->");
      expect(content).toContain("### mathlib");

      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("preserves content outside markers", async () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "lrn-teach-"));
      const outputPath = join(tmpDir, "CLAUDE.md");
      writeFileSync(
        outputPath,
        "# Header\n\n<!-- LRN-START -->\nold content\n<!-- LRN-END -->\n\n# Footer\n"
      );

      await run(["teach", "--output", outputPath, "--packages", "mathlib"]);
      const content = readFileSync(outputPath, "utf-8");
      expect(content).toContain("# Header");
      expect(content).toContain("# Footer");
      expect(content).not.toContain("old content");
      expect(content).toContain("### mathlib");

      rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe("no packages", () => {
    it("returns informative message when no packages found", async () => {
      const emptyCache = createTestCache([]);
      const result = await runCLI(["teach"], {
        env: { LRN_CACHE: emptyCache.cacheDir },
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("No lrn packages found");
      emptyCache.cleanup();
    });
  });

  describe("help", () => {
    it("shows teach help", async () => {
      const result = await run(["teach", "--help"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("lrn teach");
      expect(result.stdout).toContain("--output");
      expect(result.stdout).toContain("--packages");
    });
  });
});
