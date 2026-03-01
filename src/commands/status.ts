/**
 * Status Command
 *
 * Shows current login status by validating the session with the registry.
 */

import type { ParsedArgs } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import { readCredentials, deleteCredentials } from "../credentials.js";
import { RegistryClient } from "../registry.js";

export async function runStatus(_args: ParsedArgs, config: ResolvedConfig): Promise<string> {
  const creds = readCredentials(config.cache);
  if (!creds) {
    return "Not logged in.\nRun 'lrn login' to authenticate.";
  }

  const client = new RegistryClient(creds.registry || config.registry, creds.token);
  const me = await client.getMe();

  if (!me) {
    deleteCredentials(config.cache);
    return "Session expired.\nRun 'lrn login' to authenticate.";
  }

  return `User: ${me.user.name}\nRole: ${me.role}`;
}
