/**
 * lrn Intermediate Representation (IR) Schema
 *
 * A unified format for representing programming interfaces
 * across different sources (OpenAPI, TypeScript, etc.)
 */

export interface Package {
  /** Package/API name */
  name: string;
  /** Semantic version */
  version?: string;
  /** Human-readable description */
  description?: string;
  /** Information about where this package data came from */
  source: SourceInfo;
  /** Top-level interface members */
  members: Member[];
  /** Reusable type/schema definitions */
  schemas?: Record<string, Schema>;
}

export interface SourceInfo {
  /** The adapter that produced this IR */
  type: "openapi" | "typescript" | "jsdoc" | "custom";
  /** Original spec/documentation URL */
  url?: string;
  /** Base URL for HTTP APIs */
  baseUrl?: string;
}

export interface Member {
  /** Member name, can use dot notation for nested (e.g., "charges.create") */
  name: string;
  /** What kind of interface member this is */
  kind: "function" | "class" | "namespace" | "constant" | "type";
  /** One-line summary for list views */
  summary?: string;
  /** Full description */
  description?: string;
  /** Human-readable signature (e.g., "(options: Config) => Client") */
  signature?: string;
  /** Input parameters */
  parameters?: Parameter[];
  /** Return value information */
  returns?: Returns;
  /** Usage examples */
  examples?: Example[];
  /** Categorization tags */
  tags?: string[];
  /** Nested members (for classes, namespaces) */
  children?: Member[];
  /** HTTP-specific information (only for REST API endpoints) */
  http?: HttpInfo;
}

export interface Parameter {
  /** Parameter name */
  name: string;
  /** Type as a string (not resolved) */
  type?: string;
  /** Description of the parameter */
  description?: string;
  /** Whether this parameter is required */
  required?: boolean;
  /** Default value if not provided */
  default?: unknown;
}

export interface Returns {
  /** Return type as a string */
  type?: string;
  /** Description of the return value */
  description?: string;
}

export interface Example {
  /** Example title */
  title?: string;
  /** Language for syntax highlighting */
  language?: string;
  /** The example code */
  code: string;
  /** Additional context about this example */
  description?: string;
}

export interface HttpInfo {
  /** HTTP method */
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
  /** URL path (may include path parameters like /users/{id}) */
  path: string;
  /** Query string parameters */
  query?: Parameter[];
  /** Request body schema */
  body?: Schema;
  /** Response definitions by status code */
  responses?: Record<string, ResponseInfo>;
}

export interface ResponseInfo {
  /** Description of this response */
  description: string;
  /** Response body schema */
  schema?: Schema;
}

export interface Schema {
  /** JSON Schema type */
  type?: string;
  /** Object properties */
  properties?: Record<string, Schema>;
  /** Array item schema */
  items?: Schema;
  /** Required property names */
  required?: string[];
  /** Description of this schema */
  description?: string;
  /** Example value */
  example?: unknown;
  /** Reference to another schema */
  $ref?: string;
  /** Enum values */
  enum?: unknown[];
}
