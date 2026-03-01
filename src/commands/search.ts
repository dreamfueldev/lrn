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
import { ArgumentError } from "../errors.js";
import { readCredentials } from "../credentials.js";
import { RegistryClient } from "../registry.js";

export async function runSearch(args: ParsedArgs, config: ResolvedConfig): Promise<string> {
  const query = args.positional[0] || "";
  const packageName = args.package;

  if (!query) {
    throw new ArgumentError("Usage: lrn search <query> or lrn <package> search <query>");
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

  // Apply filters
  if (args.options.tag && args.options.tag.length > 0) {
    results = results.filter((r) =>
      r.tags?.some((t) =>
        args.options.tag.some((ft) => t.toLowerCase() === ft.toLowerCase())
      )
    );
  }

  if (args.options.kind) {
    results = results.filter((r) => r.kind === args.options.kind);
  }

  if (!args.flags.deprecated) {
    results = results.filter((r) => !r.deprecated);
  }

  // Registry fallback for global search with no local results
  if (results.length === 0 && !packageName) {
    const creds = readCredentials(config.cache);
    if (creds) {
      try {
        const client = new RegistryClient(creds.registry || config.registry, creds.token);
        const registryResults = await client.resolve(query);
        if (registryResults.length > 0) {
          let output = `No local results. Found in registry:\n\n`;
          for (const r of registryResults) {
            output += `  ${r.fullName} — ${r.description}\n`;
          }
          output += `\nRun lrn add <package> to install.`;
          return output;
        }
      } catch {
        // Registry fallback is best-effort
      }
    }
  }

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

  return format(searchResults, options);
}

function searchPackage(pkg: Package, query: string): SearchResult[] {
  const results: SearchResult[] = [];
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  // Search members
  function searchMembers(members: Member[], path = ""): void {
    for (const member of members) {
      const fullPath = path ? `${path}.${member.name}` : member.name;
      const score = calculateScore(member, terms, fullPath);

      if (score > 0) {
        results.push({
          package: pkg.name,
          type: "member",
          path: fullPath,
          name: member.name,
          summary: member.summary,
          score,
          tags: member.tags,
          kind: member.kind,
          deprecated: member.deprecated ? true : undefined,
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
      const score = calculateGuideScore(guide, terms);

      if (score > 0) {
        results.push({
          package: pkg.name,
          type: "guide",
          path: guide.slug,
          name: guide.title,
          summary: guide.summary,
          score,
          tags: guide.tags,
        });
      }
    }
  }

  searchMembers(pkg.members);
  searchGuides(pkg.guides);

  return results;
}

function calculateScore(member: Member, terms: string[], path: string): number {
  const lowerPath = path.toLowerCase();
  const lowerName = member.name.toLowerCase();
  const lowerSummary = member.summary?.toLowerCase();
  const lowerDescription = member.description?.toLowerCase();

  let totalScore = 0;

  for (const term of terms) {
    let termScore = 0;

    // Exact name match (highest priority)
    if (lowerName === term) {
      termScore += 100;
    }
    // Name starts with term
    else if (lowerName.startsWith(term)) {
      termScore += 50;
    }
    // Name contains term
    else if (lowerName.includes(term)) {
      termScore += 30;
    }
    // Path contains term
    else if (lowerPath.includes(term)) {
      termScore += 20;
    }

    // Summary contains term
    if (lowerSummary?.includes(term)) {
      termScore += 10;
    }

    // Description contains term
    if (lowerDescription?.includes(term)) {
      termScore += 5;
    }

    // Tags contain term
    if (member.tags?.some((t) => t.toLowerCase().includes(term))) {
      termScore += 15;
    }

    // Parameter types contain term
    if (member.parameters?.some((p) => p.type?.toLowerCase().includes(term))) {
      termScore += 15;
    }

    // AND semantics: every term must match somewhere
    if (termScore === 0) return 0;

    totalScore += termScore;
  }

  return totalScore;
}

function calculateGuideScore(guide: Guide, terms: string[]): number {
  const lowerTitle = guide.title.toLowerCase();
  const lowerSlug = guide.slug.toLowerCase();
  const lowerSummary = guide.summary?.toLowerCase();

  let totalScore = 0;

  for (const term of terms) {
    let termScore = 0;

    // Exact slug match
    if (lowerSlug === term) {
      termScore += 100;
    }
    // Slug starts with term
    else if (lowerSlug.startsWith(term)) {
      termScore += 50;
    }
    // Title contains term
    else if (lowerTitle.includes(term)) {
      termScore += 40;
    }
    // Slug contains term
    else if (lowerSlug.includes(term)) {
      termScore += 30;
    }

    // Summary contains term
    if (lowerSummary?.includes(term)) {
      termScore += 10;
    }

    // Tags contain term
    if (guide.tags?.some((t) => t.toLowerCase().includes(term))) {
      termScore += 15;
    }

    // AND semantics: every term must match somewhere
    if (termScore === 0) return 0;

    totalScore += termScore;
  }

  return totalScore;
}
