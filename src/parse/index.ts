/**
 * Package Parser
 *
 * Main entry point for parsing markdown directories into Package IR.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, basename } from "node:path";
import type { Package, Member } from "../schema/index.js";
import { parsePackageIndex } from "./package.js";
import { parseMember } from "./member.js";
import { parseGuide } from "./guide.js";
import { parseSchema } from "./schema.js";

export { parseMember } from "./member.js";
export { parseGuide } from "./guide.js";
export { parseSchema } from "./schema.js";
export { parsePackageIndex } from "./package.js";

/**
 * Parse error information
 */
export interface ParseError {
  file: string;
  line?: number;
  message: string;
  severity: "error" | "warning";
}

/**
 * Parse result with optional errors
 */
export interface ParseResult<T> {
  data?: T;
  errors: ParseError[];
  warnings: ParseError[];
}

/**
 * Parse a markdown directory into a Package IR.
 *
 * Expected directory structure:
 * ```
 * package/
 * ├── index.md          # Package metadata
 * ├── members/          # API member documentation
 * │   ├── function.md
 * │   └── namespace/
 * │       └── method.md
 * ├── guides/           # Prose documentation
 * │   └── getting-started.md
 * └── types/            # Schema definitions
 *     └── User.md
 * ```
 */
export async function parsePackage(directory: string): Promise<Package> {
  const errors: ParseError[] = [];
  const warnings: ParseError[] = [];

  // Check directory exists
  if (!existsSync(directory)) {
    throw new Error(`Directory does not exist: ${directory}`);
  }

  // Parse index.md
  const indexPath = join(directory, "index.md");
  let pkg: Partial<Package>;

  if (existsSync(indexPath)) {
    const indexContent = readFileSync(indexPath, "utf-8");
    pkg = parsePackageIndex(indexContent);
  } else {
    // Create minimal package from directory name
    pkg = {
      name: basename(directory),
      source: { type: "markdown" },
      members: [],
      guides: [],
      schemas: {},
    };
    warnings.push({
      file: indexPath,
      message: "No index.md found, using directory name as package name",
      severity: "warning",
    });
  }

  // Parse members
  const membersDir = join(directory, "members");
  if (existsSync(membersDir)) {
    const memberFiles = discoverMarkdownFiles(membersDir);
    const flatMembers: Member[] = [];

    for (const file of memberFiles) {
      try {
        const content = readFileSync(file, "utf-8");
        const relPath = relative(membersDir, file);
        const member = parseMember(content, relPath);
        flatMembers.push(member);
      } catch (err) {
        errors.push({
          file,
          message: `Failed to parse member: ${err instanceof Error ? err.message : String(err)}`,
          severity: "error",
        });
      }
    }

    // Reconstruct hierarchy from flat members
    pkg.members = reconstructMemberHierarchy(flatMembers);
  }

  // Parse guides
  const guidesDir = join(directory, "guides");
  if (existsSync(guidesDir)) {
    const guideFiles = discoverMarkdownFiles(guidesDir);
    for (const file of guideFiles) {
      try {
        const content = readFileSync(file, "utf-8");
        const relPath = relative(guidesDir, file);
        const guide = parseGuide(content, relPath);
        pkg.guides!.push(guide);
      } catch (err) {
        errors.push({
          file,
          message: `Failed to parse guide: ${err instanceof Error ? err.message : String(err)}`,
          severity: "error",
        });
      }
    }
  }

  // Parse schemas/types
  const typesDir = join(directory, "types");
  if (existsSync(typesDir)) {
    const typeFiles = discoverMarkdownFiles(typesDir);
    for (const file of typeFiles) {
      try {
        const content = readFileSync(file, "utf-8");
        const relPath = relative(typesDir, file);
        const { name, schema } = parseSchema(content, relPath);
        pkg.schemas![name] = schema;
      } catch (err) {
        errors.push({
          file,
          message: `Failed to parse schema: ${err instanceof Error ? err.message : String(err)}`,
          severity: "error",
        });
      }
    }
  }

  // Also check for "schemas" directory (alternative name)
  const schemasDir = join(directory, "schemas");
  if (existsSync(schemasDir) && schemasDir !== typesDir) {
    const schemaFiles = discoverMarkdownFiles(schemasDir);
    for (const file of schemaFiles) {
      try {
        const content = readFileSync(file, "utf-8");
        const relPath = relative(schemasDir, file);
        const { name, schema } = parseSchema(content, relPath);
        pkg.schemas![name] = schema;
      } catch (err) {
        errors.push({
          file,
          message: `Failed to parse schema: ${err instanceof Error ? err.message : String(err)}`,
          severity: "error",
        });
      }
    }
  }

  // Check for lrn.json overrides
  const lrnJsonPath = join(directory, "lrn.json");
  if (existsSync(lrnJsonPath)) {
    try {
      const lrnJson = JSON.parse(readFileSync(lrnJsonPath, "utf-8"));
      // Merge overrides (lrn.json takes precedence for scalar fields)
      if (lrnJson.name) pkg.name = lrnJson.name;
      if (lrnJson.version) pkg.version = lrnJson.version;
      if (lrnJson.summary) pkg.summary = lrnJson.summary;
      if (lrnJson.description) pkg.description = lrnJson.description;
      if (lrnJson.source) pkg.source = { ...pkg.source, ...lrnJson.source };
      if (lrnJson.links) pkg.links = { ...pkg.links, ...lrnJson.links };
      if (lrnJson.tags) pkg.tags = lrnJson.tags;
    } catch (err) {
      warnings.push({
        file: lrnJsonPath,
        message: `Failed to parse lrn.json: ${err instanceof Error ? err.message : String(err)}`,
        severity: "warning",
      });
    }
  }

  // Log errors/warnings if any
  if (errors.length > 0) {
    console.error(`Parse errors (${errors.length}):`);
    for (const err of errors) {
      console.error(`  ${err.file}: ${err.message}`);
    }
  }

  if (warnings.length > 0) {
    console.warn(`Parse warnings (${warnings.length}):`);
    for (const warn of warnings) {
      console.warn(`  ${warn.file}: ${warn.message}`);
    }
  }

  return pkg as Package;
}

/**
 * Reconstruct member hierarchy from flat list of members.
 *
 * Members with dot-notation names (e.g., "Calculator.add") are nested
 * as children of their parent (e.g., "Calculator").
 *
 * File structure like:
 *   Calculator.md
 *   Calculator/add.md
 *   Calculator/subtract.md
 *
 * Becomes:
 *   Calculator (with children: add, subtract)
 */
function reconstructMemberHierarchy(flatMembers: Member[]): Member[] {
  // Build a map of members by name, storing original name for tracking
  const memberMap = new Map<string, Member>();
  const originalNames = new Map<Member, string>();

  for (const member of flatMembers) {
    memberMap.set(member.name, member);
    originalNames.set(member, member.name);
  }

  // Track which members are nested as children
  const nestedMembers = new Set<Member>();

  // Process each member to find children (sort by name length so parents are processed first)
  const sortedMembers = [...flatMembers].sort((a, b) =>
    originalNames.get(a)!.split(".").length - originalNames.get(b)!.split(".").length
  );

  for (const member of sortedMembers) {
    const name = originalNames.get(member)!;

    // Check if this member has a parent
    const lastDot = name.lastIndexOf(".");
    if (lastDot !== -1) {
      const parentName = name.slice(0, lastDot);
      const childName = name.slice(lastDot + 1);

      const parent = memberMap.get(parentName);
      if (parent) {
        // This is a child of an existing member
        // Update the child's name to be just the local name
        member.name = childName;

        // Add to parent's children
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(member);
        nestedMembers.add(member);
      }
    }
  }

  // Return only top-level members (not nested as children)
  return flatMembers.filter((m) => !nestedMembers.has(m));
}

/**
 * Recursively discover all .md files in a directory
 */
function discoverMarkdownFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string): void {
    const entries = readdirSync(currentDir);

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (entry.endsWith(".md")) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files.sort();
}

/**
 * Parse a package and return result with errors
 */
export async function parsePackageWithErrors(
  directory: string
): Promise<ParseResult<Package>> {
  const errors: ParseError[] = [];
  const warnings: ParseError[] = [];

  try {
    const pkg = await parsePackage(directory);
    return { data: pkg, errors, warnings };
  } catch (err) {
    errors.push({
      file: directory,
      message: err instanceof Error ? err.message : String(err),
      severity: "error",
    });
    return { errors, warnings };
  }
}
