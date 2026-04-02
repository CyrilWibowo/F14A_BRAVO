import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.browser } },
  // Non-backend JS defaults to commonjs (frontend uses a bundler, not native ESM)
  { files: ["**/*.js"], ignores: ["backend/**"], languageOptions: { sourceType: "commonjs" } },
  // Backend source files use native ESM (backend/package.json has "type": "module")
  { files: ["backend/src/**/*.js", "backend/patch_affordability.js", "backend/seed.js"], languageOptions: { sourceType: "module", globals: { ...globals.node } } },
  // Test files need Jest globals (describe, it, expect, beforeEach, afterAll, etc.)
  { files: ["backend/tests/**/*.js"], languageOptions: { sourceType: "module", globals: { ...globals.node, ...globals.jest } } },
  tseslint.configs.recommended,
]);
