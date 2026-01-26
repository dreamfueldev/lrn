# Test Implementation Progress

Last updated: 2025-01-25

## Summary

| Status | Count |
|--------|-------|
| Passing | 213 |
| TODO | 241 |
| Total | 454 |

**Progress: 47% complete**

---

## Completed Tests by File

### errors.spec.ts (11 implemented)
- [x] exits with code 0 on success
- [x] exits with code 1 on general error
- [x] exits with code 2 when package not found
- [x] exits with code 3 when member/guide not found
- [x] package not in local cache
- [x] member path does not exist
- [x] guide slug does not exist
- [x] section path does not exist
- [x] type/schema name does not exist
- [x] shows clear error message
- [x] uses stderr for error messages

### discovery.spec.ts (5 implemented)
- [x] lists all cached packages
- [x] shows package name for each cached package
- [x] shows package version for each cached package
- [x] shows package summary for each cached package
- [x] sorts packages alphabetically by name

### guide.spec.ts (11 implemented)
- [x] shows guide tags
- [x] shows related content (see references)
- [x] shows nested subsections
- [x] shows section examples inline
- [x] renders markdown content appropriately
- [x] renders markdown headings
- [x] renders markdown code blocks with syntax highlighting hint
- [x] renders markdown lists
- [x] renders markdown links
- [x] renders markdown inline code
- [x] renders markdown bold and italic
- [x] resolves single-level section path
- [x] resolves multi-level section path

### filtering.spec.ts (7 implemented)
- [x] filters members by kind: method
- [x] filters members by kind: type
- [x] filters members by kind: property
- [x] shows deprecation notice for deprecated items
- [x] combines --tag and --kind with AND logic
- [x] filters apply to lrn <package> list --deep

### package.spec.ts (12 implemented)
- [x] shows source information
- [x] shows package links (homepage, repository, etc.)
- [x] shows guide title for each guide
- [x] shows guide summary for each guide
- [x] shows guide kind for each guide
- [x] shows guide level for each guide
- [x] shows type description for each schema
- [x] shows base type for each schema
- [x] sorts types alphabetically by name
- [x] sorts tags by count descending, then alphabetically
- [x] indents nested members for visual hierarchy
- [x] traverses all nesting levels

### search.spec.ts (8 implemented)
- [x] shows result type (member or guide)
- [x] shows result summary
- [x] shows result path/slug for each result (package search)
- [x] shows result summary (package search)
- [x] matches against member descriptions
- [x] matches against member tags
- [x] matches against guide summaries
- [x] matches against guide tags

### member.spec.ts (4 implemented)
- [x] shows member parameters with default values
- [x] shows related content (see references)
- [x] shows methods for class members

### output-format.spec.ts (4 implemented)
- [x] includes nested/child content
- [x] all show commands support all formats
- [x] all search commands support all formats

### type.spec.ts (2 implemented)
- [x] shows property descriptions
- [x] indicates required properties
- [x] shows items schema details

---

## Remaining TODO Tests by Category

### Category 1: Registry Features (requires registry service)
**Blocked by:** Registry API not implemented

#### version-select.spec.ts (18 tests)
- [ ] parses package name and version from @ syntax
- [ ] supports package names with scopes (@org/package@1.0.0)
- [ ] treats text after @ as version specifier
- [ ] uses exact version with @1.0.0 syntax
- [ ] uses exact version with @2024.1.0 syntax (calver)
- [ ] fails when exact version not available
- [ ] resolves ^1.0.0 to latest compatible version
- [ ] resolves ~1.0.0 to latest patch version
- [ ] resolves >=1.0.0 to latest matching version
- [ ] resolves 1.x to latest 1.x version
- [ ] resolves * to latest version
- [ ] fails when no version matches range
- [ ] uses version from lrn.config.json when no @ specified
- [ ] command-line @ version overrides config version
- [ ] uses latest when not in config and no @ specified
- [ ] uses cached version if it satisfies specifier
- [ ] downloads new version if cached version does not satisfy
- [ ] shows which version is being used
- [ ] shows version in package overview output
- [ ] shows version in list output header
- [ ] shows version in JSON output

#### discovery.spec.ts - Registry Commands (25 tests)
- [ ] shows message when no packages are cached
- [ ] reads package specifications from lrn.config.json
- [ ] reads package specifications from package.json dependencies
- [ ] downloads packages from registry
- [ ] saves packages to local cache directory
- [ ] shows progress during sync
- [ ] shows summary of synced packages on completion
- [ ] skips packages already cached at correct version
- [ ] updates packages when newer version matches semver range
- [ ] handles packages with local path specification
- [ ] handles packages with remote URL specification
- [ ] fails gracefully when registry is unreachable
- [ ] fails gracefully when package not found in registry
- [ ] lrn add: adds package to local cache
- [ ] lrn add: adds package to lrn.config.json
- [ ] lrn add: uses latest version when no version specified
- [ ] lrn add: shows confirmation message on success
- [ ] lrn add: creates lrn.config.json if it does not exist
- [ ] lrn add: fails gracefully when package not found in registry
- [ ] lrn add: adds exact version with @1.0.0 syntax
- [ ] lrn add: adds semver range with @^1.0.0 syntax
- [ ] lrn add: adds tilde range with @~1.0.0 syntax
- [ ] lrn add: fails gracefully when version not found
- [ ] lrn remove: removes package from local cache
- [ ] lrn remove: removes package from lrn.config.json
- [ ] lrn remove: shows confirmation message on success
- [ ] lrn remove: fails gracefully when package not in cache
- [ ] lrn remove: does not modify lrn.config.json if package not listed
- [ ] lrn versions: lists all available versions from registry
- [ ] lrn versions: shows versions in descending order
- [ ] lrn versions: indicates which version is latest
- [ ] lrn versions: indicates which version is currently cached
- [ ] lrn versions: fails gracefully when package not found
- [ ] lrn versions: fails gracefully when registry is unreachable

---

### Category 2: Config System (requires test infrastructure)
**Blocked by:** Complex test setup for config files

#### config.spec.ts (36 tests)
- [ ] checks ./lrn.config.json first (project root)
- [ ] checks ~/.lrn/config.json second (user home)
- [ ] uses built-in defaults when no config file found
- [ ] merges project config with user config
- [ ] project config takes precedence over user config
- [ ] parses valid JSON config file
- [ ] validates config against expected schema
- [ ] reports clear error for invalid JSON syntax
- [ ] reports clear error for invalid config structure
- [ ] ignores unknown fields in config
- [ ] uses default registry when not specified
- [ ] uses custom registry URL from config
- [ ] validates registry URL format
- [ ] uses ~/.lrn as default cache directory
- [ ] uses custom cache directory from config
- [ ] expands ~ to home directory
- [ ] creates cache directory if it does not exist
- [ ] uses text as default format when not specified
- [ ] uses custom default format from config
- [ ] validates format value (text, json, markdown, summary)
- [ ] parses semver string specification
- [ ] parses object with version field
- [ ] parses object with path field
- [ ] parses object with url field
- [ ] validates semver syntax
- [ ] validates local path exists
- [ ] --config: uses specified config file
- [ ] --config: overrides default config file lookup
- [ ] --config: fails with clear error when file not found
- [ ] --config: fails with clear error when file is not valid JSON
- [ ] --no-config: ignores all config files
- [ ] --no-config: uses only built-in defaults
- [ ] --no-config: still respects command-line flags
- [ ] --no-config: still respects environment variables
- [ ] --registry: overrides registry from config
- [ ] --registry: overrides default registry
- [ ] --registry: validates URL format
- [ ] LRN_REGISTRY: overrides default registry
- [ ] LRN_REGISTRY: overrides config file registry
- [ ] LRN_REGISTRY: is overridden by --registry flag
- [ ] LRN_CACHE: overrides default cache directory
- [ ] LRN_CACHE: overrides config file cache
- [ ] LRN_CACHE: expands ~ to home directory
- [ ] LRN_FORMAT: overrides default output format
- [ ] LRN_FORMAT: overrides config file defaultFormat
- [ ] LRN_FORMAT: is overridden by --format flag
- [ ] NO_COLOR: disables colored output when set
- [ ] NO_COLOR: respects any non-empty value
- [ ] precedence: command-line flags take highest precedence
- [ ] precedence: environment variables take second precedence
- [ ] precedence: project config takes third precedence
- [ ] precedence: user config takes fourth precedence
- [ ] precedence: built-in defaults take lowest precedence

---

### Category 3: HTTP Endpoint Details (requires formatter changes)
**Blocked by:** Text formatter doesn't output HTTP details

#### member.spec.ts - HTTP Members (5 tests)
- [ ] shows path parameters
- [ ] shows query parameters
- [ ] shows request body schema
- [ ] shows response schemas by status code
- [ ] shows required scopes/permissions

---

### Category 4: Error Handling Enhancements
**Blocked by:** Feature implementation needed

#### errors.spec.ts (18 tests)
- [ ] exits with code 4 on network error
- [ ] invalid command syntax
- [ ] invalid option value
- [ ] missing required argument
- [ ] invalid config file
- [ ] permission denied errors
- [ ] file system errors
- [ ] package not found in registry
- [ ] package name typo suggestions
- [ ] similar name suggestions
- [ ] registry unreachable
- [ ] connection timeout
- [ ] DNS resolution failure
- [ ] SSL/TLS errors
- [ ] shows error context (what was being attempted)
- [ ] shows suggestion for resolution when possible
- [ ] uses consistent error format across commands
- [ ] --verbose: shows stack trace on error
- [ ] --verbose: shows additional debug information
- [ ] --verbose: shows network request details
- [ ] --verbose: shows config resolution details
- [ ] --quiet: suppresses non-essential output
- [ ] --quiet: still shows error messages
- [ ] --quiet: still shows requested data
- [ ] --quiet: suppresses progress indicators
- [ ] --quiet: suppresses informational messages
- [ ] graceful degradation: continues with partial results
- [ ] graceful degradation: shows warning for missing optional data
- [ ] graceful degradation: handles malformed package data gracefully

---

### Category 5: Minor Features & Edge Cases

#### member.spec.ts (15 tests)
- [ ] shows since version when present
- [ ] --summary: shows only the one-line summary
- [ ] --summary: excludes description
- [ ] --summary: excludes parameters
- [ ] --summary: excludes examples
- [ ] --summary: excludes other details
- [ ] --signature: shows only the type signature
- [ ] --signature: excludes description
- [ ] --signature: excludes parameters
- [ ] --signature: excludes examples
- [ ] --signature: shows message when member has no signature
- [ ] --examples: shows only the examples
- [ ] --examples: shows example title when present
- [ ] --examples: shows example code with language hint
- [ ] --examples: shows example description when present
- [ ] --examples: shows all examples when multiple exist
- [ ] --examples: shows message when member has no examples
- [ ] --parameters: shows only the parameters
- [ ] --parameters: shows parameter name
- [ ] --parameters: shows parameter type
- [ ] --parameters: shows parameter description
- [ ] --parameters: shows parameter required status
- [ ] --parameters: shows parameter default value
- [ ] --parameters: shows message when member has no parameters

#### package.spec.ts (4 tests)
- [ ] limits guides shown to reasonable count
- [ ] excludes deprecated members by default
- [ ] sorts members alphabetically by name
- [ ] groups members by kind when multiple kinds present
- [ ] shows message when package has no tags

#### guide.spec.ts (2 tests)
- [ ] shows subsection list if section has children
- [ ] resolves deeply nested section path

#### search.spec.ts (8 tests)
- [ ] limits results to reasonable count
- [ ] ranks name matches higher than description matches
- [ ] ranks summary matches higher than description matches
- [ ] ranks exact matches higher than partial matches
- [ ] ranks tag matches appropriately
- [ ] matches against guide content
- [ ] ranks results by relevance score
- [ ] respects --tag filter in search results
- [ ] respects --kind filter in search results
- [ ] respects --deprecated flag in search results
- [ ] combines search query with filters

#### filtering.spec.ts (10 tests)
- [ ] filters guides to those with specified tag
- [ ] performs case-insensitive tag matching
- [ ] returns items matching ANY of the specified tags (OR logic)
- [ ] can be combined with other filters
- [ ] filters members by kind: constant
- [ ] returns error for invalid kind value
- [ ] only applies to member lists, not guides
- [ ] excludes deprecated members by default (without flag)
- [ ] can filter to ONLY deprecated with --deprecated --kind
- [ ] combines --tag and --deprecated appropriately
- [ ] combines --kind and --deprecated appropriately
- [ ] combines all three filters correctly
- [ ] filters apply to lrn <package> guides (tag only)
- [ ] filters apply to lrn search results
- [ ] filters apply to lrn <package> search results
- [ ] filters do not apply to single item show commands

#### type.spec.ts (15 tests)
- [ ] shows property default values
- [ ] shows property examples
- [ ] shows minLength constraint
- [ ] shows maxLength constraint
- [ ] shows format constraint (email, uri, date-time, etc.)
- [ ] shows pattern constraint
- [ ] shows enum values when present
- [ ] shows minimum constraint
- [ ] shows maximum constraint
- [ ] distinguishes integer from number
- [ ] shows referenced schema inline
- [ ] handles circular references gracefully
- [ ] shows reference path for complex nested refs
- [ ] oneOf: shows all possible types
- [ ] oneOf: shows description for each variant
- [ ] allOf: shows merged properties from all schemas
- [ ] allOf: indicates which properties come from which schema
- [ ] indicates when schema is nullable

#### output-format.spec.ts (6 tests)
- [ ] uses appropriate spacing between sections
- [ ] wraps long lines appropriately
- [ ] uses colors when terminal supports it
- [ ] escapes special markdown characters in content
- [ ] uses text format when stdout is a TTY
- [ ] LRN_FORMAT env var overrides auto-detection
- [ ] format output is consistent across command types

#### help.spec.ts (9 tests)
- [ ] shows error message for unknown command
- [ ] suggests similar commands if available
- [ ] shows hint to use --help
- [ ] exits with code 1 (unknown command)
- [ ] suggests similar options if available
- [ ] shows error when required argument missing
- [ ] shows which argument is missing
- [ ] shows command usage
- [ ] aligns option descriptions
- [ ] wraps long descriptions appropriately
- [ ] groups related options together
- [ ] uses consistent formatting throughout

---

## Priority Order for Implementation

### High Priority (Unblocks many features)
1. **Config system tests** - Foundation for other features
2. **HTTP endpoint details** - Important for API documentation use case

### Medium Priority (Core functionality)
3. **Error handling enhancements** - Better UX
4. **Search improvements** - Better relevance ranking
5. **Filtering enhancements** - More powerful queries

### Low Priority (Nice to have)
6. **Member slice flags** (--summary, --signature, --examples, --parameters)
7. **Format edge cases**
8. **Help formatting improvements

### Blocked (Requires registry)
9. **Version selection** - Requires registry
10. **Discovery commands** - Requires registry

---

## Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test specs/member.spec.ts

# Run tests matching pattern
bun test --grep "exit code"

# Watch mode
bun test --watch
```
