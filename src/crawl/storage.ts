/**
 * Storage Manager
 *
 * Manages file storage for crawled content.
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import type { CrawlMetadata, PageMeta, CrawlOptions } from "./types.js";

const DEFAULT_CRAWL_DIR = join(homedir(), ".lrn", "crawled");
const META_FILE = "_meta.json";

/**
 * Get the crawl output directory for a URL
 */
export function getCrawlDir(url: string, options: Pick<CrawlOptions, "output">): string {
  if (options.output) {
    return options.output;
  }

  try {
    const hostname = new URL(url).hostname;
    return join(DEFAULT_CRAWL_DIR, hostname);
  } catch {
    return join(DEFAULT_CRAWL_DIR, "unknown");
  }
}

/**
 * Convert a URL to a local file path
 */
export function urlToFilePath(url: string): string {
  try {
    const parsed = new URL(url);
    let path = parsed.pathname;

    // Remove leading slash
    if (path.startsWith("/")) {
      path = path.slice(1);
    }

    // If path is empty, use index
    if (!path) {
      path = "index";
    }

    // Remove extension if present
    path = path.replace(/\.(html?|md|txt)$/i, "");

    // Add .md extension
    if (!path.endsWith(".md")) {
      path = path + ".md";
    }

    return path;
  } catch {
    return "index.md";
  }
}

/**
 * Compute a content hash for change detection
 */
export function computeHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/**
 * Storage manager for a crawl
 */
export class CrawlStorage {
  private dir: string;
  private metadata: CrawlMetadata;
  private existingMeta: CrawlMetadata | null = null;

  constructor(url: string, options: Pick<CrawlOptions, "output">) {
    this.dir = getCrawlDir(url, options);
    this.metadata = {
      origin: new URL(url).origin,
      crawledAt: new Date().toISOString(),
      llmsTxt: false,
      pages: 0,
      urls: [],
    };

    // Load existing metadata for incremental crawling
    this.existingMeta = this.loadMeta();
  }

  /**
   * Initialize the storage directory
   */
  init(): void {
    mkdirSync(this.dir, { recursive: true });
  }

  /**
   * Get the output directory
   */
  getDir(): string {
    return this.dir;
  }

  /**
   * Load existing metadata
   */
  private loadMeta(): CrawlMetadata | null {
    const metaPath = join(this.dir, META_FILE);
    try {
      if (existsSync(metaPath)) {
        const content = readFileSync(metaPath, "utf-8");
        return JSON.parse(content) as CrawlMetadata;
      }
    } catch {
      // Ignore errors
    }
    return null;
  }

  /**
   * Check if a URL has already been crawled with the same content
   */
  hasUnchanged(url: string, contentHash: string): boolean {
    if (!this.existingMeta) {
      return false;
    }

    const existing = this.existingMeta.urls.find((u) => u.url === url);
    return existing?.contentHash === contentHash;
  }

  /**
   * Get the existing file path for a URL
   */
  getExistingFilePath(url: string): string | undefined {
    if (!this.existingMeta) {
      return undefined;
    }

    const existing = this.existingMeta.urls.find((u) => u.url === url);
    return existing?.file;
  }

  /**
   * Save a page to disk
   */
  savePage(
    url: string,
    markdown: string,
    title?: string
  ): PageMeta {
    const filePath = urlToFilePath(url);
    const fullPath = join(this.dir, filePath);
    const contentHash = computeHash(markdown);

    // Create directory if needed
    mkdirSync(dirname(fullPath), { recursive: true });

    // Write the markdown file
    writeFileSync(fullPath, markdown, "utf-8");

    const pageMeta: PageMeta = {
      url,
      file: filePath,
      fetchedAt: new Date().toISOString(),
      status: 200,
      contentHash,
      title,
    };

    this.metadata.urls.push(pageMeta);
    this.metadata.pages = this.metadata.urls.length;

    return pageMeta;
  }

  /**
   * Record a failed page
   */
  recordFailure(url: string, status: number): void {
    const filePath = urlToFilePath(url);

    const pageMeta: PageMeta = {
      url,
      file: filePath,
      fetchedAt: new Date().toISOString(),
      status,
    };

    this.metadata.urls.push(pageMeta);
  }

  /**
   * Set whether llms.txt was detected
   */
  setLlmsTxt(detected: boolean): void {
    this.metadata.llmsTxt = detected;
  }

  /**
   * Save the metadata file
   */
  saveMeta(): void {
    const metaPath = join(this.dir, META_FILE);
    writeFileSync(
      metaPath,
      JSON.stringify(this.metadata, null, 2) + "\n",
      "utf-8"
    );
  }

  /**
   * Get the current metadata
   */
  getMeta(): CrawlMetadata {
    return this.metadata;
  }

  /**
   * Get the page count
   */
  getPageCount(): number {
    return this.metadata.pages;
  }

  /**
   * Check if a file exists
   */
  fileExists(filePath: string): boolean {
    return existsSync(join(this.dir, filePath));
  }
}
