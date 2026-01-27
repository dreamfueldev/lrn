/**
 * Command Router
 *
 * Routes parsed arguments to the appropriate command handler.
 */

import type { ParsedArgs } from "../args.js";
import { loadConfig, type ResolvedConfig } from "../config.js";
import { CLIError, ExitCode } from "../errors.js";
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

export interface CommandResult {
  exitCode: number;
}

/**
 * Execute the appropriate command based on parsed arguments
 */
export async function runCommand(args: ParsedArgs): Promise<CommandResult> {
  // Check for unknown flags first
  const unknownFlags = getUnknownFlags(args);
  if (unknownFlags.length > 0) {
    printUnknownOption(unknownFlags[0]!);
    return { exitCode: 1 };
  }

  // Handle global flags
  if (args.flags.version) {
    printVersion();
    return { exitCode: 0 };
  }

  if (args.flags.help) {
    // If there's a command, show command-specific help
    if (args.command) {
      printCommandHelp(args.command);
    } else {
      printHelp();
    }
    return { exitCode: 0 };
  }

  // Load config for commands that need it
  let config: ResolvedConfig;
  try {
    config = loadConfig(args);
  } catch (err) {
    if (err instanceof CLIError) {
      console.error(err.message);
      return { exitCode: err.exitCode };
    }
    throw err;
  }

  // Route to command handler
  try {
    switch (args.command) {
      case undefined:
        // No command - either list packages or show package
        if (args.package) {
          runPackage(args, config);
        } else {
          runListPackages(args, config);
        }
        return { exitCode: 0 };

      case "list":
        runList(args, config);
        return { exitCode: 0 };

      case "guides":
        runGuides(args, config);
        return { exitCode: 0 };

      case "types":
        runTypes(args, config);
        return { exitCode: 0 };

      case "tags":
        runTags(args, config);
        return { exitCode: 0 };

      case "guide":
        runGuide(args, config);
        return { exitCode: 0 };

      case "type":
        runType(args, config);
        return { exitCode: 0 };

      case "search":
        runSearch(args, config);
        return { exitCode: 0 };

      case "sync":
        console.log("lrn sync - not yet implemented (requires registry)");
        return { exitCode: 0 };

      case "add":
        console.log("lrn add - not yet implemented (requires registry)");
        return { exitCode: 0 };

      case "remove":
        console.log("lrn remove - not yet implemented");
        return { exitCode: 0 };

      case "versions":
        console.log("lrn versions - not yet implemented (requires registry)");
        return { exitCode: 0 };

      case "parse":
        await runParse(args, config);
        return { exitCode: 0 };

      case "format":
        // Format to directory requires --out option
        if (args.options.out) {
          runFormatDir(args, config);
          return { exitCode: 0 };
        }
        // Without --out, fall through to show help
        console.log("Usage: lrn format <file.json> --out <directory>");
        return { exitCode: 1 };

      case "crawl":
        await runCrawl(args);
        return { exitCode: 0 };

      default:
        // Check if this might be a member path (contains dots or positional[0] exists)
        if (args.package && args.positional.length > 0) {
          runMember(args, config);
          return { exitCode: 0 };
        }
        printUnknownCommand(args.command);
        return { exitCode: 1 };
    }
  } catch (err) {
    if (err instanceof CLIError) {
      console.error(err.message);
      return { exitCode: err.exitCode };
    }
    throw err;
  }
}
