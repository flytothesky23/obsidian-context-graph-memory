import type { ViewState, WorkspaceLeaf } from "obsidian";

export const OBSIDIAN_LOCAL_GRAPH_COMMAND_IDS = ["graph:open-local", "graph:open-local-graph", "graph:open"] as const;

export const OBSIDIAN_GLOBAL_GRAPH_COMMAND_IDS = ["graph:open"] as const;

export function buildFolderGraphSearch(folderPath: string): string {
  const normalized = normalizeFolderPath(folderPath);

  if (normalized.length === 0) {
    return "";
  }

  return `path:"${escapeGraphSearchValue(`${normalized}/`)}"`;
}

export function buildFolderGraphViewState(folderPath: string, currentViewState?: ViewState): ViewState {
  const currentState = currentViewState?.type === "graph" ? currentViewState.state ?? {} : {};
  const currentOptions = isRecord(currentState.options) ? currentState.options : {};

  return {
    type: "graph",
    state: {
      ...currentState,
      options: {
        ...currentOptions,
        "collapse-filter": false,
        search: buildFolderGraphSearch(folderPath),
      },
    },
    active: true,
  };
}

export function getExistingGraphLeaf(leaves: WorkspaceLeaf[]): WorkspaceLeaf | undefined {
  return leaves.find((leaf) => leaf.getViewState().type === "graph");
}

function normalizeFolderPath(folderPath: string): string {
  return folderPath.replace(/^\/+|\/+$/gu, "");
}

function escapeGraphSearchValue(value: string): string {
  return value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
