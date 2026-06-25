import { describe, expect, it } from "vitest";
import { buildFolderGraphSearch, buildFolderGraphViewState } from "./obsidian-graph";

describe("Obsidian graph helpers", () => {
  it("builds a path search for a folder graph", () => {
    expect(buildFolderGraphSearch("21_업무노트/정보기술/neo4j")).toBe('path:"21_업무노트/정보기술/neo4j/"');
  });

  it("trims extra slashes from folder graph paths", () => {
    expect(buildFolderGraphSearch("/Projects/Neo4j/")).toBe('path:"Projects/Neo4j/"');
  });

  it("keeps root folder graph searches empty", () => {
    expect(buildFolderGraphSearch("/")).toBe("");
  });

  it("preserves existing graph options while applying folder search", () => {
    const state = buildFolderGraphViewState("Projects/Neo4j", {
      type: "graph",
      state: {
        options: {
          localJumps: 2,
          showTags: true,
        },
      },
    });

    expect(state).toEqual({
      type: "graph",
      active: true,
      state: {
        options: {
          localJumps: 2,
          showTags: true,
          "collapse-filter": false,
          search: 'path:"Projects/Neo4j/"',
        },
      },
    });
  });
});
