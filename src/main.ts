import { Notice, Plugin, type TFile } from "obsidian";
import { CodexContextBuilder } from "./export/codex-context-builder";
import { CodexContextWriter } from "./export/context-writer";
import { MetadataPreviewModal } from "./extract/metadata-preview-modal";
import { buildMetadataPreviewPayload, NoteMetadataExtractor } from "./extract/note-metadata";
import { GraphQueryService } from "./graph/graph-query";
import { createFolderGraphScope, createNoteGraphScope, isFolder, type GraphResult } from "./graph/graph-scope";
import { IndexingReport } from "./indexing/index-report";
import { VaultIndexQueue, type IndexQueueItem } from "./indexing/index-queue";
import { VaultIndexer, isMarkdownFile } from "./indexing/vault-indexer";
import { MemoryInboxWriter } from "./memory/memory-inbox";
import { MemoryTypeModal } from "./memory/memory-modal";
import {
  buildMemorySourceFromFile,
  MemoryPromotionService,
  normalizeSelectedText,
  type MemoryType,
} from "./memory/memory-promotion";
import { Neo4jClient, sanitizeNeo4jError } from "./neo4j/client";
import { Neo4jSchemaService } from "./neo4j/schema";
import { SemanticEnrichmentApprovalModal } from "./semantic/semantic-enrichment-modal";
import {
  SemanticEnrichmentService,
  type SemanticEnrichmentCandidate,
  type SemanticEnrichmentPreview,
} from "./semantic/semantic-enrichment";
import { ContextGraphMemorySettingTab } from "./settings";
import { DEFAULT_SETTINGS, mergeSettings, type ContextGraphMemorySettings } from "./types";
import { GraphView, VIEW_TYPE_CONTEXT_GRAPH } from "./views/graph-view";

export default class ContextGraphMemoryPlugin extends Plugin {
  settings: ContextGraphMemorySettings = { ...DEFAULT_SETTINGS };
  private vaultIndexer: VaultIndexer | null = null;
  private indexQueue: VaultIndexQueue | null = null;
  private graphQueryService: GraphQueryService | null = null;
  private lastGraphResult: GraphResult | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new ContextGraphMemorySettingTab(this.app, this));
    this.createIndexingServices();

    this.registerView(VIEW_TYPE_CONTEXT_GRAPH, (leaf) => new GraphView(leaf, this.settings));

    this.addCommand({
      id: "open-graph-panel",
      name: "Context Graph Memory: Open Graph Panel",
      callback: async () => {
        await this.openGraphPanel(this.lastGraphResult ?? undefined);
      },
    });

    this.addCommand({
      id: "test-neo4j-connection",
      name: "Context Graph Memory: Test Neo4j Connection",
      callback: async () => {
        await this.testNeo4jConnection();
      },
    });

    this.addCommand({
      id: "initialize-neo4j-schema",
      name: "Context Graph Memory: Initialize Neo4j Schema",
      callback: async () => {
        await this.initializeNeo4jSchema();
      },
    });

    this.addCommand({
      id: "index-current-note",
      name: "Context Graph Memory: Index Current Note",
      callback: async () => {
        await this.indexCurrentNote();
      },
    });

    this.addCommand({
      id: "index-vault",
      name: "Context Graph Memory: Index Vault",
      callback: async () => {
        await this.indexVault();
      },
    });

    this.addCommand({
      id: "reindex-changed-notes",
      name: "Context Graph Memory: Reindex Changed Notes",
      callback: async () => {
        await this.flushChangedNotes();
      },
    });

    this.addCommand({
      id: "show-metadata-extraction-preview",
      name: "Context Graph Memory: Show Metadata Extraction Preview",
      callback: async () => {
        await this.showMetadataExtractionPreview();
      },
    });

    this.addCommand({
      id: "preview-semantic-enrichment-candidates",
      name: "Context Graph Memory: Preview Semantic Enrichment Candidates",
      callback: async () => {
        await this.previewSemanticEnrichmentCandidates();
      },
    });

    this.addCommand({
      id: "show-related-graph",
      name: "Context Graph Memory: Show Related Graph",
      callback: async () => {
        await this.showRelatedGraph();
      },
    });

    this.addCommand({
      id: "show-graph-for-folder",
      name: "Context Graph Memory: Show Graph for Folder",
      callback: async () => {
        await this.showGraphForActiveFolder();
      },
    });

    this.addCommand({
      id: "promote-selection-to-long-term-memory",
      name: "Context Graph Memory: Promote Selection to Long-term Memory",
      editorCallback: (editor, ctx) => {
        void this.promoteSelectionToLongTermMemory(editor.getSelection(), ctx.file);
      },
    });

    this.addCommand({
      id: "export-codex-context-for-current-note",
      name: "Context Graph Memory: Export Codex Context for Current Note",
      callback: async () => {
        await this.exportCodexContextForCurrentNote();
      },
    });

    this.registerIndexingEvents();
    this.registerGraphContextMenus();
  }

  onunload(): void {
    this.indexQueue?.destroy();
    this.indexQueue = null;
    this.vaultIndexer = null;
    this.graphQueryService = null;
    this.lastGraphResult = null;
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CONTEXT_GRAPH);
  }

  async loadSettings(): Promise<void> {
    this.settings = mergeSettings(await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async testNeo4jConnection(): Promise<void> {
    const client = new Neo4jClient(this.settings);

    try {
      const result = await client.verifyConnectivity();
      new Notice(result.ok ? result.message : `Neo4j connection failed: ${result.message}`);
    } finally {
      await client.close();
    }
  }

  private async initializeNeo4jSchema(): Promise<void> {
    const client = new Neo4jClient(this.settings);

    try {
      const schema = new Neo4jSchemaService(client);
      const result = await schema.initializeSchema();
      new Notice(`Neo4j schema initialized: ${result.applied.length} statements.`);
    } catch (error) {
      new Notice(`Neo4j schema initialization failed: ${sanitizeNeo4jError(error, this.settings)}`);
    } finally {
      await client.close();
    }
  }

  private createIndexingServices(): void {
    this.vaultIndexer = new VaultIndexer(this.app, this.settings);
    this.indexQueue = new VaultIndexQueue(
      (items) => this.processQueueItems(items),
      this.settings.indexDebounceMs,
      (report) => this.notifyIndexingReport("Context Graph Memory auto-index", report, false),
    );
  }

  private createGraphQueryService(): void {
    this.graphQueryService = new GraphQueryService(this.settings);
  }

  private registerIndexingEvents(): void {
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (this.settings.autoIndexOnModify && isMarkdownFile(file)) {
          this.indexQueue?.enqueueFile(file, "create");
        }
      }),
    );

    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (this.settings.autoIndexOnModify && isMarkdownFile(file)) {
          this.indexQueue?.enqueueFile(file, "modify");
        }
      }),
    );

    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (!this.settings.autoIndexOnModify) {
          return;
        }

        if (isMarkdownFile(file) && isMarkdownPath(oldPath)) {
          this.indexQueue?.enqueueRename(file, oldPath);
          return;
        }

        if (isMarkdownFile(file)) {
          this.indexQueue?.enqueueFile(file, "rename-to-markdown");
          return;
        }

        if (isMarkdownPath(oldPath)) {
          this.indexQueue?.enqueueDelete(oldPath, "rename-away");
        }
      }),
    );

    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (this.settings.autoIndexOnModify && isMarkdownPath(file.path)) {
          this.indexQueue?.enqueueDelete(file.path, "delete");
        }
      }),
    );

    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        if (this.settings.autoIndexOnModify && isMarkdownFile(file)) {
          this.indexQueue?.enqueueFile(file, "metadata-changed");
        }
      }),
    );

    this.registerEvent(
      this.app.metadataCache.on("resolve", (file) => {
        if (this.settings.autoIndexOnModify && isMarkdownFile(file)) {
          this.indexQueue?.enqueueFile(file, "metadata-resolved");
        }
      }),
    );

    this.registerEvent(
      this.app.metadataCache.on("resolved", () => {
        if (this.settings.autoIndexOnModify) {
          void this.flushAutoIndexQueue();
        }
      }),
    );

    if (this.settings.indexOnStartup) {
      this.app.workspace.onLayoutReady(() => {
        void this.indexVault("Context Graph Memory startup index");
      });
    }
  }

  private async indexCurrentNote(prefix = "Context Graph Memory: Index Current Note"): Promise<void> {
    const report = await this.getVaultIndexer().indexCurrentNote(true);
    this.notifyIndexingReport(prefix, report);
  }

  private async indexVault(prefix = "Context Graph Memory: Index Vault"): Promise<void> {
    const report = await this.getVaultIndexer().indexVault(true);
    this.notifyIndexingReport(prefix, report);
  }

  private async flushChangedNotes(prefix = "Context Graph Memory: Reindex Changed Notes"): Promise<void> {
    const queue = this.getIndexQueue();
    const report = queue.getPendingCount() === 0 ? new IndexingReport() : await queue.flush();
    this.notifyIndexingReport(prefix, report);
  }

  private async flushAutoIndexQueue(): Promise<void> {
    if (!this.indexQueue || this.indexQueue.getPendingCount() === 0) {
      return;
    }

    await this.indexQueue.flush();
  }

  private async processQueueItems(items: IndexQueueItem[]): Promise<IndexingReport> {
    return this.getVaultIndexer().processQueueItems(items);
  }

  private async showMetadataExtractionPreview(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || !isMarkdownFile(activeFile)) {
      new Notice("Context Graph Memory: Open a Markdown note before previewing metadata.");
      return;
    }

    try {
      const content = await this.app.vault.cachedRead(activeFile);
      const cache = this.app.metadataCache.getFileCache(activeFile);
      const metadata = new NoteMetadataExtractor().extract(activeFile, cache, content);
      const payload = buildMetadataPreviewPayload(metadata, this.settings.dataForgeCompatibilityMode);

      new MetadataPreviewModal(this.app, payload).open();
      new Notice(
        `Context Graph Memory: Metadata preview ready (${payload.dataForgeCompatibility.relationCandidateCount} relation candidates).`,
      );
    } catch (error) {
      new Notice(`Context Graph Memory metadata preview failed: ${sanitizeNeo4jError(error, this.settings)}`);
    }
  }

  private async previewSemanticEnrichmentCandidates(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || !isMarkdownFile(activeFile)) {
      new Notice("Context Graph Memory: Open a Markdown note before previewing semantic enrichment.");
      return;
    }

    try {
      const content = await this.app.vault.cachedRead(activeFile);
      const cache = this.app.metadataCache.getFileCache(activeFile);
      const metadata = new NoteMetadataExtractor().extract(activeFile, cache, content);
      const service = new SemanticEnrichmentService(this.settings);
      const preview = service.buildPreview(metadata);
      const approvedCandidates = await this.chooseSemanticEnrichmentCandidates(preview);

      if (!approvedCandidates || approvedCandidates.length === 0) {
        return;
      }

      const report = await service.approveCandidates(approvedCandidates);
      new Notice(
        `Context Graph Memory: Approved ${report.approved}/${report.attempted} semantic enrichment candidates.`,
      );
    } catch (error) {
      new Notice(`Context Graph Memory semantic enrichment failed: ${sanitizeNeo4jError(error, this.settings)}`);
    }
  }

  private async chooseSemanticEnrichmentCandidates(
    preview: SemanticEnrichmentPreview,
  ): Promise<SemanticEnrichmentCandidate[] | null> {
    return new Promise((resolve) => {
      new SemanticEnrichmentApprovalModal(this.app, preview, resolve).open();
    });
  }

  private registerGraphContextMenus(): void {
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (isMarkdownFile(file)) {
          menu.addItem((item) => {
            item
              .setTitle("Neo4j 그래프 보기")
              .setIcon("network")
              .onClick(() => {
                void this.showGraphForFile(file);
              });
          });
          return;
        }

        if (isFolder(file)) {
          menu.addItem((item) => {
            item
              .setTitle("Neo4j 폴더 그래프 보기")
              .setIcon("folder-tree")
              .onClick(() => {
                void this.showGraphForFolderPath(file.path);
              });
          });
        }
      }),
    );
  }

  private async showRelatedGraph(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || !isMarkdownFile(activeFile)) {
      new Notice("Context Graph Memory: No active Markdown file.");
      return;
    }

    await this.showGraphForFile(activeFile);
  }

  private async showGraphForActiveFolder(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    const folderPath = activeFile?.parent?.path;

    if (folderPath === undefined) {
      new Notice("Context Graph Memory: No active folder.");
      return;
    }

    await this.showGraphForFolderPath(folderPath);
  }

  private async showGraphForFile(file: TFile): Promise<void> {
    try {
      const scope = createNoteGraphScope(file.path, this.settings);
      const result = await this.getGraphQueryService().getGraph(scope);
      this.lastGraphResult = result;
      await this.openGraphPanel(result);
      this.notifyGraphResult("Context Graph Memory: Related graph ready", result);
    } catch (error) {
      new Notice(`Context Graph Memory graph query failed: ${sanitizeNeo4jError(error, this.settings)}`);
    }
  }

  private async showGraphForFolderPath(path: string): Promise<void> {
    try {
      const scope = createFolderGraphScope(path, this.settings);
      const result = await this.getGraphQueryService().getGraph(scope);
      this.lastGraphResult = result;
      await this.openGraphPanel(result);
      this.notifyGraphResult("Context Graph Memory: Folder graph ready", result);
    } catch (error) {
      new Notice(`Context Graph Memory folder graph query failed: ${sanitizeNeo4jError(error, this.settings)}`);
    }
  }

  private async promoteSelectionToLongTermMemory(selection: string, file: TFile | null): Promise<void> {
    if (!file || !isMarkdownFile(file)) {
      new Notice("Context Graph Memory: Open a Markdown note before promoting memory.");
      return;
    }

    const text = normalizeSelectedText(selection);
    if (text.length === 0) {
      new Notice("Context Graph Memory: Select text before promoting memory.");
      return;
    }

    const type = await this.chooseMemoryType(text);
    if (!type) {
      return;
    }

    const service = new MemoryPromotionService(this.settings);
    let memory;

    try {
      memory = await service.promote({
        type,
        text,
        source: buildMemorySourceFromFile(file),
      });
    } catch (error) {
      new Notice(`Context Graph Memory memory promotion failed: ${sanitizeNeo4jError(error, this.settings)}`);
      return;
    }

    try {
      await new MemoryInboxWriter(this.app.vault, this.settings.memoryInboxPath).append(memory);
    } catch (error) {
      new Notice(`Context Graph Memory saved Neo4j memory, but Memory Inbox append failed: ${sanitizeNeo4jError(error, this.settings)}`);
      return;
    }

    new Notice(`Context Graph Memory: ${type} promoted and recorded.`);
  }

  private async chooseMemoryType(selection: string): Promise<MemoryType | null> {
    return new Promise((resolve) => {
      new MemoryTypeModal(this.app, selection, resolve).open();
    });
  }

  private async exportCodexContextForCurrentNote(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || !isMarkdownFile(activeFile)) {
      new Notice("Context Graph Memory: Open a Markdown note before exporting Codex context.");
      return;
    }

    const noteContent = await this.app.vault.read(activeFile);
    let graph: GraphResult | undefined;
    let graphError: string | undefined;

    try {
      const scope = createNoteGraphScope(activeFile.path, this.settings);
      graph = await this.getGraphQueryService().getGraph(scope);
      this.lastGraphResult = graph;
    } catch (error) {
      graphError = sanitizeNeo4jError(error, this.settings);
    }

    const context = new CodexContextBuilder().build({
      currentNote: {
        path: activeFile.path,
        title: activeFile.basename,
        content: noteContent,
      },
      graph,
      graphError,
      maxCurrentNoteChars: this.settings.metadataPreviewMaxChars,
      redactValues: [this.settings.neo4jPassword],
    });

    try {
      const outputPath = await new CodexContextWriter(this.app.vault, this.settings.codexContextOutputPath).write(context);
      const warning = graphError ? " with graph warning" : "";
      new Notice(`Context Graph Memory: Codex context exported${warning} to ${outputPath}.`);
    } catch (error) {
      new Notice(`Context Graph Memory context export failed: ${sanitizeNeo4jError(error, this.settings)}`);
    }
  }

  private async openGraphPanel(result?: GraphResult): Promise<GraphView> {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CONTEXT_GRAPH)[0];

    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE_CONTEXT_GRAPH, active: true });
    }

    await this.app.workspace.revealLeaf(leaf);
    await leaf.loadIfDeferred();

    if (!(leaf.view instanceof GraphView)) {
      throw new Error("Context Graph Memory graph view failed to open.");
    }

    if (result) {
      leaf.view.setGraphResult(result);
    }

    return leaf.view;
  }

  private getVaultIndexer(): VaultIndexer {
    if (!this.vaultIndexer) {
      this.createIndexingServices();
    }

    return this.vaultIndexer as VaultIndexer;
  }

  private getIndexQueue(): VaultIndexQueue {
    if (!this.indexQueue) {
      this.createIndexingServices();
    }

    return this.indexQueue as VaultIndexQueue;
  }

  private getGraphQueryService(): GraphQueryService {
    if (!this.graphQueryService) {
      this.createGraphQueryService();
    }

    return this.graphQueryService as GraphQueryService;
  }

  private notifyIndexingReport(prefix: string, report: IndexingReport, showSuccess = true): void {
    const snapshot = report.toSnapshot();

    if (showSuccess || snapshot.failed > 0) {
      new Notice(report.toNoticeMessage(prefix));
    }
  }

  private notifyGraphResult(prefix: string, result: GraphResult): void {
    new Notice(`${prefix}: ${result.summary.nodeCount} nodes, ${result.summary.edgeCount} edges.`);
  }
}

function isMarkdownPath(path: string): boolean {
  return path.toLowerCase().endsWith(".md");
}
