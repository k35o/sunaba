import { StreamableHTTPTransport } from "@hono/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Hono } from "hono";
import { z } from "zod";
import type { EnvAxisConfig } from "../config.ts";
import { parseAddress } from "../protocol/address.ts";
import type { StoryAddress } from "../protocol/types.ts";
import type { SunabaCommands } from "./commands.ts";

/**
 * The MCP surface. Tools are thin wrappers over the shared command layer;
 * descriptions stay short and schemas shallow to keep tools/list cheap.
 */

export type McpOptions = {
  origin: string;
  axes: Record<string, EnvAxisConfig>;
};

const jsonText = (value: unknown): { content: [{ type: "text"; text: string }] } => ({
  content: [{ type: "text", text: JSON.stringify(value) }],
});

const createServer = (commands: SunabaCommands, options: McpOptions): McpServer => {
  const server = new McpServer({ name: "sunaba", version: "0.0.0" });

  server.registerTool(
    "list_stories",
    {
      description:
        "List stories in the catalog with the project's environment axes. " +
        "Story ids are `<file>:<Export>`; diagnostics explain skipped files.",
      inputSchema: {
        q: z.string().optional().describe("Substring filter on id or title"),
      },
    },
    ({ q }) => {
      const { index, diagnostics } = commands.listStories();
      const needle = q?.toLowerCase();
      const stories = Object.values(index.entries)
        .filter(
          (entry) =>
            needle === undefined ||
            entry.id.toLowerCase().includes(needle) ||
            entry.title.toLowerCase().includes(needle),
        )
        .map((entry) => ({
          id: entry.id,
          title: entry.title,
          name: entry.name,
          ...(entry.tags.length > 0 ? { tags: entry.tags } : {}),
          ...(entry.hasPlay === true ? { hasPlay: true } : {}),
        }));
      return jsonText({
        stories,
        total: stories.length,
        axes: Object.fromEntries(
          Object.entries(options.axes).map(([axis, config]) => [axis, config.values]),
        ),
        ...(diagnostics.length > 0 ? { diagnostics } : {}),
      });
    },
  );

  server.registerTool(
    "stage",
    {
      description:
        "Mount a story on the live stage and read its state (render status, " +
        "errors, console, resolved args). Pass `play: true` to run the story's " +
        "play function on demand. Re-invoke with new args/env to re-render.",
      inputSchema: {
        story: z.string().optional().describe("Story id from list_stories (`<file>:<Export>`)"),
        address: z
          .string()
          .optional()
          .describe("A permalink (/render/... URL) to restore instead of story/args/env"),
        args: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("Shallow JSON overrides merged over the story args"),
        env: z
          .record(z.string(), z.string())
          .optional()
          .describe('Environment axis values, e.g. {"theme":"dark"}'),
        play: z.boolean().optional().describe("Run the play function after render"),
      },
    },
    async ({ story, address, args, env, play }) => {
      let target: StoryAddress | undefined;
      if (address !== undefined) {
        target = parseAddress(address);
      } else if (story !== undefined) {
        target = { story };
        if (args !== undefined && Object.keys(args).length > 0) {
          target.args = args as NonNullable<StoryAddress["args"]>;
        }
        if (env !== undefined && Object.keys(env).length > 0) {
          target.env = env;
        }
      }
      let view = target === undefined ? commands.getStageView() : commands.select(target, "mcp");
      if (view.state.address === null) {
        return jsonText({
          error: "Nothing is staged. Pass `story` (see list_stories) or `address`.",
        });
      }
      // Give a freshly selected stage a beat to render before reporting.
      if (target !== undefined) {
        await waitForSettledView(commands);
        view = commands.getStageView();
      }
      const playRun =
        play === true && view.state.stageConnected ? await commands.runPlay("mcp") : undefined;
      const playReport =
        play === true
          ? playRun === undefined
            ? { status: "skipped" as const, reason: "no stage is connected" }
            : { ...playRun.result, steps: playRun.steps.map((step) => step.label) }
          : undefined;
      const finalView = commands.getStageView();
      return jsonText({
        permalink: finalView.permalink === null ? null : `${options.origin}${finalView.permalink}`,
        status: finalView.state.render.status,
        ...(finalView.state.render.error === undefined
          ? {}
          : { error: finalView.state.render.error }),
        stageConnected: finalView.state.stageConnected,
        ...(finalView.state.stageConnected
          ? {}
          : {
              note:
                "No live stage is attached. Open the permalink in a browser " +
                "to render and report state.",
            }),
        ...(finalView.state.argsSnapshot === undefined
          ? {}
          : { args: finalView.state.argsSnapshot }),
        ...(finalView.console.length > 0 ? { console: finalView.console } : {}),
        ...(playReport === undefined ? {} : { play: playReport }),
      });
    },
  );

  return server;
};

const waitForSettledView = async (commands: SunabaCommands): Promise<void> => {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const { state } = commands.getStageView();
    if (!state.stageConnected || state.render.status !== "pending") {
      return;
    }
    await new Promise((resolvePoll) => setTimeout(resolvePoll, 100));
  }
};

export const registerMcpRoute = (
  app: Hono,
  commands: SunabaCommands,
  options: McpOptions,
): void => {
  app.all("/mcp", async (c) => {
    const server = createServer(commands, options);
    const transport = new StreamableHTTPTransport();
    await server.connect(transport);
    return transport.handleRequest(c);
  });
};
