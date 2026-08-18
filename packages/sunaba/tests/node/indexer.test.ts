import { indexStoryFile } from "../../src/node/indexer.ts";

const FILE = "src/components/button/button.stories.tsx";

describe("indexStoryFile", () => {
  test("indexes CSF3 stories with meta title, tags, name, and play detection", () => {
    const { entries, diagnostics } = indexStoryFile(
      FILE,
      `
      import { Button } from "./button.tsx";
      const meta = { title: "Components/Button", component: Button, tags: ["ui"] } satisfies Meta<typeof Button>;
      export default meta;
      export const Primary: Story = { args: { label: "Buy" } };
      export const Renamed: Story = { name: "Custom Name", tags: ["wip"] };
      export const WithPlay: Story = { play: async () => {} };
      `,
    );
    expect(diagnostics).toEqual([]);
    expect(entries).toEqual([
      {
        id: `${FILE}:Primary`,
        title: "Components/Button",
        name: "Primary",
        exportName: "Primary",
        file: FILE,
        tags: ["ui"],
      },
      {
        id: `${FILE}:Renamed`,
        title: "Components/Button",
        name: "Custom Name",
        exportName: "Renamed",
        file: FILE,
        tags: ["ui", "wip"],
      },
      {
        id: `${FILE}:WithPlay`,
        title: "Components/Button",
        name: "WithPlay",
        exportName: "WithPlay",
        file: FILE,
        tags: ["ui"],
        hasPlay: true,
      },
    ]);
  });

  test("derives the title from the file path when meta.title is absent", () => {
    const { entries } = indexStoryFile(
      FILE,
      `
      export default {};
      export const Primary = {};
      `,
    );
    expect(entries[0]?.title).toBe("components/button");
  });

  test("supports direct default export and specifier re-exports", () => {
    const { entries, diagnostics } = indexStoryFile(
      FILE,
      `
      const Primary = { args: {} };
      export default { title: "X" };
      export { Primary };
      `,
    );
    expect(diagnostics).toEqual([]);
    expect(entries.map((entry) => entry.exportName)).toEqual(["Primary"]);
  });

  test("reports a diagnostic and skips the file without a default export", () => {
    const { entries, diagnostics } = indexStoryFile(FILE, `export const Primary = {};`);
    expect(entries).toEqual([]);
    expect(diagnostics[0]?.reason).toContain("missing default export meta");
  });

  test("reports non-object named exports instead of silently skipping", () => {
    const { entries, diagnostics } = indexStoryFile(
      FILE,
      `
      export default {};
      export function Template() {}
      export const NotAStory = 42;
      export const Fine = {};
      `,
    );
    expect(entries.map((entry) => entry.exportName)).toEqual(["Fine"]);
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0]?.reason).toContain('"Template"');
    expect(diagnostics[1]?.reason).toContain('"NotAStory"');
  });

  test("ignores type-only exports", () => {
    const { entries, diagnostics } = indexStoryFile(
      FILE,
      `
      export default {};
      export type Story = { a: 1 };
      type Local = { b: 2 };
      export type { Local };
      export const Real = {};
      `,
    );
    expect(diagnostics).toEqual([]);
    expect(entries.map((entry) => entry.exportName)).toEqual(["Real"]);
  });

  test("flags spread and non-literal titles with fallbacks", () => {
    const { entries, diagnostics } = indexStoryFile(
      FILE,
      `
      const base = {};
      const title = "Nope";
      export default { title, ...base };
      export const Primary = { ...base };
      `,
    );
    expect(entries[0]?.title).toBe("components/button");
    const reasons = diagnostics.map((diagnostic) => diagnostic.reason);
    expect(reasons.some((reason) => reason.includes("meta uses spread"))).toBe(true);
    expect(reasons.some((reason) => reason.includes("meta.title must be a string literal"))).toBe(
      true,
    );
    expect(reasons.some((reason) => reason.includes('story "Primary" uses spread'))).toBe(true);
  });
});
