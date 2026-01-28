/**
 * Health Command Module
 *
 * Main entry point for the health check system.
 */

import { resolve } from "node:path";
import type {
  HealthResult,
  HealthOptions,
  FileContext,
  FileCount,
  FileBreakdown,
} from "./types.js";
import { discoverFiles, buildCheckContext } from "./discovery.js";
import { runAllChecks } from "./checks/index.js";
import { calculateScore } from "./scoring.js";
import { estimateTotalTokens } from "./tokens.js";
import { formatTextOutput } from "./output/text.js";
import { formatJsonOutput } from "./output/json.js";

// Re-export types
export * from "./types.js";

/**
 * Count files by type
 */
function countFiles(files: FileContext[]): FileCount {
  const byType: FileBreakdown = {
    package: 0,
    member: 0,
    guide: 0,
    schema: 0,
    unknown: 0,
  };

  for (const file of files) {
    byType[file.type]++;
  }

  return {
    total: files.length,
    byType,
  };
}

/**
 * Run health checks on a path
 *
 * @param path - Directory or file path to check
 * @param options - Health check options
 * @returns Health check result
 */
export async function runHealth(
  path: string,
  options: HealthOptions = {}
): Promise<HealthResult> {
  // Resolve to absolute path
  const absolutePath = resolve(path);

  // Discover files
  const files = discoverFiles(absolutePath);

  if (files.length === 0) {
    // Return empty result for empty directory
    return {
      path,
      score: {
        overall: 100,
        categories: {
          structure: 100,
          content: 100,
          format: 100,
          reference: 100,
        },
      },
      issues: [],
      tokens: {
        total: 0,
        bySection: {
          summaries: 0,
          descriptions: 0,
          parameters: 0,
          examples: 0,
          guides: 0,
          schemas: 0,
          other: 0,
        },
      },
      files: {
        total: 0,
        byType: {
          package: 0,
          member: 0,
          guide: 0,
          schema: 0,
          unknown: 0,
        },
      },
    };
  }

  // Build check context
  const context = buildCheckContext(absolutePath, files);

  // Run all checks
  const issues = runAllChecks(files, context);

  // Calculate score
  const score = calculateScore(issues);

  // Estimate tokens
  const tokens = estimateTotalTokens(files);

  // Count files
  const fileCount = countFiles(files);

  return {
    path,
    score,
    issues,
    tokens,
    files: fileCount,
  };
}

/**
 * Run health checks and format output
 *
 * @param path - Directory or file path to check
 * @param options - Health check options
 * @returns Formatted output string
 */
export async function runHealthWithOutput(
  path: string,
  options: HealthOptions = {}
): Promise<{ result: HealthResult; output: string; exitCode: number }> {
  const result = await runHealth(path, options);

  // Format output
  const output = options.json
    ? formatJsonOutput(result, options)
    : formatTextOutput(result, options);

  // Determine exit code
  const hasErrors = result.issues.some((i) => i.severity === "error");
  const exitCode = hasErrors ? 1 : 0;

  return { result, output, exitCode };
}
