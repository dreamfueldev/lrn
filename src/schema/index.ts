/**
 * lrn Intermediate Representation (IR) Schema v2
 *
 * A unified format for representing programming interface documentation
 * across different sources (OpenAPI, TypeScript, markdown docs, etc.)
 *
 * Design goals:
 * - Progressive disclosure: summaries for lists, full content on demand
 * - Unified access: API members and guides are peers, queryable the same way
 * - Token efficiency: LLMs can drill down to exactly what they need
 * - Composability: structured output that pipes well with standard tools
 */

// ============================================================
// Package - The top-level container
// ============================================================

/**
 * A Package is a complete documentation unit for a programming interface.
 * It contains structured API documentation (members), prose documentation
 * (guides), and reusable type definitions (schemas).
 */
export interface Package {
  /** Package identifier, typically the npm/pypi/etc. package name */
  name: string;

  /** Semantic version (semver) */
  version?: string;

  /** One-liner for package lists */
  summary?: string;

  /** Longer description for package detail view */
  description?: string;

  /** Information about how this package data was generated */
  source: SourceInfo;

  /** Structured API documentation (functions, classes, endpoints, etc.) */
  members: Member[];

  /** Prose documentation (tutorials, concepts, howtos, etc.) */
  guides: Guide[];

  /** Reusable type/schema definitions, keyed by name */
  schemas: Record<string, Schema>;

  /** Package-level tags for categorization */
  tags?: string[];

  /** Links to external resources */
  links?: PackageLinks;

  /** What type of thing this package documents */
  classification?: PackageClassification;
}

export type PackageClassification =
  | "api"        // REST/GraphQL endpoints
  | "library"    // functions, classes, types
  | "components" // UI elements with variants/props
  | "cli"        // commands, subcommands, flags
  | "config"     // declarative resources/directives
  | "framework"; // hybrid of multiple types

export interface SourceInfo {
  /** The adapter/parser that produced this IR */
  type: "openapi" | "typescript" | "jsdoc" | "markdown" | "custom";

  /** Original spec or documentation URL */
  url?: string;

  /** Base URL for HTTP APIs (e.g., "https://api.stripe.com") */
  baseUrl?: string;

  /** ISO 8601 timestamp when this IR was generated */
  generatedAt?: string;
}

export interface PackageLinks {
  /** Project homepage */
  homepage?: string;

  /** Source code repository */
  repository?: string;

  /** Changelog or release notes */
  changelog?: string;

  /** Official documentation site */
  documentation?: string;
}

// ============================================================
// Member - Structured API Documentation
// ============================================================

/**
 * A Member represents a discrete unit of API surface: a function, class,
 * method, type, constant, etc. Members can be nested (classes have methods,
 * namespaces have members) forming a tree structure.
 *
 * The dot-notation path (e.g., "charges.create") addresses members in the tree.
 */
export interface Member {
  /**
   * Member name. For nested members, this is just the local name (e.g., "create"),
   * not the full path (that's computed from the tree position).
   */
  name: string;

  /** What kind of API surface this represents */
  kind: MemberKind;

  /** One-line summary for list views - optimized for token efficiency */
  summary?: string;

  /** Full description for detail views */
  description?: string;

  /**
   * Human-readable type signature.
   * Examples:
   *   - "(amount: number, currency: string) => Promise<Charge>"
   *   - "class StripeClient"
   *   - "type ChargeStatus = 'pending' | 'succeeded' | 'failed'"
   *
   * This is a string (not a structured type) because:
   * 1. Avoids type resolution complexity across different source formats
   * 2. Still useful for LLMs and humans to understand the interface
   * 3. Detailed types are in `parameters`, `returns`, and `schemas`
   */
  signature?: string;

  /**
   * Language of the signature code block.
   * Examples: "html", "bash", "hcl"
   * Defaults to "typescript" when not set.
   * Only stored when the signature language is not typescript/ts/javascript/js.
   */
  signatureLanguage?: string;

  /** Input parameters (for functions, methods, constructors) */
  parameters?: Parameter[];

  /** Return value information */
  returns?: Returns;

  /** Usage examples */
  examples?: Example[];

  /** Categorization tags (shared namespace with Guide.tags) */
  tags?: string[];

  /**
   * Nested members. Used for:
   * - Class methods and properties
   * - Namespace members
   * - Nested types
   */
  children?: Member[];

  /** HTTP-specific information (REST API endpoints only) */
  http?: HttpInfo;

  /** Cross-references to related content */
  see?: Reference[];

  /**
   * Deprecation notice. If present (even if empty string), the member is deprecated.
   * The string value explains what to use instead.
   */
  deprecated?: string;

  /**
   * Version when this member was introduced.
   * Useful for compatibility checking.
   */
  since?: string;
}

export type MemberKind =
  | "function" // standalone function
  | "method" // function on a class/object
  | "class" // class definition
  | "namespace" // grouping container (module, namespace, API category)
  | "constant" // constant value
  | "type" // type alias, interface, enum
  | "property" // property on a class/object
  | "component" // UI component (daisyUI button, Radix Dialog)
  | "command" // CLI command/subcommand (docker run, git commit)
  | "resource"; // infrastructure/config resource (aws_lambda_function, K8s Deployment)

// ============================================================
// Guide - Prose Documentation
// ============================================================

/**
 * A Guide represents prose documentation that isn't tied to a single API member.
 * Tutorials, conceptual explanations, how-to guides, etc.
 *
 * Guides use a section tree structure that mirrors the Member hierarchy,
 * enabling the same progressive disclosure pattern:
 * - Guide list: title + summary
 * - Guide overview: intro + section summaries (TOC)
 * - Section detail: full content
 * - Full guide: everything
 */
export interface Guide {
  /**
   * URL-friendly identifier: "handling-webhooks", "getting-started"
   * Used for addressing: `lrn stripe guide handling-webhooks`
   */
  slug: string;

  /** Human-readable title: "Handling Webhooks" */
  title: string;

  /** One-liner for guide lists */
  summary?: string;

  /** Optional introductory content before sections */
  intro?: string;

  /**
   * Structured sections for progressive disclosure.
   * Each section has its own summary, enabling TOC-style overview.
   */
  sections: Section[];

  /**
   * Documentation type (inspired by Diataxis framework):
   * - quickstart: Get running fast, minimal explanation
   * - tutorial: Learning-oriented, step-by-step instruction
   * - concept: Understanding-oriented, explains how/why things work
   * - howto: Task-oriented, solve a specific problem
   * - example: Complete working code with explanation
   */
  kind: GuideKind;

  /** Categorization tags (shared namespace with Member.tags) */
  tags?: string[];

  /** Cross-references to related content */
  see?: Reference[];

  /** Difficulty/complexity hint */
  level?: "beginner" | "intermediate" | "advanced";
}

export type GuideKind =
  | "quickstart"
  | "tutorial"
  | "concept"
  | "howto"
  | "example";

/**
 * A Section is a discrete chunk of guide content with its own identity.
 * Sections can be nested, forming a tree that mirrors document structure.
 *
 * Addressable via dot notation: `lrn stripe guide webhooks.verification`
 */
export interface Section {
  /** URL-friendly identifier: "setup", "verification" */
  id: string;

  /** Section heading */
  title: string;

  /** One-liner for TOC view */
  summary?: string;

  /** Full markdown content for this section */
  content: string;

  /** Nested subsections */
  sections?: Section[];

  /** Code examples specific to this section */
  examples?: Example[];
}

// ============================================================
// Shared Types
// ============================================================

/**
 * Cross-reference to related content.
 * Enables navigation between members, guides, schemas, and external URLs.
 */
export interface Reference {
  /** What kind of thing this references */
  type: "member" | "guide" | "schema" | "url";

  /**
   * The reference target:
   * - member: dot-notation path ("charges.create")
   * - guide: slug ("handling-webhooks")
   * - schema: schema name ("Charge")
   * - url: full URL
   */
  target: string;

  /** Optional display label (defaults to target) */
  label?: string;
}

/**
 * A code example with optional metadata.
 */
export interface Example {
  /** Optional title: "Basic usage", "With error handling" */
  title?: string;

  /** Language for syntax highlighting: "typescript", "python", "bash" */
  language?: string;

  /** The example code */
  code: string;

  /** Explanation of what this example demonstrates */
  description?: string;

  /**
   * Can this example run standalone, or does it need surrounding context?
   * Helps LLMs decide whether to use as-is or adapt.
   */
  standalone?: boolean;
}

/**
 * Function/method parameter.
 */
export interface Parameter {
  /** Parameter name */
  name: string;

  /** Type as a human-readable string */
  type?: string;

  /** What this parameter does */
  description?: string;

  /** Is this parameter required? */
  required?: boolean;

  /** Default value if not provided */
  default?: unknown;

  /**
   * Where this parameter appears in HTTP requests.
   * Only relevant for REST API endpoints.
   */
  in?: "path" | "query" | "header" | "body";

  /** Reference to a schema for complex types */
  schema?: string;
}

/**
 * Return value information.
 */
export interface Returns {
  /** Type as a human-readable string */
  type?: string;

  /** What the return value represents */
  description?: string;

  /** Reference to a schema for complex types */
  schema?: string;
}

// ============================================================
// HTTP-Specific Types
// ============================================================

/**
 * HTTP-specific information for REST API endpoints.
 * This is an optional extension - not all Members have HTTP info.
 */
export interface HttpInfo {
  /** HTTP method */
  method: HttpMethod;

  /**
   * URL path, may include path parameters.
   * Examples: "/v1/charges", "/v1/charges/{id}"
   */
  path: string;

  /** Query string parameters (convenience, also in Member.parameters) */
  query?: Parameter[];

  /** Request body schema reference or inline schema */
  body?: Schema | string;

  /** Response definitions by status code */
  responses?: Record<string, ResponseInfo>;

  /** Required authentication scopes/permissions */
  scopes?: string[];
}

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "PATCH"
  | "HEAD"
  | "OPTIONS";

export interface ResponseInfo {
  /** Description of when this response occurs */
  description: string;

  /** Response body schema reference or inline schema */
  schema?: Schema | string;

  /** Response headers */
  headers?: Record<string, Parameter>;
}

// ============================================================
// Schema - Type Definitions
// ============================================================

/**
 * Schema represents a data type definition.
 * Based on JSON Schema with some simplifications.
 *
 * Schemas are stored in Package.schemas and referenced by name
 * using the `$ref` field or string references in other types.
 */
export interface Schema {
  /** JSON Schema type */
  type?: SchemaType;

  /** Human-readable description */
  description?: string;

  /** Object properties (when type is "object") */
  properties?: Record<string, Schema>;

  /** Array item schema (when type is "array") */
  items?: Schema;

  /** Required property names (when type is "object") */
  required?: string[];

  /** Allowed values (for enums) */
  enum?: unknown[];

  /** Default value */
  default?: unknown;

  /** Example value */
  example?: unknown;

  /**
   * Reference to another schema by name.
   * Format: "SchemaName" (resolved from Package.schemas)
   */
  $ref?: string;

  /**
   * Additional format hint: "email", "uri", "date-time", "uuid", etc.
   * Provides semantic meaning beyond the base type.
   */
  format?: string;

  /** Minimum value (for numbers) */
  minimum?: number;

  /** Maximum value (for numbers) */
  maximum?: number;

  /** Minimum length (for strings/arrays) */
  minLength?: number;

  /** Maximum length (for strings/arrays) */
  maxLength?: number;

  /** Regex pattern (for strings) */
  pattern?: string;

  /** Allow null values */
  nullable?: boolean;

  /**
   * Union types: value must match one of these schemas.
   * Example: oneOf: [{ type: "string" }, { type: "number" }]
   */
  oneOf?: Schema[];

  /**
   * Intersection types: value must match all of these schemas.
   * Example: allOf: [{ $ref: "Base" }, { properties: { extra: ... } }]
   */
  allOf?: Schema[];
}

export type SchemaType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "object"
  | "array"
  | "null";

// ============================================================
// Config - lrn.config.json
// ============================================================

/**
 * Configuration file for lrn, typically at project root as lrn.config.json
 * or in user home as ~/.lrn/config.json
 */
export interface LrnConfig {
  /** JSON Schema reference for editor support */
  $schema?: string;

  /** Registry endpoint (default: https://uselrn.dev) */
  registry?: string;

  /** Package specifications */
  packages?: Record<string, PackageSpec>;

  /** Local cache directory (default: ~/.lrn) */
  cache?: string;

  /** Default output format */
  defaultFormat?: "text" | "json" | "markdown" | "summary";

  /** Enable automatic update checks (default: true) */
  updateCheck?: boolean;
}

/**
 * Package specification in config.
 * Can be a semver string or an object with more options.
 */
export type PackageSpec =
  | string // semver range: "^2.0.0", "~1.2.3", "2024.1.0"
  | PackageSpecObject;

export interface PackageSpecObject {
  /** Semver version (for registry packages) */
  version?: string;

  /** Local file path to .lrn.json file */
  path?: string;

  /** Remote URL to .lrn.json file */
  url?: string;
}
