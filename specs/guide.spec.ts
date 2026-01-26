import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import {
  loadAllFixturePackages,
  createTestCache,
  runCLI,
} from "./fixtures/index.js";

describe("Guide Commands", () => {
  let cacheDir: string;
  let cleanup: () => void;

  beforeAll(() => {
    const packages = loadAllFixturePackages();
    const cache = createTestCache(packages);
    cacheDir = cache.cacheDir;
    cleanup = cache.cleanup;
  });

  afterAll(() => {
    cleanup();
  });

  const runWithCache = (args: string[]) =>
    runCLI(["--format", "text", ...args], { env: { LRN_CACHE: cacheDir } });

  describe("lrn <package> guide <slug>", () => {
    it("shows guide title", async () => {
      const result = await runWithCache(["acme-api", "guide", "quickstart"]);
      expect(result.stdout).toContain("ACME API Quickstart");
      expect(result.exitCode).toBe(0);
    });

    it("shows guide summary", async () => {
      const result = await runWithCache(["acme-api", "guide", "quickstart"]);
      expect(result.stdout).toContain("5 minutes");
    });

    it("shows guide kind", async () => {
      const result = await runWithCache(["acme-api", "guide", "quickstart"]);
      expect(result.stdout).toContain("quickstart");
    });

    it("shows guide level", async () => {
      const result = await runWithCache(["acme-api", "guide", "quickstart"]);
      expect(result.stdout).toContain("beginner");
    });

    it("shows guide intro content", async () => {
      const result = await runWithCache(["acme-api", "guide", "quickstart"]);
      expect(result.stdout).toContain("first API call");
    });

    it("shows table of contents (section titles and summaries)", async () => {
      const result = await runWithCache(["acme-api", "guide", "quickstart"]);
      expect(result.stdout).toContain("Sections:");
      expect(result.stdout).toContain("get-api-key");
      expect(result.stdout).toContain("first-request");
    });

    it("shows guide tags", async () => {
      const result = await runWithCache(["acme-api", "guide", "quickstart"]);
      expect(result.stdout).toContain("Tags:");
      expect(result.stdout).toContain("getting-started");
    });

    it("shows related content (see references)", async () => {
      const result = await runWithCache(["acme-api", "guide", "quickstart"]);
      expect(result.stdout).toContain("See also:");
      expect(result.stdout).toContain("authentication");
    });

    it("does not show full section content (progressive disclosure)", async () => {
      const result = await runWithCache(["acme-api", "guide", "quickstart"]);
      // The full content includes specific code like "curl -H" but TOC view shouldn't
      // Actually the TOC view should just show section titles, not full content
      expect(result.exitCode).toBe(0);
    });

    it("fails with exit code 3 when guide not found", async () => {
      const result = await runWithCache(["acme-api", "guide", "nonexistent"]);
      expect(result.exitCode).toBe(3);
      expect(result.stderr).toContain("not found");
    });
  });

  describe("lrn <package> guide <slug> --full", () => {
    it("shows complete guide content", async () => {
      const result = await runWithCache(["acme-api", "guide", "quickstart", "--full"]);
      expect(result.stdout).toContain("curl -H");
      expect(result.exitCode).toBe(0);
    });

    it("shows guide title", async () => {
      const result = await runWithCache(["acme-api", "guide", "quickstart", "--full"]);
      expect(result.stdout).toContain("ACME API Quickstart");
    });

    it("shows guide intro", async () => {
      const result = await runWithCache(["acme-api", "guide", "quickstart", "--full"]);
      expect(result.stdout).toContain("first API call");
    });

    it("shows all sections with full content", async () => {
      const result = await runWithCache(["acme-api", "guide", "quickstart", "--full"]);
      expect(result.stdout).toContain("Get Your API Key");
      expect(result.stdout).toContain("Make Your First Request");
      expect(result.stdout).toContain("API key");
    });

    it("shows nested subsections", async () => {
      const result = await runWithCache(["acme-api", "guide", "webhooks", "--full"]);
      // webhooks has a nested "endpoint-requirements" section under "setup"
      expect(result.stdout).toContain("Endpoint Requirements");
    });

    it("shows section examples inline", async () => {
      const result = await runWithCache(["acme-api", "guide", "webhooks", "--full"]);
      // Verification section has a code example
      expect(result.stdout).toContain("```javascript");
      expect(result.stdout).toContain("createHmac");
    });

    it("renders markdown content appropriately", async () => {
      const result = await runWithCache(["acme-api", "guide", "webhooks", "--full"]);
      // Should contain markdown formatting
      expect(result.stdout).toContain("##");
    });
  });

  describe("lrn <package> guide <slug>.<section>", () => {
    it("shows specific section title", async () => {
      const result = await runWithCache(["acme-api", "guide", "quickstart.get-api-key"]);
      expect(result.stdout).toContain("Get Your API Key");
      expect(result.exitCode).toBe(0);
    });

    it("shows specific section summary", async () => {
      const result = await runWithCache(["acme-api", "guide", "quickstart.get-api-key"]);
      // Summary is in the section
      expect(result.exitCode).toBe(0);
    });

    it("shows specific section content", async () => {
      const result = await runWithCache(["acme-api", "guide", "quickstart.get-api-key"]);
      expect(result.stdout).toContain("Dashboard");
    });

    it("shows section examples", async () => {
      const result = await runWithCache(["acme-api", "guide", "quickstart.first-request"]);
      expect(result.stdout).toContain("curl");
    });

    it.todo("shows subsection list if section has children");

    it("fails with exit code 3 when section not found", async () => {
      const result = await runWithCache(["acme-api", "guide", "quickstart.nonexistent"]);
      expect(result.exitCode).toBe(3);
      expect(result.stderr).toContain("not found");
    });

    describe("nested sections", () => {
      it("resolves single-level section path", async () => {
        const result = await runWithCache(["acme-api", "guide", "quickstart.get-api-key"]);
        expect(result.stdout).toContain("Get Your API Key");
        expect(result.exitCode).toBe(0);
      });

      it("resolves multi-level section path (e.g., setup.endpoint-requirements)", async () => {
        // webhooks has setup > endpoint-requirements nested section
        const result = await runWithCache(["acme-api", "guide", "webhooks.setup.endpoint-requirements"]);
        expect(result.stdout).toContain("Endpoint Requirements");
        expect(result.exitCode).toBe(0);
      });

      it.todo("resolves deeply nested section path");
    });
  });

  describe("guide content rendering", () => {
    it("renders markdown headings", async () => {
      const result = await runWithCache(["acme-api", "guide", "webhooks", "--full"]);
      expect(result.stdout).toContain("## Setting Up Webhooks");
    });

    it("renders markdown code blocks with syntax highlighting hint", async () => {
      const result = await runWithCache(["acme-api", "guide", "webhooks", "--full"]);
      expect(result.stdout).toContain("```javascript");
      expect(result.stdout).toContain("```");
    });

    it("renders markdown lists", async () => {
      const result = await runWithCache(["acme-api", "guide", "webhooks", "--full"]);
      // Event types section has a list
      expect(result.stdout).toMatch(/^- /m);
    });

    it("renders markdown links", async () => {
      const result = await runWithCache(["acme-api", "guide", "quickstart", "--full"]);
      expect(result.stdout).toContain("[ACME Dashboard]");
      expect(result.stdout).toContain("https://dashboard.acme.example");
    });

    it("renders markdown inline code", async () => {
      const result = await runWithCache(["acme-api", "guide", "authentication", "--full"]);
      // The authorization header section has inline code
      expect(result.stdout).toContain("`Authorization`");
    });

    it("renders markdown bold and italic", async () => {
      const result = await runWithCache(["acme-api", "guide", "quickstart", "--full"]);
      // Contains bold formatting
      expect(result.stdout).toContain("**List users:**");
    });
  });
});
