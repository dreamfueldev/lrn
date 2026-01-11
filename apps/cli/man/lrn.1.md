# LRN(1) - Learn and query programming interfaces

## NAME

**lrn** - universal CLI for learning and querying programming interfaces

## SYNOPSIS

```
lrn [options]
lrn <package> [options]
lrn <package> <command> [args] [options]
lrn <package> <member.path> [options]
```

## DESCRIPTION

**lrn** provides token-efficient access to programming interface documentation. It enables progressive discovery of API documentation, delivering exactly the information needed without loading full documentation.

**lrn** is designed for both humans and LLMs. It supports structured output formats (JSON) for programmatic consumption and readable text for interactive use.

Documentation is stored locally for fast, offline querying. Packages are synced from the lrn registry or loaded from local files.

## COMMANDS

### Discovery Commands

**lrn**
: List all cached packages with their versions and summaries.

**lrn sync**
: Sync package documentation for project dependencies. Reads from `lrn.config.json` or `package.json` and downloads documentation from the registry.

**lrn add** *package*[@*version*]
: Add a package to the local cache and update `lrn.config.json`. If no version is specified, uses the latest available.

**lrn remove** *package*
: Remove a package from the local cache and `lrn.config.json`.

**lrn versions** *package*
: List available versions for a package in the registry.

### Package Commands

**lrn** *package*
: Show package overview: description, top members, and available guides.

**lrn** *package* **list**
: List all top-level members with their summaries.

**lrn** *package* **list --deep**
: List all members recursively, including nested children.

**lrn** *package* **guides**
: List all guides with their summaries.

**lrn** *package* **types**
: List all schema/type definitions.

**lrn** *package* **tags**
: List all tags used in this package.

### Member Commands

**lrn** *package* *member.path*
: Show full details for a member at the given path.

**lrn** *package* *member.path* **--summary**
: Show only the summary (one-liner).

**lrn** *package* *member.path* **--signature**
: Show only the type signature.

**lrn** *package* *member.path* **--examples**
: Show only the examples.

**lrn** *package* *member.path* **--parameters**
: Show only the parameters.

### Guide Commands

**lrn** *package* **guide** *slug*
: Show guide overview: intro and section summaries (table of contents).

**lrn** *package* **guide** *slug* **--full**
: Show the complete guide content.

**lrn** *package* **guide** *slug*.*section*
: Show a specific section of the guide.

### Type/Schema Commands

**lrn** *package* **type** *name*
: Show a schema/type definition.

### Search Commands

**lrn search** *query*
: Search across all cached packages. Returns matching members and guides.

**lrn** *package* **search** *query*
: Search within a specific package.

## OPTIONS

### Output Format

**--format** *format*
: Output format. One of: `text` (default for TTY), `json` (default for pipes), `markdown`, `summary`.

**--json**
: Shorthand for `--format json`.

**--summary**
: Show minimal output (names and one-liners only).

**--full**
: Show complete details (overrides progressive disclosure).

### Filtering

**--tag** *tag*
: Filter results to items with this tag. Can be specified multiple times.

**--kind** *kind*
: Filter members by kind: `function`, `method`, `class`, `namespace`, `constant`, `type`, `property`.

**--deprecated**
: Include deprecated members (excluded by default in lists).

### Version Selection

*package*@*version*
: Use a specific version of a package. Supports semver ranges.

### Configuration

**--registry** *url*
: Override the registry URL for this command.

**--config** *path*
: Use a specific config file instead of auto-detection.

**--no-config**
: Ignore config files, use defaults only.

### General

**--help**, **-h**
: Show help message.

**--version**, **-v**
: Show lrn version.

**--verbose**
: Show detailed output (for debugging).

**--quiet**, **-q**
: Suppress non-essential output.

## CONFIGURATION

**lrn** looks for configuration in this order:

1. `./lrn.config.json` (project root)
2. `~/.lrn/config.json` (user home)
3. Built-in defaults

### Configuration File Format

```json
{
  "$schema": "https://lrn.dev/schema/config.json",
  "registry": "https://registry.lrn.dev",
  "cache": "~/.lrn",
  "defaultFormat": "text",
  "packages": {
    "stripe": "^2024.0.0",
    "react": "^18.0.0",
    "internal-api": {
      "path": "./docs/internal-api.lrn.json"
    }
  }
}
```

### Configuration Fields

**registry**
: Registry endpoint URL. Default: `https://registry.lrn.dev`

**cache**
: Local cache directory. Default: `~/.lrn`

**defaultFormat**
: Default output format. One of: `text`, `json`, `markdown`, `summary`. Default: `text`

**packages**
: Package specifications. Values can be:
  - Semver string: `"^2.0.0"`, `"~1.2.3"`, `"2024.1.0"`
  - Object with `version`: `{ "version": "^2.0.0" }`
  - Object with `path`: `{ "path": "./local-file.lrn.json" }`
  - Object with `url`: `{ "url": "https://example.com/api.lrn.json" }`

## PROGRESSIVE DISCLOSURE

**lrn** is designed for token-efficient access. Each command shows only what's needed:

```
lrn                          # package list (names + summaries)
lrn stripe                   # package overview (top members, guides)
lrn stripe list              # member list (names + summaries)
lrn stripe charges           # namespace detail (children)
lrn stripe charges.create    # full member detail
```

For LLM usage, start broad and drill down to minimize token usage:

```bash
# Find relevant endpoints
lrn stripe list --tag payments --format json | jq '.[].name'

# Get details on specific endpoint
lrn stripe charges.create --json
```

## OUTPUT FORMATS

### text (default for TTY)

Human-readable formatted output with colors (when supported).

```
$ lrn stripe charges.create

charges.create - Create a new charge
POST /v1/charges

Parameters:
  amount      integer  required  Amount in cents
  currency    string   required  Three-letter ISO code
  ...
```

### json (default for pipes)

Machine-readable JSON output. Suitable for piping to jq or programmatic parsing.

```
$ lrn stripe charges.create --json
{
  "name": "create",
  "kind": "method",
  "summary": "Create a new charge",
  "http": {
    "method": "POST",
    "path": "/v1/charges"
  },
  ...
}
```

### markdown

Markdown-formatted output suitable for pasting into documentation or chat.

### summary

Ultra-minimal output showing only names and one-line summaries. Useful for getting an overview with minimal tokens.

```
$ lrn stripe list --format summary
charges.create      Create a new charge
charges.retrieve    Get an existing charge
charges.update      Update charge metadata
...
```

## EXAMPLES

### Basic Usage

```bash
# List cached packages
lrn

# Get Stripe API overview
lrn stripe

# List all Stripe endpoints
lrn stripe list

# Show specific endpoint details
lrn stripe charges.create

# Show just the signature
lrn stripe charges.create --signature
```

### Syncing Packages

```bash
# Sync packages from lrn.config.json
lrn sync

# Add a package
lrn add openai@^4.0.0

# Add with exact version
lrn add stripe@2024.1.0

# Remove a package
lrn remove old-api
```

### Working with Guides

```bash
# List guides
lrn stripe guides

# Show guide table of contents
lrn stripe guide webhooks

# Show specific section
lrn stripe guide webhooks.verification

# Show full guide
lrn stripe guide webhooks --full
```

### Searching

```bash
# Search all packages
lrn search "authentication"

# Search within a package
lrn stripe search "refund"

# Search with filters
lrn stripe search "create" --kind function
```

### Filtering

```bash
# Filter by tag
lrn stripe list --tag payments

# Filter by kind
lrn stripe list --kind namespace

# Include deprecated
lrn stripe list --deprecated
```

### LLM/Automation Usage

```bash
# JSON output for programmatic use
lrn stripe list --json | jq '.[] | select(.tags | contains(["payments"]))'

# Find all POST endpoints
lrn stripe list --deep --json | jq '.[] | select(.http.method == "POST")'

# Get signatures only
lrn stripe list --json | jq -r '.[] | "\(.name): \(.signature)"'

# Compose with grep
lrn stripe list --tag $(lrn stripe tags | grep -i payment | head -1)
```

### Version Management

```bash
# List available versions
lrn versions stripe

# Use specific version
lrn stripe@2023.10.0 charges.create

# Pin version in config
lrn add stripe@2024.0.0
```

### Local and Custom Sources

```bash
# Use local file (in lrn.config.json)
# { "packages": { "my-api": { "path": "./docs/api.lrn.json" } } }
lrn my-api list

# Use custom registry
lrn sync --registry https://internal.company.com/lrn
```

## ENVIRONMENT VARIABLES

**LRN_REGISTRY**
: Override the default registry URL.

**LRN_CACHE**
: Override the default cache directory.

**LRN_FORMAT**
: Override the default output format.

**NO_COLOR**
: Disable colored output.

## FILES

**~/.lrn/**
: Default cache directory containing downloaded package documentation.

**~/.lrn/config.json**
: User-level configuration file.

**./lrn.config.json**
: Project-level configuration file.

**~/.lrn/packages/**
: Cached package documentation files.

## EXIT STATUS

**0**
: Success.

**1**
: General error (invalid arguments, file not found, etc.).

**2**
: Package not found in cache or registry.

**3**
: Member/guide not found in package.

**4**
: Network error (registry unreachable).

## SEE ALSO

**jq**(1) - JSON processor, useful for filtering lrn JSON output

## NOTES

### For LLM Users

**lrn** is designed for token-efficient API exploration. Recommended workflow:

1. Start with `lrn <package>` for overview
2. Use `lrn <package> list` with tags to narrow down
3. Drill into specific members with `lrn <package> <member.path>`
4. Use `--json` output with jq for complex filtering

The progressive disclosure model means you only consume tokens for the information you actually need.

### For Humans

Use **lrn** as a faster alternative to web documentation:

1. `lrn sync` once to cache docs for your dependencies
2. `lrn <package> search <query>` to find what you need
3. Tab completion works with common shells (bash, zsh, fish)

## BUGS

Report bugs at: https://github.com/lrn-dev/lrn/issues

## AUTHORS

The lrn team.

## COPYRIGHT

MIT License. See LICENSE file for details.
