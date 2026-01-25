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

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { LrnConfig, PackageSpec } from "./schema/index.js";
import { ConfigError } from "./errors.js";
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
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: ResolvedConfig = {
  registry: "https://registry.lrn.dev",
  cache: join(homedir(), ".lrn"),
  defaultFormat: "text",
  packages: {},
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

    // Load project config (./lrn.config.json or specified --config)
    const projectConfigPath = args.options.config || findProjectConfig();
    if (projectConfigPath) {
      const projectConfig = loadConfigFile(projectConfigPath, true);
      if (projectConfig) {
        config = mergeConfig(config, projectConfig);
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
 * Find project config file by searching upward
 */
function findProjectConfig(): string | null {
  const configName = "lrn.config.json";
  let dir = process.cwd();

  while (true) {
    const configPath = join(dir, configName);
    if (existsSync(configPath)) {
      return configPath;
    }

    const parent = join(dir, "..");
    if (parent === dir) {
      // Reached root
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
    if (["text", "json", "markdown", "summary"].includes(format)) {
      result.defaultFormat = format as ResolvedConfig["defaultFormat"];
    }
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
