import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { join } from "node:path";

const CLI_PATH = join(__dirname, "../dist/index.js");

/**
 * Helper to run CLI and capture output
 */
function runCLI(
  args: string[]
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${args.join(" ")}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || "",
      stderr: error.stderr || "",
      exitCode: error.status || 1,
    };
  }
}

describe("Help and Version", () => {
  beforeAll(() => {
    // Ensure CLI is built
    try {
      execSync("pnpm build", { cwd: join(__dirname, ".."), stdio: "pipe" });
    } catch {
      // Build might fail in some test environments, that's ok
    }
  });

  describe("--help flag", () => {
    it("shows help message", () => {
      const result = runCLI(["--help"]);
      expect(result.stdout).toContain("lrn - learn and query programming interfaces");
    });

    it("shows usage synopsis", () => {
      const result = runCLI(["--help"]);
      expect(result.stdout).toContain("Usage:");
      expect(result.stdout).toContain("lrn [command] [options]");
    });

    it("shows list of commands", () => {
      const result = runCLI(["--help"]);
      expect(result.stdout).toContain("Discovery Commands:");
      expect(result.stdout).toContain("Package Commands:");
      expect(result.stdout).toContain("Member Commands:");
    });

    it("shows list of global options", () => {
      const result = runCLI(["--help"]);
      expect(result.stdout).toContain("Options:");
      expect(result.stdout).toContain("--format");
      expect(result.stdout).toContain("--json");
      expect(result.stdout).toContain("--help, -h");
    });

    it("shows examples", () => {
      const result = runCLI(["--help"]);
      expect(result.stdout).toContain("Examples:");
      expect(result.stdout).toContain("lrn stripe");
    });

    it("exits with code 0", () => {
      const result = runCLI(["--help"]);
      expect(result.exitCode).toBe(0);
    });
  });

  describe("-h short flag", () => {
    it("is equivalent to --help", () => {
      const helpResult = runCLI(["--help"]);
      const shortResult = runCLI(["-h"]);
      expect(shortResult.stdout).toBe(helpResult.stdout);
    });

    it("shows same help message as --help", () => {
      const result = runCLI(["-h"]);
      expect(result.stdout).toContain("lrn - learn and query programming interfaces");
    });
  });

  describe("command-specific help", () => {
    it("lrn sync --help shows sync command help", () => {
      const result = runCLI(["sync", "--help"]);
      expect(result.stdout).toContain("lrn sync");
      expect(result.stdout).toContain("Sync packages for project dependencies");
    });

    it("lrn add --help shows add command help", () => {
      const result = runCLI(["add", "--help"]);
      expect(result.stdout).toContain("lrn add");
      expect(result.stdout).toContain("Add a package to the local cache");
    });

    it("lrn remove --help shows remove command help", () => {
      const result = runCLI(["remove", "--help"]);
      expect(result.stdout).toContain("lrn remove");
      expect(result.stdout).toContain("Remove a package from the local cache");
    });

    it("lrn search --help shows search command help", () => {
      const result = runCLI(["search", "--help"]);
      expect(result.stdout).toContain("lrn search");
      expect(result.stdout).toContain("Search across packages");
    });

    it("lrn versions --help shows versions command help", () => {
      const result = runCLI(["versions", "--help"]);
      expect(result.stdout).toContain("lrn versions");
      expect(result.stdout).toContain("List available versions");
    });

    it("shows command-specific options", () => {
      const result = runCLI(["list", "--help"]);
      expect(result.stdout).toContain("--deep");
      expect(result.stdout).toContain("--tag");
    });

    it("shows command-specific examples", () => {
      const result = runCLI(["guide", "--help"]);
      expect(result.stdout).toContain("Examples:");
    });
  });

  describe("--version flag", () => {
    it("shows version number", () => {
      const result = runCLI(["--version"]);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("shows only version (no other output)", () => {
      const result = runCLI(["--version"]);
      const lines = result.stdout.trim().split("\n");
      expect(lines).toHaveLength(1);
    });

    it("exits with code 0", () => {
      const result = runCLI(["--version"]);
      expect(result.exitCode).toBe(0);
    });
  });

  describe("-v short flag", () => {
    it("is equivalent to --version", () => {
      const versionResult = runCLI(["--version"]);
      const shortResult = runCLI(["-v"]);
      expect(shortResult.stdout).toBe(versionResult.stdout);
    });

    it("shows same version as --version", () => {
      const result = runCLI(["-v"]);
      expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe("unknown command", () => {
    // Note: In our CLI design, `lrn notacommand` is treated as `lrn <package>`
    // not as an unknown command. The "unknown command" case only applies to
    // invalid subcommands like `lrn stripe badsubcommand`.
    // These tests require package loading to be implemented first.

    it.todo("shows error message for unknown command");
    it.todo("suggests similar commands if available");
    it.todo("shows hint to use --help");
    it.todo("exits with code 1");
  });

  describe("unknown option", () => {
    it("shows error message for unknown option", () => {
      const result = runCLI(["--notanoption"]);
      expect(result.stderr).toContain("Unknown option");
    });

    it.todo("suggests similar options if available");

    it("shows hint to use --help", () => {
      const result = runCLI(["--notanoption"]);
      expect(result.stderr).toContain("--help");
    });

    it("exits with code 1", () => {
      const result = runCLI(["--notanoption"]);
      expect(result.exitCode).toBe(1);
    });
  });

  describe.todo("missing argument", () => {
    it.todo("shows error when required argument missing");
    it.todo("shows which argument is missing");
    it.todo("shows command usage");
    it.todo("exits with code 1");
  });

  describe("help formatting", () => {
    it.todo("aligns option descriptions");
    it.todo("wraps long descriptions appropriately");
    it.todo("groups related options together");
    it.todo("uses consistent formatting throughout");
  });
});
