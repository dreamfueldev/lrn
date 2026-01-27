/**
 * Progress Reporter
 *
 * Progress bar and completion summary for crawl operations.
 */

import type { CrawlProgress, CrawlOptions } from "./types.js";

/**
 * Progress reporter for crawl operations
 */
export class ProgressReporter {
  private progress: CrawlProgress;
  private startTime: number;
  private quiet: boolean;
  private verbose: boolean;
  private lastLineLength = 0;

  constructor(options: Pick<CrawlOptions, "quiet" | "verbose">) {
    this.progress = {
      total: 0,
      processed: 0,
      errors: [],
      skipped: [],
    };
    this.startTime = Date.now();
    this.quiet = options.quiet;
    this.verbose = options.verbose;
  }

  /**
   * Set the total number of URLs to process
   */
  setTotal(total: number): void {
    this.progress.total = total;
    if (!this.quiet) {
      this.log(`Found ${total} URLs to crawl`);
    }
  }

  /**
   * Increment the total by a delta
   */
  addToTotal(delta: number): void {
    this.progress.total += delta;
  }

  /**
   * Report starting to process a URL
   */
  startUrl(url: string): void {
    this.progress.current = url;
    if (!this.quiet) {
      this.updateProgressLine();
    }
  }

  /**
   * Report successful processing of a URL
   */
  completeUrl(url: string): void {
    this.progress.processed++;
    this.progress.current = undefined;
    if (this.verbose) {
      this.clearLine();
      this.log(`  + ${url}`);
    } else if (!this.quiet) {
      this.updateProgressLine();
    }
  }

  /**
   * Report an error processing a URL
   */
  errorUrl(url: string, error: string): void {
    this.progress.processed++;
    this.progress.errors.push({ url, error });
    this.progress.current = undefined;
    if (!this.quiet) {
      this.clearLine();
      this.log(`  x ${url} - ${error}`);
    }
  }

  /**
   * Report a skipped URL
   */
  skipUrl(url: string, reason?: string): void {
    this.progress.skipped.push(url);
    if (this.verbose) {
      this.clearLine();
      this.log(`  - Skipped: ${url}${reason ? ` (${reason})` : ""}`);
    }
  }

  /**
   * Report llms.txt detection
   */
  foundLlmsTxt(urlCount: number): void {
    if (!this.quiet) {
      this.log(`Found llms.txt with ${urlCount} URLs`);
    }
  }

  /**
   * Report dry-run mode
   */
  dryRun(urls: string[]): void {
    this.log("\nDry run - would fetch:");
    for (const url of urls) {
      this.log(`  ${url}`);
    }
    this.log(`\nTotal: ${urls.length} URLs`);
  }

  /**
   * Update the progress line (single-line update)
   */
  private updateProgressLine(): void {
    const { processed, total, current } = this.progress;
    const width = 30;
    const percent = total > 0 ? processed / total : 0;
    const filled = Math.round(width * percent);
    const bar = "=".repeat(filled) + ">".slice(0, width - filled ? 1 : 0) + " ".repeat(Math.max(0, width - filled - 1));

    let line = `[${bar}] ${processed}/${total}`;
    if (current) {
      // Truncate current URL to fit
      const maxUrlLen = 40;
      const urlDisplay =
        current.length > maxUrlLen
          ? "..." + current.slice(-maxUrlLen + 3)
          : current;
      line += ` - ${urlDisplay}`;
    }

    // Write to stderr to avoid interfering with stdout
    process.stderr.write("\r" + " ".repeat(this.lastLineLength) + "\r" + line);
    this.lastLineLength = line.length;
  }

  /**
   * Clear the current progress line
   */
  private clearLine(): void {
    if (this.lastLineLength > 0) {
      process.stderr.write("\r" + " ".repeat(this.lastLineLength) + "\r");
      this.lastLineLength = 0;
    }
  }

  /**
   * Log a message (clears progress line first)
   */
  private log(message: string): void {
    this.clearLine();
    console.log(message);
  }

  /**
   * Print the completion summary
   */
  summary(outputDir: string): void {
    this.clearLine();

    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const { processed, errors, skipped } = this.progress;
    const successful = processed - errors.length;

    console.log("");
    console.log(`Complete: ${successful} pages saved to ${outputDir}/`);
    console.log(`Time: ${elapsed}s`);

    if (errors.length > 0) {
      console.log("");
      console.log(`Errors (${errors.length}):`);
      for (const { url, error } of errors.slice(0, 10)) {
        console.log(`  x ${url}`);
        console.log(`    ${error}`);
      }
      if (errors.length > 10) {
        console.log(`  ... and ${errors.length - 10} more`);
      }
    }

    if (this.verbose && skipped.length > 0) {
      console.log("");
      console.log(`Skipped (${skipped.length}):`);
      for (const url of skipped.slice(0, 5)) {
        console.log(`  - ${url}`);
      }
      if (skipped.length > 5) {
        console.log(`  ... and ${skipped.length - 5} more`);
      }
    }
  }

  /**
   * Get the current progress state
   */
  getProgress(): CrawlProgress {
    return { ...this.progress };
  }
}
