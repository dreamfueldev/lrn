/**
 * Markdown Parsing Utilities
 *
 * Helpers for extracting structured content from markdown using marked.
 */

import { Lexer, type Token, type Tokens } from "marked";

export type { Token, Tokens };

/**
 * Parse markdown content into tokens
 */
export function parseMarkdown(content: string): Token[] {
  const lexer = new Lexer();
  return lexer.lex(content);
}

/**
 * Extract the first H1 heading text
 */
export function extractH1(tokens: Token[]): string | undefined {
  for (const token of tokens) {
    if (token.type === "heading" && token.depth === 1) {
      return token.text;
    }
  }
  return undefined;
}

/**
 * Extract the first blockquote content
 */
export function extractFirstBlockquote(tokens: Token[]): string | undefined {
  for (const token of tokens) {
    if (token.type === "blockquote") {
      // Get raw text from blockquote tokens
      const blockquoteToken = token as Tokens.Blockquote;
      return extractTextFromTokens(blockquoteToken.tokens);
    }
  }
  return undefined;
}

/**
 * Extract the first code block, optionally filtered by language
 */
export function extractCodeBlock(
  tokens: Token[],
  language?: string
): { code: string; language?: string } | undefined {
  for (const token of tokens) {
    if (token.type === "code") {
      const codeToken = token as Tokens.Code;
      if (!language || codeToken.lang === language) {
        return {
          code: codeToken.text,
          language: codeToken.lang,
        };
      }
    }
  }
  return undefined;
}

/**
 * Extract all code blocks
 */
export function extractAllCodeBlocks(
  tokens: Token[]
): { code: string; language?: string }[] {
  const blocks: { code: string; language?: string }[] = [];

  for (const token of tokens) {
    if (token.type === "code") {
      const codeToken = token as Tokens.Code;
      blocks.push({
        code: codeToken.text,
        language: codeToken.lang,
      });
    }
  }

  return blocks;
}

/**
 * Extract tokens for a section starting with a specific heading.
 * Returns tokens from after the heading until the next heading of same or higher level.
 */
export function extractSection(
  tokens: Token[],
  heading: string,
  level: number = 2
): Token[] {
  let inSection = false;
  const sectionTokens: Token[] = [];

  for (const token of tokens) {
    if (token.type === "heading") {
      const headingToken = token as Tokens.Heading;

      if (!inSection && headingToken.depth === level) {
        // Check if this is the heading we're looking for
        if (headingToken.text.toLowerCase() === heading.toLowerCase()) {
          inSection = true;
          continue;
        }
      } else if (inSection && headingToken.depth <= level) {
        // End of section (hit another heading of same or higher level)
        break;
      }
    }

    if (inSection) {
      sectionTokens.push(token);
    }
  }

  return sectionTokens;
}

/**
 * Extract all H2 sections as a map of heading → tokens
 */
export function extractAllSections(
  tokens: Token[],
  level: number = 2
): Map<string, Token[]> {
  const sections = new Map<string, Token[]>();
  let currentHeading: string | null = null;
  let currentTokens: Token[] = [];

  for (const token of tokens) {
    if (token.type === "heading") {
      const headingToken = token as Tokens.Heading;

      if (headingToken.depth === level) {
        // Save previous section
        if (currentHeading !== null) {
          sections.set(currentHeading, currentTokens);
        }

        // Start new section
        currentHeading = headingToken.text;
        currentTokens = [];
        continue;
      } else if (headingToken.depth < level && currentHeading !== null) {
        // Hit a higher-level heading, end current section
        sections.set(currentHeading, currentTokens);
        currentHeading = null;
        currentTokens = [];
        continue;
      }
    }

    if (currentHeading !== null) {
      currentTokens.push(token);
    }
  }

  // Save final section
  if (currentHeading !== null) {
    sections.set(currentHeading, currentTokens);
  }

  return sections;
}

/**
 * Extract metadata from a pattern like "**Key:** value" or "**Key**: value"
 */
export function extractMetadata(
  tokens: Token[],
  key: string
): string | undefined {
  for (const token of tokens) {
    if (token.type === "paragraph") {
      const paragraphToken = token as Tokens.Paragraph;
      const text = paragraphToken.text || paragraphToken.raw;

      // Look for **Key:** value pattern
      const pattern = new RegExp(`\\*\\*${key}:\\*\\*\\s*(.+)`, "i");
      const match = text.match(pattern);
      if (match) {
        return match[1]!.trim();
      }

      // Also try **Key**: value (colon outside bold)
      const pattern2 = new RegExp(`\\*\\*${key}\\*\\*:\\s*(.+)`, "i");
      const match2 = text.match(pattern2);
      if (match2) {
        return match2[1]!.trim();
      }
    }
  }
  return undefined;
}

/**
 * Extract metadata from any inline pattern in tokens
 */
export function extractInlineMetadata(
  tokens: Token[],
  key: string
): string | undefined {
  // First check paragraph tokens
  const result = extractMetadata(tokens, key);
  if (result) return result;

  // Also check in text tokens (might be inside lists, etc.)
  for (const token of tokens) {
    if ("tokens" in token && token.tokens) {
      const nested = extractInlineMetadata(token.tokens as Token[], key);
      if (nested) return nested;
    }
  }

  return undefined;
}

/**
 * Get text content between the first heading and the first H2
 * (i.e., the intro/description text)
 */
export function extractIntro(tokens: Token[]): string | undefined {
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
      if (
        token.type === "paragraph" &&
        (token as Tokens.Paragraph).text?.startsWith("**")
      ) {
        continue;
      }

      // Skip blockquotes (they're summaries)
      if (token.type === "blockquote") {
        continue;
      }

      // Collect other content
      const text = tokenToMarkdown(token);
      if (text.trim()) {
        lines.push(text);
      }
    }
  }

  const content = lines.join("\n\n").trim();
  return content || undefined;
}

/**
 * Extract text content from tokens, stripping markdown formatting
 */
export function extractTextFromTokens(tokens: Token[]): string {
  let text = "";

  for (const token of tokens) {
    if ("text" in token && token.text) {
      text += token.text;
    } else if ("tokens" in token && token.tokens) {
      text += extractTextFromTokens(token.tokens as Token[]);
    }
  }

  return text.trim();
}

/**
 * Convert a token back to markdown string (simplified)
 */
export function tokenToMarkdown(token: Token): string {
  switch (token.type) {
    case "paragraph":
      return (token as Tokens.Paragraph).text || "";

    case "code":
      const codeToken = token as Tokens.Code;
      return "```" + (codeToken.lang || "") + "\n" + codeToken.text + "\n```";

    case "heading":
      const headingToken = token as Tokens.Heading;
      return "#".repeat(headingToken.depth) + " " + headingToken.text;

    case "list":
      const listToken = token as Tokens.List;
      return listToken.items
        .map((item) => {
          const prefix = listToken.ordered ? "1. " : "- ";
          return prefix + extractTextFromTokens(item.tokens);
        })
        .join("\n");

    case "blockquote":
      const blockquoteToken = token as Tokens.Blockquote;
      return "> " + extractTextFromTokens(blockquoteToken.tokens);

    case "table":
      return (token as Tokens.Table).raw || "";

    case "space":
      return "";

    default:
      return "raw" in token ? (token.raw as string) : "";
  }
}

/**
 * Convert tokens array back to markdown
 */
export function tokensToMarkdown(tokens: Token[]): string {
  return tokens.map(tokenToMarkdown).join("\n\n");
}

/**
 * Extract table from tokens as raw markdown
 */
export function extractTableMarkdown(tokens: Token[]): string | undefined {
  for (const token of tokens) {
    if (token.type === "table") {
      return (token as Tokens.Table).raw;
    }
  }
  return undefined;
}

/**
 * Find and extract deprecated notice from blockquotes
 * Looks for "> **Deprecated:** message" or "> Deprecated: message"
 */
export function extractDeprecated(tokens: Token[]): string | undefined {
  for (const token of tokens) {
    if (token.type === "blockquote") {
      const blockquoteToken = token as Tokens.Blockquote;
      const text = extractTextFromTokens(blockquoteToken.tokens);

      // Check for deprecated pattern
      const match = text.match(/^\s*\*?\*?Deprecated:?\*?\*?:?\s*(.+)/i);
      if (match) {
        return match[1]!.trim();
      }
    }
  }
  return undefined;
}

/**
 * Parse H1 that may contain version info: "# name v1.2.3" or "# name 1.2.3"
 */
export function parseH1WithVersion(
  h1: string
): { name: string; version?: string } {
  // Try to match "name v1.2.3" or "name 1.2.3"
  const match = h1.match(/^(.+?)\s+v?(\d+\.\d+\.\d+.*)$/);
  if (match) {
    return {
      name: match[1]!.trim(),
      version: match[2]!.trim(),
    };
  }
  return { name: h1.trim() };
}
