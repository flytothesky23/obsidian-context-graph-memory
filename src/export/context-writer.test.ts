import type { TAbstractFile, TFile, Vault } from "obsidian";
import { describe, expect, it } from "vitest";
import { CodexContextWriter, normalizeVaultPath } from "./context-writer";

describe("CodexContextWriter", () => {
  it("normalizes vault output paths", () => {
    expect(normalizeVaultPath("/00_System//Codex Context.md/")).toBe("00_System/Codex Context.md");
  });

  it("creates parent folders and writes a new export file", async () => {
    const vault = new MockVault();
    const writer = new CodexContextWriter(vault as unknown as Vault, "/00_System/Codex Context.md");

    const path = await writer.write("# Codex Implementation Context\n");

    expect(path).toBe("00_System/Codex Context.md");
    expect(vault.folders).toEqual(new Set(["00_System"]));
    expect(vault.files.get("00_System/Codex Context.md")).toBe("# Codex Implementation Context\n");
  });

  it("updates an existing export file", async () => {
    const vault = new MockVault();
    vault.files.set("00_System/Codex Context.md", "old");
    const writer = new CodexContextWriter(vault as unknown as Vault, "00_System/Codex Context.md");

    await writer.write("new");

    expect(vault.files.get("00_System/Codex Context.md")).toBe("new");
  });

  it("rejects output paths that resolve to a folder", async () => {
    const vault = new MockVault();
    vault.folders.add("00_System");
    vault.folders.add("00_System/Codex Context.md");
    const writer = new CodexContextWriter(vault as unknown as Vault, "00_System/Codex Context.md");

    await expect(writer.write("content")).rejects.toThrow("Codex context output path is not a file");
  });
});

class MockVault {
  readonly files = new Map<string, string>();
  readonly folders = new Set<string>();

  getAbstractFileByPath(path: string): TAbstractFile | null {
    if (this.folders.has(path)) {
      return { path, children: [] } as unknown as TAbstractFile;
    }

    if (this.files.has(path)) {
      return { path, extension: "md", basename: path.split("/").pop()?.replace(/\.md$/u, "") ?? path } as TFile;
    }

    return null;
  }

  async createFolder(path: string): Promise<void> {
    this.folders.add(path);
  }

  async create(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async modify(file: TFile, content: string): Promise<void> {
    this.files.set(file.path, content);
  }
}
