/**
 * Sync Command
 *
 * Pulls all packages listed in config that are missing or outdated.
 */

import { existsSync } from "node:fs";
import { resolve, join } from "node:path";
import type { ParsedArgs } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import {
  findProjectConfig,
  getConfigDir,
} from "../config.js";
import type { PackageSpec, PackageSpecObject } from "../schema/index.js";
import { requireToken } from "../credentials.js";
import { runPull } from "./pull.js";

interface SyncResult {
  name: string;
  status: "loaded" | "pulled" | "cached" | "error";
  detail: string;
}

export async function runSync(
  args: ParsedArgs,
  config: ResolvedConfig
): Promise<string> {
  const packages = config.packages;
  const entries = Object.entries(packages);

  if (entries.length === 0) {
    return "No packages configured. Run 'lrn add <package>' to add one.";
  }

  // Determine config dir for resolving relative paths
  const configLocation = findProjectConfig();
  const configDir = configLocation ? getConfigDir(configLocation) : process.cwd();

  // Check if any entries need registry access
  const hasRegistryPackages = entries.some(([, spec]) => {
    if (typeof spec === "string") return true;
    const obj = spec as PackageSpecObject;
    return !obj.path && !obj.url;
  });

  if (hasRegistryPackages) {
    requireToken(config.cache);
  }

  const results: SyncResult[] = [];

  for (const [name, spec] of entries) {
    const result = await syncEntry(name, spec, args, config, configDir);
    results.push(result);
  }

  return formatSyncResults(results);
}

async function syncEntry(
  name: string,
  spec: PackageSpec,
  args: ParsedArgs,
  config: ResolvedConfig,
  configDir: string
): Promise<SyncResult> {
  // Path source — load from local filesystem
  if (typeof spec === "object" && spec.path) {
    const resolvedPath = resolve(configDir, spec.path);
    if (!existsSync(resolvedPath)) {
      return {
        name,
        status: "error",
        detail: `File not found: ${spec.path}`,
      };
    }
    return {
      name,
      status: "loaded",
      detail: `loaded from ${spec.path}`,
    };
  }

  // URL source — fetch if not cached or --force
  if (typeof spec === "object" && spec.url) {
    const cachedPath = join(config.cache, "packages", name);
    if (existsSync(cachedPath) && !args.flags.force) {
      return { name, status: "cached", detail: "cached" };
    }
    // URL fetch not implemented yet for sync
    return { name, status: "error", detail: "URL sync not yet implemented" };
  }

  // Registry source — pull via runPull
  const version = typeof spec === "string" ? spec : spec.version;
  const versionSuffix = version && version !== "latest" ? `@${version}` : "";

  // Check cache first
  const packagesDir = join(config.cache, "packages", name);
  if (existsSync(packagesDir) && !args.flags.force) {
    return { name, status: "cached", detail: "cached" };
  }

  try {
    const pullArgs: ParsedArgs = {
      ...args,
      positional: [`${name}${versionSuffix}`],
      command: "pull",
    };
    const pullResult = await runPull(pullArgs, config);
    return { name, status: "pulled", detail: pullResult };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { name, status: "error", detail: msg };
  }
}

function formatSyncResults(results: SyncResult[]): string {
  const lines: string[] = [];
  lines.push(`Syncing ${results.length} package${results.length === 1 ? "" : "s"}...`);

  for (const r of results) {
    const icon =
      r.status === "loaded" ? "+" :
      r.status === "pulled" ? "+" :
      r.status === "cached" ? "=" :
      "!";
    lines.push(`  ${icon} ${r.name}: ${r.detail}`);
  }

  const ok = results.filter((r) => r.status !== "error").length;
  const errors = results.filter((r) => r.status === "error").length;

  if (errors > 0) {
    lines.push(`Done. ${ok} package${ok === 1 ? "" : "s"} ready, ${errors} error${errors === 1 ? "" : "s"}.`);
  } else {
    lines.push(`Done. ${ok} package${ok === 1 ? "" : "s"} ready.`);
  }

  return lines.join("\n");
}
