import type { TAbstractFile, TFolder } from "obsidian";
import type { ContextGraphMemorySettings } from "../types";

export type GraphScope = NoteGraphScope | FolderGraphScope | SelectionGraphScope;

export interface NoteGraphScope {
  type: "note";
  path: string;
  depth: number;
  maxNodes: number;
}

export interface FolderGraphScope {
  type: "folder";
  path: string;
  recursive: boolean;
  includeExternalBridges: boolean;
  maxNodes: number;
}

export interface SelectionGraphScope {
  type: "selection";
  paths: string[];
  includeExternalBridges: boolean;
  maxNodes: number;
}

export interface GraphNode {
  id: string;
  labels: string[];
  kind: string;
  label: string;
  path?: string;
  title?: string;
  scopeRole?: GraphNodeScopeRole;
  properties: Record<string, unknown>;
}

export type GraphNodeScopeRole = "folder-internal" | "external-bridge";

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface FolderGraphSummaryNode {
  id: string;
  label: string;
  path?: string;
  degree: number;
  internalDegree: number;
  bridgeDegree: number;
}

export interface FolderGraphSummary {
  totalInternalNotes: number;
  displayedInternalNotes: number;
  isolatedInternalNotes: number;
  internalEdges: number;
  internalLinks: number;
  bridgeEdges: number;
  displayedExternalBridgeNodes: number;
  displayedExternalBridgeNotes: number;
  totalExternalBridgeNodes: number;
  centralNotes: FolderGraphSummaryNode[];
  isolatedNotes: FolderGraphSummaryNode[];
  externalBridgeNotes: FolderGraphSummaryNode[];
  truncationReason?: string;
}

export interface GraphSummary {
  scopeType: GraphScope["type"];
  targetPath?: string;
  depth?: number;
  maxNodes: number;
  nodeCount: number;
  edgeCount: number;
  truncated: boolean;
  folderRecursive?: boolean;
  folderExternalBridges?: boolean;
  folder?: FolderGraphSummary;
  warnings: string[];
}

export interface GraphResult {
  scope: GraphScope;
  nodes: GraphNode[];
  edges: GraphEdge[];
  summary: GraphSummary;
}

export function createNoteGraphScope(path: string, settings: ContextGraphMemorySettings): NoteGraphScope {
  return {
    type: "note",
    path,
    depth: clampPositiveInteger(settings.maxGraphDepth, 1, 5),
    maxNodes: clampPositiveInteger(settings.maxGraphNodes, 1, 1000),
  };
}

export function createFolderGraphScope(path: string, settings: ContextGraphMemorySettings): FolderGraphScope {
  return {
    type: "folder",
    path: normalizeFolderPath(path),
    recursive: settings.folderGraphRecursive,
    includeExternalBridges: settings.folderGraphIncludeExternalBridges,
    maxNodes: clampPositiveInteger(settings.maxGraphNodes, 1, 1000),
  };
}

export function createSelectionGraphScope(paths: string[], settings: ContextGraphMemorySettings): SelectionGraphScope {
  return {
    type: "selection",
    paths: [...new Set(paths.filter((path) => path.trim().length > 0))],
    includeExternalBridges: settings.folderGraphIncludeExternalBridges,
    maxNodes: clampPositiveInteger(settings.maxGraphNodes, 1, 1000),
  };
}

export function isFolder(file: TAbstractFile | null | undefined): file is TFolder {
  return Boolean(file && "children" in file);
}

function normalizeFolderPath(path: string): string {
  return path.replace(/\/+$/u, "");
}

function clampPositiveInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(Math.trunc(value), min), max);
}
