/**
 * Crawl Orchestrator
 *
 * Main entry point for the crawl functionality.
 * Accepts a manifest URL (llms.txt, llms-full.txt, or sitemap.xml)
 * and fetches/converts the listed pages.
 */

import type { CrawlOptions, CrawlMetadata } from "./types.js";
import { fetchUrl, isValidUrl, isSameOrigin } from "./fetcher.js";
import { isUrlAllowed, getCrawlDelay } from "./robots.js";
import { processContent } from "./converter.js";
import { isLlmsTxtUrl, isLlmsFullUrl, parseLlmsTxt, extractUrls } from "./llms-txt.js";
import { isSitemapUrl, parseSitemap } from "./sitemap.js";
import { CrawlQueue } from "./queue.js";
import { filterByPatterns, normalizePatterns } from "./links.js";
import { CrawlStorage, computeHash } from "./storage.js";
import { ProgressReporter } from "./progress.js";
import { CrawlError } from "../errors.js";

export type { CrawlOptions, CrawlMetadata } from "./types.js";

type ManifestType = 'llms-full' | 'llms-txt' | 'sitemap';

/**
 * Detect manifest type from URL
 */
function detectManifestType(url: string): ManifestType | null {
  // Check llms-full before llms-txt (both end with llms.txt)
  if (isLlmsFullUrl(url)) return 'llms-full';
  if (isLlmsTxtUrl(url)) return 'llms-txt';
  if (isSitemapUrl(url)) return 'sitemap';
  return null;
}

/**
 * Crawl documentation from a manifest URL
 */
export async function crawl(options: CrawlOptions): Promise<CrawlMetadata> {
  const { url, dryRun, include, exclude, verbose, quiet } = options;

  // Validate URL
  if (!isValidUrl(url)) {
    throw new CrawlError(`Invalid URL: ${url}`);
  }

  // Detect manifest type
  const manifestType = detectManifestType(url);
  if (!manifestType) {
    throw new CrawlError(
      `URL must point to an llms.txt, llms-full.txt, or sitemap.xml file.\n\nExamples:\n  lrn crawl https://docs.example.com/llms.txt\n  lrn crawl https://docs.example.com/llms-full.txt\n  lrn crawl https://example.com/sitemap.xml`
    );
  }

  // Normalize patterns
  const includePatterns = normalizePatterns(include);
  const excludePatterns = normalizePatterns(exclude);

  // Initialize components
  const storage = new CrawlStorage(url, options);
  const progress = new ProgressReporter({ quiet, verbose });
  storage.setSource(manifestType);

  // Handle llms-full.txt — single file download
  if (manifestType === 'llms-full') {
    return handleLlmsFull(url, storage, progress, dryRun);
  }

  // Extract URLs from manifest
  let manifestUrls: string[];
  if (manifestType === 'llms-txt') {
    manifestUrls = await extractLlmsTxtUrls(url, progress);
  } else {
    manifestUrls = await extractSitemapUrlsFromManifest(url, progress, quiet);
  }

  // Apply include/exclude filters
  if (includePatterns.length > 0 || excludePatterns.length > 0) {
    manifestUrls = filterByPatterns(manifestUrls, includePatterns, excludePatterns);
  }

  // Handle dry-run mode
  if (dryRun) {
    progress.dryRun(manifestUrls);
    return storage.getMeta();
  }

  // Initialize queue and storage
  const queue = new CrawlQueue(options);
  storage.init();

  // Check robots.txt crawl-delay
  const robotsDelay = await getCrawlDelay(url);
  if (robotsDelay && robotsDelay > 1 / options.rate) {
    queue.setRate(1 / robotsDelay);
    if (!quiet) {
      process.stderr.write(`Respecting robots.txt crawl-delay: ${robotsDelay}s\n`);
    }
  }

  // Add manifest URLs to queue
  queue.addAll(manifestUrls);
  progress.setTotal(manifestUrls.length);

  // Process queue
  while (!queue.isEmpty) {
    const item = await queue.next();
    if (!item) break;

    progress.startUrl(item.url);

    try {
      // Check robots.txt
      const allowed = await isUrlAllowed(item.url);
      if (!allowed) {
        progress.skipUrl(item.url, "robots.txt");
        continue;
      }

      // Fetch the page
      const result = await fetchUrl(item.url);

      // Check for redirects to different domain
      if (!isSameOrigin(result.finalUrl, url)) {
        progress.skipUrl(item.url, "redirect to different domain");
        continue;
      }

      // Convert to markdown
      const { markdown, title } = processContent(
        result.body,
        result.contentType,
        result.finalUrl
      );

      // Check for unchanged content (incremental crawling)
      const contentHash = computeHash(markdown);
      if (storage.hasUnchanged(item.url, contentHash)) {
        progress.skipUrl(item.url, "unchanged");
        continue;
      }

      // Save the page
      storage.savePage(item.url, markdown, title);
      progress.completeUrl(item.url);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const statusCode = err instanceof CrawlError ? err.statusCode : undefined;

      // Retry on certain errors
      if (err instanceof CrawlError && (statusCode === 429 || statusCode === 503)) {
        if (queue.retry(item)) {
          progress.skipUrl(item.url, "retry later");
          continue;
        }
      }

      progress.errorUrl(item.url, message);
      if (statusCode) {
        storage.recordFailure(item.url, statusCode);
      }
    }
  }

  // Save metadata
  storage.saveMeta();

  // Print summary
  progress.summary(storage.getDir());

  return storage.getMeta();
}

/**
 * Handle llms-full.txt — download a single pre-concatenated file
 */
async function handleLlmsFull(
  url: string,
  storage: CrawlStorage,
  progress: ProgressReporter,
  dryRun: boolean
): Promise<CrawlMetadata> {
  if (dryRun) {
    progress.dryRun([url]);
    return storage.getMeta();
  }

  progress.setTotal(1);
  progress.startUrl(url);

  try {
    const result = await fetchUrl(url);
    storage.init();
    storage.savePage(url, result.body, undefined);
    storage.saveMeta();
    progress.completeUrl(url);
    progress.summary(storage.getDir());
  } catch (err) {
    throw new CrawlError(
      `Failed to fetch llms-full.txt: ${err instanceof Error ? err.message : String(err)}`,
      url
    );
  }

  return storage.getMeta();
}

/**
 * Extract URLs from an llms.txt manifest
 */
async function extractLlmsTxtUrls(
  url: string,
  progress: ProgressReporter
): Promise<string[]> {
  try {
    const result = await fetchUrl(url);
    const llmsTxt = parseLlmsTxt(result.body);
    const urls = extractUrls(llmsTxt, url);
    progress.foundLlmsTxt(urls.length);
    return urls;
  } catch (err) {
    throw new CrawlError(
      `Failed to fetch llms.txt: ${err instanceof Error ? err.message : String(err)}`,
      url
    );
  }
}

/**
 * Extract URLs from a sitemap manifest
 */
async function extractSitemapUrlsFromManifest(
  url: string,
  progress: ProgressReporter,
  quiet: boolean
): Promise<string[]> {
  try {
    const urls = await parseSitemap(url);
    if (!quiet) {
      process.stderr.write(`Found ${urls.length} URLs in sitemap\n`);
    }
    return urls;
  } catch (err) {
    throw new CrawlError(
      `Failed to fetch sitemap: ${err instanceof Error ? err.message : String(err)}`,
      url
    );
  }
}

// Re-export for convenience
export { getCrawlDir } from "./storage.js";
