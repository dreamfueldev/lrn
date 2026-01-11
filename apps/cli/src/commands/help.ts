/**
 * Help Command
 *
 * Handles --help, -h, --version, -v flags and help for subcommands.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Get package version from package.json
 */
export function getVersion(): string {
  try {
    // Try multiple locations since we might be running from src or dist
    const possiblePaths = [
      join(__dirname, "../../package.json"),
      join(__dirname, "../package.json"),
      join(__dirname, "../../../package.json"),
    ];
    for (const pkgPath of possiblePaths) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.name === "@lrn/cli" && pkg.version) {
          return pkg.version;
        }
      } catch {
        // Try next path
      }
    }
    return "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Print version and exit
 */
export function printVersion(): void {
  console.log(getVersion());
}

/**
 * Print main help message
 */
export function printHelp(): void {
  console.log(`
lrn - learn and query programming interfaces

Usage: lrn [command] [options]
       lrn <package> [command] [options]
       lrn <package> <member.path> [options]

Discovery Commands:
  (no command)        List all cached packages
  sync                Sync packages for project dependencies
  add <package>       Add a package to the local cache
  remove <package>    Remove a package from the local cache
  versions <package>  List available versions for a package

Package Commands:
  <package>                   Show package overview
  <package> list              List all members
  <package> list --deep       List all members recursively
  <package> guides            List all guides
  <package> types             List all type definitions
  <package> tags              List all tags

Member Commands:
  <package> <member.path>               Show member details
  <package> <member.path> --summary     Show only summary
  <package> <member.path> --signature   Show only signature
  <package> <member.path> --examples    Show only examples
  <package> <member.path> --parameters  Show only parameters

Guide Commands:
  <package> guide <slug>                Show guide overview (TOC)
  <package> guide <slug> --full         Show full guide content
  <package> guide <slug>.<section>      Show specific section

Type Commands:
  <package> type <name>       Show type/schema definition

Search Commands:
  search <query>              Search across all packages
  <package> search <query>    Search within a package

Options:
  --format <format>   Output format: text, json, markdown, summary
  --json              Shorthand for --format json
  --summary           Shorthand for --format summary
  --full              Show complete details

Filtering:
  --tag <tag>         Filter by tag (can be used multiple times)
  --kind <kind>       Filter by kind: function, method, class, namespace, etc.
  --deprecated        Include deprecated members

Configuration:
  --config <path>     Use specific config file
  --no-config         Ignore config files
  --registry <url>    Override registry URL

General:
  --help, -h          Show this help message
  --version, -v       Show version
  --verbose           Show detailed output
  --quiet, -q         Suppress non-essential output

Examples:
  lrn                           List cached packages
  lrn stripe                    Show Stripe API overview
  lrn stripe list               List Stripe endpoints
  lrn stripe charges.create     Show endpoint details
  lrn stripe guide webhooks     Show webhooks guide
  lrn search "authentication"   Search all packages
  lrn stripe list --json        Output as JSON

Version: ${getVersion()}
`);
}

/**
 * Help text for specific commands
 */
const commandHelp: Record<string, string> = {
  sync: `
lrn sync - Sync packages for project dependencies

Usage: lrn sync [options]

Reads package specifications from lrn.config.json or package.json
and downloads documentation from the registry.

Options:
  --config <path>     Use specific config file
  --registry <url>    Override registry URL
  --quiet, -q         Suppress progress output

Examples:
  lrn sync                          Sync from lrn.config.json
  lrn sync --config ./my-config.json  Use custom config
`,

  add: `
lrn add - Add a package to the local cache

Usage: lrn add <package>[@<version>] [options]

Downloads package documentation and adds it to lrn.config.json.

Arguments:
  <package>           Package name (e.g., stripe, react)
  @<version>          Optional version (semver range supported)

Options:
  --registry <url>    Override registry URL

Examples:
  lrn add stripe                    Add latest version
  lrn add stripe@2024.1.0           Add specific version
  lrn add stripe@^2024.0.0          Add semver range
`,

  remove: `
lrn remove - Remove a package from the local cache

Usage: lrn remove <package> [options]

Removes package documentation from cache and lrn.config.json.

Arguments:
  <package>           Package name to remove

Examples:
  lrn remove stripe
`,

  versions: `
lrn versions - List available versions for a package

Usage: lrn versions <package> [options]

Lists all available versions from the registry.

Arguments:
  <package>           Package name

Options:
  --registry <url>    Override registry URL

Examples:
  lrn versions stripe
`,

  search: `
lrn search - Search across packages

Usage: lrn search <query> [options]
       lrn <package> search <query> [options]

Search for members and guides matching the query.

Arguments:
  <query>             Search term

Options:
  --format <format>   Output format: text, json, markdown, summary
  --tag <tag>         Filter by tag
  --kind <kind>       Filter by kind

Examples:
  lrn search "authentication"       Search all packages
  lrn stripe search "charge"        Search within Stripe
`,

  list: `
lrn <package> list - List package members

Usage: lrn <package> list [options]

Lists all top-level members in a package.

Options:
  --deep              List all members recursively
  --format <format>   Output format: text, json, markdown, summary
  --tag <tag>         Filter by tag
  --kind <kind>       Filter by kind
  --deprecated        Include deprecated members

Examples:
  lrn stripe list
  lrn stripe list --deep
  lrn stripe list --tag payments --json
`,

  guide: `
lrn <package> guide - Show guide documentation

Usage: lrn <package> guide <slug> [options]
       lrn <package> guide <slug>.<section> [options]

Shows guide content with progressive disclosure.

Arguments:
  <slug>              Guide identifier (e.g., webhooks)
  <section>           Optional section path (e.g., setup.installation)

Options:
  --full              Show complete guide content
  --format <format>   Output format: text, json, markdown

Examples:
  lrn stripe guide webhooks                   Show TOC
  lrn stripe guide webhooks --full            Show full content
  lrn stripe guide webhooks.verification      Show specific section
`,

  type: `
lrn <package> type - Show type/schema definition

Usage: lrn <package> type <name> [options]

Shows detailed information about a type or schema.

Arguments:
  <name>              Type/schema name

Options:
  --format <format>   Output format: text, json, markdown

Examples:
  lrn stripe type Charge
  lrn acme-api type User --json
`,
};

/**
 * Print help for a specific command
 */
export function printCommandHelp(command: string): void {
  const help = commandHelp[command];
  if (help) {
    console.log(help);
  } else {
    console.error(`Unknown command: ${command}`);
    console.error("Run 'lrn --help' for usage information.");
  }
}

/**
 * Print error for unknown command
 */
export function printUnknownCommand(command: string): void {
  console.error(`Unknown command: ${command}`);

  // Find similar commands
  const allCommands = [
    "sync",
    "add",
    "remove",
    "versions",
    "search",
    "list",
    "guide",
    "type",
    "guides",
    "types",
    "tags",
  ];
  const similar = allCommands.filter(
    (c) => c.includes(command) || command.includes(c)
  );

  if (similar.length > 0) {
    console.error(`Did you mean: ${similar.join(", ")}?`);
  }

  console.error("\nRun 'lrn --help' for usage information.");
}

/**
 * Print error for unknown option
 */
export function printUnknownOption(option: string): void {
  console.error(`Unknown option: ${option}`);
  console.error("\nRun 'lrn --help' for usage information.");
}
