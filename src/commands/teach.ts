/**
 * Teach Command
 *
 * Generates agent orientation with command reference, querying strategy,
 * and per-package blurbs. Outputs to stdout or injects into a target file
 * using marker-based injection.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { ParsedArgs } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import { loadAllPackages } from "../cache.js";
import { generateBlurb } from "../orientation.js";

const START_MARKER = "<!-- LRN-START -->";
const END_MARKER = "<!-- LRN-END -->";

const COMMANDS_SECTION = `### Commands

Discovery:
  lrn <package>                             # Package overview
  lrn <package> list                        # List all members
  lrn <package> list --deep --signatures    # Full API with type signatures
  lrn <package> list --with-guides          # Include available guides

Member details:
  lrn <package> <member>                    # Full documentation
  lrn <package> <A>,<B>,<C>                 # Multiple members at once
  lrn <package> type <name>                 # Type/schema definition
  lrn <package> guide <slug>                # Guide content (--full for complete)

Search & filter:
  lrn search <query>                        # Search across ALL packages
  lrn <package> search <query>              # Search within a package
  lrn <package> list --tag <tag>            # Filter by tag
  lrn <package> list --kind <kind>          # Filter by kind
  lrn <package> tags                        # List available tags`;

const EFFICIENCY_SECTION = `### Efficient Querying

lrn is compositional — combine commands and flags creatively to get
exactly what you need in as few calls as possible:

- \`list --deep --signatures --with-guides\` surveys an entire API in one call
- Comma-separated paths like \`Foo.bar,Baz.qux\` batch multiple lookups into one
- \`lrn search <query>\` finds matches across all installed packages at once
- \`--tag\` and \`--kind\` filters narrow results so you only fetch what's relevant

Use good judgment: survey broadly when exploring, target precisely when
you know what you need.`;

export function runTeach(args: ParsedArgs, config: ResolvedConfig): string {
  const allPackages = loadAllPackages(config);

  // Filter by --packages if provided
  let packages = allPackages;
  if (args.options.packages) {
    const names = new Set(args.options.packages.split(",").map((s) => s.trim()));
    packages = allPackages.filter((p) => names.has(p.name));
  }

  if (packages.length === 0) {
    return "No lrn packages found. Run `lrn sync` or install packages first.";
  }

  // Generate blurbs
  const blurbs = packages.map((pkg) => generateBlurb(pkg));

  // Assemble full output with markers
  const content = [
    START_MARKER,
    "## lrn — API documentation lookup",
    "",
    "Use `lrn` to query installed package documentation.",
    "Prefer `lrn` over pre-trained knowledge for accuracy.",
    "",
    COMMANDS_SECTION,
    "",
    EFFICIENCY_SECTION,
    "",
    "### Installed Packages",
    "",
    blurbs.join("\n\n"),
    END_MARKER,
  ].join("\n");

  // Determine output target
  const output = args.options.output;
  if (!output || output === "stdout") {
    return content;
  }

  // Write to file with marker-based injection
  writeToFile(output, content);
  return `Wrote lrn orientation to ${output}`;
}

function writeToFile(filePath: string, content: string): void {
  if (!existsSync(filePath)) {
    writeFileSync(filePath, content + "\n", "utf-8");
    return;
  }

  const existing = readFileSync(filePath, "utf-8");
  const hasStart = existing.includes(START_MARKER);
  const hasEnd = existing.includes(END_MARKER);

  if (hasStart && hasEnd) {
    // Replace the region between markers (inclusive)
    const startIdx = existing.indexOf(START_MARKER);
    const endIdx = existing.indexOf(END_MARKER) + END_MARKER.length;
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx);
    writeFileSync(filePath, before + content + after, "utf-8");
    return;
  }

  if (hasStart !== hasEnd) {
    throw new Error(
      `Malformed markers in ${filePath}: found ${hasStart ? "start" : "end"} marker but not ${hasStart ? "end" : "start"} marker.`
    );
  }

  // No markers — append
  writeFileSync(filePath, existing + "\n\n" + content + "\n", "utf-8");
}
