import { defineConfig } from "sunaba";

export default defineConfig({
  stories: ["src/**/*.stories.{ts,tsx}"],
  env: {
    theme: { values: ["light", "dark"], default: "light" },
  },
});
