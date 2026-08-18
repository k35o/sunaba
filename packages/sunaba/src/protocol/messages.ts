import type {
  JsonObject,
  RenderStatus,
  SerializedError,
  StoryAddress,
  StoryIndex,
} from "./types.ts";

/**
 * WebSocket protocol between the stage (browser runtime), the server, and
 * observers (human UI). The server's session store is the single source of
 * truth; every mutation is broadcast to all subscribers.
 */

export type PlayResult =
  | { status: "passed" }
  | { status: "failed"; error: SerializedError }
  | { status: "skipped"; reason: string };

export type StageToServerMessage =
  | { kind: "stage:hello"; address: StoryAddress }
  | { kind: "stage:render"; status: RenderStatus; error?: SerializedError }
  /** Resolved args snapshot; functions are reported as the string `"[fn]"`. */
  | { kind: "stage:args"; args: JsonObject }
  | { kind: "stage:play"; requestId: string; result: PlayResult }
  | { kind: "stage:console"; level: "log" | "warn" | "error"; text: string };

export type ServerToStageMessage =
  | { kind: "stage:select"; address: StoryAddress }
  | { kind: "stage:runPlay"; requestId: string };

export type SessionRenderState = {
  status: RenderStatus;
  error?: SerializedError;
};

export type SessionState = {
  address: StoryAddress | null;
  stageConnected: boolean;
  render: SessionRenderState;
  argsSnapshot?: JsonObject;
};

export type LogActor = "mcp" | "ui" | "system";

export type SessionLogEntry = {
  at: string;
  actor: LogActor;
  command: string;
  payload?: JsonObject;
};

export type ServerToObserverMessage =
  | { kind: "session"; state: SessionState }
  | { kind: "index"; index: StoryIndex }
  | { kind: "log"; entry: SessionLogEntry };
