/**
 * HTML to Markdown Converter
 *
 * Converts HTML to clean markdown using turndown and linkedom.
 */

import TurndownService from "turndown";
import { parseHTML } from "linkedom";

// Types from linkedom
type LinkedomDocument = ReturnType<typeof parseHTML>["document"];
type LinkedomElement = LinkedomDocument["documentElement"];

// Elements to remove before conversion
const REMOVE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "svg",
  "canvas",
  "nav",
  "header:not(article header)",
  "footer:not(article footer)",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  ".nav",
  ".navbar",
  ".navigation",
  ".sidebar",
  ".menu",
  ".toc",
  ".table-of-contents",
  ".advertisement",
  ".ad",
  ".ads",
  ".cookie-banner",
  ".cookie-consent",
  ".popup",
  ".modal",
  ".social-share",
  ".share-buttons",
  ".comments",
  ".comment-section",
];

// Selectors to find main content
const CONTENT_SELECTORS = [
  "main",
  "article",
  '[role="main"]',
  '[role="article"]',
  ".content",
  ".main-content",
  ".post-content",
  ".article-content",
  ".documentation",
  ".docs",
  ".docs-content",
  "#content",
  "#main",
  "#main-content",
];

/**
 * Create and configure the turndown service
 */
function createTurndown(baseUrl: string): TurndownService {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
  });

  // Custom rule for code blocks with language detection
  turndown.addRule("codeBlock", {
    filter: (node) => {
      return (
        node.nodeName === "PRE" &&
        (node as unknown as LinkedomElement).querySelector?.("code") !== null
      );
    },
    replacement: (_content, node) => {
      const codeNode = (node as unknown as LinkedomElement).querySelector?.("code");
      if (!codeNode) return "";

      // Try to detect language from class
      const classList = codeNode.className || "";
      const langMatch = classList.match(
        /(?:language-|lang-|hljs-)(\w+)/
      );
      const lang = langMatch?.[1] || "";

      const code = codeNode.textContent || "";
      return `\n\n\`\`\`${lang}\n${code.trim()}\n\`\`\`\n\n`;
    },
  });

  // Custom rule for inline code
  turndown.addRule("inlineCode", {
    filter: (node) => {
      return (
        node.nodeName === "CODE" &&
        node.parentNode?.nodeName !== "PRE"
      );
    },
    replacement: (content) => {
      if (!content.trim()) return "";
      // Handle code with backticks inside
      if (content.includes("`")) {
        return `\`\` ${content} \`\``;
      }
      return `\`${content}\``;
    },
  });

  // Custom rule for links - resolve relative URLs
  turndown.addRule("absoluteLinks", {
    filter: "a",
    replacement: (content, node) => {
      const el = node as unknown as LinkedomElement;
      const href = el.getAttribute?.("href");
      if (!href || !content.trim()) return content;

      // Skip anchor-only links
      if (href.startsWith("#")) return content;

      // Resolve relative URLs
      let absoluteUrl = href;
      try {
        absoluteUrl = new URL(href, baseUrl).href;
      } catch {
        // Keep as-is if invalid
      }

      const title = el.getAttribute?.("title");
      const titlePart = title ? ` "${title}"` : "";
      return `[${content}](${absoluteUrl}${titlePart})`;
    },
  });

  // Custom rule for images - resolve relative URLs
  turndown.addRule("absoluteImages", {
    filter: "img",
    replacement: (_content, node) => {
      const el = node as unknown as LinkedomElement;
      const src = el.getAttribute?.("src");
      const alt = el.getAttribute?.("alt") || "";
      if (!src) return "";

      // Resolve relative URLs
      let absoluteSrc = src;
      try {
        absoluteSrc = new URL(src, baseUrl).href;
      } catch {
        // Keep as-is if invalid
      }

      const title = el.getAttribute?.("title");
      const titlePart = title ? ` "${title}"` : "";
      return `![${alt}](${absoluteSrc}${titlePart})`;
    },
  });

  // Remove empty links
  turndown.addRule("removeEmptyLinks", {
    filter: (node) => {
      return (
        node.nodeName === "A" &&
        !node.textContent?.trim()
      );
    },
    replacement: () => "",
  });

  return turndown;
}

/**
 * Extract the main content from an HTML document
 */
function extractMainContent(document: LinkedomDocument): LinkedomElement {
  // First, remove unwanted elements
  for (const selector of REMOVE_SELECTORS) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el: LinkedomElement) => el.remove?.());
    } catch {
      // Skip invalid selectors
    }
  }

  // Try to find main content area
  for (const selector of CONTENT_SELECTORS) {
    try {
      const element = document.querySelector(selector);
      if (element && element.textContent?.trim()) {
        return element;
      }
    } catch {
      // Skip invalid selectors
    }
  }

  // Fall back to body
  return document.body || document.documentElement;
}

/**
 * Extract the title from an HTML document
 */
function extractTitle(document: LinkedomDocument): string | undefined {
  // Try <title>
  const titleEl = document.querySelector("title");
  if (titleEl?.textContent?.trim()) {
    return titleEl.textContent.trim();
  }

  // Try <h1>
  const h1 = document.querySelector("h1");
  if (h1?.textContent?.trim()) {
    return h1.textContent.trim();
  }

  // Try og:title
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    const content = ogTitle.getAttribute("content");
    if (content?.trim()) {
      return content.trim();
    }
  }

  return undefined;
}

/**
 * Clean up the markdown output
 */
function cleanMarkdown(markdown: string): string {
  return (
    markdown
      // Remove excessive blank lines (more than 2)
      .replace(/\n{4,}/g, "\n\n\n")
      // Remove trailing whitespace from lines
      .replace(/[ \t]+$/gm, "")
      // Ensure file ends with single newline
      .trim() + "\n"
  );
}

/**
 * Convert HTML to markdown
 */
export function htmlToMarkdown(
  html: string,
  baseUrl: string
): { markdown: string; title?: string } {
  // Parse HTML
  const { document } = parseHTML(html);

  // Extract title before modifying the document
  const title = extractTitle(document);

  // Extract main content
  const content = extractMainContent(document);

  // Convert to markdown
  const turndown = createTurndown(baseUrl);
  const markdown = turndown.turndown(content.innerHTML || content.outerHTML);

  return {
    markdown: cleanMarkdown(markdown),
    title,
  };
}

/**
 * Check if content is already markdown
 */
export function isMarkdown(contentType: string): boolean {
  return (
    contentType.includes("text/markdown") ||
    contentType.includes("text/x-markdown") ||
    contentType.includes("text/plain")
  );
}

/**
 * Process fetched content - convert to markdown if needed
 */
export function processContent(
  body: string,
  contentType: string,
  url: string
): { markdown: string; title?: string } {
  // If already markdown or plain text, return as-is
  if (isMarkdown(contentType)) {
    // Try to extract title from markdown
    const titleMatch = body.match(/^#\s+(.+)$/m);
    return {
      markdown: cleanMarkdown(body),
      title: titleMatch?.[1]?.trim(),
    };
  }

  // Convert HTML to markdown
  return htmlToMarkdown(body, url);
}
