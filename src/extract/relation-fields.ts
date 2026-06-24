export const RELATION_FIELD_NAMES = [
  "related",
  "supports",
  "depends_on",
  "part_of",
  "affects",
  "evidenced_by",
  "mentions_people",
  "mentions_orgs",
  "mentions_systems",
  "mentions_projects",
] as const;

export const DATA_FORGE_FIELD_NAMES = [
  "source_context",
  "template_style_id",
  "quality_asset_profile",
  "exemplar_archetype",
  "project_name",
  "doc_class",
  "source_uri",
  "source_hash",
] as const;

export type RelationFieldName = (typeof RELATION_FIELD_NAMES)[number];
export type DataForgeFieldName = (typeof DATA_FORGE_FIELD_NAMES)[number];

export type ExtractedRelationFields = Record<RelationFieldName, string[]>;
export type ExtractedDataForgeFields = Partial<Record<DataForgeFieldName, unknown>>;

export const RELATION_FIELD_ALIASES: Record<RelationFieldName, readonly string[]> = {
  related: ["related", "related_note", "related_notes", "relations"],
  supports: ["supports", "support", "supporting"],
  depends_on: ["depends_on", "depends", "dependencies"],
  part_of: ["part_of", "parent", "parent_project"],
  affects: ["affects", "impact", "impacts"],
  evidenced_by: ["evidenced_by", "evidence", "sources"],
  mentions_people: ["mentions_people", "mentions_person", "mentions_persons", "mentions_people_names"],
  mentions_orgs: ["mentions_orgs", "mentions_org", "mentions_organization", "mentions_organizations"],
  mentions_systems: ["mentions_systems", "mentions_system", "mentions_tool", "mentions_tools"],
  mentions_projects: ["mentions_projects", "mentions_project", "project_mentions"],
};

export function extractRelationFields(frontmatter: Record<string, unknown>): ExtractedRelationFields {
  const relationFields = createEmptyRelationFields();

  for (const fieldName of RELATION_FIELD_NAMES) {
    relationFields[fieldName] = normalizeFieldAliases(frontmatter, RELATION_FIELD_ALIASES[fieldName]);
  }

  return relationFields;
}

export function extractDataForgeFields(frontmatter: Record<string, unknown>): ExtractedDataForgeFields {
  const dataForgeFields: ExtractedDataForgeFields = {};

  for (const fieldName of DATA_FORGE_FIELD_NAMES) {
    const value = frontmatter[fieldName];
    if (!isEmptyValue(value)) {
      dataForgeFields[fieldName] = value;
    }
  }

  return dataForgeFields;
}

export function normalizeStringList(value: unknown): string[] {
  const values = collectStringValues(value);
  return uniquePreserveOrder(values.map(normalizeRelationToken).filter((item) => item.length > 0));
}

function createEmptyRelationFields(): ExtractedRelationFields {
  return RELATION_FIELD_NAMES.reduce((accumulator, fieldName) => {
    accumulator[fieldName] = [];
    return accumulator;
  }, {} as ExtractedRelationFields);
}

function collectStringValues(value: unknown): string[] {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    const values: string[] = [];
    for (const item of value) {
      values.push(...collectStringValues(item));
    }
    return values;
  }

  if (typeof value === "string") {
    return value.split(/[\n,;]/u);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }

  return [];
}

function normalizeFieldAliases(
  frontmatter: Record<string, unknown>,
  aliases: readonly string[],
): string[] {
  const values: string[] = [];

  for (const alias of aliases) {
    values.push(...normalizeStringList(frontmatter[alias]));
  }

  return uniquePreserveOrder(values);
}

function normalizeRelationToken(value: string): string {
  const trimmed = value.trim();
  const wikiMatch = trimmed.match(/^!?\[\[([^\]]+)\]\]$/u);

  if (!wikiMatch) {
    return trimmed;
  }

  const [target, display] = wikiMatch[1].split("|").map((part) => part.trim());
  return display || target || "";
}

function uniquePreserveOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }

  return result;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return false;
}
