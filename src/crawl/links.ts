/**
 * Link Extraction
 *
 * Extracts links from markdown and filters by patterns.
 */

import micromatch from "micromatch";
import { isSameOrigin, normalizeUrl } from "./fetcher.js";

/**
 * Extract all links from markdown content
 */
export function extractLinks(markdown: string, baseUrl: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();

  // Match markdown links: [text](url)
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;

  while ((match = linkRegex.exec(markdown)) !== null) {
    const rawUrl = match[2]!.trim();

    // Skip anchor links, mailto, tel, javascript, etc.
    if (
      rawUrl.startsWith("#") ||
      rawUrl.startsWith("mailto:") ||
      rawUrl.startsWith("tel:") ||
      rawUrl.startsWith("javascript:")
    ) {
      continue;
    }

    try {
      // Resolve relative URLs
      const resolved = new URL(rawUrl, baseUrl).href;
      const normalized = normalizeUrl(resolved);

      // Skip duplicates
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);

      links.push(normalized);
    } catch {
      // Skip invalid URLs
    }
  }

  return links;
}

/**
 * Filter links to only same-origin URLs
 */
export function filterSameOrigin(links: string[], baseUrl: string): string[] {
  return links.filter((link) => isSameOrigin(link, baseUrl));
}

/**
 * Filter links by include/exclude patterns
 */
export function filterByPatterns(
  links: string[],
  include: string[],
  exclude: string[]
): string[] {
  return links.filter((link) => {
    // Get the path for pattern matching
    let path: string;
    try {
      path = new URL(link).pathname;
    } catch {
      return false;
    }

    // If include patterns are specified, URL must match at least one
    if (include.length > 0) {
      const matches = micromatch.isMatch(path, include);
      if (!matches) {
        return false;
      }
    }

    // If exclude patterns are specified, URL must not match any
    if (exclude.length > 0) {
      const matches = micromatch.isMatch(path, exclude);
      if (matches) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Filter and process links for crawling
 */
export function processLinks(
  links: string[],
  baseUrl: string,
  include: string[],
  exclude: string[]
): string[] {
  // First filter to same origin
  let filtered = filterSameOrigin(links, baseUrl);

  // Then apply include/exclude patterns
  filtered = filterByPatterns(filtered, include, exclude);

  return filtered;
}

/**
 * Check if a URL matches the include/exclude patterns
 */
export function urlMatchesPatterns(
  url: string,
  include: string[],
  exclude: string[]
): boolean {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return false;
  }

  // If include patterns are specified, URL must match at least one
  if (include.length > 0) {
    const matches = micromatch.isMatch(path, include);
    if (!matches) {
      return false;
    }
  }

  // If exclude patterns are specified, URL must not match any
  if (exclude.length > 0) {
    const matches = micromatch.isMatch(path, exclude);
    if (matches) {
      return false;
    }
  }

  return true;
}

/**
 * Normalize patterns for use with micromatch
 * - Ensure patterns start with /
 * - Add ** for directory patterns
 */
export function normalizePatterns(patterns: string[]): string[] {
  return patterns.map((pattern) => {
    // Ensure pattern starts with /
    if (!pattern.startsWith("/") && !pattern.startsWith("*")) {
      pattern = "/" + pattern;
    }

    // If pattern ends with / add ** to match all files in directory
    if (pattern.endsWith("/")) {
      pattern = pattern + "**";
    }

    return pattern;
  });
}
