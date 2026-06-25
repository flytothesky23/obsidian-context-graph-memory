import { describe, expect, it } from "vitest";
import type { ExtractedNoteMetadata } from "../extract/note-metadata";
import { DEFAULT_SETTINGS, type ContextGraphMemorySettings } from "../types";
import {
  buildSemanticRelationUpsertParameters,
  buildSemanticRelationUpsertQuery,
  FrontmatterSemanticEnrichmentAdapter,
  SemanticEnrichmentService,
  type SemanticEnrichmentRunner,
} from "./semantic-enrichment";

const MANUAL_SETTINGS: ContextGraphMemorySettings = {
  ...DEFAULT_SETTINGS,
  semanticEnrichmentMode: "manual",
};

describe("semantic enrichment", () => {
  it("builds manual frontmatter candidates with provenance and normalized relation types", () => {
    const metadata = createMetadata({
      ocgm_semantic_candidates: [
        {
          relation: "supports",
          target: "[[Graph Decision]]",
          kind: "Decision",
          confidence: "0.82",
          origin: "data-forge",
          source_uri: "obsidian://data-forge/sample",
          source_hash: "hash-123",
          reason: "Evidence supports this decision with token=secret-value.",
          evidence: "A reviewed paragraph.",
        },
        {
          relation: "mentions_people",
          target: "Ada Lovelace",
          reason: "Mentioned in the implementation context.",
        },
      ],
    });

    const candidates = new FrontmatterSemanticEnrichmentAdapter().buildCandidates(metadata);

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      relationshipType: "SUPPORTS",
      targetName: "Graph Decision",
      normalizedTargetName: "graph decision",
      conceptKind: "decision",
      confidence: 0.82,
      reason: "Evidence supports this decision with token=[마스킹]",
      provenance: {
        source: "manual-frontmatter",
        origin: "data-forge",
        adapterId: "manual-frontmatter",
        sourcePath: "Projects/Semantic Source.md",
        sourceField: "ocgm_semantic_candidates",
        sourceUri: "obsidian://data-forge/sample",
        sourceHash: "hash-123",
        evidence: "A reviewed paragraph.",
      },
    });
    expect(candidates[1]).toMatchObject({
      relationshipType: "MENTIONS",
      targetName: "Ada Lovelace",
      conceptKind: "person",
    });
  });

  it("parses JSON candidate frontmatter strings", () => {
    const metadata = createMetadata({
      semantic_enrichment_candidates: JSON.stringify([
        {
          relationshipType: "DEPENDS_ON",
          targetName: "Neo4j Schema",
          provider: "codex-cli",
          confidence: 2,
        },
      ]),
    });

    const preview = new SemanticEnrichmentService(MANUAL_SETTINGS).buildPreview(metadata);

    expect(preview.candidates).toHaveLength(1);
    expect(preview.candidates[0]).toMatchObject({
      relationshipType: "DEPENDS_ON",
      targetName: "Neo4j Schema",
      confidence: 1,
      conceptKind: "concept",
      provenance: {
        origin: "codex-cli",
      },
    });
  });

  it("does not build candidates when semantic enrichment mode is off", () => {
    const metadata = createMetadata({
      ocgm_semantic_candidates: [
        {
          relation: "related",
          target: "Alpha",
        },
      ],
    });

    const preview = new SemanticEnrichmentService(DEFAULT_SETTINGS).buildPreview(metadata);

    expect(preview.mode).toBe("off");
    expect(preview.candidates).toEqual([]);
    expect(preview.warnings).toEqual([
      "시맨틱 보강이 비활성 상태입니다. 승인하려면 수동 모드를 켜세요.",
    ]);
  });

  it("does not call Neo4j when no candidates are approved", async () => {
    let called = false;
    const service = new SemanticEnrichmentService(MANUAL_SETTINGS, undefined, () => ({
      run: async () => {
        called = true;
        return { records: 0 };
      },
    }));

    await expect(service.approveCandidates([])).resolves.toEqual({
      attempted: 0,
      approved: 0,
      skipped: 0,
    });
    expect(called).toBe(false);
  });

  it("saves only the approved candidates and closes the runner", async () => {
    const metadata = createMetadata({
      ocgm_semantic_candidates: [
        {
          relation: "related",
          target: "Alpha",
          reason: "Approved relation.",
        },
        {
          relation: "supports",
          target: "Beta",
          reason: "Unapproved relation.",
        },
      ],
    });
    const preview = new SemanticEnrichmentService(MANUAL_SETTINGS).buildPreview(metadata);
    const calls: Array<{ cypher: string; parameters?: Record<string, unknown> }> = [];
    const closeCalls: string[] = [];
    const runner: SemanticEnrichmentRunner = {
      run: async (cypher, parameters) => {
        calls.push({ cypher, parameters });
        return { records: 1 };
      },
      close: async () => {
        closeCalls.push("closed");
      },
    };
    const service = new SemanticEnrichmentService(MANUAL_SETTINGS, undefined, () => runner);

    const report = await service.approveCandidates(
      [preview.candidates[0]],
      "2026-06-24T00:00:00.000Z",
    );

    expect(report).toEqual({ attempted: 1, approved: 1, skipped: 0 });
    expect(calls).toHaveLength(1);
    expect(calls[0].cypher).toContain("MERGE (source)-[relation:RELATED_TO]->(target)");
    expect(calls[0].cypher).toContain("relation.origin = $candidate.provenance.origin");
    expect(calls[0].parameters).toEqual(
      buildSemanticRelationUpsertParameters(preview.candidates[0], "2026-06-24T00:00:00.000Z"),
    );
    expect(calls[0].parameters).not.toEqual(
      buildSemanticRelationUpsertParameters(preview.candidates[1], "2026-06-24T00:00:00.000Z"),
    );
    expect(closeCalls).toEqual(["closed"]);
  });

  it("rejects unsupported dynamic relationship types", () => {
    expect(() => buildSemanticRelationUpsertQuery("DETACH_DELETE" as never)).toThrow(
      "지원하지 않는 시맨틱 관계 유형입니다: DETACH_DELETE",
    );
  });
});

function createMetadata(frontmatter: Record<string, unknown>): ExtractedNoteMetadata {
  return {
    note: {
      id: "note:semantic",
      path: "Projects/Semantic Source.md",
      title: "Semantic Source",
      basename: "Semantic Source",
      folder: "Projects",
      ctime: 1,
      mtime: 2,
      hash: "abc123",
    },
    frontmatter,
    tags: [],
    wikilinks: [],
    markdownLinks: [],
    headings: [],
    tasks: [],
    relationFields: {
      related: [],
      supports: [],
      depends_on: [],
      part_of: [],
      affects: [],
      evidenced_by: [],
      mentions_people: [],
      mentions_orgs: [],
      mentions_systems: [],
      mentions_projects: [],
    },
    dataForgeFields: {},
  };
}
