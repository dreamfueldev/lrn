import type { Package, Member } from "@lrn/schema";

/**
 * Query a package for a specific member by dot-notation path
 */
export function query(pkg: Package, path: string): Member | undefined {
  const parts = path.split(".");

  let current: Member | undefined;
  let members = pkg.members;

  for (const part of parts) {
    current = members.find((m) => m.name === part || m.name === path);
    if (!current) return undefined;
    members = current.children ?? [];
  }

  return current;
}
