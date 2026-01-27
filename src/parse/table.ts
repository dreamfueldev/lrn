/**
 * GFM Table Parser
 *
 * Utilities for parsing GitHub Flavored Markdown tables.
 */

import type { Parameter, Schema } from "../schema/index.js";

export interface TableRow {
  [column: string]: string;
}

/**
 * Parse a markdown table into rows with column headers as keys.
 * Handles GFM table syntax with | delimiters.
 */
export function parseTable(markdown: string): TableRow[] {
  const lines = markdown.trim().split("\n");
  if (lines.length < 2) return [];

  // First line is headers
  const headerLine = lines[0]!;
  const headers = parseTableRow(headerLine);
  if (headers.length === 0) return [];

  // Second line should be separator (---|---|---)
  const separatorLine = lines[1]!;
  if (!separatorLine.includes("-")) return [];

  // Remaining lines are data rows
  const rows: TableRow[] = [];
  for (let i = 2; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (!line) continue;

    const cells = parseTableRow(line);
    const row: TableRow = {};

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j]!.toLowerCase().trim();
      const value = cells[j]?.trim() || "";
      row[header] = value;
    }

    rows.push(row);
  }

  return rows;
}

/**
 * Parse a single table row into cells
 */
function parseTableRow(line: string): string[] {
  // Remove leading/trailing pipes and split
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);

  return trimmed.split("|").map((cell) => cell.trim());
}

/**
 * Parse a parameter table from markdown.
 * Expected columns: Name, Type, Required, Description
 */
export function parseParameterTable(markdown: string): Parameter[] {
  const rows = parseTable(markdown);
  const parameters: Parameter[] = [];

  for (const row of rows) {
    const name = extractCodeContent(row["name"] || "");
    if (!name) continue;

    const param: Parameter = {
      name,
    };

    if (row["type"]) {
      const type = extractCodeContent(row["type"]) || row["type"];
      if (type && type !== "-") {
        param.type = type;
      }
    }

    // Check for required - default to false if column exists but is empty
    const reqValue = (row["required"] || "").toLowerCase();
    param.required =
      reqValue.includes("✓") ||
      reqValue.includes("✔") ||
      reqValue === "yes" ||
      reqValue === "true";

    if (row["description"]) {
      param.description = row["description"];
    }

    // Handle 'in' column for HTTP params (path, query, header, body)
    if (row["in"]) {
      const inValue = row["in"].toLowerCase();
      if (["path", "query", "header", "body"].includes(inValue)) {
        param.in = inValue as "path" | "query" | "header" | "body";
      }
    }

    // Handle default value
    if (row["default"]) {
      const defaultVal = row["default"];
      if (defaultVal && defaultVal !== "-") {
        try {
          param.default = JSON.parse(defaultVal);
        } catch {
          param.default = defaultVal;
        }
      }
    }

    parameters.push(param);
  }

  return parameters;
}

/**
 * Parse a properties table for schemas.
 * Expected columns: Property, Type, Required, Description
 */
export function parsePropertyTable(
  markdown: string
): { name: string; schema: Schema; required: boolean }[] {
  const rows = parseTable(markdown);
  const properties: { name: string; schema: Schema; required: boolean }[] = [];

  for (const row of rows) {
    const name = extractCodeContent(row["property"] || row["name"] || "");
    if (!name) continue;

    const schema: Schema = {};
    let required = false;

    if (row["type"]) {
      const type = extractCodeContent(row["type"]) || row["type"];
      if (type && type !== "-") {
        // Try to map to JSON Schema type
        schema.type = mapToSchemaType(type);
        if (!schema.type) {
          // It's a reference
          schema.$ref = type;
        }
      }
    }

    if (row["required"]) {
      const reqValue = row["required"].toLowerCase();
      required =
        reqValue.includes("✓") ||
        reqValue.includes("✔") ||
        reqValue === "yes" ||
        reqValue === "true";
    }

    if (row["description"]) {
      schema.description = row["description"];
    }

    properties.push({ name, schema, required });
  }

  return properties;
}

/**
 * Extract content from backticks if present
 */
function extractCodeContent(text: string): string {
  const match = text.match(/^`([^`]+)`$/);
  return match ? match[1]! : text;
}

/**
 * Map a type string to a JSON Schema type
 */
function mapToSchemaType(
  type: string
): "string" | "number" | "integer" | "boolean" | "object" | "array" | "null" | undefined {
  const normalized = type.toLowerCase().trim();

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
