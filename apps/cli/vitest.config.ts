import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["specs/**/*.spec.ts"],
    // Use verbose reporter to show full test hierarchy as requirements list
    reporters: ["verbose"],
    // Show pending (todo) tests in output
    passWithNoTests: true,
    // Include skipped/todo tests in output
    outputFile: undefined,
  },
});
