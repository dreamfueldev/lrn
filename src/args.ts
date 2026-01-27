/**
 * CLI Argument Parser
 *
 * Parses process.argv into a structured format for command handling.
 */

export interface ParsedArgs {
  /** The command to run (e.g., "list", "show", "search") */
  command: string | undefined;

  /** Positional arguments after the command */
  positional: string[];

  /** Flag-style options */
  flags: {
    help: boolean;
    version: boolean;
    verbose: boolean;
    quiet: boolean;
    json: boolean;
    full: boolean;
    summary: boolean;
    deep: boolean;
    deprecated: boolean;
    noConfig: boolean;
  };

  /** Value options */
  options: {
    format: string | undefined;
    tag: string[];
    kind: string | undefined;
    config: string | undefined;
    registry: string | undefined;
    out: string | undefined;
  };

  /** Package name (with optional @version) */
  package: string | undefined;

  /** Package version (extracted from package@version) */
  packageVersion: string | undefined;

  /** Raw argv for debugging */
  raw: string[];
}

/**
 * Parse command-line arguments
 */
export function parseArgs(argv: string[]): ParsedArgs {
  // Skip node and script path
  const args = argv.slice(2);

  const result: ParsedArgs = {
    command: undefined,
    positional: [],
    flags: {
      help: false,
      version: false,
      verbose: false,
      quiet: false,
      json: false,
      full: false,
      summary: false,
      deep: false,
      deprecated: false,
      noConfig: false,
    },
    options: {
      format: undefined,
      tag: [],
      kind: undefined,
      config: undefined,
      registry: undefined,
      out: undefined,
    },
    package: undefined,
    packageVersion: undefined,
    raw: args,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    // Flags (boolean options)
    if (arg === "--help" || arg === "-h") {
      result.flags.help = true;
      i++;
      continue;
    }
    if (arg === "--version" || arg === "-v") {
      result.flags.version = true;
      i++;
      continue;
    }
    if (arg === "--verbose") {
      result.flags.verbose = true;
      i++;
      continue;
    }
    if (arg === "--quiet" || arg === "-q") {
      result.flags.quiet = true;
      i++;
      continue;
    }
    if (arg === "--json") {
      result.flags.json = true;
      result.options.format = "json";
      i++;
      continue;
    }
    if (arg === "--full") {
      result.flags.full = true;
      i++;
      continue;
    }
    if (arg === "--summary") {
      result.flags.summary = true;
      result.options.format = "summary";
      i++;
      continue;
    }
    if (arg === "--deep") {
      result.flags.deep = true;
      i++;
      continue;
    }
    if (arg === "--deprecated") {
      result.flags.deprecated = true;
      i++;
      continue;
    }
    if (arg === "--no-config") {
      result.flags.noConfig = true;
      i++;
      continue;
    }

    // Value options
    if (arg === "--format" && i + 1 < args.length) {
      result.options.format = args[i + 1];
      i += 2;
      continue;
    }
    if (arg === "--tag" && i + 1 < args.length) {
      result.options.tag.push(args[i + 1]!);
      i += 2;
      continue;
    }
    if (arg === "--kind" && i + 1 < args.length) {
      result.options.kind = args[i + 1];
      i += 2;
      continue;
    }
    if (arg === "--config" && i + 1 < args.length) {
      result.options.config = args[i + 1];
      i += 2;
      continue;
    }
    if (arg === "--registry" && i + 1 < args.length) {
      result.options.registry = args[i + 1];
      i += 2;
      continue;
    }
    if ((arg === "--out" || arg === "-o") && i + 1 < args.length) {
      result.options.out = args[i + 1];
      i += 2;
      continue;
    }

    // Unknown flag
    if (arg!.startsWith("-")) {
      // Store it in positional for error handling
      result.positional.push(arg!);
      i++;
      continue;
    }

    // Positional argument
    result.positional.push(arg!);
    i++;
  }

  // Determine command and package from positional args
  interpretPositionalArgs(result);

  return result;
}

/**
 * Interpret positional arguments to determine command, package, and member path.
 *
 * Examples:
 *   []                        → command: undefined (list packages)
 *   ["sync"]                  → command: "sync"
 *   ["search", "query"]       → command: "search", positional: ["query"]
 *   ["stripe"]                → package: "stripe", command: undefined (show package)
 *   ["stripe", "list"]        → package: "stripe", command: "list"
 *   ["stripe", "charges.create"] → package: "stripe", command: "show", positional: ["charges.create"]
 *   ["stripe", "guide", "webhooks"] → package: "stripe", command: "guide", positional: ["webhooks"]
 */
function interpretPositionalArgs(result: ParsedArgs): void {
  const pos = result.positional;

  // No positional args - list packages
  if (pos.length === 0) {
    return;
  }

  const first = pos[0]!;

  // Global commands (no package context)
  const globalCommands = ["sync", "add", "remove", "versions", "search", "parse", "format"];
  if (globalCommands.includes(first)) {
    result.command = first;
    result.positional = pos.slice(1);
    return;
  }

  // First arg is a package name (possibly with @version)
  const { name, version } = parsePackageSpec(first);
  result.package = name;
  result.packageVersion = version;
  result.positional = pos.slice(1);

  // No more args - show package overview
  if (result.positional.length === 0) {
    return;
  }

  const second = result.positional[0]!;

  // Package subcommands
  const packageCommands = [
    "list",
    "guides",
    "types",
    "tags",
    "guide",
    "type",
    "search",
  ];
  if (packageCommands.includes(second)) {
    result.command = second;
    result.positional = result.positional.slice(1);
    return;
  }

  // Otherwise, second arg is a member path
  result.command = "show";
  // positional[0] is already the member path
}

/**
 * Parse a package spec like "stripe" or "stripe@2024.1.0" or "@org/pkg@1.0.0"
 */
function parsePackageSpec(spec: string): { name: string; version?: string } {
  // Handle scoped packages: @org/name@version
  if (spec.startsWith("@")) {
    const lastAt = spec.lastIndexOf("@");
    if (lastAt > 0) {
      // Has version: @org/name@version
      return {
        name: spec.slice(0, lastAt),
        version: spec.slice(lastAt + 1),
      };
    }
    // No version: @org/name
    return { name: spec };
  }

  // Non-scoped: name or name@version
  const atIndex = spec.indexOf("@");
  if (atIndex === -1) {
    return { name: spec };
  }
  return {
    name: spec.slice(0, atIndex),
    version: spec.slice(atIndex + 1),
  };
}

/**
 * Check if an unknown flag was passed
 * Must be called on the raw args before interpretation
 */
export function getUnknownFlags(args: ParsedArgs): string[] {
  // Check raw args for any flags that weren't recognized
  const knownFlags = new Set([
    "--help",
    "-h",
    "--version",
    "-v",
    "--verbose",
    "--quiet",
    "-q",
    "--json",
    "--full",
    "--summary",
    "--deep",
    "--deprecated",
    "--no-config",
    "--format",
    "--tag",
    "--kind",
    "--config",
    "--registry",
    "--out",
    "-o",
  ]);

  const unknownFlags: string[] = [];
  let i = 0;
  while (i < args.raw.length) {
    const arg = args.raw[i]!;
    if (arg.startsWith("-")) {
      // Check if it's a known flag
      const flagBase = arg.split("=")[0]!; // Handle --flag=value style
      if (!knownFlags.has(flagBase)) {
        unknownFlags.push(arg);
      }
      // Skip value for flags that take values
      if (
        (arg === "--format" ||
          arg === "--tag" ||
          arg === "--kind" ||
          arg === "--config" ||
          arg === "--registry" ||
          arg === "--out" ||
          arg === "-o") &&
        i + 1 < args.raw.length
      ) {
        i++;
      }
    }
    i++;
  }
  return unknownFlags;
}
