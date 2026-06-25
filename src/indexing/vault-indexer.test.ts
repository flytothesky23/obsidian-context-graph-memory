import type { App, CachedMetadata, TFile } from "obsidian";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../types";
import {
  ARCHIVE_NOTE_QUERY,
  CLEAR_DERIVED_RELATIONSHIPS_QUERY,
  UPSERT_LINKS_QUERY,
  UPSERT_NOTE_QUERY,
  UPSERT_TAGS_QUERY,
  VaultIndexer,
  buildRelationCandidates,
  buildRelationCandidateQuery,
  isMarkdownFile,
  type Neo4jQueryRunner,
} from "./vault-indexer";

describe("VaultIndexer", () => {
  it("indexes the active Markdown file into Note, Tag, LINKS_TO, and relation candidate writes", async () => {
    const file = createFile("Projects/A.md", "A");
    const calls: QueryCall[] = [];
    const app = createApp({
      activeFile: file,
      files: [file],
      contents: {
        "Projects/A.md": [
          "---",
          "title: A Title",
          "tags: [alpha]",
          "related: [[Concept A]]",
          "mentions_people:",
          "  - Ada",
          "---",
          "# A",
          "[[B]] #inline-tag",
        ].join("\n"),
      },
      caches: {
        "Projects/A.md": {
          frontmatter: {
            title: "A Title",
            tags: ["alpha"],
            related: "[[Concept A]]",
            mentions_people: ["Ada"],
          },
          links: [{ original: "[[B]]", link: "B" }],
        } as unknown as CachedMetadata,
      },
      resolvedLinks: {
        "Projects/A.md": {
          "Projects/B.md": 1,
        },
      },
      linkDestinations: {
        B: createFile("Projects/B.md", "B"),
      },
    });
    const indexer = new VaultIndexer(app, DEFAULT_SETTINGS, () => createRunner(calls));

    const report = await indexer.indexCurrentNote();

    expect(report.toSnapshot()).toMatchObject({ indexed: 1, failed: 0 });
    expect(calls.map((call) => call.cypher)).toEqual([
      UPSERT_NOTE_QUERY,
      CLEAR_DERIVED_RELATIONSHIPS_QUERY,
      UPSERT_TAGS_QUERY,
      UPSERT_LINKS_QUERY,
      buildRelationCandidateQuery("RELATED_TO"),
      buildRelationCandidateQuery("MENTIONS"),
    ]);
    expect(calls[0].parameters?.note).toMatchObject({
      path: "Projects/A.md",
      title: "A Title",
      folder: "Projects",
    });
    expect(calls[2].parameters).toEqual({ path: "Projects/A.md", tags: ["alpha", "inline-tag"] });
    expect(calls[3].parameters?.links).toEqual([
      {
        path: "Projects/B.md",
        id: expect.stringMatching(/^note:[a-f0-9]{8}$/u),
        title: "B",
        basename: "B",
        folder: "Projects",
        count: 1,
      },
    ]);
    expect(calls[4].parameters).toMatchObject({
      field: "related",
      name: "Concept A",
      normalizedName: "concept a",
      conceptKind: "concept",
    });
    expect(calls[5].parameters).toMatchObject({
      field: "mentions_people",
      name: "Ada",
      normalizedName: "ada",
      conceptKind: "person",
    });
  });

  it("skips unchanged content hashes unless forced", async () => {
    const file = createFile("A.md", "A");
    const calls: QueryCall[] = [];
    const app = createApp({
      activeFile: file,
      files: [file],
      contents: { "A.md": "# A" },
    });
    const indexer = new VaultIndexer(app, DEFAULT_SETTINGS, () => createRunner(calls));

    await indexer.indexCurrentNote();
    const secondReport = await indexer.indexCurrentNote();

    expect(secondReport.toSnapshot()).toMatchObject({ skipped: 1, indexed: 0 });
  });

  it("indexes the vault with folder and tag filters", async () => {
    const included = createFile("Projects/A.md", "A");
    const excluded = createFile("Archive/B.md", "B");
    const calls: QueryCall[] = [];
    const app = createApp({
      files: [included, excluded],
      contents: {
        "Projects/A.md": "---\ntags: [keep]\n---\n# A",
        "Archive/B.md": "---\ntags: [keep]\n---\n# B",
      },
    });
    const indexer = new VaultIndexer(
      app,
      { ...DEFAULT_SETTINGS, includeFolders: ["Projects"], includeTags: ["keep"] },
      () => createRunner(calls),
    );

    const report = await indexer.indexVault();

    expect(report.toSnapshot()).toMatchObject({ indexed: 1, skipped: 1 });
  });

  it("indexes only Markdown files under the requested folder", async () => {
    const direct = createFile("Projects/A.md", "A");
    const nested = createFile("Projects/Nested/B.md", "B");
    const outside = createFile("Archive/C.md", "C");
    const calls: QueryCall[] = [];
    const app = createApp({
      files: [direct, nested, outside],
      contents: {
        "Projects/A.md": "# A",
        "Projects/Nested/B.md": "# B",
        "Archive/C.md": "# C",
      },
    });
    const indexer = new VaultIndexer(app, DEFAULT_SETTINGS, () => createRunner(calls));

    const report = await indexer.indexFolder("Projects", true);

    expect(report.toSnapshot()).toMatchObject({ attempted: 2, indexed: 2, skipped: 0 });
    expect(calls.filter((call) => call.cypher === UPSERT_NOTE_QUERY).map((call) => call.parameters?.note)).toEqual([
      expect.objectContaining({ path: "Projects/A.md" }),
      expect.objectContaining({ path: "Projects/Nested/B.md" }),
    ]);
  });

  it("processes rename and delete queue items by archiving old paths", async () => {
    const file = createFile("New.md", "New");
    const calls: QueryCall[] = [];
    const app = createApp({
      files: [file],
      contents: { "New.md": "# New" },
    });
    const indexer = new VaultIndexer(app, DEFAULT_SETTINGS, () => createRunner(calls));

    const report = await indexer.processQueueItems([
      { action: "rename", file, path: "New.md", oldPath: "Old.md", reason: "rename" },
      { action: "delete", path: "Deleted.md", reason: "delete" },
    ]);

    expect(report.toSnapshot()).toMatchObject({ archived: 2, indexed: 1 });
    expect(calls.filter((call) => call.cypher === ARCHIVE_NOTE_QUERY).map((call) => call.parameters?.path)).toEqual([
      "Old.md",
      "Deleted.md",
    ]);
  });

  it("identifies Markdown files structurally", () => {
    expect(isMarkdownFile(createFile("A.md", "A"))).toBe(true);
    expect(isMarkdownFile({ path: "A.pdf", name: "A.pdf" } as never)).toBe(false);
  });
});

describe("relation candidates", () => {
  it("maps relation fields to fixed relationship types", () => {
    const candidates = buildRelationCandidates({
      relationFields: {
        related: ["A"],
        supports: [],
        depends_on: [],
        part_of: [],
        affects: [],
        evidenced_by: [],
        mentions_people: ["Ada"],
        mentions_orgs: [],
        mentions_systems: [],
        mentions_projects: [],
      },
    } as never);

    expect(candidates).toEqual([
      {
        field: "related",
        relationshipType: "RELATED_TO",
        name: "A",
        normalizedName: "a",
        conceptKind: "concept",
      },
      {
        field: "mentions_people",
        relationshipType: "MENTIONS",
        name: "Ada",
        normalizedName: "ada",
        conceptKind: "person",
      },
    ]);
  });
});

interface QueryCall {
  cypher: string;
  parameters?: Record<string, unknown>;
}

function createRunner(calls: QueryCall[]): Neo4jQueryRunner {
  return {
    run: async (cypher, parameters) => {
      calls.push({ cypher, parameters });
      return { records: 0 };
    },
    close: async () => undefined,
  };
}

function createApp(options: {
  activeFile?: TFile | null;
  files: TFile[];
  contents: Record<string, string>;
  caches?: Record<string, CachedMetadata>;
  resolvedLinks?: Record<string, Record<string, number>>;
  linkDestinations?: Record<string, TFile>;
}): App {
  return {
    workspace: {
      getActiveFile: () => options.activeFile ?? null,
    },
    vault: {
      getMarkdownFiles: () => options.files,
      cachedRead: async (file: TFile) => options.contents[file.path] ?? "",
    },
    metadataCache: {
      getFileCache: (file: TFile) => options.caches?.[file.path] ?? null,
      resolvedLinks: options.resolvedLinks ?? {},
      getFirstLinkpathDest: (linkpath: string) => options.linkDestinations?.[linkpath] ?? null,
    },
  } as unknown as App;
}

function createFile(path: string, basename: string): TFile {
  return {
    path,
    name: `${basename}.md`,
    basename,
    extension: "md",
    stat: {
      ctime: 1,
      mtime: 2,
      size: 3,
    },
  } as TFile;
}
