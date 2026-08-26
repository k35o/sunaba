export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = Record<string, JsonValue>;

/**
 * Canonical story identifier: `<posix relative path>:<export name>`.
 * Example: `src/components/button.stories.tsx:Primary`
 */
export type StoryId = string;

/** Determinism overrides carried by an address. Applied by the runtime bootstrap. */
export type AddressDet = {
  /** Fixed clock origin (ISO 8601). Clock advances with real-time offset unless `freeze` is set. */
  time?: string;
  /** Seed for the pseudo-random number generator. */
  seed?: number;
  /** Fully freeze the clock (opt-in; breaks debounce/transition-dependent stories). */
  freeze?: boolean;
};

/**
 * A fully addressable render state. Everything reachable at runtime through
 * props/env patches can be re-serialized into one of these (patch ⊆ URL).
 */
export type StoryAddress = {
  story: StoryId;
  /** Shallow overrides merged over the story's own args. */
  args?: JsonObject;
  /** Environment axis values, e.g. `{ theme: "dark" }`. */
  env?: Record<string, string>;
  det?: AddressDet;
};

export type StoryIndexEntry = {
  id: StoryId;
  /** Catalog grouping, derived from the file path unless `meta.title` is set. */
  title: string;
  /** Display name: the export name as written, unless `story.name` is set. */
  name: string;
  exportName: string;
  /** Project-root-relative posix path. */
  file: string;
  tags: string[];
  /** Present only when true, to keep index payloads small. */
  hasPlay?: true;
};

export type StoryIndex = {
  /** Monotonically increasing; bumped on every index update. */
  version: number;
  entries: Record<StoryId, StoryIndexEntry>;
};

/** A diagnostic for a story file the indexer skipped or partially read. */
export type IndexDiagnostic = {
  file: string;
  reason: string;
};

export type SerializedError = {
  message: string;
  stack?: string;
};

export type RenderStatus = "pending" | "rendered" | "error";
