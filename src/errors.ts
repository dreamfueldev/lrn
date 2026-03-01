/**
 * Error Types and Exit Codes
 *
 * Standardized error handling for the CLI.
 */

/**
 * Exit codes used by the CLI
 */
export const ExitCode = {
  /** Success */
  SUCCESS: 0,
  /** General error (invalid arguments, file errors, etc.) */
  GENERAL_ERROR: 1,
  /** Package not found in cache or registry */
  PACKAGE_NOT_FOUND: 2,
  /** Member, guide, or type not found in package */
  NOT_FOUND: 3,
  /** Network error (registry unreachable) */
  NETWORK_ERROR: 4,
  /** Authentication error */
  AUTH_ERROR: 5,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

/**
 * Base class for CLI errors
 */
export class CLIError extends Error {
  readonly exitCode: ExitCodeValue;
  readonly hint?: string;
  readonly context?: Record<string, string>;

  constructor(
    message: string,
    exitCode: ExitCodeValue = ExitCode.GENERAL_ERROR,
    hint?: string,
    context?: Record<string, string>
  ) {
    super(message);
    this.name = "CLIError";
    this.exitCode = exitCode;
    this.hint = hint;
    this.context = context;
  }
}

/**
 * Error for when a package is not found
 */
export class PackageNotFoundError extends CLIError {
  readonly packageName: string;

  constructor(packageName: string, suggestion?: string) {
    const message = `Package not found: ${packageName}`;
    const hint = suggestion
      ? `Did you mean: ${suggestion}?`
      : "Run 'lrn sync' to download packages or 'lrn' to list cached packages.";
    super(message, ExitCode.PACKAGE_NOT_FOUND, hint, { package: packageName });
    this.name = "PackageNotFoundError";
    this.packageName = packageName;
  }
}

/**
 * Error for when a member is not found in a package
 */
export class MemberNotFoundError extends CLIError {
  readonly packageName: string;
  readonly memberPath: string;

  constructor(packageName: string, memberPath: string, suggestion?: string) {
    const message = `Member not found: ${packageName}.${memberPath}`;
    const hint = suggestion
      ? `Did you mean: ${suggestion}?`
      : `Run 'lrn ${packageName} list' to see available members.`;
    super(message, ExitCode.NOT_FOUND, hint);
    this.name = "MemberNotFoundError";
    this.packageName = packageName;
    this.memberPath = memberPath;
  }
}

/**
 * Error for when a guide is not found in a package
 */
export class GuideNotFoundError extends CLIError {
  readonly packageName: string;
  readonly guideSlug: string;

  constructor(packageName: string, guideSlug: string, suggestion?: string) {
    const message = `Guide not found: ${guideSlug}`;
    const hint = suggestion
      ? `Did you mean: ${suggestion}?`
      : `Run 'lrn ${packageName} guides' to see available guides.`;
    super(message, ExitCode.NOT_FOUND, hint);
    this.name = "GuideNotFoundError";
    this.packageName = packageName;
    this.guideSlug = guideSlug;
  }
}

/**
 * Error for when a type/schema is not found in a package
 */
export class TypeNotFoundError extends CLIError {
  readonly packageName: string;
  readonly typeName: string;

  constructor(packageName: string, typeName: string, suggestion?: string, referencedIn?: string[]) {
    const message = `Type not found: ${typeName}`;
    const lines: string[] = [];
    if (referencedIn && referencedIn.length > 0) {
      lines.push(`Referenced as parameter type in: ${referencedIn.join(", ")}`);
    }
    if (suggestion) {
      lines.push(`Did you mean: ${suggestion}?`);
    } else {
      lines.push(`Run 'lrn ${packageName} types' to see available types.`);
    }
    super(message, ExitCode.NOT_FOUND, lines.join("\n"));
    this.name = "TypeNotFoundError";
    this.packageName = packageName;
    this.typeName = typeName;
  }
}

/**
 * Error for when a guide section is not found
 */
export class SectionNotFoundError extends CLIError {
  readonly packageName: string;
  readonly guideSlug: string;
  readonly sectionPath: string;

  constructor(
    packageName: string,
    guideSlug: string,
    sectionPath: string,
    suggestion?: string
  ) {
    const message = `Section not found: ${sectionPath}`;
    const hint = suggestion
      ? `Did you mean: ${suggestion}?`
      : `Run 'lrn ${packageName} guide ${guideSlug}' to see available sections.`;
    super(message, ExitCode.NOT_FOUND, hint);
    this.name = "SectionNotFoundError";
    this.packageName = packageName;
    this.guideSlug = guideSlug;
    this.sectionPath = sectionPath;
  }
}

/**
 * Error for invalid configuration
 */
export class ConfigError extends CLIError {
  readonly configPath?: string;

  constructor(message: string, configPath?: string) {
    super(
      message,
      ExitCode.GENERAL_ERROR,
      "Check config file syntax. Run 'lrn --no-config' to bypass.",
      configPath ? { config: configPath } : undefined
    );
    this.name = "ConfigError";
    this.configPath = configPath;
  }
}

/**
 * Error for network/registry issues
 */
export class NetworkError extends CLIError {
  readonly url?: string;

  constructor(message: string, url?: string) {
    super(
      message,
      ExitCode.NETWORK_ERROR,
      "Check your internet connection or try again later.",
      url ? { url } : undefined
    );
    this.name = "NetworkError";
    this.url = url;
  }
}

/**
 * Error for invalid command-line arguments
 */
export class ArgumentError extends CLIError {
  constructor(message: string, hint?: string) {
    super(message, ExitCode.GENERAL_ERROR, hint || "Run 'lrn --help' for usage information.");
    this.name = "ArgumentError";
  }
}

/**
 * Error for crawl operations
 */
export class CrawlError extends CLIError {
  readonly url?: string;
  readonly statusCode?: number;

  constructor(message: string, url?: string, statusCode?: number) {
    super(message, ExitCode.NETWORK_ERROR);
    this.name = "CrawlError";
    this.url = url;
    this.statusCode = statusCode;
  }
}

/**
 * Error for registry authentication failures (401)
 */
export class RegistryAuthError extends CLIError {
  constructor(message: string = "Not logged in.") {
    super(message, ExitCode.AUTH_ERROR, "Run 'lrn login' to authenticate.");
    this.name = "RegistryAuthError";
  }
}

/**
 * Error for registry authorization failures (403)
 */
export class RegistryForbiddenError extends CLIError {
  constructor(message: string = "Package downloads require admin access.") {
    super(message, ExitCode.AUTH_ERROR, "Contact the lrn team.");
    this.name = "RegistryForbiddenError";
  }
}

/**
 * Error for registry rate limiting (429)
 */
export class RegistryRateLimitError extends CLIError {
  constructor(message: string = "Rate limit exceeded.") {
    super(message, ExitCode.NETWORK_ERROR, "Try again later.");
    this.name = "RegistryRateLimitError";
  }
}

/**
 * Error for update failures
 */
export class UpdateError extends CLIError {
  constructor(message: string, hint?: string) {
    super(
      message,
      ExitCode.GENERAL_ERROR,
      hint || "Run 'curl -fsSL https://uselrn.dev/install | sh' to install manually.",
    );
    this.name = "UpdateError";
  }
}

/**
 * Error for binary checksum verification failures during update
 */
export class BinaryChecksumError extends CLIError {
  readonly expected: string;
  readonly actual: string;

  constructor(expected: string, actual: string) {
    super(
      `Binary checksum verification failed.\nExpected: ${expected}\nActual:   ${actual}`,
      ExitCode.GENERAL_ERROR,
      "The downloaded binary may be corrupted. Try again or install manually.",
    );
    this.name = "BinaryChecksumError";
    this.expected = expected;
    this.actual = actual;
  }
}

/**
 * Error for checksum verification failures
 */
export class ChecksumError extends CLIError {
  readonly packageName: string;

  constructor(packageName: string) {
    super(
      `Checksum verification failed for ${packageName}.`,
      ExitCode.GENERAL_ERROR,
      "Try 'lrn pull --force'.",
    );
    this.name = "ChecksumError";
    this.packageName = packageName;
  }
}

/**
 * Format an error for display
 */
export function formatError(error: CLIError, verbose: boolean = false): string {
  let output = `Error: ${error.message}`;

  if (error.hint) {
    output += `\n${error.hint}`;
  }

  if (verbose && error.context && Object.keys(error.context).length > 0) {
    output += "\n\nDebug:";
    for (const [key, value] of Object.entries(error.context)) {
      output += `\n  ${key}: ${value}`;
    }
  }

  if (verbose && error.stack) {
    output += `\n\nStack trace:\n${error.stack}`;
  }

  return output;
}

/**
 * Print an error to stderr
 */
export function printError(error: CLIError, verbose: boolean = false): void {
  console.error(formatError(error, verbose));
}

/**
 * Find similar strings for suggestions (simple Levenshtein-based)
 */
export function findSimilar(
  needle: string,
  haystack: string[],
  maxDistance: number = 3
): string | undefined {
  let bestMatch: string | undefined;
  let bestDistance = Infinity;

  for (const item of haystack) {
    const distance = levenshteinDistance(needle.toLowerCase(), item.toLowerCase());
    if (distance < bestDistance && distance <= maxDistance) {
      bestDistance = distance;
      bestMatch = item;
    }
  }

  return bestMatch;
}

/**
 * Simple Levenshtein distance implementation
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1, // substitution
          matrix[i]![j - 1]! + 1, // insertion
          matrix[i - 1]![j]! + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length]![a.length]!;
}
