import { addressToUrl } from "../protocol/address.ts";
import type { PlayResult, SessionLogEntry, SessionState } from "../protocol/messages.ts";
import type { IndexDiagnostic, StoryAddress, StoryIndex } from "../protocol/types.ts";
import type { ConsoleEntry, SessionStore } from "./session.ts";

/**
 * The shared command layer. MCP tools, the HTTP API, and the human UI all go
 * through these functions so every actor sees the same state and every action
 * lands in the same operation log.
 */

export type IndexAccess = {
  getIndex: () => StoryIndex;
  getDiagnostics: () => IndexDiagnostic[];
};

export type StageView = {
  state: SessionState;
  permalink: string | null;
  console: ConsoleEntry[];
};

export type SunabaCommands = {
  listStories: () => { index: StoryIndex; diagnostics: IndexDiagnostic[] };
  getStageView: () => StageView;
  getSessionLog: () => SessionLogEntry[];
  select: (address: StoryAddress, actor: SessionLogEntry["actor"]) => StageView;
  runPlay: (actor: SessionLogEntry["actor"]) => Promise<PlayResult>;
};

export const createCommands = (store: SessionStore, index: IndexAccess): SunabaCommands => {
  const view = (): StageView => {
    const state = store.getState();
    return {
      state,
      permalink: state.address === null ? null : addressToUrl(state.address),
      console: store.getConsole(),
    };
  };

  return {
    listStories: () => ({
      index: index.getIndex(),
      diagnostics: index.getDiagnostics(),
    }),
    getStageView: view,
    getSessionLog: () => store.getLog(),
    select: (address, actor) => {
      const entry = index.getIndex().entries[address.story];
      if (entry === undefined) {
        throw new StoryNotFoundError(address.story);
      }
      store.select(address, actor);
      return view();
    },
    runPlay: (actor) => store.runPlay(actor),
  };
};

export class StoryNotFoundError extends Error {
  constructor(storyId: string) {
    super(
      `Unknown story "${storyId}". If the file was just written, the index may` +
        " still be catching up — retry in about a second. Otherwise check" +
        " list_stories diagnostics for subset violations that skip files.",
    );
    this.name = "StoryNotFoundError";
  }
}
