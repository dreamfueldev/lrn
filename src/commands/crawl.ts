/**
 * Crawl Command
 *
 * Fetches documentation from URLs and converts to markdown.
 */

import type { ParsedArgs } from "../args.js";
import { crawl, type CrawlOptions } from "../crawl/index.js";
import { CrawlError, CLIError } from "../errors.js";

/**
 * Run the crawl command
 */
export async function runCrawl(args: ParsedArgs): Promise<void> {
  // Get URL from positional args
  const url = args.positional[0];
  if (!url) {
    throw new CLIError(
      "Missing URL argument",
      1,
      "Usage: lrn crawl <url> [options]"
    );
  }

  // Parse options from raw args
  const options = parseCrawlOptions(args, url);

  try {
    await crawl(options);
  } catch (err) {
    if (err instanceof CrawlError) {
      throw new CLIError(err.message, err.exitCode);
    }
    throw err;
  }
}

/**
 * Parse crawl-specific options from args
 */
function parseCrawlOptions(args: ParsedArgs, url: string): CrawlOptions {
  const raw = args.raw;

  // Parse --depth
  let depth = 1;
  const depthIdx = raw.indexOf("--depth");
  if (depthIdx !== -1 && depthIdx + 1 < raw.length) {
    const val = parseInt(raw[depthIdx + 1]!, 10);
    if (!isNaN(val) && val >= 0) {
      depth = val;
    }
  }

  // Parse --rate
  let rate = 2;
  const rateIdx = raw.indexOf("--rate");
  if (rateIdx !== -1 && rateIdx + 1 < raw.length) {
    const val = parseFloat(raw[rateIdx + 1]!);
    if (!isNaN(val) && val > 0) {
      rate = val;
    }
  }

  // Parse --output
  let output: string | undefined;
  const outputIdx = raw.indexOf("--output");
  if (outputIdx !== -1 && outputIdx + 1 < raw.length) {
    output = raw[outputIdx + 1];
  }

  // Parse --include (can appear multiple times)
  const include: string[] = [];
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === "--include" && i + 1 < raw.length) {
      include.push(raw[i + 1]!);
      i += 2;
    } else {
      i++;
    }
  }

  // Parse --exclude (can appear multiple times)
  const exclude: string[] = [];
  i = 0;
  while (i < raw.length) {
    if (raw[i] === "--exclude" && i + 1 < raw.length) {
      exclude.push(raw[i + 1]!);
      i += 2;
    } else {
      i++;
    }
  }

  // Parse --dry-run
  const dryRun = raw.includes("--dry-run");

  return {
    url,
    depth,
    rate,
    output,
    include,
    exclude,
    dryRun,
    verbose: args.flags.verbose,
    quiet: args.flags.quiet,
  };
}
