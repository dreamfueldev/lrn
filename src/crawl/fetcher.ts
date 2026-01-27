/**
 * HTTP Fetcher
 *
 * HTTP client with retry logic, timeout handling, and redirect following.
 */

import type { FetchResult } from "./types.js";
import { CrawlError } from "../errors.js";

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_STATUS_CODES = [429, 500, 502, 503, 504];
const MAX_REDIRECTS = 5;
const MAX_BODY_SIZE = 1024 * 1024; // 1MB

const USER_AGENT = "lrn-crawler/1.0 (+https://github.com/lrn-dev/lrn)";

interface FetchOptions {
  timeout?: number;
  retries?: number;
  followRedirects?: boolean;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attempt: number, baseDelay: number = 1000): number {
  return baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
}

/**
 * Fetch a URL with retry logic
 */
export async function fetchUrl(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const { timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES } = options;

  let lastError: Error | undefined;
  let attempt = 0;
  let currentUrl = url;
  let redirectCount = 0;

  while (attempt <= retries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        timeout * (attempt + 1) // Increase timeout on retry
      );

      try {
        const response = await fetch(currentUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent": USER_AGENT,
            Accept:
              "text/html,text/markdown,text/plain,application/xhtml+xml,*/*",
          },
          redirect: "manual", // Handle redirects manually
        });

        clearTimeout(timeoutId);

        // Handle redirects
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (location) {
            redirectCount++;
            if (redirectCount > MAX_REDIRECTS) {
              throw new CrawlError(
                `Too many redirects (>${MAX_REDIRECTS})`,
                url
              );
            }
            // Resolve relative redirect URLs
            currentUrl = new URL(location, currentUrl).href;
            continue;
          }
        }

        // Handle retryable status codes
        if (RETRY_STATUS_CODES.includes(response.status)) {
          const retryAfter = response.headers.get("retry-after");
          const delay = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : getBackoffDelay(attempt);

          if (attempt < retries) {
            attempt++;
            await sleep(delay);
            continue;
          }
          throw new CrawlError(
            `HTTP ${response.status} after ${retries} retries`,
            url,
            response.status
          );
        }

        // Handle non-success status codes
        if (!response.ok && response.status !== 304) {
          throw new CrawlError(
            `HTTP ${response.status}: ${response.statusText}`,
            url,
            response.status
          );
        }

        // Check content type
        const contentType = response.headers.get("content-type") || "";
        const isText =
          contentType.includes("text/") ||
          contentType.includes("application/json") ||
          contentType.includes("application/xml") ||
          contentType.includes("application/xhtml");

        if (!isText) {
          throw new CrawlError(
            `Non-text content type: ${contentType}`,
            url,
            response.status
          );
        }

        // Read body with size limit
        const body = await readBodyWithLimit(response, MAX_BODY_SIZE);

        // Extract headers into a plain object
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        return {
          url,
          finalUrl: currentUrl,
          status: response.status,
          headers,
          body,
          contentType,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on certain errors
      if (err instanceof CrawlError) {
        // Don't retry 4xx errors (except 429)
        if (
          err.statusCode &&
          err.statusCode >= 400 &&
          err.statusCode < 500 &&
          err.statusCode !== 429
        ) {
          throw err;
        }
      }

      // Handle abort (timeout)
      if (lastError.name === "AbortError") {
        lastError = new CrawlError(
          `Request timeout after ${timeout * (attempt + 1)}ms`,
          url
        );
      }

      // SSL/TLS errors
      if (
        lastError.message.includes("SSL") ||
        lastError.message.includes("certificate")
      ) {
        throw new CrawlError(`SSL error: ${lastError.message}`, url);
      }

      // Network errors - retry
      if (attempt < retries) {
        attempt++;
        await sleep(getBackoffDelay(attempt));
        continue;
      }

      throw lastError instanceof CrawlError
        ? lastError
        : new CrawlError(lastError.message, url);
    }
  }

  throw lastError || new CrawlError("Unknown fetch error", url);
}

/**
 * Read response body with a size limit
 */
async function readBodyWithLimit(
  response: Response,
  maxSize: number
): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > maxSize) {
    throw new CrawlError(
      `Response too large: ${contentLength} bytes (max ${maxSize})`
    );
  }

  // For streaming, we read chunks and check size
  const reader = response.body?.getReader();
  if (!reader) {
    return response.text();
  }

  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalSize += value.length;
      if (totalSize > maxSize) {
        throw new CrawlError(`Response too large: >${maxSize} bytes`);
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const decoder = new TextDecoder();
  return chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join("");
}

/**
 * Check if a URL is valid HTTP(S)
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Normalize a URL (remove fragments, normalize trailing slashes)
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove fragment
    parsed.hash = "";
    // Normalize path (but don't remove trailing slash as it may be significant)
    return parsed.href;
  } catch {
    return url;
  }
}

/**
 * Get the origin (scheme + host) from a URL
 */
export function getOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

/**
 * Check if two URLs have the same origin
 */
export function isSameOrigin(url1: string, url2: string): boolean {
  return getOrigin(url1) === getOrigin(url2);
}
