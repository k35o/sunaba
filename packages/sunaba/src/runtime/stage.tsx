import { within } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { Component, createElement, StrictMode } from "react";
import type { ComponentType, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { parseAddress } from "../protocol/address.ts";
import type { ServerToStageMessage, StageToServerMessage } from "../protocol/messages.ts";
import { parseStoryId } from "../protocol/story-id.ts";
import type { JsonObject, JsonValue, StoryAddress } from "../protocol/types.ts";
import type {
  Args,
  Decorator,
  Meta,
  PlayContext,
  PreviewConfig,
  StoryContext,
  StoryDef,
  SunabaEnv,
} from "../react/index.ts";

/**
 * Browser runtime for the stage page. Interprets a render address, composes
 * the CSF subset (args merge, decorator nesting, render fallback), mounts the
 * story, and reports state over the stage WebSocket. Play functions never run
 * on mount — the server triggers them on demand.
 */

export type StageEnvAxis = { values: string[]; default?: string };

export type StageInput = {
  files: Record<string, () => Promise<Record<string, unknown>>>;
  preview: PreviewConfig;
  env: Record<string, StageEnvAxis>;
};

type StoryModuleShape = {
  meta: Meta;
  story: StoryDef;
};

const READY_ATTRIBUTE = "data-sunaba-ready";

const resolveEnv = (
  axes: Record<string, StageEnvAxis>,
  overrides: Record<string, string>,
): Record<string, string> => {
  const env: Record<string, string> = {};
  for (const [axis, config] of Object.entries(axes)) {
    const fallback = config.default ?? config.values[0];
    if (fallback !== undefined) {
      env[axis] = fallback;
    }
  }
  for (const [axis, value] of Object.entries(overrides)) {
    env[axis] = value;
  }
  return env;
};

const toSnapshotValue = (value: unknown): JsonValue => {
  if (typeof value === "function") {
    return "[fn]";
  }
  if (value === undefined) {
    return null;
  }
  if (value === null || typeof value !== "object") {
    return value as JsonValue;
  }
  if (Array.isArray(value)) {
    return value.map(toSnapshotValue);
  }
  if ("$$typeof" in value) {
    return "[element]";
  }
  const out: JsonObject = {};
  for (const [key, child] of Object.entries(value)) {
    out[key] = toSnapshotValue(child);
  }
  return out;
};

const serializeError = (error: unknown): { message: string; stack?: string } => {
  if (error instanceof Error) {
    return error.stack === undefined
      ? { message: error.message }
      : { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
};

type ErrorBoundaryProps = {
  onError: (error: unknown) => void;
  children?: ReactNode;
};

class StageErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: unknown): void {
    this.props.onError(error);
  }

  override render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

class StageConnection {
  private socket: WebSocket;
  private queue: string[] = [];

  constructor(onMessage: (message: ServerToStageMessage) => void) {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    this.socket = new WebSocket(`${protocol}//${location.host}/__sunaba/ws?role=stage`);
    this.socket.addEventListener("open", () => {
      for (const raw of this.queue) {
        this.socket.send(raw);
      }
      this.queue = [];
    });
    this.socket.addEventListener("message", (event) => {
      if (typeof event.data === "string") {
        onMessage(JSON.parse(event.data) as ServerToStageMessage);
      }
    });
  }

  send(message: StageToServerMessage): void {
    const raw = JSON.stringify(message);
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(raw);
    } else {
      this.queue.push(raw);
    }
  }
}

const loadStoryModule = async (
  input: StageInput,
  address: StoryAddress,
): Promise<StoryModuleShape> => {
  const { file, exportName } = parseStoryId(address.story);
  const loader = input.files[file];
  if (loader === undefined) {
    throw new Error(`Unknown story file: ${file}`);
  }
  const module = await loader();
  const meta = module["default"];
  if (meta === undefined || meta === null || typeof meta !== "object") {
    throw new Error(`${file} has no default export meta object`);
  }
  const story = module[exportName];
  if (story === undefined || story === null || typeof story !== "object") {
    throw new Error(`${file} has no story export named "${exportName}"`);
  }
  return { meta: meta as Meta, story: story as StoryDef };
};

const composeStoryElement = (
  shape: StoryModuleShape,
  preview: PreviewConfig,
  context: StoryContext,
): ReactNode => {
  const { meta, story } = shape;
  const renderFn = story.render;
  let node: ReactNode;
  if (renderFn === undefined) {
    const component = meta.component as ComponentType<Args> | undefined;
    if (component === undefined) {
      throw new Error("Story has neither a render function nor meta.component");
    }
    node = createElement(component, context.args);
  } else {
    node = renderFn(context.args, context);
  }
  // Decorators nest story-level innermost, preview-level outermost.
  const decorators: Decorator[] = [
    ...(story.decorators ?? []),
    ...(meta.decorators ?? []),
    ...(preview.decorators ?? []),
  ];
  for (const decorator of decorators) {
    const inner = node;
    const StoryComponent: ComponentType = () => inner;
    node = decorator(StoryComponent, context);
  }
  return node;
};

const toBeforeEachList = (value: StoryDef["beforeEach"]): NonNullable<StoryDef["beforeEach"]>[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

export const mountStage = async (input: StageInput): Promise<void> => {
  const rootElement = document.getElementById("sunaba-root");
  if (rootElement === null) {
    throw new Error("Stage HTML is missing #sunaba-root");
  }

  let currentStory: StoryDef | undefined;
  let currentContext: StoryContext | undefined;
  let abortController = new AbortController();
  const cleanups: VoidFunction[] = [];
  const root = createRoot(rootElement);

  // Passive pages (e.g. gallery tiles) render their URL but never join the
  // live-stage session; the fragment keeps this out of the address grammar.
  const passive = location.hash === "#passive";
  const connection = passive
    ? undefined
    : new StageConnection((message) => {
        if (message.kind === "stage:select") {
          void renderAddress(message.address);
        } else if (message.kind === "stage:runPlay") {
          void runPlay(message.requestId);
        }
      });
  const send = (message: StageToServerMessage): void => {
    connection?.send(message);
  };

  const reportError = (error: unknown): void => {
    send({
      kind: "stage:render",
      status: "error",
      error: serializeError(error),
    });
  };

  window.addEventListener("error", (event) => {
    reportError(event.error ?? event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason);
  });
  for (const level of ["warn", "error"] as const) {
    const original = console[level].bind(console);
    console[level] = (...parts: unknown[]): void => {
      original(...parts);
      send({
        kind: "stage:console",
        level,
        text: parts.map(String).join(" "),
      });
    };
  }

  if (input.preview.setup !== undefined) {
    await input.preview.setup();
  }

  const applyEnv = (env: Record<string, string>): void => {
    const appliers = input.preview.applyEnv ?? {};
    for (const [axis, value] of Object.entries(env)) {
      const applier = (appliers as Record<string, ((value: string) => void) | undefined>)[axis];
      applier?.(value);
    }
  };

  const renderAddress = async (address: StoryAddress): Promise<void> => {
    abortController.abort();
    abortController = new AbortController();
    rootElement.removeAttribute(READY_ATTRIBUTE);
    send({ kind: "stage:hello", address });
    send({ kind: "stage:render", status: "pending" });
    try {
      const shape = await loadStoryModule(input, address);
      const env = resolveEnv(input.env, address.env ?? {});
      applyEnv(env);
      const args: Args = {
        ...(shape.meta.args as Args | undefined),
        ...(shape.story.args as Args | undefined),
        ...address.args,
      };
      const { exportName, file } = parseStoryId(address.story);
      const context: StoryContext = {
        id: address.story,
        name: shape.story.name ?? exportName,
        title: shape.meta.title ?? file,
        args,
        env: env as Readonly<Partial<SunabaEnv>>,
        abortSignal: abortController.signal,
      };
      while (cleanups.length > 0) {
        cleanups.pop()?.();
      }
      const beforeEachList = [
        ...toBeforeEachList(input.preview.beforeEach),
        ...toBeforeEachList(shape.meta.beforeEach as StoryDef["beforeEach"]),
        ...toBeforeEachList(shape.story.beforeEach),
      ].flat();
      for (const hook of beforeEachList) {
        const cleanup = await hook(context);
        if (typeof cleanup === "function") {
          cleanups.push(cleanup);
        }
      }
      const element = composeStoryElement(shape, input.preview, context);
      root.render(
        createElement(
          StrictMode,
          null,
          createElement(StageErrorBoundary, { onError: reportError }, element),
        ),
      );
      currentStory = shape.story;
      currentContext = context;
      // Double rAF waits for paint, but rAF never fires in occluded tabs —
      // the timeout fallback keeps headless/background stages reporting.
      await Promise.race([
        new Promise<void>((resolveFrame) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolveFrame();
            });
          });
        }),
        new Promise<void>((resolveTimer) => {
          setTimeout(resolveTimer, 100);
        }),
      ]);
      rootElement.setAttribute(READY_ATTRIBUTE, "1");
      send({ kind: "stage:render", status: "rendered" });
      send({
        kind: "stage:args",
        args: toSnapshotValue(context.args) as JsonObject,
      });
    } catch (error) {
      reportError(error);
    }
  };

  const runPlay = async (requestId: string): Promise<void> => {
    if (currentStory === undefined || currentContext === undefined) {
      send({
        kind: "stage:play",
        requestId,
        result: { status: "skipped", reason: "no story is mounted" },
      });
      return;
    }
    const play = currentStory.play;
    if (play === undefined) {
      send({
        kind: "stage:play",
        requestId,
        result: { status: "skipped", reason: "story has no play function" },
      });
      return;
    }
    const playContext: PlayContext = {
      ...currentContext,
      canvasElement: rootElement,
      canvas: within(rootElement),
      userEvent: userEvent.setup(),
      step: async (_label, body) => {
        await body();
      },
    };
    try {
      await play(playContext);
      send({ kind: "stage:play", requestId, result: { status: "passed" } });
    } catch (error) {
      send({
        kind: "stage:play",
        requestId,
        result: { status: "failed", error: serializeError(error) },
      });
    }
  };

  await renderAddress(parseAddress(new URL(location.href)));
};
