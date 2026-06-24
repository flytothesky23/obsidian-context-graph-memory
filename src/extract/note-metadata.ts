import type { CachedMetadata, TFile } from "obsidian";
import type { ContextGraphMemorySettings } from "../types";
import {
  buildDataForgeCompatibilityReport,
  type DataForgeCompatibilityReport,
} from "./data-forge-adapter";
import {
  extractMarkdownStructure,
  type ExtractedHeading,
  type ExtractedMarkdownLink,
  type ExtractedTask,
  type ExtractedWikilink,
} from "./markdown-structure";
import {
  extractDataForgeFields,
  extractRelationFields,
  normalizeStringList,
  type ExtractedDataForgeFields,
  type ExtractedRelationFields,
} from "./relation-fields";

export interface ExtractedNoteMetadata {
  note: {
    id: string;
    path: string;
    title: string;
    basename: string;
    folder: string;
    ctime: number;
    mtime: number;
    hash: string;
  };
  frontmatter: Record<string, unknown>;
  tags: string[];
  wikilinks: ExtractedWikilink[];
  markdownLinks: ExtractedMarkdownLink[];
  headings: ExtractedHeading[];
  tasks: ExtractedTask[];
  relationFields: ExtractedRelationFields;
  dataForgeFields: ExtractedDataForgeFields;
}

export interface MetadataPreviewPayload {
  metadata: ExtractedNoteMetadata;
  summary: {
    tags: number;
    wikilinks: number;
    markdownLinks: number;
    headings: number;
    tasks: number;
    relationEdges: number;
    dataForgeFields: number;
  };
  dataForgeCompatibility: DataForgeCompatibilityReport;
}

export class NoteMetadataExtractor {
  extract(
    file: TFile,
    cache: CachedMetadata | null | undefined,
    content: string,
  ): ExtractedNoteMetadata {
    const frontmatter = resolveFrontmatter(cache?.frontmatter, content);
    const markdownStructure = extractMarkdownStructure(content);
    const headings = cache?.headings?.map((heading) => ({
      level: heading.level,
      text: heading.heading,
    })) ?? markdownStructure.headings;
    const tags = mergeTags(
      normalizeStringList(frontmatter.tags),
      cache?.tags?.map((tag) => tag.tag) ?? [],
      markdownStructure.inlineTags,
    );
    const wikilinks = cache?.links?.map((link) => ({
      raw: link.original,
      targetPath: link.link,
      display: link.displayText,
    })) ?? markdownStructure.wikilinks;
    const tasks = extractTasks(cache, content) ?? markdownStructure.tasks;

    return {
      note: {
        id: createNoteId(file.path),
        path: file.path,
        title: resolveTitle(frontmatter, headings, file.basename),
        basename: file.basename,
        folder: getFolder(file.path),
        ctime: file.stat.ctime,
        mtime: file.stat.mtime,
        hash: hashString(content),
      },
      frontmatter,
      tags,
      wikilinks,
      markdownLinks: markdownStructure.markdownLinks,
      headings,
      tasks,
      relationFields: extractRelationFields(frontmatter),
      dataForgeFields: extractDataForgeFields(frontmatter),
    };
  }
}

export function buildMetadataPreviewPayload(
  metadata: ExtractedNoteMetadata,
  dataForgeCompatibilityMode: ContextGraphMemorySettings["dataForgeCompatibilityMode"] = "frontmatter",
): MetadataPreviewPayload {
  return {
    metadata,
    summary: {
      tags: metadata.tags.length,
      wikilinks: metadata.wikilinks.length,
      markdownLinks: metadata.markdownLinks.length,
      headings: metadata.headings.length,
      tasks: metadata.tasks.length,
      relationEdges: Object.values(metadata.relationFields).reduce((total, values) => total + values.length, 0),
      dataForgeFields: Object.keys(metadata.dataForgeFields).length,
    },
    dataForgeCompatibility: buildDataForgeCompatibilityReport(metadata, dataForgeCompatibilityMode),
  };
}

function sanitizeFrontmatter(frontmatter: CachedMetadata["frontmatter"] | undefined): Record<string, unknown> {
  if (!frontmatter) {
    return {};
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(frontmatter)) {
    if (key !== "position") {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function resolveFrontmatter(
  cacheFrontmatter: CachedMetadata["frontmatter"] | undefined,
  content: string,
): Record<string, unknown> {
  const frontmatter = sanitizeFrontmatter(cacheFrontmatter);
  if (Object.keys(frontmatter).length > 0) {
    return frontmatter;
  }

  return parseFrontmatterFromContent(content);
}

function parseFrontmatterFromContent(content: string): Record<string, unknown> {
  const frontmatterText = getFrontmatterText(content);
  if (!frontmatterText) {
    return {};
  }

  return parseSimpleFrontmatter(frontmatterText);
}

function getFrontmatterText(content: string): string | null {
  const lines = content.split(/\r?\n/u);
  if (lines[0]?.trim() !== "---") {
    return null;
  }

  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "---") {
      return lines.slice(1, index).join("\n");
    }
  }

  return null;
}

function parseSimpleFrontmatter(frontmatterText: string): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {};
  let currentListKey: string | null = null;

  for (const line of frontmatterText.split(/\r?\n/u)) {
    if (line.trim().length === 0 || line.replace(/^\s+/u, "").startsWith("#")) {
      continue;
    }

    const listItemMatch = line.match(/^\s+-\s+(.+)$/u);
    if (listItemMatch && currentListKey) {
      const currentValue = frontmatter[currentListKey];
      const listValue = Array.isArray(currentValue) ? currentValue : [];
      listValue.push(parseScalar(listItemMatch[1]));
      frontmatter[currentListKey] = listValue;
      continue;
    }

    const propertyMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/u);
    if (!propertyMatch) {
      currentListKey = null;
      continue;
    }

    const [, key, rawValue] = propertyMatch;
    currentListKey = key;
    frontmatter[key] = rawValue.length > 0 ? parseScalar(rawValue) : [];
  }

  return frontmatter;
}

function parseScalar(rawValue: string): unknown {
  const value = rawValue.trim();

  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => parseScalar(item))
      .filter((item) => typeof item !== "string" || item.length > 0);
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  const numericValue = Number(value);
  if (value.length > 0 && Number.isFinite(numericValue)) {
    return numericValue;
  }

  return value;
}

function resolveTitle(
  frontmatter: Record<string, unknown>,
  headings: ExtractedHeading[],
  basename: string,
): string {
  if (typeof frontmatter.title === "string" && frontmatter.title.trim().length > 0) {
    return frontmatter.title.trim();
  }

  return headings.find((heading) => heading.level === 1)?.text ?? basename;
}

function mergeTags(...tagGroups: string[][]): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();

  for (const tagGroup of tagGroups) {
    for (const tag of tagGroup) {
      const normalized = normalizeTag(tag);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        tags.push(normalized);
      }
    }
  }

  return tags;
}

function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#+/u, "");
}

function extractTasks(cache: CachedMetadata | null | undefined, content: string): ExtractedTask[] | null {
  const taskItems = cache?.listItems?.filter((item) => item.task !== undefined);
  if (!taskItems || taskItems.length === 0) {
    return null;
  }

  const lines = content.split(/\r?\n/u);
  return taskItems.map((item) => {
    const line = lines[item.position.start.line] ?? "";
    const parsed = line.match(/^\s*[-*+]\s+\[([^\]])\]\s+(.*)$/u);

    return {
      checked: item.task !== " ",
      text: parsed?.[2]?.trim() ?? "",
    };
  });
}

function createNoteId(path: string): string {
  return `note:${hashString(path)}`;
}

function getFolder(path: string): string {
  const slashIndex = path.lastIndexOf("/");
  return slashIndex === -1 ? "" : path.slice(0, slashIndex);
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}
