/**
 * Member Parser
 *
 * Parses markdown files into Member IR.
 */

import type {
  Member,
  MemberKind,
  Parameter,
  Returns,
  Example,
  Reference,
} from "../schema/index.js";
import {
  parseMarkdown,
  extractH1,
  extractFirstBlockquote,
  extractCodeBlock,
  extractSection,
  extractAllSections,
  extractMetadata,
  extractIntro,
  extractTableMarkdown,
  extractAllCodeBlocks,
  extractDeprecated,
  tokensToMarkdown,
  type Token,
} from "./markdown.js";
import { parseParameterTable } from "./table.js";

/**
 * Parse a markdown file content into a Member
 */
export function parseMember(content: string, filename: string): Member {
  const tokens = parseMarkdown(content);

  // Always use filename-derived name for proper hierarchy reconstruction
  // The file path determines the member's position in the tree
  // e.g., "Calculator/add.md" → "Calculator.add"
  const name = filenameToName(filename);

  // Extract kind from **Kind:** line
  const kindRaw = extractMetadata(tokens, "Kind");
  const kind = parseKind(kindRaw);

  // Extract summary from first blockquote
  const summary = extractFirstBlockquote(tokens);

  // Extract HTTP endpoint info
  const endpointRaw = extractMetadata(tokens, "Endpoint");
  const http = endpointRaw ? parseEndpoint(endpointRaw) : undefined;

  // Extract signature from first typescript/javascript code block
  // Try TS/JS first, then fall back to any code block (for html/bash/hcl signatures)
  const signatureBlock = extractCodeBlock(tokens, "typescript") ||
    extractCodeBlock(tokens, "javascript") ||
    extractCodeBlock(tokens, "ts") ||
    extractCodeBlock(tokens);
  const signature = signatureBlock?.code;

  // Capture signature language when it's not TypeScript/JavaScript
  const sigLang = signatureBlock?.language?.toLowerCase();
  const isDefaultLang = !sigLang || ["typescript", "ts", "javascript", "js"].includes(sigLang);
  const signatureLanguage = isDefaultLang ? undefined : signatureBlock?.language;

  // Extract description (text after signature, before first H2)
  const description = extractIntro(tokens);

  // Extract parameters from ## Parameters section
  const parametersSection = extractSection(tokens, "Parameters");
  const parametersTableMd = extractTableMarkdown(parametersSection);
  const parameters = parametersTableMd
    ? parseParameterTable(parametersTableMd)
    : undefined;

  // Extract returns from ## Returns section
  const returns = parseReturns(extractSection(tokens, "Returns"));

  // Extract examples from ## Examples section
  const examples = parseExamples(tokens);

  // Extract tags from **Tags:** line
  const tagsRaw = extractMetadata(tokens, "Tags");
  const tags = tagsRaw ? parseTags(tagsRaw) : undefined;

  // Extract deprecated notice
  const deprecated = extractDeprecated(tokens);

  // Extract since version
  const since = extractMetadata(tokens, "Since");

  // Extract see also references
  const see = parseSeeAlso(extractSection(tokens, "See Also"));

  // Build member
  const member: Member = {
    name,
    kind,
  };

  if (summary) member.summary = summary;
  if (description) member.description = description;
  if (signature) member.signature = signature;
  if (signatureLanguage) member.signatureLanguage = signatureLanguage;
  if (parameters && parameters.length > 0) member.parameters = parameters;
  if (returns) member.returns = returns;
  if (examples && examples.length > 0) member.examples = examples;
  if (tags && tags.length > 0) member.tags = tags;
  if (http) member.http = http;
  if (deprecated !== undefined) member.deprecated = deprecated;
  if (since) member.since = since;
  if (see && see.length > 0) member.see = see;

  return member;
}

/**
 * Convert filename to member name
 * e.g., "namespace/method.md" → "namespace.method"
 */
function filenameToName(filename: string): string {
  return filename
    .replace(/\.md$/, "")
    .replace(/\//g, ".")
    .replace(/\\/g, ".");
}

/**
 * Parse kind from string
 */
function parseKind(raw: string | undefined): MemberKind {
  if (!raw) return "function";

  const normalized = raw.toLowerCase().trim();
  const validKinds: MemberKind[] = [
    "function",
    "method",
    "class",
    "namespace",
    "constant",
    "type",
    "property",
    "component",
    "command",
    "resource",
  ];

  for (const kind of validKinds) {
    if (normalized === kind) return kind;
  }

  return "function";
}

/**
 * Parse endpoint string into HttpInfo
 * e.g., "`GET /v1/users/{id}`" → { method: "GET", path: "/v1/users/{id}" }
 */
function parseEndpoint(
  raw: string
): { method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS"; path: string } | undefined {
  // Remove backticks if present
  const cleaned = raw.replace(/`/g, "").trim();

  const match = cleaned.match(/^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+(.+)$/i);
  if (match) {
    return {
      method: match[1]!.toUpperCase() as "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS",
      path: match[2]!.trim(),
    };
  }

  return undefined;
}

/**
 * Parse returns section
 */
function parseReturns(tokens: Token[]): Returns | undefined {
  if (tokens.length === 0) return undefined;

  const returns: Returns = {};

  // Look for **Type:** line
  const typeRaw = extractMetadata(tokens, "Type");
  if (typeRaw) {
    // Remove backticks if present
    returns.type = typeRaw.replace(/`/g, "").trim();
  }

  // Get description (remaining text)
  const descLines: string[] = [];
  for (const token of tokens) {
    if (token.type === "paragraph") {
      const text = (token as { text?: string }).text || "";
      // Skip the Type line
      if (!text.startsWith("**Type:**") && !text.startsWith("**Type**:")) {
        descLines.push(text);
      }
    }
  }

  if (descLines.length > 0) {
    returns.description = descLines.join("\n\n").trim();
  }

  // Check if we have anything
  if (!returns.type && !returns.description) {
    return undefined;
  }

  return returns;
}

/**
 * Parse examples from ## Examples section
 */
function parseExamples(tokens: Token[]): Example[] | undefined {
  const examplesSection = extractSection(tokens, "Examples");
  if (examplesSection.length === 0) return undefined;

  const examples: Example[] = [];
  const h3Sections = extractAllSections(examplesSection, 3);

  if (h3Sections.size > 0) {
    // Examples have ### titles
    for (const [title, sectionTokens] of h3Sections) {
      const codeBlocks = extractAllCodeBlocks(sectionTokens);

      for (const block of codeBlocks) {
        const example: Example = {
          code: block.code,
        };

        if (title) example.title = title;
        if (block.language) example.language = block.language;

        // Look for description text before code block
        const descTokens = sectionTokens.filter(
          (t) => t.type === "paragraph"
        );
        if (descTokens.length > 0) {
          const desc = tokensToMarkdown(descTokens).trim();
          if (desc) example.description = desc;
        }

        examples.push(example);
      }
    }
  } else {
    // No ### titles, just code blocks
    const codeBlocks = extractAllCodeBlocks(examplesSection);
    for (const block of codeBlocks) {
      const example: Example = {
        code: block.code,
      };
      if (block.language) example.language = block.language;
      examples.push(example);
    }
  }

  return examples.length > 0 ? examples : undefined;
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
  if (tokens.length === 0) return undefined;

  const references: Reference[] = [];

  for (const token of tokens) {
    if (token.type === "list") {
      const listToken = token as { items: Array<{ text?: string; tokens?: Token[] }> };
      for (const item of listToken.items) {
        const text = item.text || "";

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

  // Guide reference (starts with "guide:" or "guides/")
  if (target.startsWith("guide:") || target.startsWith("guides/")) {
    const slug = target.replace(/^guide:|^guides\//, "");
    return {
      type: "guide",
      target: slug,
      label,
    };
  }

  // Schema reference (starts with "schema:" or "types/")
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
