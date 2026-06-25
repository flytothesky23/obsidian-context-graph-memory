import type { TFile } from "obsidian";
import { describe, expect, it } from "vitest";
import { DataForgeMetadataAdapter } from "./data-forge-adapter";
import { NoteMetadataExtractor } from "./note-metadata";

describe("DataForgeMetadataAdapter", () => {
  it("builds a compatibility report from a Data Forge sample note without runtime calls", () => {
    const metadata = new NoteMetadataExtractor().extract(
      createFile("Projects/Data Forge Sample.md", "Data Forge Sample", 1, 2),
      null,
      [
        "---",
        "title: Data Forge Sample",
        "source_context: brat-data-forge",
        "template_style_id: technical-brief",
        "quality_asset_profile: graph-memory",
        "exemplar_archetype: implementation-note",
        "project_name: OCGM",
        "doc_class: design-note",
        "source_uri: https://example.com/source",
        "source_hash: hash-123",
        "related:",
        "  - [[Alpha Note]]",
        "supports: Decision A; Decision B",
        "mentions_people:",
        "  - Ada Lovelace",
        "mentions_orgs: Neo4j, OpenAI",
        "mentions_systems: Obsidian",
        "mentions_projects: Context Graph Memory",
        "---",
        "# Data Forge Sample",
      ].join("\n"),
    );

    const report = new DataForgeMetadataAdapter().buildReport(metadata, "frontmatter");

    expect(report).toMatchObject({
      mode: "frontmatter",
      detected: true,
      runtimeRequired: false,
      dataForgeFieldCount: 8,
      relationCandidateCount: 8,
      warnings: [],
    });
    expect(report.fields.map((field) => field.name)).toEqual([
      "source_context",
      "template_style_id",
      "quality_asset_profile",
      "exemplar_archetype",
      "project_name",
      "doc_class",
      "source_uri",
      "source_hash",
    ]);
    expect(report.relationCandidates.map((candidate) => [
      candidate.field,
      candidate.relationshipType,
      candidate.name,
      candidate.conceptKind,
    ])).toEqual([
      ["related", "RELATED_TO", "Alpha Note", "concept"],
      ["supports", "SUPPORTS", "Decision A", "concept"],
      ["supports", "SUPPORTS", "Decision B", "concept"],
      ["mentions_people", "MENTIONS", "Ada Lovelace", "person"],
      ["mentions_orgs", "MENTIONS", "Neo4j", "organization"],
      ["mentions_orgs", "MENTIONS", "OpenAI", "organization"],
      ["mentions_systems", "MENTIONS", "Obsidian", "system"],
      ["mentions_projects", "MENTIONS", "Context Graph Memory", "project"],
    ]);
  });

  it("reports detected fields but suppresses Data Forge candidates when compatibility mode is off", () => {
    const metadata = new NoteMetadataExtractor().extract(
      createFile("Projects/Data Forge Off.md", "Data Forge Off", 1, 2),
      null,
      [
        "---",
        "source_context: data-forge",
        "related: Alpha",
        "---",
        "content",
      ].join("\n"),
    );

    const report = new DataForgeMetadataAdapter().buildReport(metadata, "off");

    expect(report.detected).toBe(true);
    expect(report.runtimeRequired).toBe(false);
    expect(report.relationCandidateCount).toBe(0);
    expect(report.relationCandidates).toEqual([]);
    expect(report.warnings).toEqual([
      "Data Forge 호환 프론트매터가 존재하지만 호환성 모드가 비활성입니다.",
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
