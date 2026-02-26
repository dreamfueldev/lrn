/**
 * Logout Command
 *
 * Removes stored registry credentials.
 */

import type { ParsedArgs } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import { deleteCredentials } from "../credentials.js";

export function runLogout(_args: ParsedArgs, config: ResolvedConfig): string {
  deleteCredentials(config.cache);
  return "Logged out.";
}
