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
  if (process.env.LRN_VERSION) return process.env.LRN_VERSION;
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
        if (pkg.name === "lrn" && pkg.version) {
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
 * Return version string
 */
export function printVersion(): string {
  return getVersion();
}

/**
 * Return main help message
 */
export function printHelp(): string {
  return `
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
  crawl <url>         Crawl documentation from a URL
  teach               Generate agent orientation and strategy

Registry Commands:
  login               Log in to the lrn registry via GitHub
  logout              Log out and remove stored credentials
  status              Show current login status
  pull <package>      Download a package from the registry

Authoring Commands:
  parse <directory>           Parse markdown directory to IR JSON
  format <file> --out <dir>   Format IR JSON to markdown directory
  health <path>               Validate lrn-compatible markdown
  llms-full <directory>        Generate llms-full.txt from markdown

Package Commands:
  <package>                   Show package overview
  <package> list              List all members
  <package> list --deep       List all members recursively
  <package> guides            List all guides
  <package> types             List all type definitions
  <package> tags              List all tags

Member Commands:
  <package> <member.path>               Show member details
  <package> <A>,<B>,<C>                 Show multiple members at once
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
  --kind <kind>       Filter by kind: function, method, class, namespace, constant, type, property, component, command, resource
  --deprecated        Include deprecated members
  --signatures        Show member signatures instead of summaries
  --with-guides       Append guide list to list output

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
  lrn stripe list --signatures  Show signatures instead of summaries
  lrn stripe charges.create,customers.list  Show multiple members

Version: ${getVersion()}`;
}

/**
 * Help text for specific commands
 */
const commandHelp: Record<string, string> = {
  sync: `
lrn sync - Sync packages for project dependencies

Usage: lrn sync [options]

Pulls all packages listed in project config that are missing or outdated.
Reads from lrn.config.json or the "lrn" key in package.json.

Local path entries are verified, registry entries are pulled if missing.

Options:
  --force             Re-download even if cached
  --config <path>     Use specific config file
  --registry <url>    Override registry URL
  --quiet, -q         Suppress progress output

Examples:
  lrn sync                            Sync all configured packages
  lrn sync --force                    Force re-download everything
  lrn sync --config ./my-config.json  Use custom config
`,

  add: `
lrn add - Add a package to the project config

Usage: lrn add <package>[@<version>] [options]

Adds a package entry to the project config and pulls it from the registry.
Supports local file paths and remote URLs as alternatives to the registry.

Arguments:
  <package>           Package name (e.g., stripe, react)
  @<version>          Optional version (semver range supported)

Options:
  --path <file>              Use a local .lrn.json file
  --url <url>                Use a remote URL
  --save-to-package-json     Write to package.json "lrn" key instead of lrn.config.json
  --registry <url>           Override registry URL

Examples:
  lrn add stripe                                        Add latest from registry
  lrn add stripe@2024.1.0                               Add specific version
  lrn add internal-sdk --path ./docs/sdk.lrn.json       Add from local file
  lrn add custom-api --url https://example.com/api.json Add from URL
  lrn add react --save-to-package-json                  Write to package.json
`,

  remove: `
lrn remove - Remove a package from the project config

Usage: lrn remove <package>

Removes a package entry from the project config file.
Does NOT delete cached data (use 'lrn cache clean' for that).

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
  --deprecated        Include deprecated members

Examples:
  lrn search "authentication"       Search all packages
  lrn stripe search "charge"        Search within Stripe
  lrn search "auth" --tag security  Search with tag filter
`,

  list: `
lrn <package> list - List package members

Usage: lrn <package> list [options]

Lists all top-level members in a package.

Options:
  --deep              List all members recursively
  --signatures        Show member signatures instead of summaries
  --with-guides       Append guide list to output
  --format <format>   Output format: text, json, markdown, summary
  --tag <tag>         Filter by tag
  --kind <kind>       Filter by kind
  --deprecated        Include deprecated members

Examples:
  lrn stripe list
  lrn stripe list --deep
  lrn stripe list --deep --signatures
  lrn stripe list --with-guides
  lrn stripe list --tag payments --json
`,

  guides: `
lrn <package> guides - List package guides

Usage: lrn <package> guides [options]

Lists all guides in a package.

Options:
  --format <format>   Output format: text, json, markdown, summary
  --tag <tag>         Filter by tag

Examples:
  lrn stripe guides
  lrn stripe guides --tag auth
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

  parse: `
lrn parse - Parse markdown directory to IR JSON

Usage: lrn parse <directory> [options]

Parses a markdown documentation directory into lrn IR (Intermediate
Representation) JSON format. This enables authoring documentation in
markdown and converting it to the structured format lrn uses.

Arguments:
  <directory>         Path to markdown documentation directory

Expected directory structure:
  <directory>/
  ├── index.md        Package metadata (name, version, summary)
  ├── members/        API member documentation
  │   ├── function.md
  │   └── Class/
  │       └── method.md
  ├── guides/         Prose documentation
  │   └── getting-started.md
  └── types/          Schema/type definitions
      └── User.md

Options:
  --out, -o <file>    Write output to file instead of stdout

Examples:
  lrn parse ./docs                        Output IR to stdout
  lrn parse ./docs --out package.lrn.json Write to file
  lrn parse ./docs | jq '.members'        Pipe to jq
`,

  format: `
lrn format - Format IR JSON to markdown directory

Usage: lrn format <file> --out <directory>

Converts lrn IR (Intermediate Representation) JSON to a markdown
documentation directory. This is the inverse of 'lrn parse'.

Arguments:
  <file>              Path to IR JSON file (*.lrn.json)

Options:
  --out, -o <dir>     Output directory (required)

Generated directory structure:
  <directory>/
  ├── index.md        Package metadata
  ├── members/        API member files
  │   ├── function.md
  │   └── Class/
  │       └── method.md
  ├── guides/         Guide files
  │   └── getting-started.md
  └── types/          Schema files
      └── User.md

Examples:
  lrn format stripe.lrn.json --out ./stripe-docs
  lrn format package.json -o ./docs

Round-trip example:
  lrn format api.lrn.json --out /tmp/docs
  lrn parse /tmp/docs --out api-roundtrip.lrn.json
`,

  crawl: `
lrn crawl - Fetch documentation from URLs

Usage: lrn crawl <url> [options]

Crawls documentation from a URL and converts it to markdown.
Supports llms.txt discovery for structured documentation sites.

Arguments:
  <url>               URL to crawl (site root, specific page, or llms.txt)

Options:
  --depth <n>         Maximum link following depth (default: 1)
  --rate <n>          Requests per second (default: 2)
  --output <dir>      Custom output directory
  --include <pattern> Include URLs matching glob pattern (can repeat)
  --exclude <pattern> Exclude URLs matching glob pattern (can repeat)
  --dry-run           Show what would be fetched without fetching
  --verbose           Show detailed output
  --quiet, -q         Suppress non-essential output

Output:
  Crawled files are saved to ~/.lrn/crawled/<domain>/
  A _meta.json file tracks crawl metadata.

Examples:
  lrn crawl https://docs.stripe.com              Crawl site (auto-detect llms.txt)
  lrn crawl https://docs.stripe.com/llms.txt     Crawl from llms.txt
  lrn crawl https://htmx.org --depth 2           Follow links 2 levels deep
  lrn crawl https://example.com/docs --dry-run   Preview what would be fetched
  lrn crawl <url> --include "api/*"              Only crawl API pages
  lrn crawl <url> --exclude "blog/*"             Skip blog pages
  lrn crawl <url> --rate 1                       Slow down to 1 req/s
`,

  health: `
lrn health - Validate lrn-compatible markdown

Usage: lrn health <path> [options]

Validates markdown documentation against the lrn specification,
reports compliance issues, calculates a health score, and estimates
token costs for LLM consumption.

Arguments:
  <path>              Directory or file to check

Options:
  --json              Output as JSON
  --verbose           Show all issues including info
  --errors            Only show errors
  --warnings          Show errors and warnings (default)
  --fix               Auto-fix simple issues (not yet implemented)

Check Categories:
  Structure (S001-S006)   - File structure and required elements
  Content (C001-C006)     - Documentation completeness
  Format (F001-F005)      - Formatting requirements
  Reference (R001-R004)   - Link validation

Exit Codes:
  0                   No errors (warnings/info ok)
  1                   Errors present

Examples:
  lrn health ./docs/stripe            Check a directory
  lrn health ./docs/stripe/index.md   Check a single file
  lrn health ./docs --json            JSON output for CI
  lrn health ./docs --errors          Only show errors
  lrn health ./docs --verbose         Show all issues
`,

  "llms-full": `
lrn llms-full - Generate llms-full.txt from markdown

Usage: lrn llms-full <directory> [options]

Parses a markdown documentation directory and generates a single
llms-full.txt file containing all documentation in a flat format
suitable for LLM context injection.

Arguments:
  <directory>         Path to markdown documentation directory

Options:
  --out, -o <file>    Write output to file instead of stdout

Examples:
  lrn llms-full ./docs                          Output to stdout
  lrn llms-full ./docs --out llms-full.txt      Write to file
  lrn llms-full ./docs | wc -l                  Check line count
`,

  login: `
lrn login - Log in to the lrn registry

Usage: lrn login [options]

Authenticates with the lrn registry using GitHub device flow.
Opens your browser to complete authentication.

Options:
  --registry <url>    Override registry URL

Examples:
  lrn login
`,

  logout: `
lrn logout - Log out of the lrn registry

Usage: lrn logout

Removes stored credentials from ~/.lrn/credentials.

Examples:
  lrn logout
`,

  status: `
lrn status - Show current login status

Usage: lrn status [options]

Shows whether you are logged in, your username, and role.

Options:
  --registry <url>    Override registry URL

Examples:
  lrn status
`,

  teach: `
lrn teach - Generate agent orientation and strategy

Usage: lrn teach [options]

Generates agent orientation including command reference, querying strategy,
and per-package blurbs. Teaches LLMs how to use lrn effectively.

Options:
  --output <path>     Write to file (uses marker-based injection) or "stdout"
  --packages <list>   Comma-separated list of package names to include

Output uses <!-- LRN-START --> / <!-- LRN-END --> markers for idempotent
file updates. Re-running replaces the previous content between markers.

Examples:
  lrn teach                              Print to stdout
  lrn teach --output CLAUDE.md           Inject into CLAUDE.md
  lrn teach --output AGENTS.md           Inject into AGENTS.md
  lrn teach --packages stripe,react      Only include specific packages
`,

  pull: `
lrn pull - Download a package from the registry

Usage: lrn pull <package>[@<version>] [options]

Downloads package documentation from the registry and caches it locally.

Arguments:
  <package>           Package name (e.g., stripe, react)
  @<version>          Optional version (defaults to latest)

Options:
  --force             Re-download even if already cached
  --registry <url>    Override registry URL

Examples:
  lrn pull stripe                     Pull latest version
  lrn pull stripe@2024.1.0            Pull specific version
  lrn pull stripe --force             Force re-download
`,
};

/**
 * Return help for a specific command
 */
export function printCommandHelp(command: string): { stdout?: string; stderr?: string } {
  const help = commandHelp[command];
  if (help) {
    return { stdout: help };
  } else {
    return { stderr: `Unknown command: ${command}\nRun 'lrn --help' for usage information.` };
  }
}

/**
 * Return error for unknown command
 */
export function printUnknownCommand(command: string): string {
  const lines: string[] = [];
  lines.push(`Unknown command: ${command}`);

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
    "parse",
    "format",
    "crawl",
    "health",
    "llms-full",
    "login",
    "logout",
    "status",
    "pull",
    "teach",
  ];
  const similar = allCommands.filter(
    (c) => c.includes(command) || command.includes(c)
  );

  if (similar.length > 0) {
    lines.push(`Did you mean: ${similar.join(", ")}?`);
  }

  lines.push("");
  lines.push("Run 'lrn --help' for usage information.");

  return lines.join("\n");
}

/**
 * Return error for unknown option
 */
export function printUnknownOption(option: string): string {
  return `Unknown option: ${option}\n\nRun 'lrn --help' for usage information.`;
}
