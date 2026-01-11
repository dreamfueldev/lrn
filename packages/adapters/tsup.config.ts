import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/openapi.ts", "src/typescript.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
});
