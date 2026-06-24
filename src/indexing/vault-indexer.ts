import type { App, CachedMetadata, TAbstractFile, TFile } from "obsidian";
import {
  buildRelationCandidatesFromFields,
  type RelationCandidate,
} from "../extract/relation-candidates";
import { NoteMetadataExtractor, type ExtractedNoteMetadata } from "../extract/note-metadata";
import { Neo4jClient, sanitizeNeo4jError, type Neo4jQueryResult, type QueryParameters } from "../neo4j/client";
import type { ContextGraphMemorySettings } from "../types";
import { IndexingReport } from "./index-report";
import type { IndexQueueItem } from "./index-queue";

export interface Neo4jQueryRunner {
  run(cypher: string, parameters?: QueryParameters): Promise<Neo4jQueryResult>;
  close?(): Promise<void>;
}

export type Neo4jQueryRunnerFactory = () => Neo4jQueryRunner;

export interface ResolvedLinkTarget {
  path: string;
  id: string;
  title: string;
  basename: string;
  folder: string;
  count: number;
}

export type { RelationCandidate } from "../extract/relation-candidates";

export const UPSERT_NOTE_QUERY = `
MERGE (n:Note {path: $note.path})
SET n.id = $note.id,
    n.title = $note.title,
    n.basename = $note.basename,
    n.folder = $note.folder,
    n.ctime = $note.ctime,
    n.mtime = $note.mtime,
    n.hash = $note.hash,
    n.archived = false,
    n.indexedAt = datetime()
`;

export const CLEAR_DERIVED_RELATIONSHIPS_QUERY = `
MATCH (n:Note {path: $path})
OPTIONAL MATCH (n)-[r:HAS_TAG|LINKS_TO|RELATED_TO|SUPPORTS|DEPENDS_ON|PART_OF|AFFECTS|EVIDENCED_BY|MENTIONS]->()
DELETE r
`;

export const UPSERT_TAGS_QUERY = `
MATCH (n:Note {path: $path})
UNWIND $tags AS tagName
MERGE (t:Tag {name: tagName})
MERGE (n)-[r:HAS_TAG]->(t)
SET r.updatedAt = datetime()
`;

export const UPSERT_LINKS_QUERY = `
MATCH (n:Note {path: $path})
UNWIND $links AS link
MERGE (target:Note {path: link.path})
ON CREATE SET target.id = link.id,
              target.title = link.title,
              target.basename = link.basename,
              target.folder = link.folder,
              target.archived = false
MERGE (n)-[r:LINKS_TO]->(target)
SET r.count = link.count,
    r.updatedAt = datetime()
`;

export const ARCHIVE_NOTE_QUERY = `
MERGE (n:Note {path: $path})
SET n.archived = true,
    n.archivedAt = datetime()
`;

export class VaultIndexer {
  private readonly metadataExtractor = new NoteMetadataExtractor();
  private readonly indexedHashes = new Map<string, string>();

  constructor(
    private readonly app: App,
    private readonly settings: ContextGraphMemorySettings,
    private readonly createRunner: Neo4jQueryRunnerFactory = () => new Neo4jClient(settings),
  ) {}

  async indexCurrentNote(force = false): Promise<IndexingReport> {
    const report = new IndexingReport();
    const activeFile = this.app.workspace.getActiveFile();

    if (!activeFile || !isMarkdownFile(activeFile)) {
      report.recordSkipped("(active file)", "No active Markdown file.");
      return report;
    }

    const runner = this.createRunner();
    try {
      await this.indexFileWithRunner(activeFile, runner, report, force);
    } finally {
      await runner.close?.();
    }

    return report;
  }

  async indexVault(force = false): Promise<IndexingReport> {
    const report = new IndexingReport();
    const runner = this.createRunner();

    try {
      const markdownFiles = this.app.vault.getMarkdownFiles();
      for (let index = 0; index < markdownFiles.length; index += 1) {
        await this.indexFileWithRunner(markdownFiles[index], runner, report, force);

        if ((index + 1) % 25 === 0) {
          await yieldToEventLoop();
        }
      }
    } finally {
      await runner.close?.();
    }

    return report;
  }

  async processQueueItems(items: IndexQueueItem[]): Promise<IndexingReport> {
    const report = new IndexingReport();
    const runner = this.createRunner();

    try {
      for (const item of items) {
        if (item.action === "delete") {
          await this.archivePathWithRunner(item.path, runner, report);
          continue;
        }

        if (item.action === "rename") {
          await this.archivePathWithRunner(item.oldPath, runner, report);
          await this.indexFileWithRunner(item.file, runner, report, true);
          continue;
        }

        await this.indexFileWithRunner(item.file, runner, report);
      }
    } finally {
      await runner.close?.();
    }

    return report;
  }

  async archivePath(path: string): Promise<IndexingReport> {
    const report = new IndexingReport();
    const runner = this.createRunner();

    try {
      await this.archivePathWithRunner(path, runner, report);
    } finally {
      await runner.close?.();
    }

    return report;
  }

  private async indexFileWithRunner(
    file: TFile,
    runner: Neo4jQueryRunner,
    report: IndexingReport,
    force = false,
  ): Promise<void> {
    if (!this.shouldReadFile(file)) {
      report.recordSkipped(file.path, "Excluded by folder settings.");
      return;
    }

    try {
      const content = await this.app.vault.cachedRead(file);
      const cache = this.app.metadataCache.getFileCache(file);
      const metadata = this.metadataExtractor.extract(file, cache, content);

      if (!this.hasIncludedTag(metadata)) {
        report.recordSkipped(file.path, "No included tag matched.");
        return;
      }

      if (!force && this.indexedHashes.get(file.path) === metadata.note.hash) {
        report.recordSkipped(file.path, "Content hash unchanged.");
        return;
      }

      await this.upsertMetadata(runner, metadata);
      this.indexedHashes.set(file.path, metadata.note.hash);
      report.recordIndexed(file.path);
    } catch (error) {
      report.recordFailure(file.path, sanitizeNeo4jError(error, this.settings));
    }
  }

  private async archivePathWithRunner(
    path: string,
    runner: Neo4jQueryRunner,
    report: IndexingReport,
  ): Promise<void> {
    try {
      await runner.run(ARCHIVE_NOTE_QUERY, { path });
      this.indexedHashes.delete(path);
      report.recordArchived(path);
    } catch (error) {
      report.recordFailure(path, sanitizeNeo4jError(error, this.settings));
    }
  }

  private async upsertMetadata(runner: Neo4jQueryRunner, metadata: ExtractedNoteMetadata): Promise<void> {
    await runner.run(UPSERT_NOTE_QUERY, { note: metadata.note });
    await runner.run(CLEAR_DERIVED_RELATIONSHIPS_QUERY, { path: metadata.note.path });

    if (metadata.tags.length > 0) {
      await runner.run(UPSERT_TAGS_QUERY, { path: metadata.note.path, tags: metadata.tags });
    }

    const resolvedLinks = this.resolveLinks(metadata);
    if (resolvedLinks.length > 0) {
      await runner.run(UPSERT_LINKS_QUERY, { path: metadata.note.path, links: resolvedLinks });
    }

    for (const candidate of buildRelationCandidates(metadata)) {
      await runner.run(buildRelationCandidateQuery(candidate.relationshipType), {
        path: metadata.note.path,
        field: candidate.field,
        name: candidate.name,
        normalizedName: candidate.normalizedName,
        conceptKind: candidate.conceptKind,
      });
    }
  }

  private resolveLinks(metadata: ExtractedNoteMetadata): ResolvedLinkTarget[] {
    const byPath = new Map<string, ResolvedLinkTarget>();
    const resolvedLinkCounts = this.app.metadataCache.resolvedLinks[metadata.note.path] ?? {};

    for (const [path, count] of Object.entries(resolvedLinkCounts)) {
      byPath.set(path, buildResolvedLinkTarget(path, count));
    }

    for (const wikilink of metadata.wikilinks) {
      if (!wikilink.targetPath) {
        continue;
      }

      const targetFile = this.app.metadataCache.getFirstLinkpathDest(wikilink.targetPath, metadata.note.path);
      if (targetFile && !byPath.has(targetFile.path)) {
        byPath.set(targetFile.path, buildResolvedLinkTarget(targetFile.path, 1));
      }
    }

    return [...byPath.values()];
  }

  private shouldReadFile(file: TFile): boolean {
    if (!isMarkdownFile(file)) {
      return false;
    }

    const folder = getFolder(file.path);
    if (matchesFolderPrefix(folder, this.settings.excludeFolders)) {
      return false;
    }

    if (this.settings.includeFolders.length > 0 && !matchesFolderPrefix(folder, this.settings.includeFolders)) {
      return false;
    }

    return true;
  }

  private hasIncludedTag(metadata: ExtractedNoteMetadata): boolean {
    if (this.settings.includeTags.length === 0) {
      return true;
    }

    const noteTags = new Set(metadata.tags.map(normalizeTag));
    return this.settings.includeTags.map(normalizeTag).some((tag) => noteTags.has(tag));
  }
}

export function isMarkdownFile(file: TAbstractFile | null | undefined): file is TFile {
  return Boolean(file && "extension" in file && file.extension === "md");
}

export function buildRelationCandidates(metadata: ExtractedNoteMetadata): RelationCandidate[] {
  return buildRelationCandidatesFromFields(metadata.relationFields);
}

export function buildRelationCandidateQuery(relationshipType: string): string {
  return `
MATCH (n:Note {path: $path})
MERGE (c:Concept {normalizedName: $normalizedName})
ON CREATE SET c.name = $name,
              c.source = 'frontmatter',
              c.kind = $conceptKind
SET c.name = coalesce(c.name, $name),
    c.kind = coalesce(c.kind, $conceptKind),
    c.lastSeenAt = datetime()
MERGE (n)-[r:${relationshipType}]->(c)
SET r.field = $field,
    r.source = 'frontmatter',
    r.candidate = true,
    r.updatedAt = datetime()
`;
}

function buildResolvedLinkTarget(path: string, count: number): ResolvedLinkTarget {
  const basename = getBasename(path);
  return {
    path,
    id: createNoteIdFromPath(path),
    title: basename,
    basename,
    folder: getFolder(path),
    count,
  };
}

function createNoteIdFromPath(path: string): string {
  return `note:${hashString(path)}`;
}

function getBasename(path: string): string {
  const filename = path.split("/").pop() ?? path;
  return filename.replace(/\.md$/iu, "");
}

function getFolder(path: string): string {
  const slashIndex = path.lastIndexOf("/");
  return slashIndex === -1 ? "" : path.slice(0, slashIndex);
}

function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#+/u, "");
}

function matchesFolderPrefix(folder: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => {
    const normalizedPrefix = prefix.replace(/\/+$/u, "");
    return normalizedPrefix.length > 0 && (folder === normalizedPrefix || folder.startsWith(`${normalizedPrefix}/`));
  });
}

function hashString(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
