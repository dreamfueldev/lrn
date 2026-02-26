/**
 * Request Queue
 *
 * URL queue with rate limiting and duplicate detection.
 */

import type { QueueItem, CrawlOptions } from "./types.js";
import { normalizeUrl } from "./fetcher.js";

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Request queue with rate limiting
 */
export class CrawlQueue {
  private queue: QueueItem[] = [];
  private visited = new Set<string>();
  private lastRequest = 0;
  private minInterval: number;

  constructor(options: Pick<CrawlOptions, "rate">) {
    // Rate is requests per second, so interval is 1000/rate ms
    this.minInterval = 1000 / options.rate;
  }

  /**
   * Add a URL to the queue
   */
  add(url: string, parent?: string): boolean {
    const normalized = normalizeUrl(url);

    // Skip if already visited or queued
    if (this.visited.has(normalized)) {
      return false;
    }

    // Mark as queued (counts as visited)
    this.visited.add(normalized);

    this.queue.push({
      url: normalized,
      parent,
      retries: 0,
    });

    return true;
  }

  /**
   * Add multiple URLs to the queue
   */
  addAll(urls: string[], parent?: string): number {
    let added = 0;
    for (const url of urls) {
      if (this.add(url, parent)) {
        added++;
      }
    }
    return added;
  }

  /**
   * Get the next item from the queue, respecting rate limits
   */
  async next(): Promise<QueueItem | undefined> {
    if (this.queue.length === 0) {
      return undefined;
    }

    // Enforce rate limit
    const now = Date.now();
    const elapsed = now - this.lastRequest;
    if (elapsed < this.minInterval) {
      await sleep(this.minInterval - elapsed);
    }

    this.lastRequest = Date.now();
    return this.queue.shift();
  }

  /**
   * Re-add an item for retry
   */
  retry(item: QueueItem): boolean {
    if (item.retries >= 3) {
      return false;
    }

    // Remove from visited so it can be re-added
    this.visited.delete(normalizeUrl(item.url));

    this.queue.push({
      ...item,
      retries: item.retries + 1,
    });

    return true;
  }

  /**
   * Check if a URL has been visited
   */
  hasVisited(url: string): boolean {
    return this.visited.has(normalizeUrl(url));
  }

  /**
   * Mark a URL as visited without adding to queue
   */
  markVisited(url: string): void {
    this.visited.add(normalizeUrl(url));
  }

  /**
   * Get the number of items in the queue
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * Get the number of visited URLs
   */
  get visitedCount(): number {
    return this.visited.size;
  }

  /**
   * Check if the queue is empty
   */
  get isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Clear the queue and visited set
   */
  clear(): void {
    this.queue = [];
    this.visited.clear();
  }

  /**
   * Set a custom rate (requests per second)
   */
  setRate(rate: number): void {
    this.minInterval = 1000 / rate;
  }

  /**
   * Get all queued URLs (for dry-run)
   */
  getQueued(): string[] {
    return this.queue.map((item) => item.url);
  }

  /**
   * Get all visited URLs
   */
  getVisited(): string[] {
    return Array.from(this.visited);
  }
}
