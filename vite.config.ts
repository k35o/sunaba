import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: ["**/dist/**", "**/CHANGELOG.md", ".changeset"],
  },
  lint: {
    ignorePatterns: ["**/dist/**", "**/CHANGELOG.md", ".changeset"],
  },
  staged: {
    "*.{js,ts,cjs,mjs,jsx,tsx,json,jsonc,yaml,yml,md}": "vp check --fix",
  },
});
