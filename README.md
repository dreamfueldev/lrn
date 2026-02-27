# lrn

Token-optimized reference docs for AI coding agents. Fewer tokens, higher accuracy, better code.

**[Documentation](https://uselrn.dev/docs)** &nbsp;|&nbsp; **[Website](https://uselrn.dev)**

---

lrn gives AI agents access to real API documentation through progressive disclosure — delivering the right amount of detail at each step instead of dumping entire doc sites into context. The result is dramatically fewer tokens used and better code generated.

```bash
$ lrn stripe charges.create
charges.create(params, options?)

Create a new charge with the given parameters.

Parameters:
  amount     number   required  Amount in cents
  currency   string   required  Three-letter ISO currency code
  source     string             Payment source token
  ...
```

An agent following lrn's progressive disclosure pattern uses ~500 tokens to get what it needs — versus thousands or even tens of thousands of tokens from filesystem exploration, llms.txt and/or llms-full.txt

## Install

```bash
curl -fsSL https://uselrn.dev/install | sh
```

Verify:

```bash
lrn --version
```

## Quick start (registry)

The fastest way to get going. Log in, add packages, query docs.

```bash
# 1. Authenticate (opens browser)
lrn login

# 2. Add packages from the registry
lrn add stripe react convex

# 3. Query docs
lrn stripe list                  # Browse all members
lrn stripe charges.create        # Get member details
lrn search "authentication"      # Search across packages
```

That's it. Pre-crawled, token-optimized docs — cached locally for offline use.

### Configure your project

Create an `lrn.config.json` so `lrn sync` keeps packages up to date:

```json
{
  "packages": {
    "stripe": { "version": "2024.12.1" },
    "react": {},
    "convex": {}
  }
}
```

```bash
lrn sync
```

Or add an `"lrn"` key to your existing `package.json` instead.

### Hook up your agent

Use `lrn teach` to generate a documentation reference block for your AI agent:

```bash
# Claude Code
lrn teach --output CLAUDE.md

# Cursor / Windsurf / other agents
lrn teach # prints to stdout — paste into your rules file
```

See the [Agent Integration guide](https://uselrn.dev/docs/agent-setup/integration) for detailed setup per tool.

## How it works

lrn delivers documentation in four layers, each adding detail on demand:

| Layer | Command | Tokens | When to use |
|-------|---------|--------|-------------|
| Overview | `lrn stripe` | ~50 | Decide whether to use a library |
| Member list | `lrn stripe list` | ~200 | Find the right function |
| Details | `lrn stripe charges.create` | ~500 | Call it correctly |
| Full | `lrn stripe charges.create --full` | ~2000+ | Exhaustive reference |

Agents start broad and drill down. No wasted tokens, no hallucinated APIs.

## Commands

### Querying

```bash
lrn <package>                         # Package overview
lrn <package> list                    # Browse all members
lrn <package> <member.path>           # Member details
lrn <package> search "query"          # Search within package
lrn search "query"                    # Search across all packages
lrn <package> guides                  # List guides
lrn <package> guide <slug>            # Read a guide
lrn <package> types                   # List type definitions
lrn <package> type <name>             # Show type definition
lrn <package> tags                    # List tags
```

### Package management

```bash
lrn add <package>[@version]           # Add from registry + update config
lrn sync                              # Sync all packages from config
lrn pull <package>[@version]          # Download without updating config
lrn remove <package>                  # Remove from config
lrn versions <package>                # List available versions
```

### Agent integration

```bash
lrn teach                             # Generate agent orientation block
lrn teach --output CLAUDE.md          # Write directly to file
```

### Useful flags

```bash
--full              # Complete details (all params, examples, edge cases)
--summary           # Compact output for context budgeting
--json              # JSON output for machine parsing
--format markdown   # Markdown table format
--tag <tag>         # Filter by tag
--kind <kind>       # Filter by kind (function, class, component, etc.)
```

## Pricing

The CLI is **free and open source**. You can crawl, convert, and query docs entirely on your own.

The **[lrn registry](https://uselrn.dev/pricing)** ($10/mo) provides pre-crawled, token-optimized documentation packages maintained by us, so you don't have to run the pipeline yourself or pay for the AI compute to convert docs.

Free accounts get a few registry packages to try.

---

## Self-hosted packages

Everything below is for building your own lrn packages, from private docs, internal APIs, or libraries not in the registry. If you're using the registry, this section is mostly not for you.

### Why self-host?

- **Private or internal documentation** — company APIs, internal SDKs
- **Packages not in the registry yet** — new or niche libraries
- **Air-gapped environments** — no network access to the registry

### The pipeline

The self-hosted path is a multi-step pipeline. You'll crawl documentation, structure it into lrn-compatible markdown, convert it to lrn's IR format using an LLM, and configure it for local use.

**Self-hosted path:** Crawl → author → validate → parse → configure. Keep reading.

### Step 1: Crawl

Fetch documentation and convert it to markdown:

```bash
lrn crawl https://docs.example.com --output ./my-docs
```

Options:

| Flag | Description |
|------|-------------|
| `--output <dir>` | Output directory |
| `--rate <n>` | Requests per second (default: 5) |
| `--include <pattern>` | Only crawl matching URLs |
| `--exclude <pattern>` | Skip matching URLs |
| `--max-pages <n>` | Limit number of pages |
| `--dry-run` | Preview without downloading |

### Step 2: Author

Structure the raw markdown into lrn-compatible format. This is where the work is — you need to organize docs into the lrn markdown specification, either manually or using an LLM. For a detailed spec your AI agent can follow step by step, see [AUTHORING.md](./AUTHORING.md).

```
my-package/
├── index.md              # Package metadata (required)
├── members/              # API member documentation
│   ├── createUser.md
│   └── Config/
│       └── set.md
├── guides/               # Prose documentation
│   └── getting-started.md
└── types/                # Type definitions
    └── User.md
```

Each member file follows a structured format with headings for parameters, returns, examples, and tags. See the [Authoring guide](https://uselrn.dev/docs/self-hosted/authoring) for the full spec.

### Step 3: Validate

Check your package against the lrn specification:

```bash
lrn health ./my-package
lrn health ./my-package --verbose    # Detailed diagnostics
```

### Step 4: Parse

Convert markdown to lrn's IR (Intermediate Representation) format:

```bash
lrn parse ./my-package --out my-package.lrn.json
```

### Step 5: Configure

Add the local package to your project config:

```json
{
  "packages": {
    "my-package": { "path": "./docs/my-package.lrn.json" }
  }
}
```

Then query it like any registry package:

```bash
lrn my-package list
lrn my-package createUser
```

No authentication required for local packages.

### Authoring commands

```bash
lrn crawl <url>                       # Crawl docs to markdown
lrn parse <directory>                 # Markdown → IR JSON
lrn format <ir.json>                  # IR JSON → markdown (round-trip)
lrn health <directory>                # Validate against spec
lrn llms-full <directory>             # Generate concatenated llms-full.txt
```

For the full self-hosted walkthrough, see the [Self-Hosted guide](https://uselrn.dev/docs/self-hosted/overview).

## License

MIT
