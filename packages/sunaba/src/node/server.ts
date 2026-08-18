import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { Hono } from "hono";
import { createServer as createViteServer } from "vite";
import type { ViteDevServer } from "vite";
import { resolveConfig } from "../config.ts";
import type { SunabaConfig, SunabaUserConfig } from "../config.ts";
import type { IndexDiagnostic, StoryIndex, StoryIndexEntry } from "../protocol/types.ts";
import { createApiApp } from "./api.ts";
import { createCommands } from "./commands.ts";
import { registerMcpRoute } from "./mcp.ts";
import type { SunabaCommands } from "./commands.ts";
import { buildIndex } from "./indexer.ts";
import { invalidateStories, sunabaPlugin } from "./plugin.ts";
import { SessionStore } from "./session.ts";

export const DEFAULT_PORT = 3780;

const CONFIG_FILE = "sunaba.config.ts";

const loadUserConfig = async (root: string): Promise<SunabaUserConfig> => {
  const configPath = join(root, CONFIG_FILE);
  if (!existsSync(configPath)) {
    return {};
  }
  // Node 24 strips types natively, so the config imports without a bundler.
  const module = (await import(pathToFileURL(configPath).href)) as {
    default?: SunabaUserConfig;
  };
  return module.default ?? {};
};

export type SunabaDevServer = {
  vite: ViteDevServer;
  config: SunabaConfig;
  commands: SunabaCommands;
  app: Hono;
  listen: () => Promise<void>;
  close: () => Promise<void>;
};

export type SunabaDevServerOptions = {
  root?: string;
  port?: number;
  host?: string | boolean;
};

export const createSunabaDevServer = async (
  options: SunabaDevServerOptions = {},
): Promise<SunabaDevServer> => {
  const root = resolve(options.root ?? process.cwd());
  const port = options.port ?? DEFAULT_PORT;
  const config = resolveConfig(await loadUserConfig(root));

  let entries: Record<string, StoryIndexEntry> = {};
  let diagnostics: IndexDiagnostic[] = [];
  let version = 0;
  let storyFiles: string[] = [];

  const applyIndex = (built: {
    entries: StoryIndexEntry[];
    diagnostics: IndexDiagnostic[];
  }): void => {
    version += 1;
    entries = Object.fromEntries(built.entries.map((entry) => [entry.id, entry]));
    diagnostics = built.diagnostics;
    storyFiles = [...new Set(built.entries.map((entry) => entry.file))];
  };

  applyIndex(await buildIndex(root, config.stories));

  const getIndex = (): StoryIndex => ({ version, entries });
  const store = new SessionStore();
  const commands = createCommands(store, {
    getIndex,
    getDiagnostics: () => diagnostics,
  });
  const app = createApiApp(commands);
  registerMcpRoute(app, commands, {
    origin: `http://localhost:${String(port)}`,
    axes: config.env,
  });

  const vite = await createViteServer({
    root,
    ...(config.vite.configFile !== undefined ? { configFile: config.vite.configFile } : {}),
    appType: "custom",
    server: {
      port,
      strictPort: true,
      open: false,
      ...(options.host !== undefined ? { host: options.host } : {}),
    },
    plugins: [
      sunabaPlugin({
        root,
        config,
        store,
        getStoryFiles: () => storyFiles,
        app,
      }),
    ],
  });

  const isStoryFile = (path: string): boolean => /\.stories\.[jt]sx?$/.test(path);
  let reindexTimer: NodeJS.Timeout | undefined;
  const scheduleReindex = (structural: boolean): void => {
    clearTimeout(reindexTimer);
    reindexTimer = setTimeout(() => {
      void buildIndex(root, config.stories).then((built) => {
        applyIndex(built);
        store.broadcastIndex(getIndex());
        if (structural) {
          invalidateStories(vite);
        }
      });
    }, 100);
  };
  vite.watcher.on("add", (path) => {
    if (isStoryFile(path)) {
      scheduleReindex(true);
    }
  });
  vite.watcher.on("unlink", (path) => {
    if (isStoryFile(path)) {
      scheduleReindex(true);
    }
  });
  vite.watcher.on("change", (path) => {
    if (isStoryFile(path)) {
      scheduleReindex(false);
    }
  });

  return {
    vite,
    config,
    commands,
    app,
    listen: async () => {
      await vite.listen();
    },
    close: async () => {
      clearTimeout(reindexTimer);
      await vite.close();
    },
  };
};
