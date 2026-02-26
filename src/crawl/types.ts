/**
 * Crawl Command Types
 *
 * TypeScript interfaces for the crawl functionality.
 */

/**
 * Options for the crawl command
 */
export interface CrawlOptions {
  /** Starting URL to crawl */
  url: string;

  /** Requests per second (default: 2) */
  rate: number;

  /** Custom output directory (default: ~/.lrn/crawled/<domain>) */
  output?: string;

  /** URL patterns to include (glob patterns) */
  include: string[];

  /** URL patterns to exclude (glob patterns) */
  exclude: string[];

  /** Show what would be fetched without actually fetching */
  dryRun: boolean;

  /** Verbose output */
  verbose: boolean;

  /** Quiet mode - suppress non-essential output */
  quiet: boolean;
}

/**
 * Metadata for a crawled page
 */
export interface PageMeta {
  /** Original URL */
  url: string;

  /** Local file path (relative to crawl root) */
  file: string;

  /** When the page was fetched */
  fetchedAt: string;

  /** HTTP status code */
  status: number;

  /** Content hash for incremental crawling */
  contentHash?: string;

  /** Title extracted from the page */
  title?: string;
}

/**
 * Metadata for the entire crawl
 */
export interface CrawlMetadata {
  /** Origin URL (scheme + host) */
  origin: string;

  /** When the crawl started */
  crawledAt: string;

  /** How the crawl URLs were discovered */
  source: 'llms-txt' | 'llms-full' | 'sitemap';

  /** Total number of pages crawled */
  pages: number;

  /** Metadata for each crawled URL */
  urls: PageMeta[];
}

/**
 * Result of fetching a single URL
 */
export interface FetchResult {
  /** The URL that was fetched */
  url: string;

  /** Final URL after redirects */
  finalUrl: string;

  /** HTTP status code */
  status: number;

  /** Response headers */
  headers: Record<string, string>;

  /** Response body */
  body: string;

  /** Content type */
  contentType: string;

  /** Whether the response was from cache */
  cached?: boolean;
}

/**
 * Parsed llms.txt content
 */
export interface LlmsTxt {
  /** Title from # heading */
  title?: string;

  /** Description from > blockquote */
  description?: string;

  /** Sections with their entries */
  sections: LlmsTxtSection[];
}

/**
 * A section in llms.txt
 */
export interface LlmsTxtSection {
  /** Section title from ## heading */
  title: string;

  /** Entries in this section */
  entries: LlmsTxtEntry[];
}

/**
 * An entry in llms.txt
 */
export interface LlmsTxtEntry {
  /** Label for the entry */
  label: string;

  /** URL path (relative or absolute) */
  path: string;
}

/**
 * Item in the crawl queue
 */
export interface QueueItem {
  /** URL to fetch */
  url: string;

  /** Parent URL that linked to this */
  parent?: string;

  /** Number of retry attempts */
  retries: number;
}

/**
 * Result of processing a crawled page
 */
export interface ProcessedPage {
  /** The URL that was crawled */
  url: string;

  /** Converted markdown content */
  markdown: string;

  /** Title extracted from the page */
  title?: string;
}

/**
 * Crawl progress state
 */
export interface CrawlProgress {
  /** Total URLs to process */
  total: number;

  /** URLs processed so far */
  processed: number;

  /** Currently processing URL */
  current?: string;

  /** URLs that failed */
  errors: Array<{ url: string; error: string }>;

  /** URLs that were skipped (robots.txt, patterns) */
  skipped: string[];
}

/**
 * Robots.txt rules for a domain
 */
export interface RobotsTxtRules {
  /** Whether crawling is allowed for a given path */
  isAllowed: (path: string) => boolean;

  /** Crawl delay in seconds (if specified) */
  crawlDelay?: number;

  /** Sitemap URLs found in robots.txt */
  sitemaps: string[];
}
