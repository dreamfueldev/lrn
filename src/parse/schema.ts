/**
 * Schema Parser
 *
 * Parses markdown files into Schema IR.
 */

import type { Schema } from "../schema/index.js";
import {
  parseMarkdown,
  extractH1,
  extractFirstBlockquote,
  extractMetadata,
  extractCodeBlock,
  extractTableMarkdown,
  type Token,
} from "./markdown.js";
import { parsePropertyTable } from "./table.js";

/**
 * Parse a markdown file content into a named Schema
 */
export function parseSchema(
  content: string,
  filename: string
): { name: string; schema: Schema } {
  const tokens = parseMarkdown(content);

  // Extract H1 as name
  const h1 = extractH1(tokens);
  const name = h1 || filenameToName(filename);

  // Extract type from **Type:** line
  const typeRaw = extractMetadata(tokens, "Type");
  const schemaType = parseSchemaType(typeRaw);

  // Extract description from first blockquote
  const description = extractFirstBlockquote(tokens);

  // Extract format from **Format:** line
  const format = extractMetadata(tokens, "Format");

  // Build schema
  const schema: Schema = {};

  if (schemaType) {
    schema.type = schemaType;
  }

  if (description) {
    schema.description = description;
  }

  if (format) {
    schema.format = format;
  }

  // Parse properties table if this is an object type
  const propertiesTable = extractPropertiesSection(tokens);
  if (propertiesTable) {
    const props = parsePropertyTable(propertiesTable);
    if (props.length > 0) {
      schema.type = "object";
      schema.properties = {};
      const requiredFields: string[] = [];

      for (const prop of props) {
        schema.properties[prop.name] = prop.schema;
        if (prop.required) {
          requiredFields.push(prop.name);
        }
      }

      if (requiredFields.length > 0) {
        schema.required = requiredFields;
      }
    }
  }

  // Parse enum values if present
  const enumValues = parseEnumValues(tokens);
  if (enumValues && enumValues.length > 0) {
    schema.enum = enumValues;
  }

  // Extract example from ## Example code block
  const exampleBlock = extractExampleBlock(tokens);
  if (exampleBlock) {
    try {
      schema.example = JSON.parse(exampleBlock);
    } catch {
      // If not valid JSON, store as-is
      schema.example = exampleBlock;
    }
  }

  // Extract default value
  const defaultRaw = extractMetadata(tokens, "Default");
  if (defaultRaw) {
    try {
      schema.default = JSON.parse(defaultRaw);
    } catch {
      schema.default = defaultRaw;
    }
  }

  // Extract nullable
  const nullableRaw = extractMetadata(tokens, "Nullable");
  if (nullableRaw?.toLowerCase() === "true" || nullableRaw?.toLowerCase() === "yes") {
    schema.nullable = true;
  }

  // Extract constraints
  const minimum = extractMetadata(tokens, "Minimum");
  if (minimum) {
    const num = parseFloat(minimum);
    if (!isNaN(num)) schema.minimum = num;
  }

  const maximum = extractMetadata(tokens, "Maximum");
  if (maximum) {
    const num = parseFloat(maximum);
    if (!isNaN(num)) schema.maximum = num;
  }

  const minLength = extractMetadata(tokens, "MinLength");
  if (minLength) {
    const num = parseInt(minLength, 10);
    if (!isNaN(num)) schema.minLength = num;
  }

  const maxLength = extractMetadata(tokens, "MaxLength");
  if (maxLength) {
    const num = parseInt(maxLength, 10);
    if (!isNaN(num)) schema.maxLength = num;
  }

  const pattern = extractMetadata(tokens, "Pattern");
  if (pattern) {
    schema.pattern = pattern.replace(/^`|`$/g, "");
  }

  return { name, schema };
}

/**
 * Convert filename to schema name
 * e.g., "User.md" → "User", "types/User.md" → "User"
 */
function filenameToName(filename: string): string {
  return filename
    .replace(/\.md$/, "")
    .split(/[/\\]/)
    .pop() || filename;
}

/**
 * Parse schema type from string
 */
function parseSchemaType(
  raw: string | undefined
): Schema["type"] | undefined {
  if (!raw) return undefined;

  const normalized = raw.toLowerCase().replace(/`/g, "").trim();

  switch (normalized) {
    case "string":
      return "string";
    case "number":
    case "float":
    case "double":
      return "number";
    case "integer":
    case "int":
      return "integer";
    case "boolean":
    case "bool":
      return "boolean";
    case "object":
      return "object";
    case "array":
      return "array";
    case "null":
      return "null";
    default:
      return undefined;
  }
}

/**
 * Extract properties table markdown from ## Properties section
 */
function extractPropertiesSection(tokens: Token[]): string | undefined {
  let inSection = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;

    if (token.type === "heading") {
      const heading = token as { depth: number; text: string };
      if (heading.depth === 2) {
        if (heading.text.toLowerCase() === "properties") {
          inSection = true;
          continue;
        } else if (inSection) {
          // End of properties section
          break;
        }
      }
    }

    if (inSection && token.type === "table") {
      return (token as { raw: string }).raw;
    }
  }

  return undefined;
}

/**
 * Parse enum values from ## Values or ## Enum section
 */
function parseEnumValues(tokens: Token[]): unknown[] | undefined {
  let inSection = false;
  const values: unknown[] = [];

  for (const token of tokens) {
    if (token.type === "heading") {
      const heading = token as { depth: number; text: string };
      if (heading.depth === 2) {
        const title = heading.text.toLowerCase();
        if (title === "values" || title === "enum") {
          inSection = true;
          continue;
        } else if (inSection) {
          break;
        }
      }
    }

    if (inSection && token.type === "list") {
      const list = token as { items: Array<{ text?: string }> };
      for (const item of list.items) {
        const text = item.text || "";
        // Extract value from backticks if present
        const match = text.match(/^`([^`]+)`/);
        if (match) {
          const value = match[1]!;
          // Try to parse as JSON (for numbers, booleans, null)
          try {
            values.push(JSON.parse(value));
          } catch {
            values.push(value);
          }
        } else {
          // Plain text value
          const trimmed = text.split("-")[0]?.trim() || text.trim();
          if (trimmed) {
            try {
              values.push(JSON.parse(trimmed));
            } catch {
              values.push(trimmed);
            }
          }
        }
      }
    }
  }

  return values.length > 0 ? values : undefined;
}

/**
 * Extract example code block from ## Example section
 */
function extractExampleBlock(tokens: Token[]): string | undefined {
  let inSection = false;

  for (const token of tokens) {
    if (token.type === "heading") {
      const heading = token as { depth: number; text: string };
      if (heading.depth === 2) {
        if (heading.text.toLowerCase() === "example") {
          inSection = true;
          continue;
        } else if (inSection) {
          break;
        }
      }
    }

    if (inSection && token.type === "code") {
      return (token as { text: string }).text;
    }
  }

  return undefined;
}
