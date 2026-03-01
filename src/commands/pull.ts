/**
 * Pull Command
 *
 * Downloads a package from the registry and caches it locally.
 */

import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import type { ParsedArgs } from "../args.js";
import { parsePackageSpec } from "../args.js";
import type { ResolvedConfig } from "../config.js";
import { requireToken } from "../credentials.js";
import { updateCacheIndex } from "../cache-index.js";
import { RegistryClient } from "../registry.js";
import {
  ArgumentError,
  ChecksumError,
  RegistryForbiddenError,
  NetworkError,
} from "../errors.js";

export async function runPull(args: ParsedArgs, config: ResolvedConfig): Promise<string> {
  // 1. Parse package spec
  const raw = args.positional[0];
  if (!raw) {
    throw new ArgumentError("Missing package name.", "Usage: lrn pull <package>[@version]");
  }

  const { name, version: requestedVersion } = parsePackageSpec(raw);

  // 2. Require auth
  const creds = requireToken(config.cache);
  const client = new RegistryClient(creds.registry || config.registry, creds.token);

  // 3. Resolve version
  let version = requestedVersion;
  if (!version) {
    const pkg = await client.getPackage(name);
    if (!pkg.versions.length) {
      throw new NetworkError(`No versions found for package '${name}'.`);
    }
    version = pkg.versions[0]!.version;
  }

  // 4. Check cache
  const packagesDir = join(config.cache, "packages", name);
  const cachedPath = join(packagesDir, `${version}.lrn.json`);
  if (existsSync(cachedPath) && !args.flags.force) {
    return `${name}@${version} already cached.`;
  }

  // 5. Get version info
  const versionInfo = await client.getVersion(name, version);
  if (!versionInfo.downloadUrl) {
    throw new RegistryForbiddenError();
  }

  // 6. Download
  process.stderr.write(`Pulling ${name}@${version}...`);
  const data = await client.downloadFile(versionInfo.downloadUrl);

  // 7. Verify checksum
  if (versionInfo.version.checksum) {
    const hash = createHash("sha256").update(Buffer.from(data)).digest("hex");
    const expected = versionInfo.version.checksum.replace(/^sha256:/, "");
    if (hash !== expected) {
      throw new ChecksumError(name);
    }
  }

  // 8. Extract .tar.gz to temp dir, move .lrn.json to cache
  const tempDir = join(tmpdir(), `lrn-pull-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  try {
    const tarPath = join(tempDir, "package.tar.gz");
    writeFileSync(tarPath, Buffer.from(data));
    execSync(`tar xzf ${JSON.stringify(tarPath)} -C ${JSON.stringify(tempDir)}`, { stdio: "ignore" });

    // Find the .lrn.json file in the extracted contents
    const extractedJson = findLrnJson(tempDir);
    if (!extractedJson) {
      throw new NetworkError(`No .lrn.json file found in downloaded package '${name}'.`);
    }

    // Move to cache
    mkdirSync(packagesDir, { recursive: true });
    const { readFileSync: readFs } = await import("node:fs");
    writeFileSync(cachedPath, readFs(extractedJson));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }

  // 9. Update cache index
  updateCacheIndex(config.cache, name, {
    version,
    pulledAt: new Date().toISOString(),
    checksum: versionInfo.version.checksum || "",
  });

  // 10. Format size
  const size = formatSize(versionInfo.version.size);
  process.stderr.write(" done\n");

  return `Pulled ${name}@${version} (${size})`;
}

function findLrnJson(dir: string): string | null {
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  const { join: joinPath } = require("node:path") as typeof import("node:path");

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = joinPath(dir, entry);
    if (entry.endsWith(".lrn.json") && statSync(full).isFile()) {
      return full;
    }
    if (statSync(full).isDirectory()) {
      const found = findLrnJson(full);
      if (found) return found;
    }
  }
  return null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
