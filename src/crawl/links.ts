/**
 * URL Pattern Filtering
 *
 * Filters URLs by include/exclude patterns for --include/--exclude support.
 */

import micromatch from "micromatch";

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
