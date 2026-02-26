import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTestCache, runCLI } from "./fixtures/index.js";

/**
 * Helper: run CLI with a given cwd and cache dir.
 */
function run(
  args: string[],
  opts: { cwd: string; cacheDir: string; env?: Record<string, string> }
) {
  const savedCwd = process.cwd();
  process.chdir(opts.cwd);
  return runCLI(args, {
    env: { LRN_CACHE: opts.cacheDir, ...opts.env },
  }).finally(() => {
    process.chdir(savedCwd);
  });
}

describe("Package Management", () => {
  let cacheDir: string;
  let cleanupCache: () => void;
  let tempDir: string;

  beforeEach(() => {
    const cache = createTestCache([]);
    cacheDir = cache.cacheDir;
    cleanupCache = cache.cleanup;
    tempDir = mkdtempSync(join(tmpdir(), "lrn-pkgmgmt-"));
  });

  afterEach(() => {
    cleanupCache();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ─── Config Loading ───────────────────────────────────────────────

  describe("config loading from package.json", () => {
    it("loads config from package.json 'lrn' key", async () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({
          name: "test-project",
          lrn: { packages: { "my-pkg": { path: "./test.lrn.json" } } },
        })
      );
      // Write a dummy .lrn.json so package.json config is valid
      const result = await run(["sync"], { cwd: tempDir, cacheDir });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Syncing 1 package");
    });

    it("prefers lrn.config.json over package.json", async () => {
      // Create dummy files for path entries
      writeFileSync(join(tempDir, "config-pkg.lrn.json"), "{}");
      writeFileSync(join(tempDir, "pkgjson-pkg.lrn.json"), "{}");

      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({
          name: "test",
          lrn: { packages: { "pkg-from-packagejson": { path: "./pkgjson-pkg.lrn.json" } } },
        })
      );
      writeFileSync(
        join(tempDir, "lrn.config.json"),
        JSON.stringify({ packages: { "pkg-from-config": { path: "./config-pkg.lrn.json" } } })
      );
      const result = await run(["sync"], { cwd: tempDir, cacheDir });
      // Should use lrn.config.json (which has pkg-from-config, not pkg-from-packagejson)
      expect(result.stdout).toContain("pkg-from-config");
      expect(result.stdout).not.toContain("pkg-from-packagejson");
    });

    it("ignores package.json without 'lrn' key", async () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({ name: "plain-project" })
      );
      const result = await run(["sync"], { cwd: tempDir, cacheDir });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("No packages configured");
    });
  });

  // ─── lrn add ──────────────────────────────────────────────────────

  describe("lrn add", () => {
    it("requires package name", async () => {
      const result = await run(["add"], { cwd: tempDir, cacheDir });
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Missing package name");
    });

    it("creates lrn.config.json if missing and adds entry", async () => {
      // Create a dummy .lrn.json so --path works
      const dummyPath = join(tempDir, "test.lrn.json");
      writeFileSync(dummyPath, JSON.stringify({ name: "test" }));

      const result = await run(
        ["add", "my-pkg", "--path", "./test.lrn.json"],
        { cwd: tempDir, cacheDir }
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Added my-pkg");
      expect(result.stdout).toContain("lrn.config.json");

      // Verify file was created
      const configPath = join(tempDir, "lrn.config.json");
      expect(existsSync(configPath)).toBe(true);
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.packages["my-pkg"]).toEqual({
        path: "./test.lrn.json",
      });
    });

    it("--path with existing file adds path spec", async () => {
      const dummyPath = join(tempDir, "docs.lrn.json");
      writeFileSync(dummyPath, "{}");

      const result = await run(
        ["add", "sdk", "--path", "./docs.lrn.json"],
        { cwd: tempDir, cacheDir }
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("path: ./docs.lrn.json");
    });

    it("--path with missing file errors", async () => {
      const result = await run(
        ["add", "sdk", "--path", "./nonexistent.lrn.json"],
        { cwd: tempDir, cacheDir }
      );
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("File not found");
    });

    it("--url adds URL spec", async () => {
      const result = await run(
        ["add", "api", "--url", "https://example.com/api.lrn.json"],
        { cwd: tempDir, cacheDir }
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("url: https://example.com/api.lrn.json");

      const config = JSON.parse(
        readFileSync(join(tempDir, "lrn.config.json"), "utf-8")
      );
      expect(config.packages.api).toEqual({
        url: "https://example.com/api.lrn.json",
      });
    });

    it("--path + --url together errors", async () => {
      const result = await run(
        [
          "add",
          "pkg",
          "--path",
          "./foo.json",
          "--url",
          "https://example.com/foo.json",
        ],
        { cwd: tempDir, cacheDir }
      );
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Cannot use both --path and --url");
    });

    it("--save-to-package-json writes to package.json", async () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({ name: "test" })
      );
      const dummyPath = join(tempDir, "test.lrn.json");
      writeFileSync(dummyPath, "{}");

      const result = await run(
        [
          "add",
          "my-lib",
          "--path",
          "./test.lrn.json",
          "--save-to-package-json",
        ],
        { cwd: tempDir, cacheDir }
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("package.json");

      const pkg = JSON.parse(
        readFileSync(join(tempDir, "package.json"), "utf-8")
      );
      expect(pkg.lrn.packages["my-lib"]).toEqual({
        path: "./test.lrn.json",
      });
    });

    it("package@version stores version spec", async () => {
      // This will fail the pull (no registry running) but should still store config
      const result = await run(["add", "stripe@^2024.1.0"], {
        cwd: tempDir,
        cacheDir,
      });
      // Pull will fail (no auth), but config entry should persist
      // The exitCode may be 0 (graceful failure) with a warning
      const config = JSON.parse(
        readFileSync(join(tempDir, "lrn.config.json"), "utf-8")
      );
      expect(config.packages.stripe).toBe("^2024.1.0");
    });
  });

  // ─── lrn remove ───────────────────────────────────────────────────

  describe("lrn remove", () => {
    it("requires package name", async () => {
      const result = await run(["remove"], { cwd: tempDir, cacheDir });
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Missing package name");
    });

    it("removes from lrn.config.json", async () => {
      writeFileSync(
        join(tempDir, "lrn.config.json"),
        JSON.stringify({ packages: { stripe: "latest", react: "latest" } })
      );

      const result = await run(["remove", "stripe"], {
        cwd: tempDir,
        cacheDir,
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Removed stripe");

      const config = JSON.parse(
        readFileSync(join(tempDir, "lrn.config.json"), "utf-8")
      );
      expect(config.packages.stripe).toBeUndefined();
      expect(config.packages.react).toBe("latest");
    });

    it("removes from package.json 'lrn' key", async () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({
          name: "test",
          lrn: { packages: { react: "latest" } },
        })
      );

      const result = await run(["remove", "react"], {
        cwd: tempDir,
        cacheDir,
      });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Removed react");

      const pkg = JSON.parse(
        readFileSync(join(tempDir, "package.json"), "utf-8")
      );
      expect(pkg.lrn.packages.react).toBeUndefined();
    });

    it("errors if no config found", async () => {
      const result = await run(["remove", "stripe"], {
        cwd: tempDir,
        cacheDir,
      });
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("No lrn config found");
    });

    it("errors if package not in config", async () => {
      writeFileSync(
        join(tempDir, "lrn.config.json"),
        JSON.stringify({ packages: { react: "latest" } })
      );

      const result = await run(["remove", "stripe"], {
        cwd: tempDir,
        cacheDir,
      });
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("not in config");
    });
  });

  // ─── lrn sync ─────────────────────────────────────────────────────

  describe("lrn sync", () => {
    it("empty config reports no packages", async () => {
      const result = await run(["sync"], { cwd: tempDir, cacheDir });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("No packages configured");
    });

    it("path entries: verifies file and reports loaded", async () => {
      const dummyPath = join(tempDir, "sdk.lrn.json");
      writeFileSync(dummyPath, JSON.stringify({ name: "sdk" }));

      writeFileSync(
        join(tempDir, "lrn.config.json"),
        JSON.stringify({
          packages: { sdk: { path: "./sdk.lrn.json" } },
        })
      );

      const result = await run(["sync"], { cwd: tempDir, cacheDir });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("sdk");
      expect(result.stdout).toContain("loaded from ./sdk.lrn.json");
      expect(result.stdout).toContain("1 package ready");
    });

    it("missing path reports error per entry", async () => {
      writeFileSync(
        join(tempDir, "lrn.config.json"),
        JSON.stringify({
          packages: { sdk: { path: "./nonexistent.lrn.json" } },
        })
      );

      const result = await run(["sync"], { cwd: tempDir, cacheDir });
      expect(result.exitCode).toBe(0); // sync itself succeeds, reports errors per entry
      expect(result.stdout).toContain("File not found");
      expect(result.stdout).toContain("1 error");
    });

    it("works without auth when only path entries", async () => {
      const dummyPath = join(tempDir, "local.lrn.json");
      writeFileSync(dummyPath, "{}");

      writeFileSync(
        join(tempDir, "lrn.config.json"),
        JSON.stringify({
          packages: { local: { path: "./local.lrn.json" } },
        })
      );

      // No credentials set up — should still work for path entries
      const result = await run(["sync"], { cwd: tempDir, cacheDir });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("1 package ready");
    });

    it("multiple entries with mixed results", async () => {
      const file1 = join(tempDir, "a.lrn.json");
      writeFileSync(file1, "{}");

      writeFileSync(
        join(tempDir, "lrn.config.json"),
        JSON.stringify({
          packages: {
            "pkg-a": { path: "./a.lrn.json" },
            "pkg-b": { path: "./missing.lrn.json" },
          },
        })
      );

      const result = await run(["sync"], { cwd: tempDir, cacheDir });
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Syncing 2 packages");
      expect(result.stdout).toContain("pkg-a");
      expect(result.stdout).toContain("pkg-b");
      expect(result.stdout).toContain("1 package ready");
      expect(result.stdout).toContain("1 error");
    });
  });

  // ─── Help text ────────────────────────────────────────────────────

  describe("help text", () => {
    it("add --help shows --path and --url options", async () => {
      const result = await run(["add", "--help"], {
        cwd: tempDir,
        cacheDir,
      });
      expect(result.stdout).toContain("--path");
      expect(result.stdout).toContain("--url");
      expect(result.stdout).toContain("--save-to-package-json");
    });

    it("remove --help mentions cached data not deleted", async () => {
      const result = await run(["remove", "--help"], {
        cwd: tempDir,
        cacheDir,
      });
      expect(result.stdout).toContain("Does NOT delete cached data");
    });

    it("sync --help mentions --force flag", async () => {
      const result = await run(["sync", "--help"], {
        cwd: tempDir,
        cacheDir,
      });
      expect(result.stdout).toContain("--force");
    });
  });
});
