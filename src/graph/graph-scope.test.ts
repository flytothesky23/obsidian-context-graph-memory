import type { TAbstractFile } from "obsidian";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../types";
import { createFolderGraphScope, createNoteGraphScope, createSelectionGraphScope, isFolder } from "./graph-scope";

describe("graph scopes", () => {
  it("creates a note graph scope from settings limits", () => {
    const scope = createNoteGraphScope("Projects/A.md", {
      ...DEFAULT_SETTINGS,
      maxGraphDepth: 3,
      maxGraphNodes: 50,
    });

    expect(scope).toEqual({
      type: "note",
      path: "Projects/A.md",
      depth: 3,
      maxNodes: 50,
    });
  });

  it("creates a folder graph scope with recursive and bridge settings", () => {
    const scope = createFolderGraphScope("Projects/", {
      ...DEFAULT_SETTINGS,
      folderGraphRecursive: false,
      folderGraphIncludeExternalBridges: false,
      maxGraphNodes: 25,
    });

    expect(scope).toEqual({
      type: "folder",
      path: "Projects",
      recursive: false,
      includeExternalBridges: false,
      maxNodes: 25,
    });
  });

  it("creates a deduplicated selection graph scope", () => {
    const scope = createSelectionGraphScope(["A.md", "B.md", "A.md", ""], DEFAULT_SETTINGS);

    expect(scope.paths).toEqual(["A.md", "B.md"]);
  });

  it("identifies folders structurally", () => {
    expect(isFolder({ path: "Projects", name: "Projects", children: [] } as unknown as TAbstractFile)).toBe(true);
    expect(isFolder({ path: "A.md", name: "A.md" } as TAbstractFile)).toBe(false);
  });
});
