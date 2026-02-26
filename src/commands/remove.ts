/**
 * Remove Command
 *
 * Removes a package entry from the project config file.
 * Does NOT delete cached data.
 */

import type { ParsedArgs } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import {
  findProjectConfig,
  removePackageEntry,
} from "../config.js";
import { ArgumentError, ConfigError } from "../errors.js";
import { basename } from "node:path";

export function runRemove(args: ParsedArgs, _config: ResolvedConfig): string {
  const name = args.positional[0];
  if (!name) {
    throw new ArgumentError(
      "Missing package name.",
      "Usage: lrn remove <package>"
    );
  }

  const target = findProjectConfig();
  if (!target) {
    throw new ConfigError(
      "No lrn config found. Nothing to remove from."
    );
  }

  const removed = removePackageEntry(target, name);
  if (!removed) {
    throw new ArgumentError(
      `Package "${name}" is not in config.`,
      `Run 'lrn add ${name}' to add it first.`
    );
  }

  const configName =
    target.type === "package.json"
      ? "package.json"
      : basename(target.path);
  return `Removed ${name} from ${configName}`;
}
