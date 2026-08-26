import { deriveTitle, makeStoryId, parseStoryId } from "../../src/protocol/story-id.ts";

describe("makeStoryId / parseStoryId", () => {
  test("round-trips a file path and export name", () => {
    const id = makeStoryId("src/components/button.stories.tsx", "Primary");
    expect(id).toBe("src/components/button.stories.tsx:Primary");
    expect(parseStoryId(id)).toEqual({
      file: "src/components/button.stories.tsx",
      exportName: "Primary",
    });
  });

  test("rejects file paths containing a colon", () => {
    expect(() => makeStoryId("src/a:b.stories.tsx", "X")).toThrow(":");
  });

  test("rejects malformed ids", () => {
    expect(() => parseStoryId("no-separator")).toThrow("Invalid story id");
    expect(() => parseStoryId("file.stories.tsx:")).toThrow("Invalid story id");
    expect(() => parseStoryId(":Export")).toThrow("Invalid story id");
  });
});

describe("deriveTitle", () => {
  test("strips extension and leading src/", () => {
    expect(deriveTitle("src/components/button.stories.tsx")).toBe("components/button");
  });

  test("collapses a file segment repeating its directory", () => {
    expect(deriveTitle("src/components/form/password-input/password-input.stories.tsx")).toBe(
      "components/form/password-input",
    );
  });

  test("keeps paths without src/ prefix intact", () => {
    expect(deriveTitle("stories/button.stories.ts")).toBe("stories/button");
  });
});
