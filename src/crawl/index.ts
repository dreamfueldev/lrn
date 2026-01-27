/**
 * Crawl Orchestrator
 *
 * Main entry point for the crawl functionality.
 */

import type { CrawlOptions, CrawlMetadata } from "./types.js";
import { fetchUrl, isValidUrl, getOrigin, isSameOrigin } from "./fetcher.js";
import { isUrlAllowed, getCrawlDelay } from "./robots.js";
import { processContent } from "./converter.js";
import { detectLlmsTxt, isLlmsTxtUrl, parseLlmsTxt, extractUrls } from "./llms-txt.js";
import { CrawlQueue } from "./queue.js";
import { extractLinks, processLinks, normalizePatterns } from "./links.js";
import { CrawlStorage, computeHash } from "./storage.js";
import { ProgressReporter } from "./progress.js";
import { CrawlError } from "../errors.js";

export type { CrawlOptions, CrawlMetadata } from "./types.js";

/**
 * Crawl a URL and its linked pages
 */
export async function crawl(options: CrawlOptions): Promise<CrawlMetadata> {
  const { url, depth, dryRun, include, exclude, verbose, quiet } = options;

  // Validate URL
  if (!isValidUrl(url)) {
    throw new CrawlError(`Invalid URL: ${url}`);
  }

  // Normalize patterns
  const includePatterns = normalizePatterns(include);
  const excludePatterns = normalizePatterns(exclude);

  // Initialize components
  const queue = new CrawlQueue(options);
  const storage = new CrawlStorage(url, options);
  const progress = new ProgressReporter({ quiet, verbose });

  // Check robots.txt crawl-delay
  const robotsDelay = await getCrawlDelay(url);
  if (robotsDelay && robotsDelay > 1 / options.rate) {
    queue.setRate(1 / robotsDelay);
    if (!quiet) {
      console.log(`Respecting robots.txt crawl-delay: ${robotsDelay}s`);
    }
  }

  // Check for llms.txt
  let llmsTxtUrls: string[] | null = null;

  if (isLlmsTxtUrl(url)) {
    // Direct llms.txt URL
    try {
      const result = await fetchUrl(url);
      const llmsTxt = parseLlmsTxt(result.body);
      llmsTxtUrls = extractUrls(llmsTxt, url);
      storage.setLlmsTxt(true);
      progress.foundLlmsTxt(llmsTxtUrls.length);
    } catch (err) {
      throw new CrawlError(
        `Failed to fetch llms.txt: ${err instanceof Error ? err.message : String(err)}`,
        url
      );
    }
  } else {
    // Try to detect llms.txt at root
    const llmsTxt = await detectLlmsTxt(url);
    if (llmsTxt) {
      llmsTxtUrls = extractUrls(llmsTxt, url);
      storage.setLlmsTxt(true);
      progress.foundLlmsTxt(llmsTxtUrls.length);
    }
  }

  // Add initial URLs to queue
  if (llmsTxtUrls) {
    // Use URLs from llms.txt
    queue.addAll(llmsTxtUrls, 0);
    progress.setTotal(llmsTxtUrls.length);
  } else {
    // Start with the given URL
    queue.add(url, 0);
    progress.setTotal(1);
  }

  // Handle dry-run mode
  if (dryRun) {
    // For dry-run, we need to discover all URLs that would be crawled
    const allUrls = await discoverUrls(queue, options, includePatterns, excludePatterns, progress);
    progress.dryRun(allUrls);
    return storage.getMeta();
  }

  // Initialize storage
  storage.init();

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

      // Extract and queue links if not at max depth
      if (item.depth < depth) {
        const links = extractLinks(markdown, result.finalUrl);
        const filtered = processLinks(
          links,
          result.finalUrl,
          includePatterns,
          excludePatterns
        );

        const added = queue.addAll(filtered, item.depth + 1, item.url);
        if (added > 0) {
          progress.addToTotal(added);
        }
      }
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
 * Discover all URLs that would be crawled (for dry-run)
 */
async function discoverUrls(
  queue: CrawlQueue,
  options: CrawlOptions,
  includePatterns: string[],
  excludePatterns: string[],
  progress: ProgressReporter
): Promise<string[]> {
  const discovered: string[] = [];
  const { depth } = options;

  while (!queue.isEmpty) {
    const item = await queue.next();
    if (!item) break;

    try {
      // Check robots.txt
      const allowed = await isUrlAllowed(item.url);
      if (!allowed) {
        progress.skipUrl(item.url, "robots.txt");
        continue;
      }

      discovered.push(item.url);

      // If we need to discover more links, fetch the page
      if (item.depth < depth) {
        const result = await fetchUrl(item.url);
        const { markdown } = processContent(
          result.body,
          result.contentType,
          result.finalUrl
        );

        const links = extractLinks(markdown, result.finalUrl);
        const filtered = processLinks(
          links,
          result.finalUrl,
          includePatterns,
          excludePatterns
        );

        queue.addAll(filtered, item.depth + 1, item.url);
      }
    } catch {
      // Skip errors in dry-run, just add the URL
      discovered.push(item.url);
    }
  }

  return discovered;
}

// Re-export for convenience
export { getCrawlDir } from "./storage.js";
