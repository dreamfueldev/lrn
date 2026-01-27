/**
 * Package Index Parser
 *
 * Parses index.md into Package metadata.
 */

import type { Package, PackageLinks, SourceInfo } from "../schema/index.js";
import {
  parseMarkdown,
  extractH1,
  extractFirstBlockquote,
  extractIntro,
  extractMetadata,
  extractSection,
  extractTextFromTokens,
  parseH1WithVersion,
  type Token,
  type Tokens,
} from "./markdown.js";

/**
 * Parse index.md content into partial Package metadata
 * Members, guides, and schemas are added separately by parsePackage()
 */
export function parsePackageIndex(content: string): Partial<Package> {
  const tokens = parseMarkdown(content);

  // Parse H1 for name and version
  const h1 = extractH1(tokens);
  const { name, version } = h1 ? parseH1WithVersion(h1) : { name: "unknown" };

  // Extract summary from first blockquote
  const summary = extractFirstBlockquote(tokens);

  // Extract description (text before first H2, after metadata)
  const description = extractPackageDescription(tokens);

  // Extract source info
  const source = parseSourceInfo(tokens);

  // Extract links from ## Links section
  const links = parseLinks(tokens);

  // Extract package-level tags
  const tagsRaw = extractMetadata(tokens, "Tags");
  const tags = tagsRaw ? parseTags(tagsRaw) : undefined;

  // Build package
  const pkg: Partial<Package> = {
    name,
    source,
    members: [],
    guides: [],
    schemas: {},
  };

  if (version) pkg.version = version;
  if (summary) pkg.summary = summary;
  if (description) pkg.description = description;
  if (tags && tags.length > 0) pkg.tags = tags;
  if (links && Object.keys(links).length > 0) pkg.links = links;

  return pkg;
}

/**
 * Extract description for package (between H1 and first H2, excluding metadata and summary)
 */
function extractPackageDescription(tokens: Token[]): string | undefined {
  const lines: string[] = [];
  let pastH1 = false;
  let pastBlockquote = false;

  for (const token of tokens) {
    if (token.type === "heading") {
      const headingToken = token as Tokens.Heading;
      if (headingToken.depth === 1) {
        pastH1 = true;
        continue;
      }
      if (headingToken.depth === 2 && pastH1) {
        // Stop at first H2
        break;
      }
    }

    if (pastH1) {
      // Skip first blockquote (it's the summary)
      if (token.type === "blockquote" && !pastBlockquote) {
        pastBlockquote = true;
        continue;
      }

      // Skip metadata lines
      if (token.type === "paragraph") {
        const text = (token as Tokens.Paragraph).text || "";
        if (
          text.startsWith("**Source:**") ||
          text.startsWith("**Source**:") ||
          text.startsWith("**Tags:**") ||
          text.startsWith("**Tags**:") ||
          text.startsWith("**BaseURL:**") ||
          text.startsWith("**BaseURL**:")
        ) {
          continue;
        }
      }

      // Collect other content
      if (token.type === "paragraph") {
        const text = (token as Tokens.Paragraph).text;
        if (text?.trim()) {
          lines.push(text);
        }
      }
    }
  }

  const content = lines.join("\n\n").trim();
  return content || undefined;
}

/**
 * Parse source info from metadata lines
 */
function parseSourceInfo(tokens: Token[]): SourceInfo {
  const sourceType = extractMetadata(tokens, "Source");
  const baseUrl = extractMetadata(tokens, "BaseURL");
  const url = extractMetadata(tokens, "URL");
  const generatedAt = extractMetadata(tokens, "GeneratedAt");

  const source: SourceInfo = {
    type: parseSourceType(sourceType),
  };

  if (url) source.url = url;
  if (baseUrl) source.baseUrl = baseUrl;
  if (generatedAt) source.generatedAt = generatedAt;

  return source;
}

/**
 * Parse source type string
 */
function parseSourceType(raw: string | undefined): SourceInfo["type"] {
  if (!raw) return "markdown";

  const normalized = raw.toLowerCase().replace(/`/g, "").trim();

  switch (normalized) {
    case "openapi":
    case "swagger":
      return "openapi";
    case "typescript":
    case "ts":
      return "typescript";
    case "jsdoc":
      return "jsdoc";
    case "markdown":
    case "md":
      return "markdown";
    default:
      return "custom";
  }
}

/**
 * Parse links from ## Links section
 */
function parseLinks(tokens: Token[]): PackageLinks | undefined {
  const linksSection = extractSection(tokens, "Links");
  if (linksSection.length === 0) return undefined;

  const links: PackageLinks = {};

  for (const token of linksSection) {
    if (token.type === "list") {
      const listToken = token as Tokens.List;
      for (const item of listToken.items) {
        const text = extractTextFromTokens(item.tokens);

        // Parse markdown link: [label](url)
        const linkMatch = text.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
          const label = linkMatch[1]!.toLowerCase();
          const url = linkMatch[2]!;

          if (label.includes("home") || label.includes("website")) {
            links.homepage = url;
          } else if (label.includes("repo") || label.includes("source") || label.includes("github")) {
            links.repository = url;
          } else if (label.includes("change") || label.includes("release")) {
            links.changelog = url;
          } else if (label.includes("doc")) {
            links.documentation = url;
          }
        }

        // Also try pattern: **Label:** url
        const metaMatch = text.match(/\*\*([^*]+)\*\*:?\s*(.+)/);
        if (metaMatch) {
          const label = metaMatch[1]!.toLowerCase();
          const url = metaMatch[2]!.trim();

          if (label.includes("home") || label.includes("website")) {
            links.homepage = url;
          } else if (label.includes("repo") || label.includes("source") || label.includes("github")) {
            links.repository = url;
          } else if (label.includes("change") || label.includes("release")) {
            links.changelog = url;
          } else if (label.includes("doc")) {
            links.documentation = url;
          }
        }
      }
    }
  }

  return Object.keys(links).length > 0 ? links : undefined;
}

/**
 * Parse tags from comma-separated string
 */
function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.replace(/`/g, "").trim())
    .filter((t) => t.length > 0);
}
