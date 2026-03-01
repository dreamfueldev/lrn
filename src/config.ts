/**
 * Configuration System
 *
 * Handles loading and merging configuration from multiple sources:
 * 1. Command-line flags (highest priority)
 * 2. Environment variables
 * 3. Project config (./lrn.config.json)
 * 4. User config (~/.lrn/config.json)
 * 5. Built-in defaults (lowest priority)
 */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import type { LrnConfig, PackageSpec } from "./schema/index.js";
import { ConfigError, ArgumentError } from "./errors.js";
import type { ParsedArgs } from "./args.js";

/**
 * Resolved configuration with all values populated
 */
export interface ResolvedConfig {
  /** Registry URL */
  registry: string;
  /** Cache directory (expanded) */
  cache: string;
  /** Default output format */
  defaultFormat: "text" | "json" | "markdown" | "summary";
  /** Package specifications */
  packages: Record<string, PackageSpec>;
  /** Enable automatic update checks */
  updateCheck: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: ResolvedConfig = {
  registry: "https://api.uselrn.dev",
  cache: join(homedir(), ".lrn"),
  defaultFormat: "text",
  packages: {},
  updateCheck: true,
};

/**
 * Load and merge configuration from all sources
 */
export function loadConfig(args: ParsedArgs): ResolvedConfig {
  // Start with defaults
  let config: ResolvedConfig = { ...DEFAULT_CONFIG };

  // Skip config files if --no-config is set
  if (!args.flags.noConfig) {
    // Load user config (~/.lrn/config.json)
    const userConfigPath = join(homedir(), ".lrn", "config.json");
    const userConfig = loadConfigFile(userConfigPath);
    if (userConfig) {
      config = mergeConfig(config, userConfig);
    }

    // Load project config (./lrn.config.json, package.json "lrn", or --config)
    if (args.options.config) {
      const projectConfig = loadConfigFile(args.options.config, true);
      if (projectConfig) {
        config = mergeConfig(config, projectConfig);
      }
    } else {
      const location = findProjectConfig();
      if (location) {
        const projectConfig =
          location.type === "package.json"
            ? loadConfigFromPackageJson(location.path)
            : loadConfigFile(location.path, true);
        if (projectConfig) {
          config = mergeConfig(config, projectConfig);
        }
      }
    }
  }

  // Apply environment variables
  config = applyEnvVars(config);

  // Apply command-line flags (highest priority)
  config = applyArgs(config, args);

  return config;
}

/**
 * Load a config file, optionally throwing on error
 */
function loadConfigFile(path: string, throwOnError: boolean = false): LrnConfig | null {
  if (!existsSync(path)) {
    if (throwOnError) {
      throw new ConfigError(`Config file not found: ${path}`, path);
    }
    return null;
  }

  try {
    const content = readFileSync(path, "utf-8");
    const config = JSON.parse(content) as LrnConfig;
    validateConfig(config, path);
    return config;
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    if (error instanceof SyntaxError) {
      throw new ConfigError(`Invalid JSON in config file: ${path}`, path);
    }
    if (throwOnError) {
      throw new ConfigError(`Failed to read config file: ${path}`, path);
    }
    return null;
  }
}

/**
 * Validate config structure
 */
function validateConfig(config: LrnConfig, path: string): void {
  // Validate defaultFormat if present
  if (config.defaultFormat !== undefined) {
    const validFormats = ["text", "json", "markdown", "summary"];
    if (!validFormats.includes(config.defaultFormat)) {
      throw new ConfigError(
        `Invalid defaultFormat "${config.defaultFormat}" in ${path}. Must be one of: ${validFormats.join(", ")}`,
        path
      );
    }
  }

  // Validate packages if present
  if (config.packages) {
    for (const [name, spec] of Object.entries(config.packages)) {
      if (typeof spec === "string") {
        // Semver string - valid
        continue;
      }
      if (typeof spec === "object" && spec !== null) {
        // Object spec - check for valid keys
        const validKeys = ["version", "path", "url"];
        const hasValidKey = validKeys.some((key) => key in spec);
        if (!hasValidKey) {
          throw new ConfigError(
            `Invalid package specification for "${name}" in ${path}. Must have version, path, or url.`,
            path
          );
        }
        continue;
      }
      throw new ConfigError(
        `Invalid package specification for "${name}" in ${path}`,
        path
      );
    }
  }
}

/**
 * Location of a discovered project config
 */
export interface ProjectConfigLocation {
  path: string;
  type: "file" | "package.json";
}

/**
 * Find project config file by searching upward.
 * Checks lrn.config.json first, then package.json "lrn" key, at each level.
 */
export function findProjectConfig(): ProjectConfigLocation | null {
  let dir = process.cwd();

  while (true) {
    // Prefer lrn.config.json
    const configPath = join(dir, "lrn.config.json");
    if (existsSync(configPath)) {
      // Warn if package.json also has "lrn" key in same dir
      const pkgPath = join(dir, "package.json");
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
          if (pkg.lrn) {
            process.stderr.write(
              `Warning: Both lrn.config.json and package.json "lrn" key found in ${dir}. Using lrn.config.json.\n`
            );
          }
        } catch {
          // Ignore parse errors in package.json
        }
      }
      return { path: configPath, type: "file" };
    }

    // Fall back to package.json "lrn" key
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.lrn) {
          return { path: pkgPath, type: "package.json" };
        }
      } catch {
        // Ignore parse errors — keep searching
      }
    }

    const parent = join(dir, "..");
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return null;
}

/**
 * Merge two configs, with source overriding base
 */
function mergeConfig(base: ResolvedConfig, source: LrnConfig): ResolvedConfig {
  return {
    registry: source.registry || base.registry,
    cache: expandPath(source.cache) || base.cache,
    defaultFormat: (source.defaultFormat as ResolvedConfig["defaultFormat"]) || base.defaultFormat,
    packages: {
      ...base.packages,
      ...source.packages,
    },
    updateCheck: source.updateCheck !== undefined ? source.updateCheck : base.updateCheck,
  };
}

/**
 * Apply environment variables to config
 */
function applyEnvVars(config: ResolvedConfig): ResolvedConfig {
  const result = { ...config };

  if (process.env.LRN_REGISTRY) {
    result.registry = process.env.LRN_REGISTRY;
  }

  if (process.env.LRN_CACHE) {
    result.cache = expandPath(process.env.LRN_CACHE) || result.cache;
  }

  if (process.env.LRN_FORMAT) {
    const format = process.env.LRN_FORMAT;
    if (["text", "json", "markdown", "summary"].includes(format)) {
      result.defaultFormat = format as ResolvedConfig["defaultFormat"];
    }
  }

  if (process.env.LRN_NO_UPDATE_CHECK === "1") {
    result.updateCheck = false;
  }

  return result;
}

/**
 * Apply command-line arguments to config
 */
function applyArgs(config: ResolvedConfig, args: ParsedArgs): ResolvedConfig {
  const result = { ...config };

  if (args.options.registry) {
    result.registry = args.options.registry;
  }

  if (args.options.format) {
    const format = args.options.format;
    const validFormats = ["text", "json", "markdown", "summary"];
    if (!validFormats.includes(format)) {
      throw new ArgumentError(
        `Invalid format: ${format}. Must be one of: ${validFormats.join(", ")}`
      );
    }
    result.defaultFormat = format as ResolvedConfig["defaultFormat"];
  }

  return result;
}

/**
 * Expand ~ in paths to home directory
 */
function expandPath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("~")) {
    return join(homedir(), path.slice(1));
  }
  return path;
}

/**
 * Load config from the "lrn" key of a package.json file
 */
function loadConfigFromPackageJson(
  pkgPath: string,
  throwOnError: boolean = true
): LrnConfig | null {
  try {
    const content = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(content);
    if (!pkg.lrn || typeof pkg.lrn !== "object") {
      return null;
    }
    const config = pkg.lrn as LrnConfig;
    validateConfig(config, pkgPath);
    return config;
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }
    if (throwOnError) {
      throw new ConfigError(`Failed to read package.json: ${pkgPath}`, pkgPath);
    }
    return null;
  }
}

/**
 * Find or create a config location for writing.
 * Searches for existing config; creates lrn.config.json in cwd if none found.
 */
export function resolveWriteTarget(
  saveToPackageJson: boolean
): ProjectConfigLocation {
  const existing = findProjectConfig();

  if (saveToPackageJson) {
    // Write to package.json "lrn" key
    const pkgPath = join(process.cwd(), "package.json");
    if (existing && existing.type === "package.json") {
      return existing;
    }
    // Use cwd package.json (must exist)
    if (existsSync(pkgPath)) {
      return { path: pkgPath, type: "package.json" };
    }
    throw new ConfigError(
      "No package.json found in current directory.",
      pkgPath
    );
  }

  // Use existing config if found
  if (existing) {
    return existing;
  }

  // Create lrn.config.json in cwd
  return { path: join(process.cwd(), "lrn.config.json"), type: "file" };
}

/**
 * Add or update a package entry in a config file.
 */
export function writePackageEntry(
  target: ProjectConfigLocation,
  name: string,
  spec: PackageSpec
): void {
  if (target.type === "package.json") {
    const content = readFileSync(target.path, "utf-8");
    const pkg = JSON.parse(content);
    if (!pkg.lrn) {
      pkg.lrn = {};
    }
    if (!pkg.lrn.packages) {
      pkg.lrn.packages = {};
    }
    pkg.lrn.packages[name] = spec;
    writeFileSync(target.path, JSON.stringify(pkg, null, 2) + "\n");
  } else {
    let config: LrnConfig = {};
    if (existsSync(target.path)) {
      config = JSON.parse(readFileSync(target.path, "utf-8"));
    }
    if (!config.packages) {
      config.packages = {};
    }
    config.packages[name] = spec;
    writeFileSync(target.path, JSON.stringify(config, null, 2) + "\n");
  }
}

/**
 * Remove a package entry from a config file.
 * Returns true if the entry was found and removed, false if not found.
 */
export function removePackageEntry(
  target: ProjectConfigLocation,
  name: string
): boolean {
  if (target.type === "package.json") {
    const content = readFileSync(target.path, "utf-8");
    const pkg = JSON.parse(content);
    if (!pkg.lrn?.packages || !(name in pkg.lrn.packages)) {
      return false;
    }
    delete pkg.lrn.packages[name];
    writeFileSync(target.path, JSON.stringify(pkg, null, 2) + "\n");
    return true;
  } else {
    const content = readFileSync(target.path, "utf-8");
    const config = JSON.parse(content) as LrnConfig;
    if (!config.packages || !(name in config.packages)) {
      return false;
    }
    delete config.packages[name];
    writeFileSync(target.path, JSON.stringify(config, null, 2) + "\n");
    return true;
  }
}

/**
 * Get the directory containing the config file (for resolving relative paths).
 */
export function getConfigDir(target: ProjectConfigLocation): string {
  return dirname(target.path);
}

/**
 * Check if NO_COLOR environment variable is set
 */
export function isColorDisabled(): boolean {
  return process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== "";
}

/**
 * Get the path to the cache directory
 */
export function getCacheDir(config: ResolvedConfig): string {
  return config.cache;
}

/**
 * Get the path to the packages subdirectory in cache
 */
export function getPackagesDir(config: ResolvedConfig): string {
  return join(config.cache, "packages");
}
