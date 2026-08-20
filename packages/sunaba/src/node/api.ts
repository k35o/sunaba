import { Hono } from "hono";
import type { EnvAxisConfig } from "../config.ts";
import type { StoryAddress } from "../protocol/types.ts";
import { StoryNotFoundError } from "./commands.ts";
import type { SunabaCommands } from "./commands.ts";

/** HTTP surface over the shared command layer (used by the human UI and CI). */
export const createApiApp = (
  commands: SunabaCommands,
  axes: Record<string, EnvAxisConfig>,
): Hono => {
  const app = new Hono();

  app.onError((error, c) => {
    if (error instanceof StoryNotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    return c.json({ error: error.message }, 500);
  });

  app.get("/__sunaba/api/index", (c) => c.json({ ...commands.listStories(), axes }));

  app.get("/__sunaba/api/session", (c) =>
    c.json({ ...commands.getStageView(), log: commands.getSessionLog() }),
  );

  app.post("/__sunaba/api/select", async (c) => {
    const body: unknown = await c.req.json();
    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as { story?: unknown }).story !== "string"
    ) {
      return c.json({ error: "body must be a StoryAddress with a string `story`" }, 400);
    }
    return c.json(commands.select(body as StoryAddress, "ui"));
  });

  app.post("/__sunaba/api/play", async (c) => {
    const result = await commands.runPlay("ui");
    return c.json(result);
  });

  return app;
};
