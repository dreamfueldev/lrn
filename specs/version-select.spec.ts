import { describe, it } from "bun:test";

describe("Version Selection", () => {
  describe("<package>@<version> syntax", () => {
    it.todo("parses package name and version from @ syntax");
    it.todo("supports package names with scopes (@org/package@1.0.0)");
    it.todo("treats text after @ as version specifier");
  });

  describe("exact version", () => {
    it.todo("uses exact version with @1.0.0 syntax");
    it.todo("uses exact version with @2024.1.0 syntax (calver)");
    it.todo("fails when exact version not available");
  });

  describe("semver ranges", () => {
    it.todo("resolves ^1.0.0 to latest compatible version");
    it.todo("resolves ~1.0.0 to latest patch version");
    it.todo("resolves >=1.0.0 to latest matching version");
    it.todo("resolves 1.x to latest 1.x version");
    it.todo("resolves * to latest version");
    it.todo("fails when no version matches range");
  });

  describe("version resolution from config", () => {
    it.todo("uses version from lrn.config.json when no @ specified");
    it.todo("command-line @ version overrides config version");
    it.todo("uses latest when not in config and no @ specified");
  });

  describe("cached versions", () => {
    it.todo("uses cached version if it satisfies specifier");
    it.todo("downloads new version if cached version does not satisfy");
    it.todo("shows which version is being used");
  });

  describe("version display", () => {
    it.todo("shows version in package overview output");
    it.todo("shows version in list output header");
    it.todo("shows version in JSON output");
  });
});
