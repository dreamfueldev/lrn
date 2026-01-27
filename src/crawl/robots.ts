/**
 * Robots.txt Parser
 *
 * Fetches and parses robots.txt for compliance checking.
 */

import robotsParser from "robots-parser";
import type { RobotsTxtRules } from "./types.js";
import { fetchUrl, getOrigin } from "./fetcher.js";

const USER_AGENT = "lrn-crawler";
const ROBOTS_CACHE = new Map<string, RobotsTxtRules>();

/**
 * Fetch and parse robots.txt for a domain
 */
export async function getRobotsTxt(url: string): Promise<RobotsTxtRules> {
  const origin = getOrigin(url);

  // Check cache
  const cached = ROBOTS_CACHE.get(origin);
  if (cached) {
    return cached;
  }

  const robotsUrl = `${origin}/robots.txt`;

  try {
    const result = await fetchUrl(robotsUrl, { retries: 1 });
    const robots = robotsParser(robotsUrl, result.body);

    const rules: RobotsTxtRules = {
      isAllowed: (path: string) => {
        const fullUrl = new URL(path, origin).href;
        return robots.isAllowed(fullUrl, USER_AGENT) ?? true;
      },
      crawlDelay: robots.getCrawlDelay(USER_AGENT) ?? undefined,
      sitemaps: robots.getSitemaps(),
    };

    ROBOTS_CACHE.set(origin, rules);
    return rules;
  } catch {
    // If robots.txt doesn't exist or can't be fetched, allow all
    const permissiveRules: RobotsTxtRules = {
      isAllowed: () => true,
      sitemaps: [],
    };

    ROBOTS_CACHE.set(origin, permissiveRules);
    return permissiveRules;
  }
}

/**
 * Check if a URL is allowed by robots.txt
 */
export async function isUrlAllowed(url: string): Promise<boolean> {
  try {
    const rules = await getRobotsTxt(url);
    const path = new URL(url).pathname;
    return rules.isAllowed(path);
  } catch {
    // If we can't check, allow by default
    return true;
  }
}

/**
 * Get crawl delay for a domain
 */
export async function getCrawlDelay(url: string): Promise<number | undefined> {
  try {
    const rules = await getRobotsTxt(url);
    return rules.crawlDelay;
  } catch {
    return undefined;
  }
}

/**
 * Clear the robots.txt cache
 */
export function clearRobotsCache(): void {
  ROBOTS_CACHE.clear();
}
