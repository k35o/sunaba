import type { WebSocket } from "ws";
import type {
  PlayResult,
  ServerToObserverMessage,
  ServerToStageMessage,
  SessionLogEntry,
  SessionState,
  StageToServerMessage,
} from "../protocol/messages.ts";
import type { JsonObject, StoryAddress, StoryIndex } from "../protocol/types.ts";

/**
 * The session store is the single source of truth for the one live stage.
 * MCP tools and the human UI converge on the same command functions; every
 * mutation is broadcast to all connected sockets.
 */

export type ConsoleEntry = { level: "log" | "warn" | "error"; text: string };

const CONSOLE_LIMIT = 50;
const LOG_LIMIT = 200;

export class SessionStore {
  private state: SessionState = {
    address: null,
    stageConnected: false,
    render: { status: "pending" },
  };
  private stages = new Set<WebSocket>();
  private observers = new Set<WebSocket>();
  private consoleEntries: ConsoleEntry[] = [];
  private log: SessionLogEntry[] = [];
  private pendingPlays = new Map<string, (result: PlayResult) => void>();
  private playCounter = 0;

  getState(): SessionState {
    return this.state;
  }

  getConsole(): ConsoleEntry[] {
    return [...this.consoleEntries];
  }

  getLog(): SessionLogEntry[] {
    return [...this.log];
  }

  attach(socket: WebSocket, role: "stage" | "observer"): void {
    if (role === "stage") {
      this.stages.add(socket);
      this.state = { ...this.state, stageConnected: true };
      socket.on("message", (raw) => {
        this.handleStageMessage(JSON.parse(String(raw)) as StageToServerMessage);
      });
      socket.on("close", () => {
        this.stages.delete(socket);
        if (this.stages.size === 0) {
          this.state = { ...this.state, stageConnected: false };
          this.broadcastSession();
        }
      });
      // No catch-up push here: a freshly connected stage renders its own URL
      // and announces it via stage:hello — the URL always wins on page load.
    } else {
      this.observers.add(socket);
      socket.on("close", () => {
        this.observers.delete(socket);
      });
      this.sendRaw(socket, { kind: "session", state: this.state });
    }
    this.broadcastSession();
  }

  /** Selects a story for the live stage and resets per-story state. */
  select(address: StoryAddress, actor: SessionLogEntry["actor"]): SessionState {
    this.state = {
      address,
      stageConnected: this.state.stageConnected,
      render: { status: "pending" },
    };
    this.consoleEntries = [];
    this.appendLog(actor, "select", { address } as unknown as JsonObject);
    for (const socket of this.stages) {
      this.sendToStage(socket, { kind: "stage:select", address });
    }
    this.broadcastSession();
    return this.state;
  }

  /** Runs the current story's play function on the live stage. */
  async runPlay(actor: SessionLogEntry["actor"], timeoutMs = 15_000): Promise<PlayResult> {
    if (this.stages.size === 0) {
      return { status: "skipped", reason: "no stage is connected" };
    }
    this.playCounter += 1;
    const requestId = `play_${String(this.playCounter)}`;
    this.appendLog(actor, "runPlay");
    const result = await new Promise<PlayResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pendingPlays.delete(requestId);
        resolve({
          status: "failed",
          error: { message: `play did not finish within ${String(timeoutMs)}ms` },
        });
      }, timeoutMs);
      this.pendingPlays.set(requestId, (value) => {
        clearTimeout(timer);
        resolve(value);
      });
      for (const socket of this.stages) {
        this.sendToStage(socket, { kind: "stage:runPlay", requestId });
      }
    });
    return result;
  }

  broadcastIndex(index: StoryIndex): void {
    for (const socket of this.observers) {
      this.sendRaw(socket, { kind: "index", index });
    }
  }

  appendLog(actor: SessionLogEntry["actor"], command: string, payload?: JsonObject): void {
    const entry: SessionLogEntry =
      payload === undefined
        ? { at: new Date().toISOString(), actor, command }
        : { at: new Date().toISOString(), actor, command, payload };
    this.log.push(entry);
    if (this.log.length > LOG_LIMIT) {
      this.log.shift();
    }
    for (const socket of this.observers) {
      this.sendRaw(socket, { kind: "log", entry });
    }
  }

  private handleStageMessage(message: StageToServerMessage): void {
    if (message.kind === "stage:hello") {
      this.state = { ...this.state, address: message.address };
    } else if (message.kind === "stage:render") {
      this.state = {
        ...this.state,
        render:
          message.error === undefined
            ? { status: message.status }
            : { status: message.status, error: message.error },
      };
    } else if (message.kind === "stage:args") {
      this.state = { ...this.state, argsSnapshot: message.args };
    } else if (message.kind === "stage:console") {
      this.consoleEntries.push({ level: message.level, text: message.text });
      if (this.consoleEntries.length > CONSOLE_LIMIT) {
        this.consoleEntries.shift();
      }
      return;
    } else {
      const waiter = this.pendingPlays.get(message.requestId);
      if (waiter !== undefined) {
        this.pendingPlays.delete(message.requestId);
        waiter(message.result);
      }
      return;
    }
    this.broadcastSession();
  }

  private broadcastSession(): void {
    for (const socket of this.observers) {
      this.sendRaw(socket, { kind: "session", state: this.state });
    }
  }

  private sendToStage(socket: WebSocket, message: ServerToStageMessage): void {
    socket.send(JSON.stringify(message));
  }

  private sendRaw(socket: WebSocket, message: ServerToObserverMessage): void {
    socket.send(JSON.stringify(message));
  }
}
