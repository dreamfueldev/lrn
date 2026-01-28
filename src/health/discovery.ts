/**
 * File Discovery
 *
 * Discovers markdown files and identifies their types.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, basename, dirname, extname } from "node:path";
import type { FileContext, FileType, CheckContext } from "./types.js";
import { parseMarkdown } from "../parse/markdown.js";

/**
 * Discover all markdown files in a directory
 */
export function discoverFiles(basePath: string): FileContext[] {
  const stat = statSync(basePath);

  if (stat.isFile()) {
    // Single file
    if (!basePath.endsWith(".md")) {
      return [];
    }
    return [createFileContext(basePath, dirname(basePath), basePath)];
  }

  // Directory - recursively find all .md files
  const files: FileContext[] = [];
  walkDirectory(basePath, basePath, files);
  return files;
}

/**
 * Recursively walk a directory and collect markdown files
 */
function walkDirectory(
  dir: string,
  baseDir: string,
  files: FileContext[]
): void {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    // Skip hidden files and node_modules
    if (entry.startsWith(".") || entry === "node_modules") {
      continue;
    }

    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      walkDirectory(fullPath, baseDir, files);
    } else if (entry.endsWith(".md")) {
      files.push(createFileContext(fullPath, baseDir, fullPath));
    }
  }
}

/**
 * Create a FileContext for a markdown file
 */
function createFileContext(
  absolutePath: string,
  baseDir: string,
  originalPath: string
): FileContext {
  const relPath = relative(baseDir, absolutePath);
  const content = readFileSync(absolutePath, "utf-8");
  const fileType = identifyFileType(relPath);

  // Try to parse the markdown
  let tokens;
  let parseError;
  try {
    tokens = parseMarkdown(content);
  } catch (err) {
    parseError = err instanceof Error ? err.message : String(err);
  }

  return {
    path: relPath,
    absolutePath,
    type: fileType,
    content,
    tokens,
    parseError,
  };
}

/**
 * Identify the file type based on its path
 */
function identifyFileType(relPath: string): FileType {
  const normalized = relPath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  const filename = basename(normalized, ".md");

  // package index.md
  if (normalized === "index.md") {
    return "package";
  }

  // members/ directory
  if (parts[0] === "members") {
    return "member";
  }

  // guides/ directory
  if (parts[0] === "guides") {
    return "guide";
  }

  // types/ or schemas/ directory
  if (parts[0] === "types" || parts[0] === "schemas") {
    return "schema";
  }

  return "unknown";
}

/**
 * Build the check context from discovered files
 */
export function buildCheckContext(
  baseDir: string,
  files: FileContext[]
): CheckContext {
  const allFiles = new Map<string, FileContext>();
  const memberPaths = new Set<string>();
  const guideSlugs = new Set<string>();
  const schemaNames = new Set<string>();

  for (const file of files) {
    allFiles.set(file.path, file);

    // Build reference indexes
    switch (file.type) {
      case "member": {
        // Convert file path to member path: members/namespace/method.md -> namespace.method
        const memberPath = file.path
          .replace(/^members\//, "")
          .replace(/\.md$/, "")
          .replace(/\//g, ".");
        memberPaths.add(memberPath);
        break;
      }
      case "guide": {
        // Convert file path to guide slug: guides/getting-started.md -> getting-started
        const slug = file.path
          .replace(/^guides\//, "")
          .replace(/\.md$/, "");
        guideSlugs.add(slug);
        break;
      }
      case "schema": {
        // Convert file path to schema name: types/User.md -> User
        const name = basename(file.path, ".md");
        schemaNames.add(name);
        break;
      }
    }
  }

  return {
    baseDir,
    allFiles,
    memberPaths,
    guideSlugs,
    schemaNames,
  };
}

/**
 * Get line number for a character index in content
 */
export function getLineNumber(content: string, index: number): number {
  const lines = content.slice(0, index).split("\n");
  return lines.length;
}
