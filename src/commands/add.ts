/**
 * Add Command
 *
 * Adds a package entry to the project config and optionally pulls it.
 */

import { existsSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { basename } from "node:path";
import type { ParsedArgs } from "../args.js";
import { parsePackageSpec } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import {
  resolveWriteTarget,
  writePackageEntry,
  getConfigDir,
} from "../config.js";
import type { PackageSpec } from "../schema/index.js";
import { ArgumentError, RegistryAuthError } from "../errors.js";
import { readCredentials } from "../credentials.js";
import { RegistryClient } from "../registry.js";
import { shouldAutoSelect, disambiguate } from "../resolve.js";
import { runPull } from "./pull.js";

export async function runAdd(
  args: ParsedArgs,
  config: ResolvedConfig
): Promise<string> {
  const raw = args.positional[0];
  if (!raw) {
    throw new ArgumentError(
      "Missing package name.",
      "Usage: lrn add <package>[@version] [--path <file>] [--url <url>]"
    );
  }

  const pathOpt = args.options.path;
  const urlOpt = args.options.url;

  // Reject --path + --url together
  if (pathOpt && urlOpt) {
    throw new ArgumentError(
      "Cannot use both --path and --url.",
      "Specify one source: --path for local files, --url for remote files."
    );
  }

  let { name, version } = parsePackageSpec(raw);

  // Fuzzy resolution: if no slash, resolve via registry
  if (!name.includes("/") && !pathOpt && !urlOpt) {
    const creds = readCredentials(config.cache);
    if (!creds) {
      throw new RegistryAuthError();
    }
    const client = new RegistryClient(creds.registry || config.registry, creds.token);
    const results = await client.resolve(name);

    if (results.length === 0) {
      throw new ArgumentError(
        `No packages match "${name}".`,
        "Check spelling or browse the registry."
      );
    }

    if (shouldAutoSelect(results)) {
      name = results[0]!.fullName;
    } else {
      const selected = await disambiguate(name, results);
      if (!selected) return "Cancelled.";
      name = selected;
    }
  }

  const target = resolveWriteTarget(args.flags.saveToPackageJson);

  // Build the package spec
  let spec: PackageSpec;
  let sourceDesc: string;

  if (pathOpt) {
    // Resolve relative to cwd
    const resolvedPath = resolvePath(process.cwd(), pathOpt);
    if (!existsSync(resolvedPath)) {
      throw new ArgumentError(
        `File not found: ${pathOpt}`,
        "Check the path and try again."
      );
    }
    spec = { path: pathOpt };
    sourceDesc = `path: ${pathOpt}`;
  } else if (urlOpt) {
    spec = { url: urlOpt };
    sourceDesc = `url: ${urlOpt}`;
  } else {
    // Registry source
    spec = version || "latest";
    sourceDesc = typeof spec === "string" ? spec : "latest";
  }

  const configName =
    target.type === "package.json"
      ? "package.json"
      : basename(target.path);

  // For registry packages, pull first, then write config on success
  if (!pathOpt && !urlOpt) {
    const pullArgs: ParsedArgs = {
      ...args,
      positional: [version ? `${name}@${version}` : name],
      command: "pull",
    };
    await runPull(pullArgs, config);
    writePackageEntry(target, name, spec);
    return `Added ${name}@${sourceDesc} to ${configName}`;
  }

  // For path/url packages, write config immediately
  writePackageEntry(target, name, spec);
  return `Added ${name} (${sourceDesc}) to ${configName}`;
}
