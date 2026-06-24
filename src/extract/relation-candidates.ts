import {
  RELATION_FIELD_NAMES,
  type ExtractedRelationFields,
  type RelationFieldName,
} from "./relation-fields";

export interface RelationCandidate {
  field: RelationFieldName;
  relationshipType: string;
  name: string;
  normalizedName: string;
  conceptKind: string;
}

export const RELATION_TYPE_BY_FIELD: Record<RelationFieldName, string> = {
  related: "RELATED_TO",
  supports: "SUPPORTS",
  depends_on: "DEPENDS_ON",
  part_of: "PART_OF",
  affects: "AFFECTS",
  evidenced_by: "EVIDENCED_BY",
  mentions_people: "MENTIONS",
  mentions_orgs: "MENTIONS",
  mentions_systems: "MENTIONS",
  mentions_projects: "MENTIONS",
};

export const CONCEPT_KIND_BY_FIELD: Record<RelationFieldName, string> = {
  related: "concept",
  supports: "concept",
  depends_on: "concept",
  part_of: "concept",
  affects: "concept",
  evidenced_by: "source",
  mentions_people: "person",
  mentions_orgs: "organization",
  mentions_systems: "system",
  mentions_projects: "project",
};

export function buildRelationCandidatesFromFields(
  relationFields: ExtractedRelationFields,
): RelationCandidate[] {
  const candidates: RelationCandidate[] = [];

  for (const field of RELATION_FIELD_NAMES) {
    for (const name of relationFields[field]) {
      candidates.push({
        field,
        relationshipType: RELATION_TYPE_BY_FIELD[field],
        name,
        normalizedName: normalizeConceptName(name),
        conceptKind: CONCEPT_KIND_BY_FIELD[field],
      });
    }
  }

  return candidates;
}

export function normalizeConceptName(name: string): string {
  return name.trim().replace(/\s+/gu, " ").toLowerCase();
}
