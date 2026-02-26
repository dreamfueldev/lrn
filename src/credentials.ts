/**
 * Credentials Management
 *
 * Manages ~/.lrn/credentials JSON file for registry authentication.
 */

import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { RegistryAuthError } from "./errors.js";

export interface Credentials {
  /** Registry URL */
  registry: string;
  /** Bearer session token */
  token: string;
  /** Display name from session */
  user: string;
}

function credentialsPath(cacheDir: string): string {
  return join(cacheDir, "credentials");
}

/**
 * Read stored credentials, or null if not found/corrupt.
 */
export function readCredentials(cacheDir: string): Credentials | null {
  try {
    const raw = readFileSync(credentialsPath(cacheDir), "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === "string" && typeof parsed.user === "string") {
      return parsed as Credentials;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Write credentials to disk with restricted permissions.
 */
export function writeCredentials(cacheDir: string, creds: Credentials): void {
  mkdirSync(cacheDir, { recursive: true });
  const path = credentialsPath(cacheDir);
  writeFileSync(path, JSON.stringify(creds, null, 2) + "\n", { mode: 0o600 });
}

/**
 * Delete stored credentials. No-op if missing.
 */
export function deleteCredentials(cacheDir: string): void {
  try {
    unlinkSync(credentialsPath(cacheDir));
  } catch {
    // Already gone — fine
  }
}

/**
 * Read credentials or throw RegistryAuthError if missing.
 */
export function requireToken(cacheDir: string): Credentials {
  const creds = readCredentials(cacheDir);
  if (!creds) {
    throw new RegistryAuthError();
  }
  return creds;
}
