/**
 * llms.txt Parser
 *
 * Detects and parses llms.txt format for documentation discovery.
 *
 * Format:
 * # Title
 * > Description
 *
 * ## Section
 * - Label: /path/to/doc
 * - Another Label: https://example.com/doc
 */

import type { LlmsTxt, LlmsTxtSection, LlmsTxtEntry } from "./types.js";
import { getOrigin } from "./fetcher.js";

/**
 * Check if a URL points to an llms.txt file
 */
export function isLlmsTxtUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname.endsWith("/llms.txt") || parsed.pathname === "/llms.txt";
  } catch {
    return false;
  }
}

/**
 * Check if a URL points to an llms-full.txt file
 */
export function isLlmsFullUrl(url: string): boolean {
  try {
    return new URL(url).pathname.endsWith("/llms-full.txt");
  } catch {
    return false;
  }
}

/**
 * Parse llms.txt content
 */
export function parseLlmsTxt(content: string): LlmsTxt {
  const lines = content.split("\n");

  let title: string | undefined;
  let description: string | undefined;
  const sections: LlmsTxtSection[] = [];
  let currentSection: LlmsTxtSection | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Title: # Title
    const titleMatch = trimmed.match(/^#\s+(.+)$/);
    if (titleMatch && !title) {
      title = titleMatch[1]!.trim();
      continue;
    }

    // Description: > Description
    const descMatch = trimmed.match(/^>\s*(.+)$/);
    if (descMatch && !description) {
      description = descMatch[1]!.trim();
      continue;
    }

    // Section: ## Section
    const sectionMatch = trimmed.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      currentSection = {
        title: sectionMatch[1]!.trim(),
        entries: [],
      };
      sections.push(currentSection);
      continue;
    }

    // Entry: - Label: /path or - Label: https://...
    const entryMatch = trimmed.match(/^-\s+(.+?):\s+(\S+)$/);
    if (entryMatch && currentSection) {
      currentSection.entries.push({
        label: entryMatch[1]!.trim(),
        path: entryMatch[2]!.trim(),
      });
      continue;
    }

    // Entry without label: - /path
    const simpleEntryMatch = trimmed.match(/^-\s+(\S+)$/);
    if (simpleEntryMatch && currentSection) {
      const path = simpleEntryMatch[1]!.trim();
      currentSection.entries.push({
        label: pathToLabel(path),
        path,
      });
    }
  }

  return { title, description, sections };
}

/**
 * Convert a path to a label
 */
function pathToLabel(path: string): string {
  // Remove extension
  let label = path.replace(/\.(md|html|htm|txt)$/i, "");

  // Get last segment
  const segments = label.split("/").filter(Boolean);
  label = segments[segments.length - 1] || label;

  // Convert to title case
  return label
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Extract all URLs from llms.txt
 */
export function extractUrls(llmsTxt: LlmsTxt, baseUrl: string): string[] {
  const origin = getOrigin(baseUrl);
  const urls: string[] = [];

  for (const section of llmsTxt.sections) {
    for (const entry of section.entries) {
      let url: string;

      if (entry.path.startsWith("http://") || entry.path.startsWith("https://")) {
        // Absolute URL
        url = entry.path;
      } else {
        // Relative path
        url = new URL(entry.path, origin).href;
      }

      urls.push(url);
    }
  }

  return urls;
}

/**
 * Get the llms.txt URL for a domain
 */
export function getLlmsTxtUrl(url: string): string {
  return `${getOrigin(url)}/llms.txt`;
}
