import type { CachedMetadata, TFile } from "obsidian";
import { describe, expect, it } from "vitest";
import { buildMetadataPreviewPayload, NoteMetadataExtractor } from "./note-metadata";

describe("NoteMetadataExtractor", () => {
  it("combines TFile facts, metadata cache, markdown body, relation fields, and Data Forge fields", () => {
    const file = createFile("Projects/Graph/Test Note.md", "Test Note", 1000, 2000);
    const content = [
      "---",
      "title: Body title ignored by cache fixture",
      "---",
      "# Body Heading",
      "See [[Ignored Parsed Link]] and [Spec](https://example.com/spec). #body-tag",
      "- [ ] Body task",
    ].join("\n");
    const cache = {
      frontmatter: {
        title: "Frontmatter Title",
        tags: ["frontmatter-tag", "#shared"],
        related: ["[[Related Note]]", "Plain relation"],
        supports: "Support A, Support B",
        mentions_people: ["Ada"],
        source_context: "ingest",
        template_style_id: "technical-brief",
        project_name: "Context Graph",
        position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 2, col: 0, offset: 20 } },
      },
      tags: [{ tag: "#cache-tag" }, { tag: "#shared" }],
      links: [{ original: "[[Cached Link|Cached]]", link: "Cached Link", displayText: "Cached" }],
      headings: [{ heading: "Cached Heading", level: 2 }],
      listItems: [
        {
          task: " ",
          parent: -5,
          position: { start: { line: 5, col: 0, offset: 0 }, end: { line: 5, col: 15, offset: 15 } },
        },
      ],
    } as unknown as CachedMetadata;

    const metadata = new NoteMetadataExtractor().extract(file, cache, content);

    expect(metadata.note).toMatchObject({
      id: expect.stringMatching(/^note:[a-f0-9]{8}$/u),
      path: "Projects/Graph/Test Note.md",
      title: "Frontmatter Title",
      basename: "Test Note",
      folder: "Projects/Graph",
      ctime: 1000,
      mtime: 2000,
      hash: expect.stringMatching(/^[a-f0-9]{8}$/u),
    });
    expect(metadata.frontmatter).not.toHaveProperty("position");
    expect(metadata.tags).toEqual(["frontmatter-tag", "shared", "cache-tag", "body-tag"]);
    expect(metadata.wikilinks).toEqual([
      { raw: "[[Cached Link|Cached]]", targetPath: "Cached Link", display: "Cached" },
    ]);
    expect(metadata.markdownLinks).toEqual([{ text: "Spec", href: "https://example.com/spec" }]);
    expect(metadata.headings).toEqual([{ level: 2, text: "Cached Heading" }]);
    expect(metadata.tasks).toEqual([{ checked: false, text: "Body task" }]);
    expect(metadata.relationFields.related).toEqual(["Related Note", "Plain relation"]);
    expect(metadata.relationFields.supports).toEqual(["Support A", "Support B"]);
    expect(metadata.relationFields.mentions_people).toEqual(["Ada"]);
    expect(metadata.dataForgeFields).toEqual({
      source_context: "ingest",
      template_style_id: "technical-brief",
      project_name: "Context Graph",
    });
  });

  it("uses first H1 before basename when frontmatter title is absent", () => {
    const metadata = new NoteMetadataExtractor().extract(
      createFile("Root Note.md", "Root Note", 1, 2),
      null,
      "# Heading Title\ncontent",
    );

    expect(metadata.note.title).toBe("Heading Title");
    expect(metadata.note.folder).toBe("");
  });

  it("ignores non-H1 headings for title fallback", () => {
    const metadata = new NoteMetadataExtractor().extract(
      createFile("Heading Note.md", "Heading Note", 1, 2),
      { headings: [{ heading: "Section Heading", level: 2 }] } as CachedMetadata,
      "## Section Heading\ncontent",
    );

    expect(metadata.note.title).toBe("Heading Note");
  });

  it("falls back to body frontmatter when metadata cache frontmatter is unavailable", () => {
    const metadata = new NoteMetadataExtractor().extract(
      createFile("Data Forge.md", "Data Forge", 1, 2),
      null,
      [
        "---",
        "title: Parsed Frontmatter Title",
        "tags:",
        "  - parsed-tag",
        "related:",
        "  - [[Parsed Relation]]",
        "source_context: ingest",
        "source_hash: abc123",
        "---",
        "content #inline",
      ].join("\n"),
    );

    expect(metadata.note.title).toBe("Parsed Frontmatter Title");
    expect(metadata.tags).toEqual(["parsed-tag", "inline"]);
    expect(metadata.relationFields.related).toEqual(["Parsed Relation"]);
    expect(metadata.dataForgeFields).toEqual({
      source_context: "ingest",
      source_hash: "abc123",
    });
  });

  it("builds a compact metadata preview summary", () => {
    const metadata = new NoteMetadataExtractor().extract(
      createFile("Project.md", "Project", 1, 2),
      { frontmatter: { related: ["A", "B"], supports: "Decision", source_hash: "hash" } } as unknown as CachedMetadata,
      "# Project\n[[A]]\n- [x] Task\n#tag",
    );
    const payload = buildMetadataPreviewPayload(metadata);

    expect(payload.summary).toEqual({
      tags: 1,
      wikilinks: 1,
      markdownLinks: 0,
      headings: 1,
      tasks: 1,
      relationEdges: 3,
      dataForgeFields: 1,
    });
    expect(payload.dataForgeCompatibility).toMatchObject({
      mode: "frontmatter",
      detected: true,
      runtimeRequired: false,
      dataForgeFieldCount: 1,
      relationCandidateCount: 3,
    });
    expect(payload.dataForgeCompatibility.relationCandidates.map((candidate) => candidate.field)).toEqual([
      "related",
      "related",
      "supports",
    ]);
  });
});

function createFile(path: string, basename: string, ctime: number, mtime: number): TFile {
  return {
    path,
    name: `${basename}.md`,
    basename,
    extension: "md",
    stat: {
      ctime,
      mtime,
      size: 123,
    },
  } as TFile;
}
