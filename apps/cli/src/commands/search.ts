/**
 * Search Command
 *
 * `lrn <package> search <query>` - search within a package
 * `lrn search <query>` - search across all cached packages
 */

import type { Member, Guide, Package } from "../schema/index.js";
import type { ParsedArgs } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import { loadPackage, loadAllPackages } from "../cache.js";
import {
  format,
  getOutputFormat,
  type FormatOptions,
  type SearchResults,
  type SearchResult,
} from "../format/index.js";

export function runSearch(args: ParsedArgs, config: ResolvedConfig): void {
  const query = args.positional[0] || "";
  const packageName = args.package;

  if (!query) {
    console.error("Usage: lrn search <query> or lrn <package> search <query>");
    process.exit(1);
  }

  let results: SearchResult[];

  if (packageName) {
    // Scoped search within a package
    const pkg = loadPackage(config, packageName);
    results = searchPackage(pkg, query);
  } else {
    // Global search across all packages
    const packages = loadAllPackages(config);
    results = [];
    for (const pkg of packages) {
      results.push(...searchPackage(pkg, query));
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  const searchResults: SearchResults = {
    kind: "search-results",
    query,
    results,
  };

  const outputFormat = getOutputFormat(args, config);
  const options: FormatOptions = {
    format: outputFormat,
    full: args.flags.full,
    packageName,
  };

  console.log(format(searchResults, options));
}

function searchPackage(pkg: Package, query: string): SearchResult[] {
  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  // Search members
  function searchMembers(members: Member[], path = ""): void {
    for (const member of members) {
      const fullPath = path ? `${path}.${member.name}` : member.name;
      const score = calculateScore(member, lowerQuery, fullPath);

      if (score > 0) {
        results.push({
          package: pkg.name,
          type: "member",
          path: fullPath,
          name: member.name,
          summary: member.summary,
          score,
        });
      }

      if (member.children) {
        searchMembers(member.children, fullPath);
      }
    }
  }

  // Search guides
  function searchGuides(guides: Guide[]): void {
    for (const guide of guides) {
      const score = calculateGuideScore(guide, lowerQuery);

      if (score > 0) {
        results.push({
          package: pkg.name,
          type: "guide",
          path: guide.slug,
          name: guide.title,
          summary: guide.summary,
          score,
        });
      }
    }
  }

  searchMembers(pkg.members);
  searchGuides(pkg.guides);

  return results;
}

function calculateScore(member: Member, query: string, path: string): number {
  let score = 0;
  const lowerPath = path.toLowerCase();
  const lowerName = member.name.toLowerCase();

  // Exact name match (highest priority)
  if (lowerName === query) {
    score += 100;
  }
  // Name starts with query
  else if (lowerName.startsWith(query)) {
    score += 50;
  }
  // Name contains query
  else if (lowerName.includes(query)) {
    score += 30;
  }
  // Path contains query
  else if (lowerPath.includes(query)) {
    score += 20;
  }

  // Summary contains query
  if (member.summary?.toLowerCase().includes(query)) {
    score += 10;
  }

  // Description contains query
  if (member.description?.toLowerCase().includes(query)) {
    score += 5;
  }

  // Tags contain query
  if (member.tags?.some((t) => t.toLowerCase().includes(query))) {
    score += 15;
  }

  return score;
}

function calculateGuideScore(guide: Guide, query: string): number {
  let score = 0;
  const lowerTitle = guide.title.toLowerCase();
  const lowerSlug = guide.slug.toLowerCase();

  // Exact slug match
  if (lowerSlug === query) {
    score += 100;
  }
  // Slug starts with query
  else if (lowerSlug.startsWith(query)) {
    score += 50;
  }
  // Title contains query
  else if (lowerTitle.includes(query)) {
    score += 40;
  }
  // Slug contains query
  else if (lowerSlug.includes(query)) {
    score += 30;
  }

  // Summary contains query
  if (guide.summary?.toLowerCase().includes(query)) {
    score += 10;
  }

  // Tags contain query
  if (guide.tags?.some((t) => t.toLowerCase().includes(query))) {
    score += 15;
  }

  return score;
}
