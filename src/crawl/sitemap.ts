/**
 * Sitemap XML Parser
 *
 * Parses sitemap.xml and sitemap index files to extract page URLs.
 */

import { fetchUrl } from "./fetcher.js";

/**
 * Check if a URL points to a sitemap XML file
 */
export function isSitemapUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname;
    return /\/sitemap[^/]*\.xml$/.test(pathname);
  } catch {
    return false;
  }
}

/**
 * Extract page URLs from a sitemap <urlset> XML
 */
export function extractSitemapUrls(xml: string): string[] {
  const urls: string[] = [];
  const locRegex = /<url>\s*<loc>([^<]+)<\/loc>/g;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    const url = match[1]!.trim();
    if (url) urls.push(url);
  }
  return urls;
}

/**
 * Check if XML content is a sitemap index (vs a urlset)
 */
export function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

/**
 * Extract child sitemap URLs from a sitemap index
 */
export function extractSitemapIndexUrls(xml: string): string[] {
  const urls: string[] = [];
  const locRegex = /<sitemap>\s*<loc>([^<]+)<\/loc>/g;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    const url = match[1]!.trim();
    if (url) urls.push(url);
  }
  return urls;
}

/**
 * Fetch and parse a sitemap, returning all page URLs.
 * If the sitemap is an index, fetches each child sitemap and collects URLs.
 */
export async function parseSitemap(url: string): Promise<string[]> {
  const result = await fetchUrl(url, { retries: 2 });
  const xml = result.body;

  if (isSitemapIndex(xml)) {
    const childUrls = extractSitemapIndexUrls(xml);
    const allUrls: string[] = [];

    for (const childUrl of childUrls) {
      try {
        const childResult = await fetchUrl(childUrl, { retries: 2 });
        const childPageUrls = extractSitemapUrls(childResult.body);
        allUrls.push(...childPageUrls);
      } catch {
        // Skip child sitemaps that fail to fetch
      }
    }

    return allUrls;
  }

  return extractSitemapUrls(xml);
}
