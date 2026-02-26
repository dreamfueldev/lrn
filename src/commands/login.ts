/**
 * Login Command
 *
 * Authenticates with the registry via GitHub device flow.
 */

import { exec } from "node:child_process";
import type { ParsedArgs } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import { writeCredentials } from "../credentials.js";
import { RegistryClient } from "../registry.js";
import { NetworkError } from "../errors.js";

const CLIENT_ID = "lrn-cli";

export async function runLogin(_args: ParsedArgs, config: ResolvedConfig): Promise<string> {
  const client = new RegistryClient(config.registry);

  // 1. Request device code
  const device = await client.requestDeviceCode(CLIENT_ID);

  // 2. Print verification info to stderr (real-time feedback)
  const browseUrl = device.verificationUriComplete ?? device.verificationUri;
  process.stderr.write(`\nOpen this URL in your browser:\n  ${browseUrl}\n\n`);
  process.stderr.write(`Code: ${device.userCode}\n\n`);

  // 3. Best-effort browser open
  openBrowser(browseUrl);

  // 4. Poll for token
  const interval = (device.interval || 5) * 1000;
  const deadline = Date.now() + device.expiresIn * 1000;

  process.stderr.write("Waiting for authorization...\n");

  while (Date.now() < deadline) {
    await sleep(interval);
    const result = await client.pollDeviceToken(device.deviceCode, CLIENT_ID);

    if (result.status === "success" && result.token) {
      // 5. Get session info
      const authedClient = new RegistryClient(config.registry, result.token);
      const session = await authedClient.getSession();
      const userName = session?.user?.name ?? "unknown";

      // 6. Write credentials
      writeCredentials(config.cache, {
        registry: config.registry,
        token: result.token,
        user: userName,
      });

      return `Logged in as ${userName}`;
    }

    if (result.status === "expired") {
      throw new NetworkError("Device code expired. Please try again.");
    }
  }

  throw new NetworkError("Login timed out. Please try again.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openBrowser(url: string): void {
  // Only open browser when running in a real terminal (not in tests)
  if (!process.stderr.isTTY) return;
  if (process.env.NODE_ENV === "test") return;
  try {
    const cmd = process.platform === "darwin" ? "open" : "xdg-open";
    exec(`${cmd} ${JSON.stringify(url)}`);
  } catch {
    // Best-effort — user can open manually
  }
}
