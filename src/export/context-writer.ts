import type { TAbstractFile, TFile, TFolder, Vault } from "obsidian";

export class CodexContextWriter {
  constructor(
    private readonly vault: Vault,
    private readonly outputPath: string,
  ) {}

  async write(content: string): Promise<string> {
    const normalizedPath = normalizeVaultPath(this.outputPath);
    await this.ensureParentFolder(normalizedPath);

    const existing = this.vault.getAbstractFileByPath(normalizedPath);
    if (!existing) {
      await this.vault.create(normalizedPath, content);
      return normalizedPath;
    }

    if (!isTFile(existing)) {
      throw new Error(`Codex 컨텍스트 출력 경로가 파일이 아닙니다: ${normalizedPath}`);
    }

    await this.vault.modify(existing, content);
    return normalizedPath;
  }

  private async ensureParentFolder(path: string): Promise<void> {
    const folderPath = getParentFolderPath(path);
    if (!folderPath) {
      return;
    }

    let currentPath = "";
    for (const segment of folderPath.split("/")) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      const existing = this.vault.getAbstractFileByPath(currentPath);

      if (!existing) {
        await this.vault.createFolder(currentPath);
        continue;
      }

      if (!isTFolder(existing)) {
        throw new Error(`Codex 컨텍스트 상위 경로가 폴더가 아닙니다: ${currentPath}`);
      }
    }
  }
}

export function normalizeVaultPath(path: string): string {
  return path
    .replace(/\\/gu, "/")
    .replace(/\/+/gu, "/")
    .replace(/^\/+/u, "")
    .replace(/\/+$/u, "");
}

function getParentFolderPath(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

function isTFile(file: TAbstractFile): file is TFile {
  return !isTFolder(file);
}

function isTFolder(file: TAbstractFile): file is TFolder {
  return "children" in file;
}
