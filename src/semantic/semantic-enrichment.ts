import { Neo4jClient, type Neo4jQueryResult, type QueryParameters } from "../neo4j/client";
import type { ContextGraphMemorySettings } from "../types";
import type { ExtractedNoteMetadata } from "../extract/note-metadata";
import { normalizeStringList, type RelationFieldName } from "../extract/relation-fields";

export const SEMANTIC_ENRICHMENT_FRONTMATTER_FIELDS = [
  "ocgm_semantic_candidates",
  "semantic_enrichment_candidates",
] as const;

export const SEMANTIC_RELATION_TYPES = [
  "RELATED_TO",
  "SUPPORTS",
  "DEPENDS_ON",
  "PART_OF",
  "AFFECTS",
  "EVIDENCED_BY",
  "MENTIONS",
] as const;

export type SemanticRelationType = (typeof SEMANTIC_RELATION_TYPES)[number];
export type SemanticEnrichmentMode = ContextGraphMemorySettings["semanticEnrichmentMode"];
export type SemanticCandidateOrigin = "manual" | "data-forge" | "codexian" | "codex-cli" | "unknown";

export interface SemanticEnrichmentSourceNote {
  id: string;
  path: string;
  title: string;
  basename: string;
  folder: string;
  ctime: number;
  mtime: number;
  hash: string;
}

export interface SemanticEnrichmentProvenance {
  source: "manual-frontmatter";
  origin: SemanticCandidateOrigin;
  adapterId: string;
  sourcePath: string;
  sourceField: string;
  sourceUri?: string;
  sourceHash?: string;
  evidence?: string;
}

export interface SemanticEnrichmentCandidate {
  id: string;
  source: SemanticEnrichmentSourceNote;
  relationshipType: SemanticRelationType;
  targetName: string;
  normalizedTargetName: string;
  conceptKind: string;
  reason: string;
  confidence: number;
  provenance: SemanticEnrichmentProvenance;
}

export interface SemanticEnrichmentPreview {
  mode: SemanticEnrichmentMode;
  adapterId: string;
  source: SemanticEnrichmentSourceNote;
  candidates: SemanticEnrichmentCandidate[];
  warnings: string[];
}

export interface SemanticEnrichmentApprovalReport {
  attempted: number;
  approved: number;
  skipped: number;
}

export interface SemanticEnrichmentAdapter {
  id: string;
  buildCandidates(metadata: ExtractedNoteMetadata): SemanticEnrichmentCandidate[];
}

export interface SemanticEnrichmentRunner {
  run(cypher: string, parameters?: QueryParameters): Promise<Neo4jQueryResult>;
  close?(): Promise<void>;
}

export type SemanticEnrichmentRunnerFactory = () => SemanticEnrichmentRunner;

export class FrontmatterSemanticEnrichmentAdapter implements SemanticEnrichmentAdapter {
  readonly id = "manual-frontmatter";

  buildCandidates(metadata: ExtractedNoteMetadata): SemanticEnrichmentCandidate[] {
    const candidates: SemanticEnrichmentCandidate[] = [];
    const seen = new Set<string>();
    const source = buildSemanticSourceNote(metadata);

    for (const sourceField of SEMANTIC_ENRICHMENT_FRONTMATTER_FIELDS) {
      const rawEntries = collectCandidateEntries(metadata.frontmatter[sourceField]);

      for (const rawEntry of rawEntries) {
        const candidate = buildCandidateFromEntry(rawEntry, source, sourceField, this.id);
        if (!candidate) {
          continue;
        }

        const key = [
          candidate.relationshipType,
          candidate.normalizedTargetName,
          candidate.conceptKind,
          candidate.reason,
        ].join("\u0000");
        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        candidates.push(candidate);
      }
    }

    return candidates;
  }
}

export class SemanticEnrichmentService {
  constructor(
    private readonly settings: ContextGraphMemorySettings,
    private readonly adapter: SemanticEnrichmentAdapter = new FrontmatterSemanticEnrichmentAdapter(),
    private readonly createRunner: SemanticEnrichmentRunnerFactory = () => new Neo4jClient(settings),
  ) {}

  buildPreview(metadata: ExtractedNoteMetadata): SemanticEnrichmentPreview {
    const source = buildSemanticSourceNote(metadata);
    const warnings: string[] = [];

    if (this.settings.semanticEnrichmentMode !== "manual") {
      warnings.push("Semantic enrichment mode is off. Enable manual mode before approving candidates.");
      return {
        mode: this.settings.semanticEnrichmentMode,
        adapterId: this.adapter.id,
        source,
        candidates: [],
        warnings,
      };
    }

    const candidates = this.adapter.buildCandidates(metadata);
    if (candidates.length === 0) {
      warnings.push("No manual semantic enrichment candidates were found in frontmatter.");
    }

    return {
      mode: this.settings.semanticEnrichmentMode,
      adapterId: this.adapter.id,
      source,
      candidates,
      warnings,
    };
  }

  async approveCandidates(
    candidates: readonly SemanticEnrichmentCandidate[],
    approvedAt = new Date().toISOString(),
  ): Promise<SemanticEnrichmentApprovalReport> {
    if (this.settings.semanticEnrichmentMode !== "manual") {
      throw new Error("Semantic enrichment approval requires manual mode.");
    }

    if (candidates.length === 0) {
      return { attempted: 0, approved: 0, skipped: 0 };
    }

    const runner = this.createRunner();
    let approved = 0;

    try {
      for (const candidate of candidates) {
        await runner.run(
          buildSemanticRelationUpsertQuery(candidate.relationshipType),
          buildSemanticRelationUpsertParameters(candidate, approvedAt),
        );
        approved += 1;
      }
    } finally {
      await runner.close?.();
    }

    return {
      attempted: candidates.length,
      approved,
      skipped: candidates.length - approved,
    };
  }
}

export function buildSemanticRelationUpsertQuery(relationshipType: SemanticRelationType): string {
  assertSemanticRelationType(relationshipType);

  return `
MERGE (source:Note {path: $source.path})
ON CREATE SET source.id = $source.id,
              source.title = $source.title,
              source.basename = $source.basename,
              source.folder = $source.folder,
              source.ctime = $source.ctime,
              source.mtime = $source.mtime,
              source.hash = $source.hash,
              source.archived = false
SET source.title = coalesce(source.title, $source.title),
    source.basename = coalesce(source.basename, $source.basename),
    source.folder = coalesce(source.folder, $source.folder),
    source.semanticEnrichedAt = datetime($approvedAt)
MERGE (target:Concept {normalizedName: $target.normalizedName})
ON CREATE SET target.name = $target.name,
              target.kind = $target.kind,
              target.source = 'semantic-enrichment'
SET target.name = coalesce(target.name, $target.name),
    target.kind = coalesce(target.kind, $target.kind),
    target.lastSeenAt = datetime()
MERGE (source)-[relation:${relationshipType}]->(target)
SET relation.source = 'semantic-enrichment',
    relation.approved = true,
    relation.candidate = false,
    relation.candidateId = $candidate.id,
    relation.reason = $candidate.reason,
    relation.confidence = $candidate.confidence,
    relation.adapterId = $candidate.provenance.adapterId,
    relation.origin = $candidate.provenance.origin,
    relation.sourceField = $candidate.provenance.sourceField,
    relation.sourceUri = $candidate.provenance.sourceUri,
    relation.sourceHash = $candidate.provenance.sourceHash,
    relation.evidence = $candidate.provenance.evidence,
    relation.approvedAt = datetime($approvedAt),
    relation.updatedAt = datetime()
`;
}

export function buildSemanticRelationUpsertParameters(
  candidate: SemanticEnrichmentCandidate,
  approvedAt: string,
): QueryParameters {
  return {
    approvedAt,
    source: candidate.source,
    target: {
      name: candidate.targetName,
      normalizedName: candidate.normalizedTargetName,
      kind: candidate.conceptKind,
    },
    candidate: {
      id: candidate.id,
      reason: candidate.reason,
      confidence: candidate.confidence,
      provenance: candidate.provenance,
    },
  };
}

export function buildSemanticSourceNote(metadata: ExtractedNoteMetadata): SemanticEnrichmentSourceNote {
  return {
    id: metadata.note.id,
    path: metadata.note.path,
    title: metadata.note.title,
    basename: metadata.note.basename,
    folder: metadata.note.folder,
    ctime: metadata.note.ctime,
    mtime: metadata.note.mtime,
    hash: metadata.note.hash,
  };
}

function buildCandidateFromEntry(
  entry: Record<string, unknown>,
  source: SemanticEnrichmentSourceNote,
  sourceField: string,
  adapterId: string,
): SemanticEnrichmentCandidate | null {
  const relationshipType = normalizeSemanticRelationType(
    firstDefined(entry.relationshipType, entry.relationship_type, entry.relation, entry.type, entry.field),
  );
  const targetName = normalizeStringList(firstDefined(entry.targetName, entry.target, entry.name, entry.to))[0];

  if (!relationshipType || !targetName) {
    return null;
  }

  const relationField = normalizeRelationField(firstDefined(entry.field, entry.relation));
  const conceptKind = normalizeConceptKind(
    firstDefined(entry.conceptKind, entry.targetKind, entry.kind),
    relationshipType,
    relationField,
  );
  const reason = sanitizeSemanticText(
    stringValue(firstDefined(entry.reason, entry.rationale, entry.summary)) ??
      `Manual semantic enrichment candidate from ${sourceField}.`,
  );
  const evidence = sanitizeOptionalText(firstDefined(entry.evidence, entry.quote, entry.sourceText));
  const origin = normalizeCandidateOrigin(
    firstDefined(entry.origin, entry.provider, entry.sourceSystem, entry.source_system, entry.source),
  );
  const sourceUri = sanitizeOptionalText(firstDefined(entry.sourceUri, entry.source_uri, entry.uri));
  const sourceHash = sanitizeOptionalText(firstDefined(entry.sourceHash, entry.source_hash, entry.hash));
  const confidence = normalizeConfidence(firstDefined(entry.confidence, entry.score));

  return {
    id: createCandidateId(source.path, relationshipType, targetName, reason, sourceField, origin),
    source,
    relationshipType,
    targetName,
    normalizedTargetName: normalizeConceptName(targetName),
    conceptKind,
    reason,
    confidence,
    provenance: {
      source: "manual-frontmatter",
      origin,
      adapterId,
      sourcePath: source.path,
      sourceField,
      ...(sourceUri ? { sourceUri } : {}),
      ...(sourceHash ? { sourceHash } : {}),
      ...(evidence ? { evidence } : {}),
    },
  };
}

function collectCandidateEntries(value: unknown): Array<Record<string, unknown>> {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    const entries: Array<Record<string, unknown>> = [];
    for (const item of value) {
      entries.push(...collectCandidateEntries(item));
    }
    return entries;
  }

  if (typeof value === "string") {
    const parsed = parseJsonCandidateValue(value);
    return parsed ? collectCandidateEntries(parsed) : [];
  }

  if (isRecord(value)) {
    if (Array.isArray(value.candidates)) {
      return collectCandidateEntries(value.candidates);
    }

    return [value];
  }

  return [];
}

function parseJsonCandidateValue(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function normalizeSemanticRelationType(value: unknown): SemanticRelationType | null {
  const raw = stringValue(value);
  if (!raw) {
    return null;
  }

  const key = raw.trim().replace(/[\s-]+/gu, "_").toLowerCase();
  const relationType = RELATION_TYPE_ALIASES[key] ?? RELATION_TYPE_ALIASES[key.toUpperCase()];
  return relationType ?? null;
}

function normalizeRelationField(value: unknown): RelationFieldName | null {
  const raw = stringValue(value);
  if (!raw) {
    return null;
  }

  const key = raw.trim().replace(/[\s-]+/gu, "_").toLowerCase();
  return RELATION_FIELD_KIND[key]?.field ?? null;
}

function normalizeConceptKind(
  value: unknown,
  relationshipType: SemanticRelationType,
  relationField: RelationFieldName | null,
): string {
  const raw = stringValue(value);
  if (raw) {
    return raw.trim().replace(/\s+/gu, "-").toLowerCase();
  }

  if (relationField) {
    return RELATION_FIELD_KIND[relationField].kind;
  }

  return relationshipType === "EVIDENCED_BY" ? "source" : "concept";
}

function normalizeConfidence(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampConfidence(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return clampConfidence(parsed);
    }
  }

  return 0.5;
}

function normalizeCandidateOrigin(value: unknown): SemanticCandidateOrigin {
  const raw = stringValue(value);
  if (!raw) {
    return "manual";
  }

  const key = raw.trim().replace(/[\s_]+/gu, "-").toLowerCase();
  return CANDIDATE_ORIGIN_ALIASES[key] ?? "unknown";
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function sanitizeOptionalText(value: unknown): string | undefined {
  const text = stringValue(value);
  return text ? sanitizeSemanticText(text) : undefined;
}

export function sanitizeSemanticText(value: string): string {
  return value
    .replace(/(password|token|secret|credential|auth)\s*[:=]\s*[^,\s;]+/giu, "$1=[redacted]")
    .replace(/\b(ghp|github_pat|sk)-[A-Za-z0-9_\-]{12,}\b/gu, "[redacted-token]")
    .trim();
}

function assertSemanticRelationType(value: string): asserts value is SemanticRelationType {
  if (!SEMANTIC_RELATION_TYPES.includes(value as SemanticRelationType)) {
    throw new Error(`Unsupported semantic relation type: ${value}`);
  }
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null);
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeConceptName(name: string): string {
  return name.trim().replace(/\s+/gu, " ").toLowerCase();
}

function createCandidateId(
  sourcePath: string,
  relationshipType: SemanticRelationType,
  targetName: string,
  reason: string,
  sourceField: string,
  origin: SemanticCandidateOrigin,
): string {
  return `semantic:${hashString(`${sourcePath}\n${relationshipType}\n${targetName}\n${sourceField}\n${origin}\n${reason}`)}`;
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

const RELATION_TYPE_ALIASES: Record<string, SemanticRelationType> = {
  RELATED_TO: "RELATED_TO",
  SUPPORTS: "SUPPORTS",
  DEPENDS_ON: "DEPENDS_ON",
  PART_OF: "PART_OF",
  AFFECTS: "AFFECTS",
  EVIDENCED_BY: "EVIDENCED_BY",
  MENTIONS: "MENTIONS",
  related: "RELATED_TO",
  related_to: "RELATED_TO",
  supports: "SUPPORTS",
  support: "SUPPORTS",
  depends_on: "DEPENDS_ON",
  depends: "DEPENDS_ON",
  dependency: "DEPENDS_ON",
  part_of: "PART_OF",
  parent: "PART_OF",
  affects: "AFFECTS",
  impact: "AFFECTS",
  evidenced_by: "EVIDENCED_BY",
  evidence: "EVIDENCED_BY",
  mentions: "MENTIONS",
  mentions_people: "MENTIONS",
  mentions_person: "MENTIONS",
  mentions_orgs: "MENTIONS",
  mentions_org: "MENTIONS",
  mentions_systems: "MENTIONS",
  mentions_system: "MENTIONS",
  mentions_projects: "MENTIONS",
  mentions_project: "MENTIONS",
};

const CANDIDATE_ORIGIN_ALIASES: Record<string, SemanticCandidateOrigin> = {
  manual: "manual",
  frontmatter: "manual",
  "manual-frontmatter": "manual",
  "data-forge": "data-forge",
  dataforge: "data-forge",
  "flytothesky-data-forge": "data-forge",
  codexian: "codexian",
  "codex-cli": "codex-cli",
  codex: "codex-cli",
  cli: "codex-cli",
};

const RELATION_FIELD_KIND: Record<string, { field: RelationFieldName; kind: string }> = {
  related: { field: "related", kind: "concept" },
  related_to: { field: "related", kind: "concept" },
  supports: { field: "supports", kind: "concept" },
  support: { field: "supports", kind: "concept" },
  depends_on: { field: "depends_on", kind: "concept" },
  depends: { field: "depends_on", kind: "concept" },
  part_of: { field: "part_of", kind: "concept" },
  affects: { field: "affects", kind: "concept" },
  evidenced_by: { field: "evidenced_by", kind: "source" },
  evidence: { field: "evidenced_by", kind: "source" },
  mentions_people: { field: "mentions_people", kind: "person" },
  mentions_person: { field: "mentions_people", kind: "person" },
  mentions_orgs: { field: "mentions_orgs", kind: "organization" },
  mentions_org: { field: "mentions_orgs", kind: "organization" },
  mentions_organization: { field: "mentions_orgs", kind: "organization" },
  mentions_organizations: { field: "mentions_orgs", kind: "organization" },
  mentions_systems: { field: "mentions_systems", kind: "system" },
  mentions_system: { field: "mentions_systems", kind: "system" },
  mentions_projects: { field: "mentions_projects", kind: "project" },
  mentions_project: { field: "mentions_projects", kind: "project" },
};
