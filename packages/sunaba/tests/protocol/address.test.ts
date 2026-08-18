import { addressToUrl, canonicalJson, parseAddress } from "../../src/protocol/address.ts";
import type { StoryAddress } from "../../src/protocol/types.ts";

describe("canonicalJson", () => {
  test("sorts object keys recursively and keeps array order", () => {
    expect(canonicalJson({ b: 1, a: { d: [2, 1], c: null } })).toBe(
      '{"a":{"c":null,"d":[2,1]},"b":1}',
    );
  });
});

describe("addressToUrl", () => {
  test("renders the minimal form without a query", () => {
    expect(addressToUrl({ story: "src/button.stories.tsx:Primary" })).toBe(
      "/render/src/button.stories.tsx:Primary",
    );
  });

  test("produces a deterministic canonical query", () => {
    const address: StoryAddress = {
      story: "src/button.stories.tsx:Primary",
      args: { label: "購入", disabled: true },
      env: { writingMode: "vertical", theme: "dark" },
      det: { seed: 42 },
    };
    const url = addressToUrl(address);
    expect(url).toBe(
      "/render/src/button.stories.tsx:Primary" +
        `?args=${encodeURIComponent('{"disabled":true,"label":"購入"}')}` +
        "&det.seed=42&env.theme=dark&env.writingMode=vertical",
    );
  });

  test("prepends a base origin when given", () => {
    expect(addressToUrl({ story: "src/a.stories.tsx:X" }, "http://localhost:3780")).toBe(
      "http://localhost:3780/render/src/a.stories.tsx:X",
    );
  });
});

describe("parseAddress", () => {
  test("round-trips every field", () => {
    const address: StoryAddress = {
      story: "src/components/button.stories.tsx:Primary",
      args: { count: 3, label: "Buy" },
      env: { theme: "dark" },
      det: { time: "2026-01-01T00:00:00Z", seed: 1, freeze: true },
    };
    expect(parseAddress(addressToUrl(address, "http://localhost"))).toEqual(address);
  });

  test("omits empty args/env/det instead of adding empty objects", () => {
    const parsed = parseAddress("/render/src/a.stories.tsx:X");
    expect(parsed).toEqual({ story: "src/a.stories.tsx:X" });
  });

  test("rejects non-render URLs, unknown params, and invalid values", () => {
    expect(() => parseAddress("/stage")).toThrow("Not a render URL");
    expect(() => parseAddress("/render/")).toThrow("missing a story id");
    expect(() => parseAddress("/render/a.stories.tsx:X?nope=1")).toThrow(
      "Unknown address parameter",
    );
    expect(() => parseAddress("/render/a.stories.tsx:X?det.seed=abc")).toThrow("Invalid det.seed");
    expect(() => parseAddress("/render/a.stories.tsx:X?args=%5B1%5D")).toThrow(
      "args must be a JSON object",
    );
  });
});
