import type { AddressDet, JsonObject, JsonValue, StoryAddress } from "./types.ts";

/**
 * `addressToUrl` / `parseAddress` are the single source of truth for the
 * address URL grammar. Nothing else in sunaba builds or parses render URLs.
 *
 * Canonical form (deterministic — canonical URLs are comparable as strings):
 *   /render/<story id>?args=<canonical JSON>&det.freeze=1&det.seed=42
 *     &det.time=<ISO>&env.<axis>=<value>
 * - `args` is a single URL-encoded JSON object with recursively sorted keys.
 * - `env.*`/`det.*` are dotted string params; env axes are sorted by name.
 * - Params appear in the fixed order: args, det.*, env.*; empties are omitted.
 */

export const RENDER_PATH_PREFIX = "/render/";

/** JSON.stringify with object keys sorted recursively (arrays keep order). */
export const canonicalJson = (value: JsonValue): string => {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const entries = Object.keys(value)
      .toSorted()
      .map((key) => {
        const child = value[key];
        if (child === undefined) {
          return undefined;
        }
        return `${JSON.stringify(key)}:${canonicalJson(child)}`;
      })
      .filter((entry) => entry !== undefined);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
};

const encodeStoryIdForPath = (id: string): string =>
  encodeURIComponent(id).replaceAll("%2F", "/").replaceAll("%3A", ":");

export const addressToUrl = (address: StoryAddress, base = ""): string => {
  const params: string[] = [];
  if (address.args !== undefined && Object.keys(address.args).length > 0) {
    params.push(`args=${encodeURIComponent(canonicalJson(address.args))}`);
  }
  const det = address.det;
  if (det?.freeze === true) {
    params.push("det.freeze=1");
  }
  if (det?.seed !== undefined) {
    params.push(`det.seed=${String(det.seed)}`);
  }
  if (det?.time !== undefined) {
    params.push(`det.time=${encodeURIComponent(det.time)}`);
  }
  for (const axis of Object.keys(address.env ?? {}).toSorted()) {
    const value = address.env?.[axis];
    if (value !== undefined) {
      params.push(`env.${encodeURIComponent(axis)}=${encodeURIComponent(value)}`);
    }
  }
  const query = params.length > 0 ? `?${params.join("&")}` : "";
  return `${base}${RENDER_PATH_PREFIX}${encodeStoryIdForPath(address.story)}${query}`;
};

const parseArgs = (raw: string): JsonObject => {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("args must be a JSON object");
  }
  return parsed as JsonObject;
};

export const parseAddress = (url: string | URL): StoryAddress => {
  const parsed = typeof url === "string" ? new URL(url, "http://localhost") : url;
  const { pathname } = parsed;
  if (!pathname.startsWith(RENDER_PATH_PREFIX)) {
    throw new Error(`Not a render URL: ${pathname}`);
  }
  const story = decodeURIComponent(pathname.slice(RENDER_PATH_PREFIX.length));
  if (story === "") {
    throw new Error("Render URL is missing a story id");
  }

  const address: StoryAddress = { story };
  const env: Record<string, string> = {};
  const det: AddressDet = {};
  for (const [key, value] of parsed.searchParams) {
    if (key === "args") {
      address.args = parseArgs(value);
    } else if (key === "det.freeze") {
      det.freeze = value === "1" || value === "true";
    } else if (key === "det.seed") {
      const seed = Number(value);
      if (!Number.isFinite(seed)) {
        throw new Error(`Invalid det.seed: ${value}`);
      }
      det.seed = seed;
    } else if (key === "det.time") {
      det.time = value;
    } else if (key.startsWith("env.")) {
      env[key.slice("env.".length)] = value;
    } else {
      throw new Error(`Unknown address parameter: ${key}`);
    }
  }
  if (Object.keys(env).length > 0) {
    address.env = env;
  }
  if (Object.keys(det).length > 0) {
    address.det = det;
  }
  return address;
};
