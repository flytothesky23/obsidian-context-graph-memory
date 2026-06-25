import type { ContextGraphMemorySettings } from "../types";
import type { ExtractedNoteMetadata } from "./note-metadata";
import {
  DATA_FORGE_FIELD_NAMES,
  RELATION_FIELD_NAMES,
  type DataForgeFieldName,
  type RelationFieldName,
} from "./relation-fields";
import {
  buildRelationCandidatesFromFields,
  type RelationCandidate,
} from "./relation-candidates";

export type DataForgeCompatibilityMode = ContextGraphMemorySettings["dataForgeCompatibilityMode"];

export interface DataForgeFieldEntry {
  name: DataForgeFieldName;
  value: unknown;
}

export interface DataForgeRelationFieldEntry {
  name: RelationFieldName;
  count: number;
}

export interface DataForgeCompatibilityReport {
  mode: DataForgeCompatibilityMode;
  detected: boolean;
  runtimeRequired: false;
  dataForgeFieldCount: number;
  relationFieldCount: number;
  relationCandidateCount: number;
  fields: DataForgeFieldEntry[];
  relationFields: DataForgeRelationFieldEntry[];
  missingDataForgeFields: DataForgeFieldName[];
  relationCandidates: RelationCandidate[];
  warnings: string[];
}

export class DataForgeMetadataAdapter {
  buildReport(
    metadata: ExtractedNoteMetadata,
    mode: DataForgeCompatibilityMode = "frontmatter",
  ): DataForgeCompatibilityReport {
    const fields = DATA_FORGE_FIELD_NAMES
      .filter((fieldName) => metadata.dataForgeFields[fieldName] !== undefined)
      .map((fieldName) => ({
        name: fieldName,
        value: metadata.dataForgeFields[fieldName],
      }));
    const relationFields = RELATION_FIELD_NAMES
      .map((fieldName) => ({
        name: fieldName,
        count: metadata.relationFields[fieldName].length,
      }))
      .filter((field) => field.count > 0);
    const relationCandidates = mode === "frontmatter"
      ? buildRelationCandidatesFromFields(metadata.relationFields)
      : [];
    const detected = fields.length > 0 || relationFields.length > 0;

    return {
      mode,
      detected,
      runtimeRequired: false,
      dataForgeFieldCount: fields.length,
      relationFieldCount: relationFields.reduce((total, field) => total + field.count, 0),
      relationCandidateCount: relationCandidates.length,
      fields,
      relationFields,
      missingDataForgeFields: DATA_FORGE_FIELD_NAMES.filter(
        (fieldName) => metadata.dataForgeFields[fieldName] === undefined,
      ),
      relationCandidates,
      warnings: buildWarnings(mode, detected),
    };
  }
}

export function buildDataForgeCompatibilityReport(
  metadata: ExtractedNoteMetadata,
  mode: DataForgeCompatibilityMode = "frontmatter",
): DataForgeCompatibilityReport {
  return new DataForgeMetadataAdapter().buildReport(metadata, mode);
}

function buildWarnings(mode: DataForgeCompatibilityMode, detected: boolean): string[] {
  if (mode === "off" && detected) {
    return ["Data Forge 호환 프론트매터가 존재하지만 호환성 모드가 비활성입니다."];
  }

  if (mode === "frontmatter" && !detected) {
    return ["Data Forge 호환 프론트매터 항목을 찾지 못했습니다."];
  }

  return [];
}
