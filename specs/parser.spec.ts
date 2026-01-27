import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadAllFixturePackages,
  loadFixturePackage,
  getFixturePackagePath,
  runCLI,
} from "./fixtures/index.js";
import { parseMember } from "../src/parse/member.js";
import { parseGuide } from "../src/parse/guide.js";
import { parseSchema } from "../src/parse/schema.js";
import { parsePackageIndex } from "../src/parse/package.js";
import { parsePackage } from "../src/parse/index.js";
import {
  formatMemberFile,
  formatGuideFile,
  formatSchemaFile,
  formatPackageToDirectory,
} from "../src/commands/format-dir.js";
import type { Package, Member, Guide, Schema } from "../src/schema/index.js";

describe("Markdown Parser", () => {
  describe("lrn parse <directory>", () => {
    describe("package parsing", () => {
      it("parses package name from H1", () => {
        const content = `# mypackage v1.0.0

> A test package
`;
        const pkg = parsePackageIndex(content);
        expect(pkg.name).toBe("mypackage");
      });

      it("parses package version from H1 (e.g., 'v1.2.3')", () => {
        const content = `# mypackage v1.2.3

> A test package
`;
        const pkg = parsePackageIndex(content);
        expect(pkg.version).toBe("1.2.3");
      });

      it("parses package summary from first blockquote", () => {
        const content = `# mypackage

> This is the summary

Some description text.
`;
        const pkg = parsePackageIndex(content);
        expect(pkg.summary).toBe("This is the summary");
      });

      it("parses package description from text before first H2", () => {
        const content = `# mypackage

> Summary

This is the description paragraph.

## Links
`;
        const pkg = parsePackageIndex(content);
        expect(pkg.description).toBe("This is the description paragraph.");
      });

      it("extracts homepage link from ## Links section", () => {
        const content = `# mypackage

## Links

- [Homepage](https://example.com)
`;
        const pkg = parsePackageIndex(content);
        expect(pkg.links?.homepage).toBe("https://example.com");
      });

      it("extracts repository link from ## Links section", () => {
        const content = `# mypackage

## Links

- [Repository](https://github.com/example/repo)
`;
        const pkg = parsePackageIndex(content);
        expect(pkg.links?.repository).toBe("https://github.com/example/repo");
      });

      it("extracts documentation link from ## Links section", () => {
        const content = `# mypackage

## Links

- [Documentation](https://docs.example.com)
`;
        const pkg = parsePackageIndex(content);
        expect(pkg.links?.documentation).toBe("https://docs.example.com");
      });
    });

    describe("member parsing", () => {
      it("parses member name from filename", () => {
        const content = `# myFunction

**Kind:** function
`;
        const member = parseMember(content, "myFunction.md");
        expect(member.name).toBe("myFunction");
      });

      it("parses member kind from **Kind:** line", () => {
        const content = `# test

**Kind:** method
`;
        const member = parseMember(content, "test.md");
        expect(member.kind).toBe("method");
      });

      it("parses member summary from first blockquote after kind", () => {
        const content = `# test

**Kind:** function

> This is the summary
`;
        const member = parseMember(content, "test.md");
        expect(member.summary).toBe("This is the summary");
      });

      it("parses member signature from first typescript code block", () => {
        const content = `# test

**Kind:** function

\`\`\`typescript
(a: number, b: number) => number
\`\`\`
`;
        const member = parseMember(content, "test.md");
        expect(member.signature).toBe("(a: number, b: number) => number");
      });

      it("parses deprecated notice from blockquote starting with 'Deprecated:'", () => {
        const content = `# test

**Kind:** function

> **Deprecated:** Use newFunction instead
`;
        const member = parseMember(content, "test.md");
        expect(member.deprecated).toBe("Use newFunction instead");
      });

      it("parses since version from **Since:** line", () => {
        const content = `# test

**Kind:** function

**Since:** 1.2.0
`;
        const member = parseMember(content, "test.md");
        expect(member.since).toBe("1.2.0");
      });

      it("parses tags from **Tags:** line as comma-separated backtick values", () => {
        const content = `# test

**Kind:** function

**Tags:** \`math\`, \`utility\`, \`core\`
`;
        const member = parseMember(content, "test.md");
        expect(member.tags).toEqual(["math", "utility", "core"]);
      });
    });

    describe("HTTP member parsing", () => {
      it("parses HTTP method and path from **Endpoint:** line", () => {
        const content = `# createUser

**Kind:** method

**Endpoint:** \`POST /v1/users\`
`;
        const member = parseMember(content, "createUser.md");
        expect(member.http?.method).toBe("POST");
        expect(member.http?.path).toBe("/v1/users");
      });

      it("parses path parameters from parameter table with In=path", () => {
        const content = `# getUser

**Kind:** method

**Endpoint:** \`GET /v1/users/{id}\`

## Parameters

| Name | Type | In | Required | Description |
|------|------|-----|----------|-------------|
| \`id\` | string | path | ✓ | User ID |
`;
        const member = parseMember(content, "getUser.md");
        expect(member.parameters?.[0]?.in).toBe("path");
        expect(member.parameters?.[0]?.name).toBe("id");
      });

      it("parses query parameters from parameter table with In=query", () => {
        const content = `# listUsers

**Kind:** method

## Parameters

| Name | Type | In | Required | Description |
|------|------|-----|----------|-------------|
| \`limit\` | number | query |  | Max results |
`;
        const member = parseMember(content, "listUsers.md");
        expect(member.parameters?.[0]?.in).toBe("query");
      });
    });

    describe("parameter table parsing", () => {
      it("parses parameter name from first column", () => {
        const content = `# test

**Kind:** function

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| \`myParam\` | string | ✓ | A parameter |
`;
        const member = parseMember(content, "test.md");
        expect(member.parameters?.[0]?.name).toBe("myParam");
      });

      it("parses parameter type from second column", () => {
        const content = `# test

**Kind:** function

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| \`x\` | number | ✓ | A number |
`;
        const member = parseMember(content, "test.md");
        expect(member.parameters?.[0]?.type).toBe("number");
      });

      it("parses required=true when third column contains checkmark", () => {
        const content = `# test

**Kind:** function

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| \`x\` | number | ✓ | Required param |
`;
        const member = parseMember(content, "test.md");
        expect(member.parameters?.[0]?.required).toBe(true);
      });

      it("parses required=false when third column is empty", () => {
        const content = `# test

**Kind:** function

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| \`x\` | number |  | Optional param |
`;
        const member = parseMember(content, "test.md");
        expect(member.parameters?.[0]?.required).toBe(false);
      });

      it("parses parameter description from fourth column", () => {
        const content = `# test

**Kind:** function

## Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|
| \`x\` | number | ✓ | The x coordinate |
`;
        const member = parseMember(content, "test.md");
        expect(member.parameters?.[0]?.description).toBe("The x coordinate");
      });
    });

    describe("returns parsing", () => {
      it("parses return type from **Type:** line in ## Returns", () => {
        const content = `# test

**Kind:** function

## Returns

**Type:** \`number\`
`;
        const member = parseMember(content, "test.md");
        expect(member.returns?.type).toBe("number");
      });

      it("parses return description from text after type in ## Returns", () => {
        const content = `# test

**Kind:** function

## Returns

**Type:** \`number\`

The sum of the inputs
`;
        const member = parseMember(content, "test.md");
        expect(member.returns?.description).toBe("The sum of the inputs");
      });
    });

    describe("examples parsing", () => {
      it("parses example title from H3 under ## Examples", () => {
        const content = `# test

**Kind:** function

## Examples

### Basic usage

\`\`\`typescript
test()
\`\`\`
`;
        const member = parseMember(content, "test.md");
        expect(member.examples?.[0]?.title).toBe("Basic usage");
      });

      it("parses example code from code block", () => {
        const content = `# test

**Kind:** function

## Examples

\`\`\`typescript
const result = test(1, 2);
\`\`\`
`;
        const member = parseMember(content, "test.md");
        expect(member.examples?.[0]?.code).toBe("const result = test(1, 2);");
      });

      it("parses example language from code block fence", () => {
        const content = `# test

**Kind:** function

## Examples

\`\`\`python
result = test(1, 2)
\`\`\`
`;
        const member = parseMember(content, "test.md");
        expect(member.examples?.[0]?.language).toBe("python");
      });

      it("handles multiple examples in sequence", () => {
        const content = `# test

**Kind:** function

## Examples

### Example 1

\`\`\`typescript
test(1)
\`\`\`

### Example 2

\`\`\`typescript
test(2)
\`\`\`
`;
        const member = parseMember(content, "test.md");
        expect(member.examples?.length).toBe(2);
        expect(member.examples?.[0]?.title).toBe("Example 1");
        expect(member.examples?.[1]?.title).toBe("Example 2");
      });
    });

    describe("see also parsing", () => {
      it("parses member references from markdown links", () => {
        const content = `# test

**Kind:** function

## See Also

- [otherFunction](member:otherFunction)
`;
        const member = parseMember(content, "test.md");
        expect(member.see?.[0]?.type).toBe("member");
        expect(member.see?.[0]?.target).toBe("otherFunction");
      });

      it("parses external URL references", () => {
        const content = `# test

**Kind:** function

## See Also

- [MDN Docs](https://developer.mozilla.org)
`;
        const member = parseMember(content, "test.md");
        expect(member.see?.[0]?.type).toBe("url");
        expect(member.see?.[0]?.target).toBe("https://developer.mozilla.org");
      });
    });

    describe("guide parsing", () => {
      it("parses guide title from H1", () => {
        const content = `# Getting Started

**Type:** quickstart
`;
        const guide = parseGuide(content, "getting-started.md");
        expect(guide.title).toBe("Getting Started");
      });

      it("parses guide slug from filename", () => {
        const content = `# Getting Started

**Type:** quickstart
`;
        const guide = parseGuide(content, "getting-started.md");
        expect(guide.slug).toBe("getting-started");
      });

      it("parses guide kind from **Type:** line", () => {
        const content = `# Tutorial

**Type:** tutorial
`;
        const guide = parseGuide(content, "tutorial.md");
        expect(guide.kind).toBe("tutorial");
      });

      it("parses guide level from **Level:** line", () => {
        const content = `# Advanced Guide

**Type:** howto
**Level:** advanced
`;
        const guide = parseGuide(content, "advanced.md");
        expect(guide.level).toBe("advanced");
      });

      it("parses guide summary from first blockquote", () => {
        const content = `# Guide

**Type:** howto

> This guide explains how to do something
`;
        const guide = parseGuide(content, "guide.md");
        expect(guide.summary).toBe("This guide explains how to do something");
      });

      it("parses sections from H2 headings", () => {
        const content = `# Guide

**Type:** howto

## Introduction

Some intro text.

## Setup

Setup instructions.
`;
        const guide = parseGuide(content, "guide.md");
        expect(guide.sections.length).toBe(2);
        expect(guide.sections[0]?.title).toBe("Introduction");
        expect(guide.sections[1]?.title).toBe("Setup");
      });

      it("generates section IDs from heading text", () => {
        const content = `# Guide

**Type:** howto

## Getting Started with API

Content here.
`;
        const guide = parseGuide(content, "guide.md");
        expect(guide.sections[0]?.id).toBe("getting-started-with-api");
      });
    });

    describe("schema parsing", () => {
      it("parses schema name from H1", () => {
        const content = `# User

**Type:** \`object\`
`;
        const { name } = parseSchema(content, "User.md");
        expect(name).toBe("User");
      });

      it("parses schema type from **Type:** line", () => {
        const content = `# Status

**Type:** \`string\`
`;
        const { schema } = parseSchema(content, "Status.md");
        expect(schema.type).toBe("string");
      });

      it("parses schema description from blockquote", () => {
        const content = `# User

**Type:** \`object\`

> Represents a user in the system
`;
        const { schema } = parseSchema(content, "User.md");
        expect(schema.description).toBe("Represents a user in the system");
      });

      it("parses object properties from ## Properties table", () => {
        const content = `# User

**Type:** \`object\`

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| \`id\` | string | ✓ | User ID |
| \`name\` | string | ✓ | User name |
| \`email\` | string |  | User email |
`;
        const { schema } = parseSchema(content, "User.md");
        expect(schema.properties?.id?.type).toBe("string");
        expect(schema.properties?.name?.type).toBe("string");
        expect(schema.required).toContain("id");
        expect(schema.required).toContain("name");
        expect(schema.required).not.toContain("email");
      });

      it("parses schema examples from ## Example code block", () => {
        const content = `# User

**Type:** \`object\`

## Example

\`\`\`json
{
  "id": "123",
  "name": "John"
}
\`\`\`
`;
        const { schema } = parseSchema(content, "User.md");
        expect(schema.example).toEqual({ id: "123", name: "John" });
      });
    });

    describe("nested members", () => {
      let tempDir: string;
      let cleanup: () => void;

      beforeAll(() => {
        tempDir = mkdtempSync(join(tmpdir(), "lrn-parser-test-"));
        cleanup = () => rmSync(tempDir, { recursive: true, force: true });

        // Create test directory structure
        mkdirSync(join(tempDir, "members", "Calculator"), { recursive: true });
        writeFileSync(
          join(tempDir, "index.md"),
          "# TestPackage\n\n> Test\n\n**Source:** markdown"
        );
        writeFileSync(
          join(tempDir, "members", "Calculator.md"),
          "# Calculator\n\n**Kind:** class\n\n> A calculator"
        );
        writeFileSync(
          join(tempDir, "members", "Calculator", "add.md"),
          "# add\n\n**Kind:** method\n\n> Add numbers"
        );
        writeFileSync(
          join(tempDir, "members", "Calculator", "subtract.md"),
          "# subtract\n\n**Kind:** method\n\n> Subtract numbers"
        );
      });

      afterAll(() => {
        cleanup();
      });

      it("parses nested members from subdirectory structure", async () => {
        const pkg = await parsePackage(tempDir);
        const calculator = pkg.members.find((m) => m.name === "Calculator");
        expect(calculator).toBeDefined();
        expect(calculator?.children?.length).toBe(2);
      });

      it("constructs dot-notation path from directory hierarchy", async () => {
        const pkg = await parsePackage(tempDir);
        const calculator = pkg.members.find((m) => m.name === "Calculator");
        const addChild = calculator?.children?.find((c) => c.name === "add");
        expect(addChild).toBeDefined();
        expect(addChild?.kind).toBe("method");
      });

      it("handles class methods as children of class member", async () => {
        const pkg = await parsePackage(tempDir);
        const calculator = pkg.members.find((m) => m.name === "Calculator");
        expect(calculator?.kind).toBe("class");
        expect(calculator?.children?.every((c) => c.kind === "method")).toBe(true);
      });
    });

    describe("directory structure", () => {
      let tempDir: string;
      let cleanup: () => void;

      beforeAll(() => {
        tempDir = mkdtempSync(join(tmpdir(), "lrn-dir-test-"));
        cleanup = () => rmSync(tempDir, { recursive: true, force: true });

        // Create complete directory structure
        mkdirSync(join(tempDir, "members"), { recursive: true });
        mkdirSync(join(tempDir, "guides"), { recursive: true });
        mkdirSync(join(tempDir, "types"), { recursive: true });

        writeFileSync(join(tempDir, "index.md"), "# TestPkg\n\n**Source:** markdown");
        writeFileSync(join(tempDir, "members", "func.md"), "# func\n\n**Kind:** function");
        writeFileSync(join(tempDir, "guides", "intro.md"), "# Intro\n\n**Type:** quickstart\n\n## Start\n\nContent.");
        writeFileSync(join(tempDir, "types", "Config.md"), "# Config\n\n**Type:** `object`");
        writeFileSync(join(tempDir, "readme.txt"), "ignored file");
      });

      afterAll(() => {
        cleanup();
      });

      it("discovers index.md as package root", async () => {
        const pkg = await parsePackage(tempDir);
        expect(pkg.name).toBe("TestPkg");
      });

      it("discovers member files in members/ directory", async () => {
        const pkg = await parsePackage(tempDir);
        expect(pkg.members.length).toBe(1);
        expect(pkg.members[0]?.name).toBe("func");
      });

      it("discovers guide files in guides/ directory", async () => {
        const pkg = await parsePackage(tempDir);
        expect(pkg.guides.length).toBe(1);
        expect(pkg.guides[0]?.slug).toBe("intro");
      });

      it("discovers schema files in types/ directory", async () => {
        const pkg = await parsePackage(tempDir);
        expect(Object.keys(pkg.schemas).length).toBe(1);
        expect(pkg.schemas["Config"]).toBeDefined();
      });

      it("ignores non-markdown files", async () => {
        const pkg = await parsePackage(tempDir);
        // Should not have "readme" as a member
        expect(pkg.members.find((m) => m.name === "readme")).toBeUndefined();
      });
    });
  });

  describe("lrn format <package.json> --out <dir>", () => {
    describe("member file generation", () => {
      it("generates member file with H1 name", () => {
        const member: Member = {
          name: "myFunction",
          kind: "function",
        };
        const content = formatMemberFile(member);
        expect(content).toContain("# myFunction");
      });

      it("generates **Kind:** line", () => {
        const member: Member = {
          name: "test",
          kind: "method",
        };
        const content = formatMemberFile(member);
        expect(content).toContain("**Kind:** method");
      });

      it("generates summary blockquote", () => {
        const member: Member = {
          name: "test",
          kind: "function",
          summary: "A test function",
        };
        const content = formatMemberFile(member);
        expect(content).toContain("> A test function");
      });

      it("generates **Endpoint:** line for HTTP members", () => {
        const member: Member = {
          name: "createUser",
          kind: "method",
          http: { method: "POST", path: "/v1/users" },
        };
        const content = formatMemberFile(member);
        expect(content).toContain("**Endpoint:** `POST /v1/users`");
      });

      it("generates signature code block", () => {
        const member: Member = {
          name: "add",
          kind: "function",
          signature: "(a: number, b: number) => number",
        };
        const content = formatMemberFile(member);
        expect(content).toContain("```typescript");
        expect(content).toContain("(a: number, b: number) => number");
        expect(content).toContain("```");
      });

      it("generates ## Parameters table", () => {
        const member: Member = {
          name: "test",
          kind: "function",
          parameters: [
            { name: "x", type: "number", required: true, description: "X value" },
          ],
        };
        const content = formatMemberFile(member);
        expect(content).toContain("## Parameters");
        expect(content).toContain("| `x` | number | ✓ | X value |");
      });

      it("generates ## Returns section", () => {
        const member: Member = {
          name: "test",
          kind: "function",
          returns: { type: "number", description: "The result" },
        };
        const content = formatMemberFile(member);
        expect(content).toContain("## Returns");
        expect(content).toContain("**Type:** `number`");
        expect(content).toContain("The result");
      });

      it("generates ## Examples section with H3 titles", () => {
        const member: Member = {
          name: "test",
          kind: "function",
          examples: [
            { title: "Basic", code: "test()", language: "typescript" },
          ],
        };
        const content = formatMemberFile(member);
        expect(content).toContain("## Examples");
        expect(content).toContain("### Basic");
        expect(content).toContain("```typescript");
        expect(content).toContain("test()");
      });

      it("generates **Tags:** line", () => {
        const member: Member = {
          name: "test",
          kind: "function",
          tags: ["math", "utility"],
        };
        const content = formatMemberFile(member);
        expect(content).toContain("**Tags:** `math`, `utility`");
      });

      it("generates deprecated blockquote", () => {
        const member: Member = {
          name: "old",
          kind: "function",
          deprecated: "Use newFunction instead",
        };
        const content = formatMemberFile(member);
        expect(content).toContain("> **Deprecated:** Use newFunction instead");
      });

      it("generates ## See Also section", () => {
        const member: Member = {
          name: "test",
          kind: "function",
          see: [{ type: "member", target: "other", label: "other function" }],
        };
        const content = formatMemberFile(member);
        expect(content).toContain("## See Also");
        expect(content).toContain("[other function](member:other)");
      });
    });

    describe("guide file generation", () => {
      it("generates guide file with H1 title", () => {
        const guide: Guide = {
          slug: "intro",
          title: "Introduction",
          kind: "quickstart",
          sections: [],
        };
        const content = formatGuideFile(guide);
        expect(content).toContain("# Introduction");
      });

      it("generates **Type:** and **Level:** lines", () => {
        const guide: Guide = {
          slug: "intro",
          title: "Intro",
          kind: "tutorial",
          level: "beginner",
          sections: [],
        };
        const content = formatGuideFile(guide);
        expect(content).toContain("**Type:** tutorial");
        expect(content).toContain("**Level:** beginner");
      });

      it("generates summary blockquote", () => {
        const guide: Guide = {
          slug: "intro",
          title: "Intro",
          kind: "quickstart",
          summary: "Get started quickly",
          sections: [],
        };
        const content = formatGuideFile(guide);
        expect(content).toContain("> Get started quickly");
      });

      it("generates H2 sections", () => {
        const guide: Guide = {
          slug: "intro",
          title: "Intro",
          kind: "quickstart",
          sections: [
            { id: "setup", title: "Setup", content: "Setup instructions." },
          ],
        };
        const content = formatGuideFile(guide);
        expect(content).toContain("## Setup");
        expect(content).toContain("Setup instructions.");
      });

      it("generates code blocks with language tags", () => {
        const guide: Guide = {
          slug: "intro",
          title: "Intro",
          kind: "quickstart",
          sections: [
            {
              id: "example",
              title: "Example",
              content: "See below.",
              examples: [{ code: "npm install", language: "bash" }],
            },
          ],
        };
        const content = formatGuideFile(guide);
        expect(content).toContain("```bash");
        expect(content).toContain("npm install");
      });
    });

    describe("schema file generation", () => {
      it("generates schema file with H1 name", () => {
        const schema: Schema = { type: "object" };
        const content = formatSchemaFile("User", schema);
        expect(content).toContain("# User");
      });

      it("generates **Type:** line", () => {
        const schema: Schema = { type: "string" };
        const content = formatSchemaFile("Status", schema);
        expect(content).toContain("**Type:** `string`");
      });

      it("generates description", () => {
        const schema: Schema = {
          type: "object",
          description: "A user object",
        };
        const content = formatSchemaFile("User", schema);
        expect(content).toContain("> A user object");
      });

      it("generates ## Properties table", () => {
        const schema: Schema = {
          type: "object",
          properties: {
            id: { type: "string", description: "User ID" },
            name: { type: "string", description: "User name" },
          },
          required: ["id"],
        };
        const content = formatSchemaFile("User", schema);
        expect(content).toContain("## Properties");
        expect(content).toContain("| `id` | string | ✓ | User ID |");
        expect(content).toContain("| `name` | string |  | User name |");
      });

      it("generates ## Example code block", () => {
        const schema: Schema = {
          type: "object",
          example: { id: "123", name: "Test" },
        };
        const content = formatSchemaFile("User", schema);
        expect(content).toContain("## Example");
        expect(content).toContain("```json");
        expect(content).toContain('"id": "123"');
      });
    });

    describe("nested member formatting", () => {
      let tempDir: string;
      let cleanup: () => void;

      beforeAll(() => {
        tempDir = mkdtempSync(join(tmpdir(), "lrn-format-test-"));
        cleanup = () => rmSync(tempDir, { recursive: true, force: true });
      });

      afterAll(() => {
        cleanup();
      });

      it("creates subdirectories for class methods", () => {
        const pkg: Package = {
          name: "test",
          source: { type: "typescript" },
          members: [
            {
              name: "Calculator",
              kind: "class",
              children: [
                { name: "add", kind: "method" },
                { name: "subtract", kind: "method" },
              ],
            },
          ],
          guides: [],
          schemas: {},
        };

        formatPackageToDirectory(pkg, tempDir);

        expect(existsSync(join(tempDir, "members", "Calculator.md"))).toBe(true);
        expect(existsSync(join(tempDir, "members", "Calculator", "add.md"))).toBe(true);
        expect(existsSync(join(tempDir, "members", "Calculator", "subtract.md"))).toBe(true);
      });

      it("preserves hierarchy in file paths", () => {
        // Reading the files created in previous test
        const addContent = readFileSync(
          join(tempDir, "members", "Calculator", "add.md"),
          "utf-8"
        );
        expect(addContent).toContain("# add");
        expect(addContent).toContain("**Kind:** method");
      });
    });

    describe("round-trip integrity", () => {
      let tempDir: string;
      let cleanup: () => void;

      beforeAll(() => {
        tempDir = mkdtempSync(join(tmpdir(), "lrn-roundtrip-test-"));
        cleanup = () => rmSync(tempDir, { recursive: true, force: true });
      });

      afterAll(() => {
        cleanup();
      });

      it("round-trips package metadata without loss", async () => {
        const original = loadFixturePackage("mathlib");
        const outDir = join(tempDir, "mathlib-md");

        formatPackageToDirectory(original, outDir);
        const parsed = await parsePackage(outDir);

        expect(parsed.name).toBe(original.name);
        expect(parsed.version).toBe(original.version);
        expect(parsed.summary).toBe(original.summary);
      });

      it("round-trips member count correctly", async () => {
        const original = loadFixturePackage("mathlib");
        const outDir = join(tempDir, "mathlib-members");

        formatPackageToDirectory(original, outDir);
        const parsed = await parsePackage(outDir);

        expect(parsed.members.length).toBe(original.members.length);
      });

      it("round-trips member children correctly", async () => {
        const original = loadFixturePackage("mathlib");
        const outDir = join(tempDir, "mathlib-children");

        formatPackageToDirectory(original, outDir);
        const parsed = await parsePackage(outDir);

        const originalCalc = original.members.find((m) => m.name === "Calculator");
        const parsedCalc = parsed.members.find((m) => m.name === "Calculator");

        expect(parsedCalc?.children?.length).toBe(originalCalc?.children?.length);
      });

      it("round-trips guide data without loss", async () => {
        const original = loadFixturePackage("mathlib");
        const outDir = join(tempDir, "mathlib-guides");

        formatPackageToDirectory(original, outDir);
        const parsed = await parsePackage(outDir);

        expect(parsed.guides.length).toBe(original.guides.length);
        expect(parsed.guides[0]?.slug).toBe(original.guides[0]?.slug);
        expect(parsed.guides[0]?.title).toBe(original.guides[0]?.title);
      });

      it("round-trips schema data without loss", async () => {
        const original = loadFixturePackage("mathlib");
        const outDir = join(tempDir, "mathlib-schemas");

        formatPackageToDirectory(original, outDir);
        const parsed = await parsePackage(outDir);

        expect(Object.keys(parsed.schemas).length).toBe(
          Object.keys(original.schemas).length
        );
      });

      it("preserves parameter order", async () => {
        const original = loadFixturePackage("mathlib");
        const outDir = join(tempDir, "mathlib-params");

        formatPackageToDirectory(original, outDir);
        const parsed = await parsePackage(outDir);

        const originalAdd = original.members.find((m) => m.name === "add");
        const parsedAdd = parsed.members.find((m) => m.name === "add");

        expect(parsedAdd?.parameters?.map((p) => p.name)).toEqual(
          originalAdd?.parameters?.map((p) => p.name)
        );
      });
    });

    describe("CLI integration", () => {
      let tempDir: string;
      let cleanup: () => void;

      beforeAll(() => {
        tempDir = mkdtempSync(join(tmpdir(), "lrn-cli-test-"));
        cleanup = () => rmSync(tempDir, { recursive: true, force: true });
      });

      afterAll(() => {
        cleanup();
      });

      it("lrn format outputs to directory with --out", async () => {
        const fixturePath = getFixturePackagePath("mathlib");
        const outDir = join(tempDir, "format-out");

        const result = await runCLI(["format", fixturePath, "--out", outDir]);

        expect(result.exitCode).toBe(0);
        expect(existsSync(join(outDir, "index.md"))).toBe(true);
        expect(existsSync(join(outDir, "members"))).toBe(true);
      });

      it("lrn parse outputs IR JSON to stdout", async () => {
        const fixturePath = getFixturePackagePath("mathlib");
        const mdDir = join(tempDir, "parse-input");

        // First format to directory
        await runCLI(["format", fixturePath, "--out", mdDir]);

        // Then parse it
        const result = await runCLI(["parse", mdDir]);

        expect(result.exitCode).toBe(0);
        const pkg = JSON.parse(result.stdout);
        expect(pkg.name).toBe("mathlib");
      });

      it("lrn parse outputs to file with --out", async () => {
        const fixturePath = getFixturePackagePath("mathlib");
        const mdDir = join(tempDir, "parse-file-input");
        const outFile = join(tempDir, "output.json");

        await runCLI(["format", fixturePath, "--out", mdDir]);
        const result = await runCLI(["parse", mdDir, "--out", outFile]);

        expect(result.exitCode).toBe(0);
        expect(existsSync(outFile)).toBe(true);

        const content = readFileSync(outFile, "utf-8");
        const pkg = JSON.parse(content);
        expect(pkg.name).toBe("mathlib");
      });
    });
  });
});
