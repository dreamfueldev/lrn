/**
 * Fuzzy Resolution Utilities
 *
 * Auto-selection and interactive disambiguation for package resolution.
 */

import type { ResolveResult } from "./registry.js";

/**
 * Determine if we should auto-select the top result.
 * True if 0-1 results, or top score >= 2x the second.
 */
export function shouldAutoSelect(results: ResolveResult[]): boolean {
  if (results.length <= 1) return true;
  return results[0]!.score >= results[1]!.score * 2;
}

/**
 * Present an interactive numbered list on stderr and read choice from stdin.
 * Returns the selected fullName, or null if cancelled.
 */
export async function disambiguate(
  query: string,
  results: ResolveResult[],
): Promise<string | null> {
  process.stderr.write(`\nMultiple packages match "${query}":\n\n`);

  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    process.stderr.write(`  ${i + 1}. ${r.fullName} — ${r.description}\n`);
  }

  process.stderr.write(
    `\nWhich package? (1-${results.length}, or 'q' to cancel): `,
  );

  const choice = await readLine();
  if (choice === "q" || choice === "") return null;

  const idx = parseInt(choice, 10) - 1;
  if (idx < 0 || idx >= results.length || isNaN(idx)) return null;

  return results[idx]!.fullName;
}

function readLine(): Promise<string> {
  const { createInterface } = require("node:readline") as typeof import("node:readline");
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    rl.once("line", (line) => {
      rl.close();
      resolve(line.trim());
    });
    rl.once("close", () => resolve(""));
  });
}
