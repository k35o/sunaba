import { definePreview } from "sunaba/react";
import "../src/styles.css";

declare module "sunaba/react" {
  interface SunabaEnv {
    theme: "light" | "dark";
  }
}

export default definePreview({
  applyEnv: {
    theme(value) {
      document.documentElement.classList.toggle("dark", value === "dark");
    },
  },
  decorators: [
    (Story) => (
      <div style={{ padding: "2rem", minHeight: "100svh", background: "var(--bg)" }}>
        <Story />
      </div>
    ),
  ],
});
