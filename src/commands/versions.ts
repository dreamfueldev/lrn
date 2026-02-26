/**
 * Versions Command
 *
 * Lists all available versions of a package from the registry.
 */

import type { ParsedArgs } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import { requireToken } from "../credentials.js";
import { readCacheIndex } from "../cache-index.js";
import { RegistryClient } from "../registry.js";
import { ArgumentError } from "../errors.js";

export async function runVersions(args: ParsedArgs, config: ResolvedConfig): Promise<string> {
  const name = args.positional[0];
  if (!name) {
    throw new ArgumentError("Missing package name.", "Usage: lrn versions <package>");
  }

  const creds = requireToken(config.cache);
  const client = new RegistryClient(config.registry, creds.token);
  const info = await client.getPackage(name);

  const cacheIndex = readCacheIndex(config.cache);
  const cachedVersion = cacheIndex.packages[name]?.version;

  const versions = info.versions;

  if (args.flags.json) {
    const result = {
      package: name,
      versions: versions.map((v, i) => ({
        version: v.version,
        publishedAt: v.publishedAt,
        size: v.size,
        latest: i === 0,
        cached: v.version === cachedVersion,
      })),
    };
    return JSON.stringify(result, null, 2);
  }

  const lines: string[] = [];

  const description = info.package.description;
  lines.push(description ? `${name} — ${description}` : name);
  lines.push("");

  for (let i = 0; i < versions.length; i++) {
    const v = versions[i]!;
    const flags: string[] = [];
    if (i === 0) flags.push("(latest)");
    if (v.version === cachedVersion) flags.push("* cached");
    const suffix = flags.length > 0 ? `  ${flags.join("  ")}` : "";
    lines.push(`  ${v.version}${suffix}`);
  }

  lines.push("");
  const count = versions.length;
  lines.push(`${count} version${count !== 1 ? "s" : ""} available.`);

  return lines.join("\n");
}
