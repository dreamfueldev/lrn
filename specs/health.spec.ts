import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runHealth, runHealthWithOutput } from "../src/health/index.js";
import { discoverFiles, buildCheckContext } from "../src/health/discovery.js";
import { runChecks } from "../src/health/checks/index.js";
import { calculateScore, countIssuesBySeverity } from "../src/health/scoring.js";
import { estimateTokens, estimateTotalTokens } from "../src/health/tokens.js";
import { formatTextOutput } from "../src/health/output/text.js";
import { formatJsonOutput } from "../src/health/output/json.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const VALID_FIXTURE = join(__dirname, "fixtures/health/valid");
const INVALID_FIXTURE = join(__dirname, "fixtures/health/invalid");

describe("Health Command", () => {
  describe("lrn health <path>", () => {
    describe("structure validation", () => {
      it("validates package index.md has H1 with package name", async () => {
        const result = await runHealth(VALID_FIXTURE);
        const s001Issues = result.issues.filter((i) => i.checkId === "S001");
        expect(s001Issues.length).toBe(0);
      });

      it("reports error when package index.md missing H1", async () => {
        const result = await runHealth(INVALID_FIXTURE);
        const s001Issues = result.issues.filter((i) => i.checkId === "S001");
        expect(s001Issues.length).toBe(1);
        expect(s001Issues[0]!.severity).toBe("error");
      });

      it("validates member files have H1 with member name", async () => {
        const result = await runHealth(VALID_FIXTURE);
        const s002Issues = result.issues.filter((i) => i.checkId === "S002");
        expect(s002Issues.length).toBe(0);
      });

      it("validates member files have Kind declaration", async () => {
        const result = await runHealth(VALID_FIXTURE);
        const s003Issues = result.issues.filter((i) => i.checkId === "S003");
        expect(s003Issues.length).toBe(0);
      });

      it("reports error when member file missing Kind declaration", async () => {
        const result = await runHealth(INVALID_FIXTURE);
        const s003Issues = result.issues.filter((i) => i.checkId === "S003");
        expect(s003Issues.length).toBeGreaterThan(0);
      });

      it("validates heading hierarchy is sequential (H1 > H2 > H3)", async () => {
        const result = await runHealth(VALID_FIXTURE);
        const s004Issues = result.issues.filter((i) => i.checkId === "S004");
        expect(s004Issues.length).toBe(0);
      });

      it("reports warning for skipped heading levels", async () => {
        const result = await runHealth(INVALID_FIXTURE);
        const s004Issues = result.issues.filter((i) => i.checkId === "S004");
        expect(s004Issues.length).toBeGreaterThan(0);
        expect(s004Issues[0]!.severity).toBe("warning");
      });

      it("validates guide files have Type declaration", async () => {
        const result = await runHealth(VALID_FIXTURE);
        const s005Issues = result.issues.filter((i) => i.checkId === "S005");
        expect(s005Issues.length).toBe(0);
      });

      it("validates schema files have H1 with type name", async () => {
        const result = await runHealth(VALID_FIXTURE);
        const s006Issues = result.issues.filter((i) => i.checkId === "S006");
        expect(s006Issues.length).toBe(0);
      });
    });

    describe("content validation", () => {
      it("warns when members are missing summary", async () => {
        const result = await runHealth(INVALID_FIXTURE);
        const c001Issues = result.issues.filter((i) => i.checkId === "C001");
        expect(c001Issues.length).toBeGreaterThan(0);
        expect(c001Issues[0]!.severity).toBe("warning");
      });

      it("does not warn when members have summary", async () => {
        const result = await runHealth(VALID_FIXTURE);
        const c001Issues = result.issues.filter((i) => i.checkId === "C001");
        expect(c001Issues.length).toBe(0);
      });

      it("warns when function members lack parameters section", async () => {
        const result = await runHealth(INVALID_FIXTURE);
        const c003Issues = result.issues.filter((i) => i.checkId === "C003");
        expect(c003Issues.length).toBeGreaterThan(0);
      });

      it("warns when function members lack returns section", async () => {
        const result = await runHealth(INVALID_FIXTURE);
        const c004Issues = result.issues.filter((i) => i.checkId === "C004");
        expect(c004Issues.length).toBeGreaterThan(0);
      });

      it("suggests adding examples when none present", async () => {
        const result = await runHealth(INVALID_FIXTURE);
        const c005Issues = result.issues.filter((i) => i.checkId === "C005");
        expect(c005Issues.length).toBeGreaterThan(0);
      });
    });

    describe("format validation", () => {
      it("validates parameter table has required columns (Name, Type, Required)", async () => {
        const result = await runHealth(VALID_FIXTURE);
        const f001Issues = result.issues.filter((i) => i.checkId === "F001");
        expect(f001Issues.length).toBe(0);
      });

      it("reports error when parameter table missing required columns", async () => {
        const result = await runHealth(INVALID_FIXTURE);
        const f001Issues = result.issues.filter((i) => i.checkId === "F001");
        expect(f001Issues.length).toBeGreaterThan(0);
        expect(f001Issues[0]!.severity).toBe("error");
      });

      it("errors on code blocks without language tag", async () => {
        const result = await runHealth(INVALID_FIXTURE);
        const f002Issues = result.issues.filter((i) => i.checkId === "F002");
        expect(f002Issues.length).toBeGreaterThan(0);
        expect(f002Issues[0]!.severity).toBe("error");
      });

      it("does not error on code blocks with language tag", async () => {
        const result = await runHealth(VALID_FIXTURE);
        const f002Issues = result.issues.filter((i) => i.checkId === "F002");
        expect(f002Issues.length).toBe(0);
      });

      it("validates tags format (comma-separated backticks)", async () => {
        const result = await runHealth(VALID_FIXTURE);
        const f004Issues = result.issues.filter((i) => i.checkId === "F004");
        expect(f004Issues.length).toBe(0);
      });

      it("warns when tags missing backticks", async () => {
        const result = await runHealth(INVALID_FIXTURE);
        const f004Issues = result.issues.filter((i) => i.checkId === "F004");
        expect(f004Issues.length).toBeGreaterThan(0);
      });
    });

    describe("reference validation", () => {
      it("reports error for broken member references", async () => {
        const result = await runHealth(INVALID_FIXTURE);
        const r001Issues = result.issues.filter((i) => i.checkId === "R001");
        expect(r001Issues.length).toBeGreaterThan(0);
        expect(r001Issues[0]!.severity).toBe("error");
      });

      it("reports error for broken guide references", async () => {
        const result = await runHealth(INVALID_FIXTURE);
        const r002Issues = result.issues.filter((i) => i.checkId === "R002");
        expect(r002Issues.length).toBeGreaterThan(0);
        expect(r002Issues[0]!.severity).toBe("error");
      });

      it("warns for broken schema references", async () => {
        const result = await runHealth(INVALID_FIXTURE);
        const r003Issues = result.issues.filter((i) => i.checkId === "R003");
        expect(r003Issues.length).toBeGreaterThan(0);
        expect(r003Issues[0]!.severity).toBe("warning");
      });
    });

    describe("scoring", () => {
      it("calculates overall score from 0-100", async () => {
        const result = await runHealth(VALID_FIXTURE);
        expect(result.score.overall).toBeGreaterThanOrEqual(0);
        expect(result.score.overall).toBeLessThanOrEqual(100);
      });

      it("calculates structure category score", async () => {
        const result = await runHealth(VALID_FIXTURE);
        expect(result.score.categories.structure).toBeGreaterThanOrEqual(0);
        expect(result.score.categories.structure).toBeLessThanOrEqual(100);
      });

      it("calculates content category score", async () => {
        const result = await runHealth(VALID_FIXTURE);
        expect(result.score.categories.content).toBeGreaterThanOrEqual(0);
        expect(result.score.categories.content).toBeLessThanOrEqual(100);
      });

      it("calculates format category score", async () => {
        const result = await runHealth(VALID_FIXTURE);
        expect(result.score.categories.format).toBeGreaterThanOrEqual(0);
        expect(result.score.categories.format).toBeLessThanOrEqual(100);
      });

      it("calculates reference category score", async () => {
        const result = await runHealth(VALID_FIXTURE);
        expect(result.score.categories.reference).toBeGreaterThanOrEqual(0);
        expect(result.score.categories.reference).toBeLessThanOrEqual(100);
      });

      it("deducts 10 points per error", () => {
        const score = calculateScore([
          {
            checkId: "TEST",
            severity: "error",
            category: "structure",
            file: "test.md",
            message: "test",
          },
        ]);
        expect(score.overall).toBe(90);
      });

      it("deducts 2 points per warning", () => {
        const score = calculateScore([
          {
            checkId: "TEST",
            severity: "warning",
            category: "structure",
            file: "test.md",
            message: "test",
          },
        ]);
        expect(score.overall).toBe(98);
      });

      it("deducts 0.5 points per info", () => {
        const score = calculateScore([
          {
            checkId: "TEST",
            severity: "info",
            category: "structure",
            file: "test.md",
            message: "test",
          },
        ]);
        expect(score.overall).toBe(100); // Rounded from 99.5
      });

      it("score cannot go below 0", () => {
        const manyErrors = Array(20).fill({
          checkId: "TEST",
          severity: "error",
          category: "structure",
          file: "test.md",
          message: "test",
        });
        const score = calculateScore(manyErrors);
        expect(score.overall).toBe(0);
      });

      it("perfect score of 100 when no issues", () => {
        const score = calculateScore([]);
        expect(score.overall).toBe(100);
      });
    });

    describe("token estimation", () => {
      it("estimates total token count for package", async () => {
        const result = await runHealth(VALID_FIXTURE);
        expect(result.tokens.total).toBeGreaterThan(0);
      });

      it("breaks down tokens by summaries", async () => {
        const result = await runHealth(VALID_FIXTURE);
        expect(result.tokens.bySection.summaries).toBeGreaterThanOrEqual(0);
      });

      it("breaks down tokens by descriptions", async () => {
        const result = await runHealth(VALID_FIXTURE);
        expect(result.tokens.bySection.descriptions).toBeGreaterThanOrEqual(0);
      });

      it("breaks down tokens by parameters", async () => {
        const result = await runHealth(VALID_FIXTURE);
        expect(result.tokens.bySection.parameters).toBeGreaterThanOrEqual(0);
      });

      it("breaks down tokens by examples", async () => {
        const result = await runHealth(VALID_FIXTURE);
        expect(result.tokens.bySection.examples).toBeGreaterThanOrEqual(0);
      });

      it("breaks down tokens by guides", async () => {
        const result = await runHealth(VALID_FIXTURE);
        expect(result.tokens.bySection.guides).toBeGreaterThanOrEqual(0);
      });

      it("approximates ~4 chars per token", () => {
        const tokens = estimateTokens("test"); // 4 chars
        expect(tokens).toBe(1);

        const tokens2 = estimateTokens("testtest"); // 8 chars
        expect(tokens2).toBe(2);
      });
    });

    describe("issue reporting", () => {
      it("reports issue check ID (e.g., S001, F002)", async () => {
        const result = await runHealth(INVALID_FIXTURE);
        expect(result.issues.length).toBeGreaterThan(0);
        expect(result.issues[0]!.checkId).toMatch(/^[A-Z]\d{3}$/);
      });

      it("reports issue severity (error, warning, info)", async () => {
        const result = await runHealth(INVALID_FIXTURE);
        const severities = result.issues.map((i) => i.severity);
        for (const s of severities) {
          expect(["error", "warning", "info"]).toContain(s);
        }
      });

      it("reports issue file path", async () => {
        const result = await runHealth(INVALID_FIXTURE);
        expect(result.issues.length).toBeGreaterThan(0);
        expect(result.issues[0]!.file).toBeDefined();
      });

      it("reports issue message", async () => {
        const result = await runHealth(INVALID_FIXTURE);
        expect(result.issues.length).toBeGreaterThan(0);
        expect(result.issues[0]!.message).toBeDefined();
        expect(result.issues[0]!.message.length).toBeGreaterThan(0);
      });

      it("reports issue suggestion when available", async () => {
        const result = await runHealth(INVALID_FIXTURE);
        const withSuggestion = result.issues.find((i) => i.suggestion);
        expect(withSuggestion).toBeDefined();
      });
    });

    describe("text output", () => {
      it("shows overall score prominently", async () => {
        const result = await runHealth(VALID_FIXTURE);
        const output = formatTextOutput(result);
        expect(output).toContain("Score:");
        expect(output).toContain("/100");
      });

      it("shows category scores with pass/fail indicators", async () => {
        const result = await runHealth(VALID_FIXTURE);
        const output = formatTextOutput(result);
        expect(output).toContain("Structure:");
        expect(output).toContain("Content:");
        expect(output).toContain("Format:");
        expect(output).toContain("References:");
      });

      it("shows issue count by severity", async () => {
        const result = await runHealth(INVALID_FIXTURE);
        const output = formatTextOutput(result);
        expect(output).toContain("errors");
        expect(output).toContain("warnings");
        expect(output).toContain("info");
      });

      it("shows token estimate summary", async () => {
        const result = await runHealth(VALID_FIXTURE);
        const output = formatTextOutput(result);
        expect(output).toContain("Token estimate:");
        expect(output).toContain("tokens");
      });
    });

    describe("JSON output", () => {
      it("outputs valid JSON with --json flag", async () => {
        const result = await runHealth(VALID_FIXTURE);
        const output = formatJsonOutput(result);
        expect(() => JSON.parse(output)).not.toThrow();
      });

      it("includes score object with overall and categories", async () => {
        const result = await runHealth(VALID_FIXTURE);
        const output = formatJsonOutput(result);
        const parsed = JSON.parse(output);
        expect(parsed.score.overall).toBeDefined();
        expect(parsed.score.categories).toBeDefined();
        expect(parsed.score.categories.structure).toBeDefined();
      });

      it("includes issues array with all issues", async () => {
        const result = await runHealth(INVALID_FIXTURE);
        const output = formatJsonOutput(result);
        const parsed = JSON.parse(output);
        expect(Array.isArray(parsed.issues)).toBe(true);
        expect(parsed.issues.length).toBeGreaterThan(0);
      });

      it("includes tokens object with total and breakdown", async () => {
        const result = await runHealth(VALID_FIXTURE);
        const output = formatJsonOutput(result);
        const parsed = JSON.parse(output);
        expect(parsed.tokens.total).toBeDefined();
        expect(parsed.tokens.bySection).toBeDefined();
      });

      it("includes files object with counts by type", async () => {
        const result = await runHealth(VALID_FIXTURE);
        const output = formatJsonOutput(result);
        const parsed = JSON.parse(output);
        expect(parsed.files.total).toBeDefined();
        expect(parsed.files.byType).toBeDefined();
      });
    });

    describe("exit codes", () => {
      it("returns exit code 0 when no errors", async () => {
        const { exitCode } = await runHealthWithOutput(VALID_FIXTURE);
        expect(exitCode).toBe(0);
      });

      it("returns exit code 1 when errors present", async () => {
        const { exitCode } = await runHealthWithOutput(INVALID_FIXTURE);
        expect(exitCode).toBe(1);
      });
    });

    describe("file discovery", () => {
      it("discovers all .md files in directory", () => {
        const files = discoverFiles(VALID_FIXTURE);
        expect(files.length).toBe(4); // index.md, add.md, getting-started.md, Result.md
      });

      it("identifies file type from path (member, guide, schema)", () => {
        const files = discoverFiles(VALID_FIXTURE);
        const types = files.map((f) => f.type);
        expect(types).toContain("package");
        expect(types).toContain("member");
        expect(types).toContain("guide");
        expect(types).toContain("schema");
      });

      it("handles single file path input", () => {
        const files = discoverFiles(join(VALID_FIXTURE, "index.md"));
        expect(files.length).toBe(1);
        expect(files[0]!.type).toBe("package");
      });

      it("follows directory structure recursively", () => {
        const files = discoverFiles(VALID_FIXTURE);
        const paths = files.map((f) => f.path);
        expect(paths.some((p) => p.includes("members/"))).toBe(true);
        expect(paths.some((p) => p.includes("guides/"))).toBe(true);
        expect(paths.some((p) => p.includes("types/"))).toBe(true);
      });
    });

    describe("CLI options", () => {
      it("accepts --json flag for JSON output", async () => {
        const { output } = await runHealthWithOutput(VALID_FIXTURE, {
          json: true,
        });
        expect(() => JSON.parse(output)).not.toThrow();
      });

      it("accepts --verbose flag for detailed output", async () => {
        const { output: normalOutput } = await runHealthWithOutput(
          INVALID_FIXTURE,
          {}
        );
        const { output: verboseOutput } = await runHealthWithOutput(
          INVALID_FIXTURE,
          { verbose: true }
        );
        // Verbose output should include Info section
        expect(verboseOutput).toContain("Info:");
      });

      it("accepts --errors flag to show only errors", async () => {
        const { output } = await runHealthWithOutput(INVALID_FIXTURE, {
          errorsOnly: true,
        });
        expect(output).toContain("Errors:");
        expect(output).not.toContain("Warnings:");
      });
    });
  });
});
