/**
 * Command Router
 *
 * Routes parsed arguments to the appropriate command handler.
 */

import type { ParsedArgs } from "../args.js";
import { loadConfig, type ResolvedConfig } from "../config.js";
import { CLIError, ExitCode, formatError } from "../errors.js";
import {
  printHelp,
  printVersion,
  printCommandHelp,
  printUnknownCommand,
  printUnknownOption,
} from "./help.js";
import { getUnknownFlags } from "../args.js";
import { runListPackages } from "./list-packages.js";
import { runPackage } from "./package.js";
import { runList } from "./list.js";
import { runMember } from "./member.js";
import { runGuides } from "./guides.js";
import { runGuide } from "./guide.js";
import { runTypes } from "./types.js";
import { runType } from "./type.js";
import { runTags } from "./tags.js";
import { runSearch } from "./search.js";
import { runParse } from "./parse.js";
import { runFormatDir } from "./format-dir.js";
import { runCrawl } from "./crawl.js";
import { runHealthCommand } from "./health.js";
import { runLlmsFull } from "./llms-full.js";
import { runLogin } from "./login.js";
import { runLogout } from "./logout.js";
import { runStatus } from "./status.js";
import { runPull } from "./pull.js";
import { runAdd } from "./add.js";
import { runRemove } from "./remove.js";
import { runSync } from "./sync.js";
import { runVersions } from "./versions.js";
import { runTeach } from "./teach.js";

export interface CommandResult {
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

/**
 * Execute the appropriate command based on parsed arguments
 */
export async function runCommand(args: ParsedArgs): Promise<CommandResult> {
  // Check for unknown flags first
  const unknownFlags = getUnknownFlags(args);
  if (unknownFlags.length > 0) {
    return { exitCode: 1, stderr: printUnknownOption(unknownFlags[0]!) };
  }

  // Handle global flags
  if (args.flags.version) {
    return { exitCode: 0, stdout: printVersion() };
  }

  if (args.flags.help) {
    // If there's a command, show command-specific help
    if (args.command) {
      return { exitCode: 0, ...printCommandHelp(args.command) };
    } else {
      return { exitCode: 0, stdout: printHelp() };
    }
  }

  // Load config for commands that need it
  let config: ResolvedConfig;
  try {
    config = loadConfig(args);
  } catch (err) {
    if (err instanceof CLIError) {
      return { exitCode: err.exitCode, stderr: formatError(err, args.flags.verbose) };
    }
    throw err;
  }

  // Route to command handler
  try {
    switch (args.command) {
      case undefined:
        // No command - either list packages or show package
        if (args.package) {
          return { exitCode: 0, stdout: runPackage(args, config) };
        } else {
          return { exitCode: 0, stdout: runListPackages(args, config) };
        }

      case "list":
        return { exitCode: 0, stdout: runList(args, config) };

      case "guides":
        return { exitCode: 0, stdout: runGuides(args, config) };

      case "types":
        return { exitCode: 0, stdout: runTypes(args, config) };

      case "tags":
        return { exitCode: 0, stdout: runTags(args, config) };

      case "guide":
        return { exitCode: 0, stdout: runGuide(args, config) };

      case "type":
        return { exitCode: 0, stdout: runType(args, config) };

      case "search":
        return { exitCode: 0, stdout: await runSearch(args, config) };

      case "sync":
        return { exitCode: 0, stdout: await runSync(args, config) };

      case "add":
        return { exitCode: 0, stdout: await runAdd(args, config) };

      case "remove":
        return { exitCode: 0, stdout: runRemove(args, config) };

      case "versions":
        return { exitCode: 0, stdout: await runVersions(args, config) };

      case "parse":
        return { exitCode: 0, stdout: await runParse(args, config) };

      case "format":
        // Format to directory requires --out option
        if (args.options.out) {
          return { exitCode: 0, stdout: runFormatDir(args, config) };
        }
        // Without --out, fall through to show help
        return { exitCode: 1, stdout: "Usage: lrn format <file.json> --out <directory>" };

      case "crawl":
        return { exitCode: 0, stdout: await runCrawl(args) };

      case "health": {
        const result = await runHealthCommand(args);
        return result;
      }

      case "llms-full":
        return { exitCode: 0, stdout: await runLlmsFull(args, config) };

      case "login":
        return { exitCode: 0, stdout: await runLogin(args, config) };

      case "logout":
        return { exitCode: 0, stdout: runLogout(args, config) };

      case "status":
        return { exitCode: 0, stdout: await runStatus(args, config) };

      case "pull":
        return { exitCode: 0, stdout: await runPull(args, config) };

      case "teach":
        return { exitCode: 0, stdout: runTeach(args, config) };

      default:
        // Check if this might be a member path (contains dots or positional[0] exists)
        if (args.package && args.positional.length > 0) {
          return { exitCode: 0, stdout: runMember(args, config) };
        }
        return { exitCode: 1, stderr: printUnknownCommand(args.command) };
    }
  } catch (err) {
    if (err instanceof CLIError) {
      return { exitCode: err.exitCode, stderr: formatError(err, args.flags.verbose) };
    }
    throw err;
  }
}
