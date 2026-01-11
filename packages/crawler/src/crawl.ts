import type { Package } from "@lrn/schema";

export interface CrawlOptions {
  url: string;
  maxPages?: number;
}

/**
 * Crawl a documentation site and extract structured data
 */
export async function crawl(_options: CrawlOptions): Promise<Package> {
  // TODO: Implement crawling + LLM extraction
  throw new Error("Not implemented");
}
