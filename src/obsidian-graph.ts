import type { TAbstractFile, TFile, TFolder, Vault, ViewState, WorkspaceLeaf } from "obsidian";

export const RAW_FOLDER_GRAPH_SCOPE_PATH = "00_System/Context Graph Memory/Raw Folder Local Graph.md";

export function selectFolderMarkdownFiles(
  files: TFile[],
  folderPath: string,
  recursive: boolean,
  scopePath = RAW_FOLDER_GRAPH_SCOPE_PATH,
): TFile[] {
  const normalizedFolderPath = normalizeFolderPath(folderPath);

  return files
    .filter((file) => file.path !== scopePath)
    .filter((file) => isPathInFolder(file.path, normalizedFolderPath, recursive))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function buildRawFolderGraphScopeContent(folderPath: string, files: Pick<TFile, "basename" | "path">[]): string {
  const normalizedFolderPath = normalizeFolderPath(folderPath);
  const title = normalizedFolderPath.length > 0 ? normalizedFolderPath : "Vault root";
  const links = files.map((file) => `- [[${escapeWikilinkPart(stripMarkdownExtension(file.path))}|${escapeWikilinkPart(file.basename)}]]`);

  return [
    "---",
    "ocgm_generated: true",
    "ocgm_kind: raw-folder-local-graph-scope",
    `source_folder: ${quoteYamlString(normalizedFolderPath)}`,
    `note_count: ${files.length}`,
    "---",
    "",
    `# Raw folder local graph scope - ${title}`,
    "",
    "이 노트는 폴더 단위 Obsidian Raw local graph를 열기 위한 생성 스코프입니다.",
    "직접 편집하지 마세요. 폴더 우클릭 메뉴를 실행할 때 다시 생성됩니다.",
    "",
    "## Folder notes",
    "",
    ...(links.length > 0 ? links : ["- 폴더 안에 Markdown 노트가 없습니다."]),
    "",
  ].join("\n");
}

export function buildFolderLocalGraphViewState(scopeFilePath: string, currentViewState?: ViewState): ViewState {
  return buildLocalGraphViewState(scopeFilePath, currentViewState, {
    localJumps: 1,
    localBacklinks: false,
    localForelinks: true,
    localInterlinks: true,
    showTags: false,
    showAttachments: false,
    hideUnresolved: true,
  });
}

export function buildNoteLocalGraphViewState(filePath: string, currentViewState?: ViewState): ViewState {
  return buildLocalGraphViewState(filePath, currentViewState, {
    localJumps: 1,
    localBacklinks: true,
    localForelinks: true,
    localInterlinks: true,
  });
}

function buildLocalGraphViewState(
  filePath: string,
  currentViewState: ViewState | undefined,
  options: Record<string, unknown>,
): ViewState {
  const currentState = currentViewState?.type === "localgraph" ? currentViewState.state ?? {} : {};
  const currentOptions = isRecord(currentState.options) ? currentState.options : {};

  return {
    type: "localgraph",
    state: {
      ...currentState,
      file: filePath,
      options: {
        ...currentOptions,
        "collapse-filter": true,
        search: "",
        ...options,
      },
    },
    active: true,
  };
}

export function getExistingLocalGraphLeaf(leaves: WorkspaceLeaf[]): WorkspaceLeaf | undefined {
  return leaves.find((leaf) => leaf.getViewState().type === "localgraph");
}

export async function writeRawFolderGraphScopeNote(vault: Vault, folderPath: string, files: TFile[]): Promise<TFile> {
  await ensureParentFolder(vault, RAW_FOLDER_GRAPH_SCOPE_PATH);

  const content = buildRawFolderGraphScopeContent(folderPath, files);
  const existing = vault.getAbstractFileByPath(RAW_FOLDER_GRAPH_SCOPE_PATH);

  if (!existing) {
    return vault.create(RAW_FOLDER_GRAPH_SCOPE_PATH, content);
  }

  if (!isTFile(existing)) {
    throw new Error(`Raw local graph 스코프 경로가 파일이 아닙니다: ${RAW_FOLDER_GRAPH_SCOPE_PATH}`);
  }

  await vault.modify(existing, content);
  return existing;
}

function isPathInFolder(filePath: string, folderPath: string, recursive: boolean): boolean {
  const folder = getFolder(filePath);

  if (folderPath.length === 0) {
    return true;
  }

  if (recursive) {
    return folder === folderPath || folder.startsWith(`${folderPath}/`);
  }

  return folder === folderPath;
}

function normalizeFolderPath(path: string): string {
  return path.replace(/^\/+|\/+$/gu, "");
}

function stripMarkdownExtension(path: string): string {
  return path.replace(/\.md$/iu, "");
}

function getFolder(path: string): string {
  const slashIndex = path.lastIndexOf("/");
  return slashIndex === -1 ? "" : path.slice(0, slashIndex);
}

function escapeWikilinkPart(value: string): string {
  return value.replace(/\|/gu, "\\|").replace(/\]/gu, "\\]");
}

function quoteYamlString(value: string): string {
  return JSON.stringify(value);
}

async function ensureParentFolder(vault: Vault, path: string): Promise<void> {
  const folderPath = getFolder(path);
  if (!folderPath) {
    return;
  }

  let currentPath = "";
  for (const segment of folderPath.split("/")) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    const existing = vault.getAbstractFileByPath(currentPath);

    if (!existing) {
      await vault.createFolder(currentPath);
      continue;
    }

    if (!isTFolder(existing)) {
      throw new Error(`Raw local graph 스코프 상위 경로가 폴더가 아닙니다: ${currentPath}`);
    }
  }
}

function isTFile(file: TAbstractFile): file is TFile {
  return !isTFolder(file);
}

function isTFolder(file: TAbstractFile): file is TFolder {
  return "children" in file;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
