import { Hono } from "hono";
import type { StoryAddress } from "../protocol/types.ts";
import { StoryNotFoundError } from "./commands.ts";
import type { SunabaCommands } from "./commands.ts";

/** HTTP surface over the shared command layer (used by the human UI and CI). */
export const createApiApp = (commands: SunabaCommands): Hono => {
  const app = new Hono();

  app.onError((error, c) => {
    if (error instanceof StoryNotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    return c.json({ error: error.message }, 500);
  });

  app.get("/__sunaba/api/index", (c) => c.json(commands.listStories()));

  app.get("/__sunaba/api/session", (c) =>
    c.json({ ...commands.getStageView(), log: commands.getSessionLog() }),
  );

  app.post("/__sunaba/api/select", async (c) => {
    const address = (await c.req.json()) as StoryAddress;
    return c.json(commands.select(address, "ui"));
  });

  app.post("/__sunaba/api/play", async (c) => {
    const result = await commands.runPlay("ui");
    return c.json(result);
  });

  return app;
};
