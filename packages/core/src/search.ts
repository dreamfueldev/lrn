import type { Package, Member } from "@lrn/schema";

export interface SearchResult {
  member: Member;
  path: string;
  score: number;
}

/**
 * Search a package for members matching a query
 */
export function search(pkg: Package, query: string): SearchResult[] {
  const results: SearchResult[] = [];
  const queryLower = query.toLowerCase();

  function traverse(members: Member[], parentPath: string) {
    for (const member of members) {
      const path = parentPath ? `${parentPath}.${member.name}` : member.name;
      const score = calculateScore(member, queryLower);

      if (score > 0) {
        results.push({ member, path, score });
      }

      if (member.children) {
        traverse(member.children, path);
      }
    }
  }

  traverse(pkg.members, "");

  return results.sort((a, b) => b.score - a.score);
}

function calculateScore(member: Member, query: string): number {
  let score = 0;

  if (member.name.toLowerCase().includes(query)) {
    score += 10;
  }
  if (member.summary?.toLowerCase().includes(query)) {
    score += 5;
  }
  if (member.description?.toLowerCase().includes(query)) {
    score += 3;
  }
  if (member.tags?.some((t) => t.toLowerCase().includes(query))) {
    score += 4;
  }

  return score;
}
