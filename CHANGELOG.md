# Changelog

## 0.2.0 (Unreleased)

### Added

- Fuzzy package resolution — `lrn add react` resolves to `npm/react` without requiring exact domain/name
- Interactive disambiguation when multiple packages match a query
- Registry search fallback — `lrn search` queries the registry when no local results found

## 0.1.0 (2026-02-26)

Initial public release of `lrn` — a universal CLI for learning and querying programming interfaces.

### Core

- Intermediate Representation (IR) schema for packages, members, guides, and schemas
- Progressive discovery: index → category → member → details
- Output formatters: text, JSON, markdown, summary
- Package cache system with on-device storage (`~/.lrn/packages/`)
- Configuration via `lrn.config.json`
- Bidirectional markdown parser (IR ↔ lrn-compatible markdown)
- Package classification detection (api, library, components, cli, config, framework)
- Space-separated and dot-separated member path resolution

### Commands

- `lrn` — list cached packages
- `lrn <package>` — package overview
- `lrn <package> list` — list members with `--tag`, `--kind`, `--deprecated` filters
- `lrn <package> <member.path>` — show member details
- `lrn <package> guides` / `lrn <package> guide <slug>` — prose documentation
- `lrn <package> types` / `lrn <package> type <name>` — schema definitions
- `lrn <package> tags` — list tags with counts
- `lrn search <query>` — cross-package search with multi-word AND semantics
- `lrn <package> search <query>` — search within a package
- `lrn teach` — generate agent orientation and strategy per package classification
- `lrn sync` — sync specs for project dependencies
- `lrn versions` — show available package versions
- `lrn pull` — pull packages from registry
- `lrn login` / `lrn logout` / `lrn status` — registry authentication (device flow)
- `lrn health` — connectivity and environment diagnostics
- `lrn crawl` — crawl documentation sites via llms.txt
- `lrn llms-full` — generate llms-full.txt output
- `lrn markdown` — convert IR to lrn-compatible markdown

### Distribution

- Binary builds for macOS (arm64, x64), Linux (arm64, x64), and Windows (x64)
- Install scripts: `curl -fsSL https://uselrn.dev/install | sh` (macOS/Linux), `irm https://uselrn.dev/install.ps1 | iex` (Windows)
- GitHub Releases with automated CI pipeline
