#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { createSunabaDevServer, DEFAULT_PORT } from "../node/server.ts";

const HELP = `sunaba — AI-native component workbench

Usage:
  sunaba dev [--port <n>] [--host] [--open]   Start the dev server (default)
  sunaba init                                 Scaffold sunaba.config.ts and .sunaba/preview.tsx
`;

const CONFIG_TEMPLATE = `import { defineConfig } from "sunaba";

export default defineConfig({
  stories: ["src/**/*.stories.{ts,tsx}"],
});
`;

const PREVIEW_TEMPLATE = `import { definePreview } from "sunaba/react";

export default definePreview({
  decorators: [],
});
`;

const runDev = async (values: { port?: string; host?: boolean; open?: boolean }): Promise<void> => {
  const port = values.port === undefined ? DEFAULT_PORT : Number(values.port);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid --port: ${values.port ?? ""}`);
  }
  const server = await createSunabaDevServer({
    port,
    ...(values.host === true ? { host: true } : {}),
  });
  await server.listen();
  const origin = `http://localhost:${String(port)}`;
  const { index } = server.commands.listStories();
  const storyCount = Object.keys(index.entries).length;
  console.log(`sunaba dev server running at ${origin}`);
  console.log(`  stories : ${String(storyCount)}`);
  console.log(`  mcp     : ${origin}/mcp`);
  const [first] = Object.keys(index.entries).toSorted();
  if (first !== undefined) {
    console.log(`  stage   : ${origin}/render/${first}`);
  }
  if (values.open === true && first !== undefined) {
    // execFile bypasses the shell: story ids contain raw file paths, which
    // must never be interpolated into a shell command.
    const { execFile } = await import("node:child_process");
    execFile("open", [`${origin}/render/${first}`]);
  }
};

const runInit = async (): Promise<void> => {
  if (existsSync("sunaba.config.ts")) {
    console.log("sunaba.config.ts already exists — skipped");
  } else {
    await writeFile("sunaba.config.ts", CONFIG_TEMPLATE);
    console.log("created sunaba.config.ts");
  }
  if (existsSync(".sunaba/preview.tsx")) {
    console.log(".sunaba/preview.tsx already exists — skipped");
  } else {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(".sunaba", { recursive: true });
    await writeFile(".sunaba/preview.tsx", PREVIEW_TEMPLATE);
    console.log("created .sunaba/preview.tsx");
  }
};

const main = async (): Promise<void> => {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      port: { type: "string", short: "p" },
      host: { type: "boolean" },
      open: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  });
  const command = positionals[0] ?? "dev";
  if (values.help === true) {
    console.log(HELP);
    return;
  }
  if (command === "dev") {
    await runDev(values);
  } else if (command === "init") {
    await runInit();
  } else {
    console.error(`Unknown command: ${command}\n`);
    console.log(HELP);
    process.exitCode = 1;
  }
};

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
