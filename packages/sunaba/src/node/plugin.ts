import { existsSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { getRequestListener } from "@hono/node-server";
import type { Hono } from "hono";
import type { Plugin, ViteDevServer } from "vite";
import { WebSocketServer } from "ws";
import type { SunabaConfig } from "../config.ts";
import { RENDER_PATH_PREFIX } from "../protocol/address.ts";
import type { SessionStore } from "./session.ts";

/**
 * The Vite plugin wires sunaba into the dev server: virtual modules for the
 * stage entry, the /render/* stage page, the stage/observer WebSocket, and the
 * Hono app (HTTP API + MCP) mounted on reserved paths.
 */

const VIRTUAL_STORIES = "virtual:sunaba/stories";
const VIRTUAL_PREVIEW = "virtual:sunaba/preview";
const VIRTUAL_CONFIG = "virtual:sunaba/config";
const VIRTUAL_STAGE_ENTRY = "virtual:sunaba/stage-entry";
const RESOLVED_PREFIX = "\0";

const STAGE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>sunaba stage</title>
  </head>
  <body>
    <div id="sunaba-root"></div>
    <script type="module" src="/@id/__x00__${VIRTUAL_STAGE_ENTRY}"></script>
  </body>
</html>
`;

export type SunabaPluginOptions = {
  root: string;
  config: SunabaConfig;
  store: SessionStore;
  getStoryFiles: () => string[];
  app: Hono;
};

export const sunabaPlugin = (options: SunabaPluginOptions): Plugin => {
  const { root, config, store, getStoryFiles, app } = options;

  return {
    name: "sunaba",

    resolveId(id) {
      if (
        id === VIRTUAL_STORIES ||
        id === VIRTUAL_PREVIEW ||
        id === VIRTUAL_CONFIG ||
        id === VIRTUAL_STAGE_ENTRY
      ) {
        return `${RESOLVED_PREFIX}${id}`;
      }
      return undefined;
    },

    load(id) {
      if (id === `${RESOLVED_PREFIX}${VIRTUAL_STORIES}`) {
        const entries = getStoryFiles()
          .map((file) => `  ${JSON.stringify(file)}: () => import(${JSON.stringify(`/${file}`)}),`)
          .join("\n");
        return `export const files = {\n${entries}\n};\n`;
      }
      if (id === `${RESOLVED_PREFIX}${VIRTUAL_PREVIEW}`) {
        return existsSync(`${root}/${config.preview}`)
          ? `import preview from ${JSON.stringify(`/${config.preview}`)};\nexport default preview;\n`
          : "export default {};\n";
      }
      if (id === `${RESOLVED_PREFIX}${VIRTUAL_CONFIG}`) {
        return `export const env = ${JSON.stringify(config.env)};\n`;
      }
      if (id === `${RESOLVED_PREFIX}${VIRTUAL_STAGE_ENTRY}`) {
        return [
          `import { mountStage } from "sunaba/stage";`,
          `import { files } from ${JSON.stringify(VIRTUAL_STORIES)};`,
          `import preview from ${JSON.stringify(VIRTUAL_PREVIEW)};`,
          `import { env } from ${JSON.stringify(VIRTUAL_CONFIG)};`,
          `void mountStage({ files, preview, env });`,
          "",
        ].join("\n");
      }
      return undefined;
    },

    configureServer(server: ViteDevServer) {
      // Stage page: any /render/* URL serves the same HTML; the runtime
      // interprets the address on the client.
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        if (req.method === "GET" && url.startsWith(RENDER_PATH_PREFIX)) {
          void server
            .transformIndexHtml(url, STAGE_HTML)
            .then((html) => {
              res.setHeader("content-type", "text/html; charset=utf-8");
              res.end(html);
            })
            .catch(next);
          return;
        }
        next();
      });

      // HTTP API + MCP (Hono) on reserved paths.
      const listener = getRequestListener(app.fetch);
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? "";
        if (url.startsWith("/__sunaba/api/") || url === "/mcp" || url.startsWith("/mcp?")) {
          void listener(req, res);
          return;
        }
        next();
      });

      // Stage/observer WebSocket, path-separated from Vite's own HMR socket.
      const wss = new WebSocketServer({ noServer: true });
      const httpServer = server.httpServer;
      if (httpServer !== null) {
        httpServer.on("upgrade", (request: IncomingMessage, socket: Duplex, head: Buffer) => {
          const url = new URL(request.url ?? "/", "http://localhost");
          if (url.pathname !== "/__sunaba/ws") {
            return;
          }
          wss.handleUpgrade(request, socket, head, (ws) => {
            const role = url.searchParams.get("role") === "stage" ? "stage" : "observer";
            store.attach(ws, role);
          });
        });
      }
    },
  };
};

export const invalidateStories = (server: ViteDevServer): void => {
  const module = server.moduleGraph.getModuleById(`${RESOLVED_PREFIX}${VIRTUAL_STORIES}`);
  if (module !== undefined) {
    server.moduleGraph.invalidateModule(module);
    server.ws.send({ type: "full-reload" });
  }
};
