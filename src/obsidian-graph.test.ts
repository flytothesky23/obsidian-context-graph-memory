import { describe, expect, it } from "vitest";
import {
  buildFolderLocalGraphViewState,
  buildNoteLocalGraphViewState,
  buildRawFolderGraphScopeContent,
  RAW_FOLDER_GRAPH_SCOPE_PATH,
  selectFolderMarkdownFiles,
} from "./obsidian-graph";

describe("Obsidian raw folder graph helpers", () => {
  it("selects only markdown files in the requested folder recursively", () => {
    const files = [
      fakeFile("Projects/Neo4j/A.md"),
      fakeFile("Projects/Neo4j/Sub/B.md"),
      fakeFile("Projects/Other/C.md"),
      fakeFile(RAW_FOLDER_GRAPH_SCOPE_PATH),
    ];

    expect(selectFolderMarkdownFiles(files, "Projects/Neo4j", true).map((file) => file.path)).toEqual([
      "Projects/Neo4j/A.md",
      "Projects/Neo4j/Sub/B.md",
    ]);
  });

  it("can select only direct folder children", () => {
    const files = [fakeFile("Projects/Neo4j/A.md"), fakeFile("Projects/Neo4j/Sub/B.md")];

    expect(selectFolderMarkdownFiles(files, "Projects/Neo4j", false).map((file) => file.path)).toEqual([
      "Projects/Neo4j/A.md",
    ]);
  });

  it("builds a scope note that links folder notes", () => {
    const content = buildRawFolderGraphScopeContent("21_업무노트/정보기술/neo4j", [
      fakeFile("21_업무노트/정보기술/neo4j/01 현재 상태.md"),
      fakeFile("21_업무노트/정보기술/neo4j/PRD/기획.md"),
    ]);

    expect(content).toContain("ocgm_kind: raw-folder-local-graph-scope");
    expect(content).toContain('source_folder: "21_업무노트/정보기술/neo4j"');
    expect(content).toContain("[[21_업무노트/정보기술/neo4j/01 현재 상태|01 현재 상태]]");
    expect(content).toContain("[[21_업무노트/정보기술/neo4j/PRD/기획|기획]]");
  });

  it("opens a localgraph view for the generated scope note", () => {
    const state = buildFolderLocalGraphViewState(RAW_FOLDER_GRAPH_SCOPE_PATH, {
      type: "localgraph",
      state: {
        options: {
          localJumps: 2,
          showTags: true,
        },
      },
    });

    expect(state).toMatchObject({
      type: "localgraph",
      active: true,
      state: {
        file: RAW_FOLDER_GRAPH_SCOPE_PATH,
        options: {
          localJumps: 1,
          localForelinks: true,
          localInterlinks: true,
          showTags: false,
          hideUnresolved: true,
        },
      },
    });
  });

  it("opens a localgraph view for the clicked note", () => {
    const state = buildNoteLocalGraphViewState("Projects/Neo4j/A.md");

    expect(state).toMatchObject({
      type: "localgraph",
      active: true,
      state: {
        file: "Projects/Neo4j/A.md",
        options: {
          search: "",
          localJumps: 1,
          localBacklinks: true,
          localForelinks: true,
          localInterlinks: true,
        },
      },
    });
  });
});

function fakeFile(path: string): Pick<import("obsidian").TFile, "basename" | "path"> & import("obsidian").TFile {
  const name = path.split("/").pop() ?? path;
  return {
    basename: name.replace(/\.md$/iu, ""),
    path,
  } as Pick<import("obsidian").TFile, "basename" | "path"> & import("obsidian").TFile;
}
