/**
 * JSON Formatter
 *
 * Machine-readable JSON output.
 */

import type { FormattableData, FormatOptions } from "./index.js";

/**
 * Format data as JSON
 */
export function formatJson(data: FormattableData, _options: FormatOptions): string {
  return JSON.stringify(data, null, 2);
}
