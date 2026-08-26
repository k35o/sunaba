import type { StoryId } from "./types.ts";

/**
 * Builds the canonical story id from a project-root-relative posix path and an
 * export name. The file path must not contain `:` so the id stays splittable.
 */
export const makeStoryId = (file: string, exportName: string): StoryId => {
  if (file.includes(":")) {
    throw new Error(`Story file path must not contain ":": ${file}`);
  }
  return `${file}:${exportName}`;
};

export const parseStoryId = (id: StoryId): { file: string; exportName: string } => {
  const separator = id.lastIndexOf(":");
  if (separator <= 0 || separator === id.length - 1) {
    throw new Error(`Invalid story id: ${id}`);
  }
  return {
    file: id.slice(0, separator),
    exportName: id.slice(separator + 1),
  };
};

const STORY_FILE_PATTERN = /\.stories\.[jt]sx?$/;

/**
 * Derives a catalog title from a story file path when `meta.title` is absent:
 * strip the extension, drop a leading `src/`, and collapse the file segment
 * when it repeats its directory name.
 * `src/components/form/password-input/password-input.stories.tsx`
 * → `components/form/password-input`
 */
export const deriveTitle = (file: string): string => {
  const withoutExtension = file.replace(STORY_FILE_PATTERN, "");
  const segments = withoutExtension.split("/");
  if (segments[0] === "src") {
    segments.shift();
  }
  const leaf = segments.at(-1);
  const parent = segments.at(-2);
  if (leaf !== undefined && parent !== undefined && leaf === parent) {
    segments.pop();
  }
  return segments.join("/");
};
