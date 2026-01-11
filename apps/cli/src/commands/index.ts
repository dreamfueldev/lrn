/**
 * Command Router
 *
 * Routes parsed arguments to the appropriate command handler.
 */

import type { ParsedArgs } from "../args.js";
import {
  printHelp,
  printVersion,
  printCommandHelp,
  printUnknownCommand,
  printUnknownOption,
} from "./help.js";
import { getUnknownFlags } from "../args.js";

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
    printUnknownOption(unknownFlags[0]);
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

  // Route to command handler
  switch (args.command) {
    case undefined:
      // No command - either list packages or show package
      if (args.package) {
        return showPackage(args);
      }
      return listPackages(args);

    case "show":
      return showMember(args);

    case "list":
      return listMembers(args);

    case "guides":
      return listGuides(args);

    case "types":
      return listTypes(args);

    case "tags":
      return listTags(args);

    case "guide":
      return showGuide(args);

    case "type":
      return showType(args);

    case "search":
      return search(args);

    case "sync":
      return sync(args);

    case "add":
      return add(args);

    case "remove":
      return remove(args);

    case "versions":
      return versions(args);

    default:
      printUnknownCommand(args.command);
      return { exitCode: 1 };
  }
}

// Stub implementations - will be filled in as we implement each tier

async function listPackages(_args: ParsedArgs): Promise<CommandResult> {
  console.log("lrn - not yet implemented: list packages");
  return { exitCode: 0 };
}

async function showPackage(_args: ParsedArgs): Promise<CommandResult> {
  console.log("lrn <package> - not yet implemented");
  return { exitCode: 0 };
}

async function showMember(_args: ParsedArgs): Promise<CommandResult> {
  console.log("lrn <package> <member> - not yet implemented");
  return { exitCode: 0 };
}

async function listMembers(_args: ParsedArgs): Promise<CommandResult> {
  console.log("lrn <package> list - not yet implemented");
  return { exitCode: 0 };
}

async function listGuides(_args: ParsedArgs): Promise<CommandResult> {
  console.log("lrn <package> guides - not yet implemented");
  return { exitCode: 0 };
}

async function listTypes(_args: ParsedArgs): Promise<CommandResult> {
  console.log("lrn <package> types - not yet implemented");
  return { exitCode: 0 };
}

async function listTags(_args: ParsedArgs): Promise<CommandResult> {
  console.log("lrn <package> tags - not yet implemented");
  return { exitCode: 0 };
}

async function showGuide(_args: ParsedArgs): Promise<CommandResult> {
  console.log("lrn <package> guide <slug> - not yet implemented");
  return { exitCode: 0 };
}

async function showType(_args: ParsedArgs): Promise<CommandResult> {
  console.log("lrn <package> type <name> - not yet implemented");
  return { exitCode: 0 };
}

async function search(_args: ParsedArgs): Promise<CommandResult> {
  console.log("lrn search - not yet implemented");
  return { exitCode: 0 };
}

async function sync(_args: ParsedArgs): Promise<CommandResult> {
  console.log("lrn sync - not yet implemented (requires registry)");
  return { exitCode: 0 };
}

async function add(_args: ParsedArgs): Promise<CommandResult> {
  console.log("lrn add - not yet implemented (requires registry)");
  return { exitCode: 0 };
}

async function remove(_args: ParsedArgs): Promise<CommandResult> {
  console.log("lrn remove - not yet implemented");
  return { exitCode: 0 };
}

async function versions(_args: ParsedArgs): Promise<CommandResult> {
  console.log("lrn versions - not yet implemented (requires registry)");
  return { exitCode: 0 };
}
