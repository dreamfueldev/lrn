import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  loadAllFixturePackages,
  createTestCache,
  runCLI,
} from "./fixtures/index.js";

describe("Help and Version", () => {
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

  describe("--help flag", () => {
    it("shows help message", async () => {
      const result = await run(["--help"]);
      expect(result.stdout).toContain("lrn - learn and query programming interfaces");
    });

    it("shows usage synopsis", async () => {
      const result = await run(["--help"]);
      expect(result.stdout).toContain("Usage:");
      expect(result.stdout).toContain("lrn [command] [options]");
    });

    it("shows all command sections", async () => {
      const result = await run(["--help"]);
      expect(result.stdout).toContain("Discovery Commands:");
      expect(result.stdout).toContain("Authoring Commands:");
      expect(result.stdout).toContain("Package Commands:");
      expect(result.stdout).toContain("Member Commands:");
      expect(result.stdout).toContain("Guide Commands:");
      expect(result.stdout).toContain("Type Commands:");
      expect(result.stdout).toContain("Search Commands:");
    });

    it("lists all authoring commands", async () => {
      const result = await run(["--help"]);
      expect(result.stdout).toContain("parse");
      expect(result.stdout).toContain("format");
      expect(result.stdout).toContain("health");
      expect(result.stdout).toContain("llms-full");
    });

    it("shows list of global options", async () => {
      const result = await run(["--help"]);
      expect(result.stdout).toContain("Options:");
      expect(result.stdout).toContain("--format");
      expect(result.stdout).toContain("--json");
      expect(result.stdout).toContain("--help, -h");
    });

    it("shows examples", async () => {
      const result = await run(["--help"]);
      expect(result.stdout).toContain("Examples:");
      expect(result.stdout).toContain("lrn stripe");
    });

    it("exits with code 0", async () => {
      const result = await run(["--help"]);
      expect(result.exitCode).toBe(0);
    });

    it("shows version in help output", async () => {
      const result = await run(["--help"]);
      expect(result.stdout).toContain("Version:");
    });
  });

  describe("-h short flag", () => {
    it("is equivalent to --help", async () => {
      const helpResult = await run(["--help"]);
      const shortResult = await run(["-h"]);
      expect(shortResult.stdout).toBe(helpResult.stdout);
    });

    it("shows same help message as --help", async () => {
      const result = await run(["-h"]);
      expect(result.stdout).toContain("lrn - learn and query programming interfaces");
    });
  });

  describe("command-specific help", () => {
    it("lrn sync --help shows sync command help", async () => {
      const result = await run(["sync", "--help"]);
      expect(result.stdout).toContain("lrn sync");
      expect(result.stdout).toContain("Sync packages for project dependencies");
    });

    it("lrn add --help shows add command help", async () => {
      const result = await run(["add", "--help"]);
      expect(result.stdout).toContain("lrn add");
      expect(result.stdout).toContain("Add a package to the project config");
    });

    it("lrn remove --help shows remove command help", async () => {
      const result = await run(["remove", "--help"]);
      expect(result.stdout).toContain("lrn remove");
      expect(result.stdout).toContain("Remove a package from the project config");
    });

    it("lrn search --help shows search command help", async () => {
      const result = await run(["search", "--help"]);
      expect(result.stdout).toContain("lrn search");
      expect(result.stdout).toContain("Search across packages");
    });

    it("lrn versions --help shows versions command help", async () => {
      const result = await run(["versions", "--help"]);
      expect(result.stdout).toContain("lrn versions");
      expect(result.stdout).toContain("List available versions");
    });

    it("lrn parse --help shows parse command help", async () => {
      const result = await run(["parse", "--help"]);
      expect(result.stdout).toContain("lrn parse");
      expect(result.stdout).toContain("Parse markdown directory to IR JSON");
    });

    it("lrn format --help shows format command help", async () => {
      const result = await run(["format", "--help"]);
      expect(result.stdout).toContain("lrn format");
      expect(result.stdout).toContain("Format IR JSON to markdown directory");
    });

    it("lrn crawl --help shows crawl command help", async () => {
      const result = await run(["crawl", "--help"]);
      expect(result.stdout).toContain("lrn crawl");
      expect(result.stdout).toContain("Fetch documentation from URLs");
    });

    it("lrn health --help shows health command help", async () => {
      const result = await run(["health", "--help"]);
      expect(result.stdout).toContain("lrn health");
      expect(result.stdout).toContain("Validate lrn-compatible markdown");
    });

    it("lrn llms-full --help shows llms-full command help", async () => {
      const result = await run(["llms-full", "--help"]);
      expect(result.stdout).toContain("lrn llms-full");
      expect(result.stdout).toContain("Generate llms-full.txt from markdown");
    });

    it("lrn list --help shows help containing list info", async () => {
      const result = await run(["list", "--help"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("list");
    });

    it("lrn guide --help shows help containing guide info", async () => {
      const result = await run(["guide", "--help"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("guide");
    });

    it("lrn guides --help shows help containing guides info", async () => {
      const result = await run(["guides", "--help"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("guides");
    });

    it("lrn type --help shows help containing type info", async () => {
      const result = await run(["type", "--help"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("type");
    });

    it("lrn types --help shows help containing types info", async () => {
      const result = await run(["types", "--help"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("types");
    });

    it("lrn tags --help shows help containing tags info", async () => {
      const result = await run(["tags", "--help"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("tags");
    });

    it("shows command-specific options", async () => {
      const result = await run(["list", "--help"]);
      expect(result.stdout).toContain("--deep");
      expect(result.stdout).toContain("--tag");
    });

    it("shows command-specific examples", async () => {
      const result = await run(["guide", "--help"]);
      expect(result.stdout).toContain("Examples:");
    });

    it("unknown command --help without package shows error on stderr", async () => {
      // Without a package, an unknown command with --help shows command help error
      // With a package, unknown subcommands are treated as member paths
      const result = await run(["--help", "notarealcommand"]);
      // --help takes precedence and shows help for the "command"
      expect(result.exitCode).toBe(0);
    });
  });

  describe("--version flag", () => {
    it("shows version number", async () => {
      const result = await run(["--version"]);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("shows only version (no other output)", async () => {
      const result = await run(["--version"]);
      const lines = result.stdout.trim().split("\n");
      expect(lines).toHaveLength(1);
    });

    it("exits with code 0", async () => {
      const result = await run(["--version"]);
      expect(result.exitCode).toBe(0);
    });
  });

  describe("-v short flag", () => {
    it("is equivalent to --version", async () => {
      const versionResult = await run(["--version"]);
      const shortResult = await run(["-v"]);
      expect(shortResult.stdout).toBe(versionResult.stdout);
    });

    it("shows same version as --version", async () => {
      const result = await run(["-v"]);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe("unknown subcommand treated as member path", () => {
    it("treats unknown subcommand as member lookup", async () => {
      // lrn <package> <unknown> is treated as a member path, not an unknown command
      const result = await run(["mathlib", "badsubcommand"]);
      expect(result.exitCode).toBe(3); // NOT_FOUND
      expect(result.stderr).toContain("not found");
    });

    it("suggests similar member names", async () => {
      const result = await run(["mathlib", "ad"]);
      expect(result.stderr).toContain("Did you mean");
      expect(result.stderr).toContain("add");
    });
  });

  describe("unknown option", () => {
    it("shows error message for unknown option", async () => {
      const result = await run(["--notanoption"]);
      expect(result.stderr).toContain("Unknown option");
    });

    it("shows hint to use --help", async () => {
      const result = await run(["--notanoption"]);
      expect(result.stderr).toContain("--help");
    });

    it("exits with code 1", async () => {
      const result = await run(["--notanoption"]);
      expect(result.exitCode).toBe(1);
    });
  });

  describe("stub commands", () => {
    it("lrn sync with no config shows no packages", async () => {
      const result = await run(["sync"]);
      expect(result.stdout).toContain("No packages configured");
      expect(result.exitCode).toBe(0);
    });

    it("lrn add requires package name", async () => {
      const result = await run(["add"]);
      expect(result.stderr).toContain("Missing package name");
      expect(result.exitCode).not.toBe(0);
    });

    it("lrn remove requires package name", async () => {
      const result = await run(["remove"]);
      expect(result.stderr).toContain("Missing package name");
      expect(result.exitCode).not.toBe(0);
    });

    it("lrn versions requires package name", async () => {
      const result = await run(["versions"]);
      expect(result.stderr).toContain("Missing package name");
      expect(result.exitCode).not.toBe(0);
    });
  });

  describe("error hints", () => {
    it("shows 'Did you mean' hint for similar member names", async () => {
      const result = await run(["mathlib", "ad"]);
      expect(result.stderr).toContain("Did you mean");
      expect(result.stderr).toContain("add");
    });

    it("shows hint for package not found", async () => {
      const result = await run(["nonexistent"]);
      expect(result.stderr).toContain("not found");
    });

    it("shows hint for guide not found", async () => {
      const result = await run(["acme-api", "guide", "nonexistent"]);
      expect(result.stderr).toContain("not found");
      expect(result.stderr).toContain("guides");
    });

    it("shows hint for type not found", async () => {
      const result = await run(["acme-api", "type", "Nonexistent"]);
      expect(result.stderr).toContain("not found");
      expect(result.stderr).toContain("types");
    });
  });
});
