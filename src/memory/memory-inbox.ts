import type { TAbstractFile, TFile, TFolder, Vault } from "obsidian";
import type { PromotedMemory } from "./memory-promotion";

export class MemoryInboxWriter {
  constructor(
    private readonly vault: Vault,
    private readonly inboxPath: string,
  ) {}

  async append(memory: PromotedMemory): Promise<void> {
    const normalizedPath = normalizeVaultPath(this.inboxPath);
    const date = memory.createdAt.slice(0, 10);
    const entry = formatMemoryInboxEntry(memory);

    await this.ensureParentFolder(normalizedPath);

    const existing = this.vault.getAbstractFileByPath(normalizedPath);
    if (!existing) {
      await this.vault.create(normalizedPath, appendEntryToInboxContent("", date, entry));
      return;
    }

    if (!isTFile(existing)) {
      throw new Error(`Memory Inbox path is not a file: ${normalizedPath}`);
    }

    const content = await this.vault.read(existing);
    await this.vault.modify(existing, appendEntryToInboxContent(content, date, entry));
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
        throw new Error(`Memory Inbox parent path is not a folder: ${currentPath}`);
      }
    }
  }
}

export function appendEntryToInboxContent(content: string, date: string, entry: string): string {
  const lines = content.replace(/\r\n?/gu, "\n").split("\n");
  const heading = `## ${date}`;
  const headingIndex = lines.findIndex((line) => line.trim() === heading);

  if (headingIndex === -1) {
    const baseLines = trimTrailingEmptyLines(lines);
    const prefix = baseLines.length > 0 && baseLines.some((line) => line.trim().length > 0)
      ? [...baseLines, "", heading, ""]
      : ["# Memory Inbox", "", heading, ""];
    return [...prefix, ...entry.split("\n"), ""].join("\n");
  }

  let nextHeadingIndex = lines.findIndex((line, index) => index > headingIndex && /^##\s+/u.test(line));
  if (nextHeadingIndex === -1) {
    nextHeadingIndex = lines.length;
  }

  const before = trimTrailingEmptyLines(lines.slice(0, nextHeadingIndex));
  const after = trimLeadingEmptyLines(lines.slice(nextHeadingIndex));
  const combined = [...before, "", ...entry.split("\n"), ""];

  if (after.length > 0) {
    combined.push(...after);
  }

  return `${trimTrailingWhitespace(combined.join("\n"))}\n`;
}

export function formatMemoryInboxEntry(memory: PromotedMemory): string {
  const text = sanitizeMemoryInboxText(memory.text).replace(/\s+/gu, " ").trim();
  return `- [${memory.type}] ${text}\n  Source: ${toObsidianSourceLink(memory.source.path, memory.source.title)}`;
}

export function sanitizeMemoryInboxText(text: string): string {
  return text
    .replace(
      /\b(password|passwd|token|secret|credential|auth|login|runtime[_ -]?log)\b\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;]+)/giu,
      (_match, key: string) => `${key}=[masked]`,
    )
    .replace(
      /(["'])(password|passwd|token|secret|credential|auth|login|runtime[_ -]?log)\1\s*:\s*(["'])(.*?)\3/giu,
      (_match, quote: string, key: string) => `${quote}${key}${quote}: "[masked]"`,
    )
    .replace(
      /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/giu,
      (_match, scheme: string) => `${scheme} [masked]`,
    )
    .replace(
      /\b(sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{8,})\b/gu,
      "[masked-token]",
    );
}

function toObsidianSourceLink(path: string, title: string): string {
  const linkPath = path.replace(/\.md$/iu, "");
  return `[[${escapeWikilinkPart(linkPath)}|${escapeWikilinkPart(title)}]]`;
}

function escapeWikilinkPart(value: string): string {
  return value.replace(/\|/gu, "\\|");
}

function getParentFolderPath(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/");
}

function normalizeVaultPath(path: string): string {
  return path
    .replace(/\\/gu, "/")
    .replace(/\/+/gu, "/")
    .replace(/^\/+/u, "")
    .replace(/\/+$/u, "");
}

function isTFile(file: TAbstractFile): file is TFile {
  return !isTFolder(file);
}

function isTFolder(file: TAbstractFile): file is TFolder {
  return "children" in file;
}

function trimTrailingEmptyLines(lines: string[]): string[] {
  const result = [...lines];
  while (result.length > 0 && result[result.length - 1].trim().length === 0) {
    result.pop();
  }
  return result;
}

function trimLeadingEmptyLines(lines: string[]): string[] {
  const result = [...lines];
  while (result.length > 0 && result[0].trim().length === 0) {
    result.shift();
  }
  return result;
}

function trimTrailingWhitespace(value: string): string {
  return value.replace(/\s+$/u, "");
}
