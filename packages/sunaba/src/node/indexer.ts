import { readFile } from "node:fs/promises";
import { parseSync } from "oxc-parser";
import { glob } from "tinyglobby";
import { deriveTitle, makeStoryId } from "../protocol/story-id.ts";
import type { IndexDiagnostic, StoryIndexEntry } from "../protocol/types.ts";

/**
 * Static story indexer. Never executes user code: it reads literal fields
 * (title / name / tags) and export shapes from the AST. Non-literal values and
 * unsupported shapes produce diagnostics instead of silent breakage; deep
 * information (resolved args) comes from the running stage instead.
 */

type AstNode = { type: string } & Record<string, unknown>;

const isNode = (value: unknown): value is AstNode =>
  typeof value === "object" && value !== null && "type" in value;

const asNodes = (value: unknown): AstNode[] => (Array.isArray(value) ? value.filter(isNode) : []);

/** Unwraps `satisfies` / `as` / parenthesized wrappers around an expression. */
const unwrapExpression = (node: AstNode): AstNode => {
  let current = node;
  while (
    (current.type === "TSSatisfiesExpression" ||
      current.type === "TSAsExpression" ||
      current.type === "ParenthesizedExpression") &&
    isNode(current["expression"])
  ) {
    current = current["expression"];
  }
  return current;
};

const stringValue = (node: unknown): string | undefined => {
  if (isNode(node) && node.type === "Literal" && typeof node["value"] === "string") {
    return node["value"];
  }
  return undefined;
};

type ObjectShape = {
  properties: Map<string, AstNode>;
  hasSpread: boolean;
  hasNonLiteralKey: boolean;
};

const readObject = (node: AstNode): ObjectShape => {
  const shape: ObjectShape = {
    properties: new Map(),
    hasSpread: false,
    hasNonLiteralKey: false,
  };
  for (const property of asNodes(node["properties"])) {
    if (property.type === "SpreadElement") {
      shape.hasSpread = true;
      continue;
    }
    if (property.type !== "Property") {
      continue;
    }
    const key = property["key"];
    const name = isNode(key)
      ? key.type === "Identifier" && typeof key["name"] === "string"
        ? key["name"]
        : stringValue(key)
      : undefined;
    if (name === undefined) {
      shape.hasNonLiteralKey = true;
      continue;
    }
    const value = property["value"];
    if (isNode(value)) {
      shape.properties.set(name, value);
    }
  }
  return shape;
};

const readStringArray = (node: AstNode | undefined): string[] => {
  if (node === undefined || node.type !== "ArrayExpression") {
    return [];
  }
  const items: string[] = [];
  for (const element of asNodes(node["elements"])) {
    const value = stringValue(element);
    if (value !== undefined) {
      items.push(value);
    }
  }
  return items;
};

export type IndexedFile = {
  entries: StoryIndexEntry[];
  diagnostics: IndexDiagnostic[];
};

/** Indexes one story file. `file` is the project-root-relative posix path. */
export const indexStoryFile = (file: string, code: string): IndexedFile => {
  const diagnostics: IndexDiagnostic[] = [];
  const entries: StoryIndexEntry[] = [];
  const result = parseSync(file, code);
  if (result.errors.length > 0) {
    const [first] = result.errors;
    diagnostics.push({
      file,
      reason: `parse error: ${first?.message ?? "unknown"}`,
    });
    return { entries, diagnostics };
  }

  const body = asNodes((result.program as unknown as AstNode)["body"]);
  const variables = new Map<string, AstNode>();
  let metaNode: AstNode | undefined;
  type NamedExport = { exportName: string; init: AstNode };
  const namedExports: NamedExport[] = [];

  const collectDeclarators = (
    declaration: AstNode,
    onEntry: (name: string, init: AstNode) => void,
  ): void => {
    for (const declarator of asNodes(declaration["declarations"])) {
      const id = declarator["id"];
      const init = declarator["init"];
      if (
        isNode(id) &&
        id.type === "Identifier" &&
        typeof id["name"] === "string" &&
        isNode(init)
      ) {
        onEntry(id["name"], unwrapExpression(init));
      }
    }
  };

  for (const node of body) {
    if (node.type === "VariableDeclaration") {
      collectDeclarators(node, (name, init) => variables.set(name, init));
    } else if (node.type === "ExportDefaultDeclaration") {
      const declaration = node["declaration"];
      if (isNode(declaration)) {
        const unwrapped = unwrapExpression(declaration);
        metaNode =
          unwrapped.type === "Identifier" && typeof unwrapped["name"] === "string"
            ? variables.get(unwrapped["name"])
            : unwrapped;
      }
    } else if (node.type === "ExportNamedDeclaration") {
      if (node["exportKind"] === "type") {
        continue;
      }
      const declaration = node["declaration"];
      if (isNode(declaration) && declaration.type === "VariableDeclaration") {
        collectDeclarators(declaration, (name, init) => {
          variables.set(name, init);
          namedExports.push({ exportName: name, init });
        });
      } else if (isNode(declaration)) {
        // FunctionDeclaration / ClassDeclaration etc. — CSF2-style exports.
        const id = declaration["id"];
        const name = isNode(id) && typeof id["name"] === "string" ? id["name"] : "?";
        diagnostics.push({
          file,
          reason: `export "${name}" is not an object literal story (CSF2-style exports are unsupported; write CSF3 objects)`,
        });
      } else {
        for (const specifier of asNodes(node["specifiers"])) {
          if (specifier["exportKind"] === "type") {
            continue;
          }
          const local = specifier["local"];
          const exported = specifier["exported"];
          const localName = isNode(local) ? local["name"] : undefined;
          const exportedName = isNode(exported) ? exported["name"] : undefined;
          if (typeof localName !== "string" || typeof exportedName !== "string") {
            continue;
          }
          const init = variables.get(localName);
          if (init === undefined) {
            diagnostics.push({
              file,
              reason: `export "${exportedName}" could not be resolved to a local object literal`,
            });
          } else {
            namedExports.push({ exportName: exportedName, init });
          }
        }
      }
    }
  }

  if (metaNode === undefined || metaNode.type !== "ObjectExpression") {
    diagnostics.push({
      file,
      reason: "missing default export meta object (CSF3 requires `export default { ... }`)",
    });
    return { entries, diagnostics };
  }

  const meta = readObject(metaNode);
  if (meta.hasSpread) {
    diagnostics.push({
      file,
      reason: "meta uses spread; literal fields under the spread are invisible to the indexer",
    });
  }
  const metaTitleNode = meta.properties.get("title");
  let title = deriveTitle(file);
  if (metaTitleNode !== undefined) {
    const literal = stringValue(metaTitleNode);
    if (literal === undefined) {
      diagnostics.push({
        file,
        reason: "meta.title must be a string literal; falling back to the derived title",
      });
    } else {
      title = literal;
    }
  }
  const metaTags = readStringArray(meta.properties.get("tags"));

  for (const { exportName, init } of namedExports) {
    if (init.type !== "ObjectExpression") {
      diagnostics.push({
        file,
        reason: `export "${exportName}" is not an object literal story (every non-type named export must be a story)`,
      });
      continue;
    }
    const story = readObject(init);
    if (story.hasSpread) {
      diagnostics.push({
        file,
        reason: `story "${exportName}" uses spread; literal fields under the spread are invisible to the indexer`,
      });
    }
    let name = exportName;
    const nameNode = story.properties.get("name");
    if (nameNode !== undefined) {
      const literal = stringValue(nameNode);
      if (literal === undefined) {
        diagnostics.push({
          file,
          reason: `story "${exportName}" has a non-literal name; using the export name`,
        });
      } else {
        name = literal;
      }
    }
    const entry: StoryIndexEntry = {
      id: makeStoryId(file, exportName),
      title,
      name,
      exportName,
      file,
      tags: [...metaTags, ...readStringArray(story.properties.get("tags"))],
    };
    if (story.properties.has("play")) {
      entry.hasPlay = true;
    }
    entries.push(entry);
  }

  return { entries, diagnostics };
};

export type BuildIndexResult = {
  entries: StoryIndexEntry[];
  diagnostics: IndexDiagnostic[];
};

export const buildIndex = async (root: string, globs: string[]): Promise<BuildIndexResult> => {
  const files = await glob(globs, { cwd: root, onlyFiles: true });
  const entries: StoryIndexEntry[] = [];
  const diagnostics: IndexDiagnostic[] = [];
  for (const file of files.toSorted()) {
    const code = await readFile(`${root}/${file}`, "utf8");
    const indexed = indexStoryFile(file, code);
    entries.push(...indexed.entries);
    diagnostics.push(...indexed.diagnostics);
  }
  return { entries, diagnostics };
};
