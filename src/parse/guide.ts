/**
 * Guide Parser
 *
 * Parses markdown files into Guide IR.
 */

import type {
  Guide,
  GuideKind,
  Section,
  Example,
  Reference,
} from "../schema/index.js";
import {
  parseMarkdown,
  extractH1,
  extractFirstBlockquote,
  extractMetadata,
  extractAllSections,
  extractAllCodeBlocks,
  tokensToMarkdown,
  extractTextFromTokens,
  type Token,
  type Tokens,
} from "./markdown.js";

/**
 * Parse a markdown file content into a Guide
 */
export function parseGuide(content: string, filename: string): Guide {
  const tokens = parseMarkdown(content);

  // Extract H1 as title
  const h1 = extractH1(tokens);
  const title = h1 || filenameToTitle(filename);

  // Derive slug from filename
  const slug = filenameToSlug(filename);

  // Extract kind from **Type:** line
  const kindRaw = extractMetadata(tokens, "Type");
  const kind = parseKind(kindRaw);

  // Extract level from **Level:** line
  const levelRaw = extractMetadata(tokens, "Level");
  const level = parseLevel(levelRaw);

  // Extract summary from first blockquote
  const summary = extractFirstBlockquote(tokens);

  // Extract intro (text before first H2, after metadata)
  const intro = extractGuideIntro(tokens);

  // Parse H2 sections
  const sections = parseSections(tokens);

  // Extract tags from **Tags:** line
  const tagsRaw = extractMetadata(tokens, "Tags");
  const tags = tagsRaw ? parseTags(tagsRaw) : undefined;

  // Extract see also references from ## See Also section
  const see = parseSeeAlso(tokens);

  // Build guide
  const guide: Guide = {
    slug,
    title,
    kind,
    sections,
  };

  if (summary) guide.summary = summary;
  if (intro) guide.intro = intro;
  if (tags && tags.length > 0) guide.tags = tags;
  if (see && see.length > 0) guide.see = see;
  if (level) guide.level = level;

  return guide;
}

/**
 * Convert filename to slug
 * e.g., "getting-started.md" → "getting-started"
 */
function filenameToSlug(filename: string): string {
  return filename
    .replace(/\.md$/, "")
    .replace(/\//g, "-")
    .replace(/\\/g, "-");
}

/**
 * Convert filename to title
 * e.g., "getting-started.md" → "Getting Started"
 */
function filenameToTitle(filename: string): string {
  const slug = filenameToSlug(filename);
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Parse guide kind from string
 */
function parseKind(raw: string | undefined): GuideKind {
  if (!raw) return "howto";

  const normalized = raw.toLowerCase().trim();
  const validKinds: GuideKind[] = [
    "quickstart",
    "tutorial",
    "concept",
    "howto",
    "example",
  ];

  for (const kind of validKinds) {
    if (normalized === kind) return kind;
  }

  return "howto";
}

/**
 * Parse level from string
 */
function parseLevel(
  raw: string | undefined
): "beginner" | "intermediate" | "advanced" | undefined {
  if (!raw) return undefined;

  const normalized = raw.toLowerCase().trim();

  if (normalized === "beginner") return "beginner";
  if (normalized === "intermediate") return "intermediate";
  if (normalized === "advanced") return "advanced";

  return undefined;
}

/**
 * Extract intro text for guide (between H1 and first H2, excluding metadata)
 */
function extractGuideIntro(tokens: Token[]): string | undefined {
  const lines: string[] = [];
  let pastH1 = false;

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
      // Skip metadata lines (starting with **)
      if (token.type === "paragraph") {
        const text = (token as Tokens.Paragraph).text || "";
        if (
          text.startsWith("**Type:**") ||
          text.startsWith("**Type**:") ||
          text.startsWith("**Level:**") ||
          text.startsWith("**Level**:") ||
          text.startsWith("**Tags:**") ||
          text.startsWith("**Tags**:")
        ) {
          continue;
        }
      }

      // Skip blockquotes (they're summaries)
      if (token.type === "blockquote") {
        continue;
      }

      // Collect other content
      const text = tokensToMarkdown([token]);
      if (text.trim()) {
        lines.push(text);
      }
    }
  }

  const content = lines.join("\n\n").trim();
  return content || undefined;
}

/**
 * Parse H2 sections into Section array
 */
function parseSections(tokens: Token[]): Section[] {
  const sections: Section[] = [];
  const h2Sections = extractAllSections(tokens, 2);

  for (const [title, sectionTokens] of h2Sections) {
    // Skip "See Also" section as it's metadata
    if (title.toLowerCase() === "see also") continue;

    const section = parseSection(title, sectionTokens);
    sections.push(section);
  }

  return sections;
}

/**
 * Parse a single section
 */
function parseSection(title: string, tokens: Token[]): Section {
  // Generate id from title
  const id = titleToId(title);

  // Extract summary from first blockquote in section
  let summary: string | undefined;
  for (const token of tokens) {
    if (token.type === "blockquote") {
      summary = extractTextFromTokens((token as Tokens.Blockquote).tokens);
      break;
    }
  }

  // Get content (excluding code blocks and subsections)
  const content = extractSectionContent(tokens);

  // Extract code examples
  const examples = extractExamples(tokens);

  // Parse nested H3 sections
  const nestedSections = parseNestedSections(tokens);

  const section: Section = {
    id,
    title,
    content,
  };

  if (summary) section.summary = summary;
  if (examples && examples.length > 0) section.examples = examples;
  if (nestedSections && nestedSections.length > 0) {
    section.sections = nestedSections;
  }

  return section;
}

/**
 * Convert title to URL-friendly id
 */
function titleToId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Extract section content as markdown, excluding code blocks
 */
function extractSectionContent(tokens: Token[]): string {
  const contentTokens: Token[] = [];
  let inH3 = false;

  for (const token of tokens) {
    // Stop at H3 sections
    if (token.type === "heading" && (token as Tokens.Heading).depth === 3) {
      inH3 = true;
      continue;
    }

    // Skip if we're in a nested section
    if (inH3) {
      if (token.type === "heading" && (token as Tokens.Heading).depth <= 3) {
        inH3 = (token as Tokens.Heading).depth === 3;
      }
      continue;
    }

    // Skip blockquotes (used for summaries)
    if (token.type === "blockquote") continue;

    // Skip code blocks (they become examples)
    if (token.type === "code") continue;

    contentTokens.push(token);
  }

  return tokensToMarkdown(contentTokens).trim();
}

/**
 * Extract code examples from section tokens
 */
function extractExamples(tokens: Token[]): Example[] | undefined {
  const examples: Example[] = [];
  let pendingTitle: string | undefined;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;

    // Look for **Title:** pattern before code blocks
    if (token.type === "paragraph") {
      const text = (token as Tokens.Paragraph).text || "";
      const titleMatch = text.match(/^\*\*(.+?):\*\*$/);
      if (titleMatch) {
        pendingTitle = titleMatch[1];
        continue;
      }
    }

    if (token.type === "code") {
      const codeToken = token as Tokens.Code;
      const example: Example = {
        code: codeToken.text,
      };

      if (pendingTitle) {
        example.title = pendingTitle;
        pendingTitle = undefined;
      }

      if (codeToken.lang) {
        example.language = codeToken.lang;
      }

      examples.push(example);
    }
  }

  return examples.length > 0 ? examples : undefined;
}

/**
 * Parse nested H3 sections
 */
function parseNestedSections(tokens: Token[]): Section[] | undefined {
  const sections: Section[] = [];
  const h3Sections = extractAllSections(tokens, 3);

  for (const [title, sectionTokens] of h3Sections) {
    const section = parseSection(title, sectionTokens);
    sections.push(section);
  }

  return sections.length > 0 ? sections : undefined;
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

/**
 * Parse See Also section into references
 */
function parseSeeAlso(tokens: Token[]): Reference[] | undefined {
  const seeSection = extractAllSections(tokens, 2).get("See Also");
  if (!seeSection || seeSection.length === 0) return undefined;

  const references: Reference[] = [];

  for (const token of seeSection) {
    if (token.type === "list") {
      const listToken = token as Tokens.List;
      for (const item of listToken.items) {
        const text = extractTextFromTokens(item.tokens);

        // Parse markdown link: [label](target)
        const linkMatch = text.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
          const label = linkMatch[1]!;
          const target = linkMatch[2]!;

          const ref = parseReference(target, label);
          references.push(ref);
        } else {
          // Plain text reference
          const ref = parseReference(text.trim());
          references.push(ref);
        }
      }
    }
  }

  return references.length > 0 ? references : undefined;
}

/**
 * Parse a reference target into a Reference object
 */
function parseReference(target: string, label?: string): Reference {
  // URL
  if (target.startsWith("http://") || target.startsWith("https://")) {
    return {
      type: "url",
      target,
      label,
    };
  }

  // Guide reference
  if (target.startsWith("guide:") || target.startsWith("guides/")) {
    const slug = target.replace(/^guide:|^guides\//, "");
    return {
      type: "guide",
      target: slug,
      label,
    };
  }

  // Schema reference
  if (target.startsWith("schema:") || target.startsWith("types/")) {
    const name = target.replace(/^schema:|^types\//, "");
    return {
      type: "schema",
      target: name,
      label,
    };
  }

  // Default to member reference
  return {
    type: "member",
    target: target.replace(/^member:/, ""),
    label,
  };
}
