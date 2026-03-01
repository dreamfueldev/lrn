/**
 * Update System Tests
 *
 * Tests for background version checking, update notifications, and the update command.
 */

import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  readUpdateCache,
  writeUpdateCache,
  shouldCheckForUpdate,
  compareVersions,
  formatUpdateNotification,
  showUpdateNotification,
  fetchLatestVersion,
  detectPlatform,
  CHECK_COOLDOWN_MS,
} from "../src/update.js";
import { runCLI } from "./fixtures/index.js";

// ============================================================
// compareVersions
// ============================================================

describe("compareVersions", () => {
  it("returns 'newer' when latest is higher", () => {
    expect(compareVersions("0.1.0", "0.2.0")).toBe("newer");
    expect(compareVersions("0.1.0", "1.0.0")).toBe("newer");
    expect(compareVersions("1.0.0", "1.0.1")).toBe("newer");
  });

  it("returns 'same' for equal versions", () => {
    expect(compareVersions("1.0.0", "1.0.0")).toBe("same");
    expect(compareVersions("0.1.0", "0.1.0")).toBe("same");
  });

  it("returns 'older' when latest is lower", () => {
    expect(compareVersions("0.2.0", "0.1.0")).toBe("older");
    expect(compareVersions("2.0.0", "1.0.0")).toBe("older");
  });

  it("strips v prefix", () => {
    expect(compareVersions("v0.1.0", "v0.2.0")).toBe("newer");
    expect(compareVersions("v1.0.0", "1.0.0")).toBe("same");
    expect(compareVersions("0.1.0", "v0.1.0")).toBe("same");
  });

  it("handles pre-release vs release", () => {
    // Release > pre-release of same version
    expect(compareVersions("1.0.0-beta.1", "1.0.0")).toBe("newer");
    // Pre-release < release
    expect(compareVersions("1.0.0", "1.0.0-beta.1")).toBe("older");
  });
});

// ============================================================
// formatUpdateNotification
// ============================================================

describe("formatUpdateNotification", () => {
  it("contains both versions", () => {
    const result = formatUpdateNotification("0.1.0", "0.2.0");
    expect(result).toContain("0.1.0");
    expect(result).toContain("0.2.0");
  });

  it("contains lrn update instruction", () => {
    const result = formatUpdateNotification("0.1.0", "0.2.0");
    expect(result).toContain("lrn update");
  });

  it("uses box-drawing characters", () => {
    const result = formatUpdateNotification("0.1.0", "0.2.0");
    expect(result).toContain("┌");
    expect(result).toContain("┐");
    expect(result).toContain("└");
    expect(result).toContain("┘");
    expect(result).toContain("│");
  });

  it("strips v prefix from versions", () => {
    const result = formatUpdateNotification("v0.1.0", "v0.2.0");
    expect(result).not.toContain("v0.1.0");
    expect(result).not.toContain("v0.2.0");
    expect(result).toContain("0.1.0");
    expect(result).toContain("0.2.0");
  });
});

// ============================================================
// readUpdateCache / writeUpdateCache
// ============================================================

describe("readUpdateCache / writeUpdateCache", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "lrn-test-cache-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns null when cache file is missing", () => {
    expect(readUpdateCache(tempDir)).toBeNull();
  });

  it("round-trips data correctly", () => {
    const data = { latestVersion: "0.2.0", checkedAt: "2026-01-01T00:00:00.000Z" };
    writeUpdateCache(tempDir, data);
    const result = readUpdateCache(tempDir);
    expect(result).toEqual(data);
  });

  it("returns null for corrupt JSON", () => {
    writeFileSync(join(tempDir, "update-check.json"), "not json");
    expect(readUpdateCache(tempDir)).toBeNull();
  });

  it("returns null for missing required fields", () => {
    writeFileSync(join(tempDir, "update-check.json"), JSON.stringify({ foo: "bar" }));
    expect(readUpdateCache(tempDir)).toBeNull();
  });

  it("creates cache directory if missing", () => {
    const nestedDir = join(tempDir, "nested", "dir");
    const data = { latestVersion: "0.2.0", checkedAt: new Date().toISOString() };
    writeUpdateCache(nestedDir, data);
    expect(existsSync(join(nestedDir, "update-check.json"))).toBe(true);
  });
});

// ============================================================
// shouldCheckForUpdate
// ============================================================

describe("shouldCheckForUpdate", () => {
  it("returns true when cache is null", () => {
    expect(shouldCheckForUpdate(null)).toBe(true);
  });

  it("returns false when recently checked", () => {
    const cache = {
      latestVersion: "0.2.0",
      checkedAt: new Date().toISOString(),
    };
    expect(shouldCheckForUpdate(cache)).toBe(false);
  });

  it("returns true when check is stale", () => {
    const staleTime = new Date(Date.now() - CHECK_COOLDOWN_MS - 1000).toISOString();
    const cache = {
      latestVersion: "0.2.0",
      checkedAt: staleTime,
    };
    expect(shouldCheckForUpdate(cache)).toBe(true);
  });

  it("respects custom cooldown", () => {
    const cache = {
      latestVersion: "0.2.0",
      checkedAt: new Date(Date.now() - 5000).toISOString(),
    };
    // 10s cooldown, 5s elapsed → not stale
    expect(shouldCheckForUpdate(cache, 10_000)).toBe(false);
    // 3s cooldown, 5s elapsed → stale
    expect(shouldCheckForUpdate(cache, 3_000)).toBe(true);
  });
});

// ============================================================
// showUpdateNotification
// ============================================================

describe("showUpdateNotification", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "lrn-test-notify-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns null when no cache exists", () => {
    expect(showUpdateNotification(tempDir, "0.1.0")).toBeNull();
  });

  it("returns notification string when update is available", () => {
    writeUpdateCache(tempDir, {
      latestVersion: "0.2.0",
      checkedAt: new Date().toISOString(),
    });
    const result = showUpdateNotification(tempDir, "0.1.0");
    expect(result).not.toBeNull();
    expect(result).toContain("0.1.0");
    expect(result).toContain("0.2.0");
  });

  it("returns null when already up to date", () => {
    writeUpdateCache(tempDir, {
      latestVersion: "0.1.0",
      checkedAt: new Date().toISOString(),
    });
    expect(showUpdateNotification(tempDir, "0.1.0")).toBeNull();
  });

  it("returns null when current is newer", () => {
    writeUpdateCache(tempDir, {
      latestVersion: "0.1.0",
      checkedAt: new Date().toISOString(),
    });
    expect(showUpdateNotification(tempDir, "0.2.0")).toBeNull();
  });

  it("returns null when command is 'update'", () => {
    writeUpdateCache(tempDir, {
      latestVersion: "0.2.0",
      checkedAt: new Date().toISOString(),
    });
    expect(showUpdateNotification(tempDir, "0.1.0", "update")).toBeNull();
  });
});

// ============================================================
// fetchLatestVersion
// ============================================================

describe("fetchLatestVersion", () => {
  it("returns version from GitHub API response", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ tag_name: "v0.3.0" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    ) as typeof fetch;

    try {
      const version = await fetchLatestVersion("test/repo");
      expect(version).toBe("0.3.0");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("strips v prefix from tag_name", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ tag_name: "v1.2.3" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    ) as typeof fetch;

    try {
      const version = await fetchLatestVersion("test/repo");
      expect(version).toBe("1.2.3");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns null on HTTP error", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("", { status: 404 }))
    ) as typeof fetch;

    try {
      const version = await fetchLatestVersion("test/repo");
      expect(version).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns null on network error", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.reject(new Error("network error"))
    ) as typeof fetch;

    try {
      const version = await fetchLatestVersion("test/repo");
      expect(version).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns null when tag_name is missing", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    ) as typeof fetch;

    try {
      const version = await fetchLatestVersion("test/repo");
      expect(version).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ============================================================
// detectPlatform
// ============================================================

describe("detectPlatform", () => {
  it("returns valid platform info on macOS/Linux", () => {
    const platform = detectPlatform();
    // We're running on macOS or Linux in CI/dev
    if (process.platform === "darwin" || process.platform === "linux") {
      expect(platform).not.toBeNull();
      expect(["darwin", "linux"]).toContain(platform!.os);
      expect(["x64", "arm64"]).toContain(platform!.arch);
    }
  });
});

// ============================================================
// CLI integration tests via runCLI
// ============================================================

describe("lrn update --check", () => {
  it("reports update available when newer version exists", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ tag_name: "v99.0.0" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    ) as typeof fetch;

    try {
      const result = await runCLI(["update", "--check"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Update available");
      expect(result.stdout).toContain("99.0.0");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("reports already up to date when no newer version", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ tag_name: "v0.0.1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    ) as typeof fetch;

    try {
      const result = await runCLI(["update", "--check"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Already up to date");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("lrn update", () => {
  it("exits with error when network fails", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("", { status: 500 }))
    ) as typeof fetch;

    try {
      const result = await runCLI(["update"]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Could not check for updates");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("reports already up to date when versions match", async () => {
    const originalFetch = globalThis.fetch;
    // Return current version as latest
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ tag_name: "v0.1.0" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    ) as typeof fetch;

    try {
      const result = await runCLI(["update"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Already up to date");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("lrn update --help", () => {
  it("shows update help text", async () => {
    const result = await runCLI(["update", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("lrn update");
    expect(result.stdout).toContain("--check");
  });
});

describe("lrn --help includes update", () => {
  it("lists update command in help output", async () => {
    const result = await runCLI(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("update");
  });
});
