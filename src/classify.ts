/**
 * Package Classification Detection
 *
 * Detects what type of thing a package documents based on IR heuristics.
 */

import type { Package, PackageClassification, Member } from "./schema/index.js";

/**
 * Detect the classification of a package from its IR contents.
 * If the package has an explicit classification, returns that.
 * Otherwise uses heuristics based on member kinds and HTTP info.
 */
export function detectClassification(pkg: Package): PackageClassification {
  if (pkg.classification) {
    return pkg.classification;
  }

  const topMembers = pkg.members;
  if (topMembers.length === 0) {
    return "library";
  }

  // Check for HTTP endpoints anywhere in the tree
  if (hasHttpMembers(topMembers)) {
    return "api";
  }

  // Check majority kind among top-level members
  const kindCounts = new Map<string, number>();
  for (const m of topMembers) {
    kindCounts.set(m.kind, (kindCounts.get(m.kind) || 0) + 1);
  }

  const majority = topMembers.length / 2;

  if ((kindCounts.get("component") || 0) > majority) {
    return "components";
  }
  if ((kindCounts.get("command") || 0) > majority) {
    return "cli";
  }
  if ((kindCounts.get("resource") || 0) > majority) {
    return "config";
  }

  return "library";
}

function hasHttpMembers(members: Member[]): boolean {
  for (const m of members) {
    if (m.http) return true;
    if (m.children && hasHttpMembers(m.children)) return true;
  }
  return false;
}
