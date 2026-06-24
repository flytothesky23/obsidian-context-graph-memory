import type { TFile } from "obsidian";
import { Neo4jClient, type Neo4jQueryResult, type QueryParameters } from "../neo4j/client";
import type { ContextGraphMemorySettings } from "../types";

export const MEMORY_TYPES = ["Preference", "Rule", "Decision"] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

export interface MemorySourceNote {
  id: string;
  path: string;
  title: string;
  basename: string;
  folder: string;
}

export interface MemoryPromotionInput {
  type: MemoryType;
  text: string;
  source: MemorySourceNote;
  createdAt?: string;
}

export interface PromotedMemory {
  id: string;
  type: MemoryType;
  text: string;
  source: MemorySourceNote;
  createdAt: string;
  properties: Record<string, unknown>;
}

export interface MemoryPromotionRunner {
  run(cypher: string, parameters?: QueryParameters): Promise<Neo4jQueryResult>;
  close?(): Promise<void>;
}

export type MemoryPromotionRunnerFactory = () => MemoryPromotionRunner;

export class MemoryPromotionService {
  constructor(
    private readonly settings: ContextGraphMemorySettings,
    private readonly createRunner: MemoryPromotionRunnerFactory = () => new Neo4jClient(settings),
  ) {}

  async promote(input: MemoryPromotionInput): Promise<PromotedMemory> {
    const memory = buildPromotedMemory(input);
    const runner = this.createRunner();

    try {
      await runner.run(buildMemoryUpsertQuery(memory.type), buildMemoryUpsertParameters(memory));
      return memory;
    } finally {
      await runner.close?.();
    }
  }
}

export function buildPromotedMemory(input: MemoryPromotionInput): PromotedMemory {
  const text = normalizeSelectedText(input.text);
  if (text.length === 0) {
    throw new Error("Cannot promote empty selection.");
  }

  const createdAt = input.createdAt ?? new Date().toISOString();

  return {
    id: createMemoryId(input.type, input.source.path, text, createdAt),
    type: input.type,
    text,
    source: input.source,
    createdAt,
    properties: buildTypeProperties(input.type, createdAt),
  };
}

export function buildMemorySourceFromFile(file: TFile): MemorySourceNote {
  return {
    id: createNoteIdFromPath(file.path),
    path: file.path,
    title: file.basename,
    basename: file.basename,
    folder: getFolder(file.path),
  };
}

export function buildMemoryUpsertQuery(type: MemoryType): string {
  const label = memoryTypeToLabel(type);

  return `
MERGE (source:Note {path: $source.path})
ON CREATE SET source.id = $source.id,
              source.title = $source.title,
              source.basename = $source.basename,
              source.folder = $source.folder,
              source.archived = false
SET source.title = coalesce(source.title, $source.title),
    source.basename = coalesce(source.basename, $source.basename),
    source.folder = coalesce(source.folder, $source.folder)
MERGE (memory:Memory:${label} {id: $memory.id})
SET memory.type = $memory.type,
    memory.text = $memory.text,
    memory.sourcePath = $source.path,
    memory.sourceTitle = $source.title,
    memory.createdAt = datetime($memory.createdAt),
    memory.updatedAt = datetime()
SET memory += $memory.properties
MERGE (memory)-[recorded:RECORDED_IN]->(source)
SET recorded.createdAt = datetime($memory.createdAt)
`;
}

export function buildMemoryUpsertParameters(memory: PromotedMemory): QueryParameters {
  return {
    memory: {
      id: memory.id,
      type: memory.type,
      text: memory.text,
      createdAt: memory.createdAt,
      properties: memory.properties,
    },
    source: memory.source,
  };
}

export function normalizeSelectedText(text: string): string {
  return text.replace(/\r\n?/gu, "\n").trim();
}

function buildTypeProperties(type: MemoryType, createdAt: string): Record<string, unknown> {
  const date = createdAt.slice(0, 10);

  if (type === "Preference") {
    return { category: "explicit", confidence: 1 };
  }

  if (type === "Rule") {
    return { scope: "explicit" };
  }

  return { date, status: "active" };
}

function memoryTypeToLabel(type: MemoryType): MemoryType {
  if (!MEMORY_TYPES.includes(type)) {
    throw new Error(`Unsupported memory type: ${type}`);
  }

  return type;
}

function createMemoryId(type: MemoryType, sourcePath: string, text: string, createdAt: string): string {
  return `memory:${type.toLowerCase()}:${hashString(`${type}\n${sourcePath}\n${createdAt}\n${text}`)}`;
}

function createNoteIdFromPath(path: string): string {
  return `note:${hashString(path)}`;
}

function getFolder(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

function hashString(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(16);
}
