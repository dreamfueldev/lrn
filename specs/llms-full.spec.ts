import { describe, it, expect } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { loadFixturePackage, runCLI } from "./fixtures/index.js";
import { formatLlmsFull } from "../src/format/llms-full.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VALID_FIXTURE = join(__dirname, "fixtures/health/valid");

describe("llms-full", () => {
  describe("formatLlmsFull", () => {
    it("produces a single H1 at the top", () => {
      const pkg = loadFixturePackage("acme-api");
      const output = formatLlmsFull(pkg);
      const h1s = output.match(/^# .+$/gm);
      expect(h1s).not.toBeNull();
      expect(h1s!.length).toBe(1);
      expect(h1s![0]).toContain("acme-api");
    });

    it("includes package summary as blockquote", () => {
      const pkg = loadFixturePackage("acme-api");
      const output = formatLlmsFull(pkg);
      expect(output).toContain(`> ${pkg.summary}`);
    });

    it("includes all member names", () => {
      const pkg = loadFixturePackage("mathlib");
      const output = formatLlmsFull(pkg);
      for (const member of pkg.members) {
        expect(output).toContain(member.name);
        if (member.children) {
          for (const child of member.children) {
            expect(output).toContain(child.name);
          }
        }
      }
    });

    it("includes all schema names", () => {
      const pkg = loadFixturePackage("acme-api");
      const output = formatLlmsFull(pkg);
      for (const name of Object.keys(pkg.schemas)) {
        expect(output).toContain(name);
      }
    });

    it("includes all guide titles", () => {
      const pkg = loadFixturePackage("acme-api");
      const output = formatLlmsFull(pkg);
      for (const guide of pkg.guides) {
        expect(output).toContain(guide.title);
      }
    });

    it("uses H2 for namespaces with children", () => {
      const pkg = loadFixturePackage("acme-api");
      const output = formatLlmsFull(pkg);
      // acme-api has namespace members like "users"
      const namespaces = pkg.members.filter(
        (m) => m.children && m.children.length > 0
      );
      for (const ns of namespaces) {
        expect(output).toMatch(new RegExp(`^## ${ns.name}$`, "m"));
      }
    });

    it("uses H3 for children of namespaces", () => {
      const pkg = loadFixturePackage("acme-api");
      const output = formatLlmsFull(pkg);
      const namespaces = pkg.members.filter(
        (m) => m.children && m.children.length > 0
      );
      for (const ns of namespaces) {
        if (ns.children) {
          for (const child of ns.children) {
            expect(output).toMatch(
              new RegExp(`^### ${ns.name}\\.${child.name}$`, "m")
            );
          }
        }
      }
    });

    it("includes Modules listing when namespaces exist", () => {
      const pkg = loadFixturePackage("acme-api");
      const output = formatLlmsFull(pkg);
      expect(output).toContain("## Modules");
    });

    it("includes Types section when schemas exist", () => {
      const pkg = loadFixturePackage("acme-api");
      const output = formatLlmsFull(pkg);
      expect(output).toContain("## Types");
    });

    it("includes Guide sections", () => {
      const pkg = loadFixturePackage("acme-api");
      const output = formatLlmsFull(pkg);
      for (const guide of pkg.guides) {
        expect(output).toContain(`## Guide: ${guide.title}`);
      }
    });

    it("handles packages with no guides gracefully", () => {
      const pkg = loadFixturePackage("mathlib");
      pkg.guides = [];
      const output = formatLlmsFull(pkg);
      expect(output).not.toContain("## Guide:");
    });

    it("handles packages with no schemas gracefully", () => {
      const pkg = loadFixturePackage("mathlib");
      pkg.schemas = {};
      const output = formatLlmsFull(pkg);
      expect(output).not.toContain("## Types");
    });

    it("includes parameter tables for members with parameters", () => {
      const pkg = loadFixturePackage("acme-api");
      const output = formatLlmsFull(pkg);
      expect(output).toContain("**Parameters:**");
      expect(output).toContain("| Name | Type |");
    });

    it("includes return type info", () => {
      const pkg = loadFixturePackage("mathlib");
      const output = formatLlmsFull(pkg);
      expect(output).toContain("**Returns:**");
    });

    it("includes code examples", () => {
      const pkg = loadFixturePackage("mathlib");
      const output = formatLlmsFull(pkg);
      expect(output).toContain("```");
    });
  });

  describe("lrn llms-full <directory>", () => {
    it("outputs to stdout by default", async () => {
      const result = await runCLI(["llms-full", VALID_FIXTURE]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("# ");
    });

    it("writes to file with --out", async () => {
      const tmpDir = mkdtempSync(join(tmpdir(), "lrn-llms-full-test-"));
      const outFile = join(tmpDir, "llms-full.txt");
      try {
        const result = await runCLI([
          "llms-full",
          VALID_FIXTURE,
          "--out",
          outFile,
        ]);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Wrote llms-full.txt");
        const content = readFileSync(outFile, "utf-8");
        expect(content).toContain("# ");
      } finally {
        rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("exits with error when no directory given", async () => {
      const result = await runCLI(["llms-full"]);
      expect(result.exitCode).not.toBe(0);
    });
  });
});
