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
    const run = await commands.runPlay("ui");
    // Snapshots stay behind /play-run; callers only need the outcome shape.
    return c.json({
      ...run.result,
      runId: run.id,
      steps: run.steps.map((step) => step.label),
    });
  });

  app.get("/__sunaba/api/play-run", (c) => {
    const id = c.req.query("id");
    const run = id === undefined ? undefined : commands.getPlayRun(id);
    if (run === undefined) {
      return c.json({ error: "unknown play run" }, 404);
    }
    return c.json({
      ...run,
      steps: run.steps.map((step, index) => ({
        index,
        kind: step.kind,
        label: step.label,
        hasSnapshot: step.snapshot !== undefined,
      })),
    });
  });

  app.post("/__sunaba/api/show-snapshot", async (c) => {
    const body = (await c.req.json()) as { runId?: unknown; step?: unknown };
    if (typeof body.runId !== "string" || typeof body.step !== "number") {
      return c.json({ error: "body must be { runId: string, step: number }" }, 400);
    }
    const shown = commands.showSnapshot(body.runId, body.step);
    return shown ? c.json({ ok: true }) : c.json({ error: "no snapshot for that step" }, 404);
  });

  return app;
};
