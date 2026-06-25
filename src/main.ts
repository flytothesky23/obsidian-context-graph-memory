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
import {
  buildFolderGraphSearch,
  buildFolderGraphViewState,
  getExistingGraphLeaf,
  OBSIDIAN_GLOBAL_GRAPH_COMMAND_IDS,
  OBSIDIAN_LOCAL_GRAPH_COMMAND_IDS,
} from "./obsidian-graph";
import { SemanticEnrichmentApprovalModal } from "./semantic/semantic-enrichment-modal";
import {
  SemanticEnrichmentService,
  type SemanticEnrichmentCandidate,
  type SemanticEnrichmentPreview,
} from "./semantic/semantic-enrichment";
import { ContextGraphMemorySettingTab } from "./settings";
import { DEFAULT_SETTINGS, mergeSettings, type ContextGraphMemorySettings } from "./types";
import { GraphView, VIEW_TYPE_CONTEXT_GRAPH } from "./views/graph-view";

const UI_PREFIX = "컨텍스트 그래프 메모리";

const COMMAND_NAMES = {
  openGraphPanel: `${UI_PREFIX}: 그래프 패널 열기`,
  openObsidianLocalGraph: `${UI_PREFIX}: Obsidian Raw local graph 열기`,
  testNeo4jConnection: `${UI_PREFIX}: Neo4j 연결 테스트`,
  initializeNeo4jSchema: `${UI_PREFIX}: Neo4j 스키마 초기화`,
  indexCurrentNote: `${UI_PREFIX}: 현재 노트 인덱싱`,
  indexVault: `${UI_PREFIX}: 저장소 전체 인덱싱`,
  reindexChangedNotes: `${UI_PREFIX}: 변경 노트 재인덱싱`,
  showMetadataPreview: `${UI_PREFIX}: 메타데이터 추출 미리보기`,
  previewSemanticCandidates: `${UI_PREFIX}: 시맨틱 보강 후보 미리보기`,
  showRelatedGraph: `${UI_PREFIX}: 관련 그래프 보기`,
  showGraphForFolder: `${UI_PREFIX}: 폴더 그래프 보기`,
  promoteSelection: `${UI_PREFIX}: 선택 텍스트 장기기억 승격`,
  exportCodexContext: `${UI_PREFIX}: 현재 노트 Codex 컨텍스트 내보내기`,
};

const NOTICE_PREFIX = `${UI_PREFIX}:`;
const AUTO_INDEX_PREFIX = `${UI_PREFIX} 자동 인덱싱`;
const STARTUP_INDEX_PREFIX = `${UI_PREFIX} 시작 시 인덱싱`;
const INDEX_CURRENT_PREFIX = `${UI_PREFIX}: 현재 노트 인덱싱`;
const INDEX_VAULT_PREFIX = `${UI_PREFIX}: 저장소 전체 인덱싱`;
const REINDEX_CHANGED_PREFIX = `${UI_PREFIX}: 변경 노트 재인덱싱`;
const GRAPH_FILE_INDEX_PREFIX = `${UI_PREFIX}: 그래프 조회 전 노트 인덱싱`;
const GRAPH_FOLDER_INDEX_PREFIX = `${UI_PREFIX}: 그래프 조회 전 폴더 인덱싱`;
const RELATED_GRAPH_READY_PREFIX = `${UI_PREFIX}: 관련 그래프 준비 완료`;
const FOLDER_GRAPH_READY_PREFIX = `${UI_PREFIX}: 폴더 그래프 준비 완료`;

interface ObsidianCommandRegistry {
  listCommands?: () => Array<{ id: string }>;
  executeCommandById?: (id: string) => boolean | void;
}

interface AppWithCommands {
  commands?: ObsidianCommandRegistry;
}

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
    this.addRibbonIcon("network", "컨텍스트 그래프 메모리 열기", () => {
      void this.openGraphPanel(this.lastGraphResult ?? undefined);
    });

    this.addCommand({
      id: "open-graph-panel",
      name: COMMAND_NAMES.openGraphPanel,
      callback: async () => {
        await this.openGraphPanel(this.lastGraphResult ?? undefined);
      },
    });

    this.addCommand({
      id: "open-obsidian-local-graph",
      name: COMMAND_NAMES.openObsidianLocalGraph,
      callback: async () => {
        this.openObsidianLocalGraph("Obsidian Raw local graph를 열었습니다.");
      },
    });

    this.addCommand({
      id: "test-neo4j-connection",
      name: COMMAND_NAMES.testNeo4jConnection,
      callback: async () => {
        await this.testNeo4jConnection();
      },
    });

    this.addCommand({
      id: "initialize-neo4j-schema",
      name: COMMAND_NAMES.initializeNeo4jSchema,
      callback: async () => {
        await this.initializeNeo4jSchema();
      },
    });

    this.addCommand({
      id: "index-current-note",
      name: COMMAND_NAMES.indexCurrentNote,
      callback: async () => {
        await this.indexCurrentNote();
      },
    });

    this.addCommand({
      id: "index-vault",
      name: COMMAND_NAMES.indexVault,
      callback: async () => {
        await this.indexVault();
      },
    });

    this.addCommand({
      id: "reindex-changed-notes",
      name: COMMAND_NAMES.reindexChangedNotes,
      callback: async () => {
        await this.flushChangedNotes();
      },
    });

    this.addCommand({
      id: "show-metadata-extraction-preview",
      name: COMMAND_NAMES.showMetadataPreview,
      callback: async () => {
        await this.showMetadataExtractionPreview();
      },
    });

    this.addCommand({
      id: "preview-semantic-enrichment-candidates",
      name: COMMAND_NAMES.previewSemanticCandidates,
      callback: async () => {
        await this.previewSemanticEnrichmentCandidates();
      },
    });

    this.addCommand({
      id: "show-related-graph",
      name: COMMAND_NAMES.showRelatedGraph,
      callback: async () => {
        await this.showRelatedGraph();
      },
    });

    this.addCommand({
      id: "show-graph-for-folder",
      name: COMMAND_NAMES.showGraphForFolder,
      callback: async () => {
        await this.showGraphForActiveFolder();
      },
    });

    this.addCommand({
      id: "promote-selection-to-long-term-memory",
      name: COMMAND_NAMES.promoteSelection,
      editorCallback: (editor, ctx) => {
        void this.promoteSelectionToLongTermMemory(editor.getSelection(), ctx.file);
      },
    });

    this.addCommand({
      id: "export-codex-context-for-current-note",
      name: COMMAND_NAMES.exportCodexContext,
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
      new Notice(result.ok ? "Neo4j 연결 성공" : `Neo4j 연결 실패: ${result.message}`);
    } finally {
      await client.close();
    }
  }

  private async initializeNeo4jSchema(): Promise<void> {
    const client = new Neo4jClient(this.settings);

    try {
      const schema = new Neo4jSchemaService(client);
      const result = await schema.initializeSchema();
      new Notice(`Neo4j 스키마 초기화 완료: ${result.applied.length}개 구문 적용됨.`);
    } catch (error) {
      new Notice(`Neo4j 스키마 초기화 실패: ${sanitizeNeo4jError(error, this.settings)}`);
    } finally {
      await client.close();
    }
  }

  private createIndexingServices(): void {
    this.vaultIndexer = new VaultIndexer(this.app, this.settings);
    this.indexQueue = new VaultIndexQueue(
      (items) => this.processQueueItems(items),
      this.settings.indexDebounceMs,
      (report) => this.notifyIndexingReport(AUTO_INDEX_PREFIX, report, false),
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
        void this.indexVault(STARTUP_INDEX_PREFIX);
      });
    }
  }

  private async indexCurrentNote(prefix = INDEX_CURRENT_PREFIX): Promise<void> {
    const report = await this.getVaultIndexer().indexCurrentNote(true);
    this.notifyIndexingReport(prefix, report);
  }

  private async indexVault(prefix = INDEX_VAULT_PREFIX): Promise<void> {
    const report = await this.getVaultIndexer().indexVault(true);
    this.notifyIndexingReport(prefix, report);
  }

  private async flushChangedNotes(prefix = REINDEX_CHANGED_PREFIX): Promise<void> {
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
      new Notice("컨텍스트 그래프 메모리: 메타데이터 미리보기를 실행하려면 마크다운 노트를 열어주세요.");
      return;
    }

    try {
      const content = await this.app.vault.cachedRead(activeFile);
      const cache = this.app.metadataCache.getFileCache(activeFile);
      const metadata = new NoteMetadataExtractor().extract(activeFile, cache, content);
      const payload = buildMetadataPreviewPayload(metadata, this.settings.dataForgeCompatibilityMode);

      new MetadataPreviewModal(this.app, payload).open();
      new Notice(
        `메타데이터 미리보기 완료 (${payload.dataForgeCompatibility.relationCandidateCount}개 관계 후보).`,
      );
    } catch (error) {
      new Notice(`메타데이터 미리보기 실패: ${sanitizeNeo4jError(error, this.settings)}`);
    }
  }

  private async previewSemanticEnrichmentCandidates(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || !isMarkdownFile(activeFile)) {
      new Notice("컨텍스트 그래프 메모리: 시맨틱 보강 후보를 보려면 마크다운 노트를 열어주세요.");
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
        `시맨틱 보강 후보 승인 완료: ${report.approved}/${report.attempted}개`,
      );
    } catch (error) {
      new Notice(`시맨틱 보강 처리 실패: ${sanitizeNeo4jError(error, this.settings)}`);
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
          menu.addItem((item) => {
            item
              .setTitle("Obsidian Raw local graph 열기")
              .setIcon("git-fork")
              .onClick(() => {
                this.openObsidianLocalGraph("Obsidian Raw local graph를 열었습니다.");
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
          menu.addItem((item) => {
            item
              .setTitle("Obsidian Raw local graph 열기")
              .setIcon("git-fork")
              .onClick(() => {
                void this.openObsidianFolderRawGraph(file.path);
              });
          });
        }
      }),
    );
  }

  private async showRelatedGraph(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || !isMarkdownFile(activeFile)) {
      new Notice("컨텍스트 그래프 메모리: 활성 마크다운 노트가 없습니다.");
      return;
    }

    await this.showGraphForFile(activeFile);
  }

  private async showGraphForActiveFolder(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    const folderPath = activeFile?.parent?.path;

    if (folderPath === undefined) {
      new Notice("컨텍스트 그래프 메모리: 활성 폴더가 없습니다.");
      return;
    }

    await this.showGraphForFolderPath(folderPath);
  }

  private async showGraphForFile(file: TFile): Promise<void> {
    try {
      const report = await this.getVaultIndexer().indexFile(file, true);
      this.notifyIndexingReport(GRAPH_FILE_INDEX_PREFIX, report, false);
      const scope = createNoteGraphScope(file.path, this.settings);
      const result = await this.getGraphQueryService().getGraph(scope);
      this.lastGraphResult = result;
      await this.openGraphPanel(result);
      this.notifyGraphResult(RELATED_GRAPH_READY_PREFIX, result);
    } catch (error) {
      new Notice(`그래프 조회 실패: ${sanitizeNeo4jError(error, this.settings)}`);
    }
  }

  private async showGraphForFolderPath(path: string): Promise<void> {
    try {
      const report = await this.getVaultIndexer().indexFolder(path, true);
      this.notifyIndexingReport(GRAPH_FOLDER_INDEX_PREFIX, report, false);
      const scope = createFolderGraphScope(path, this.settings);
      const result = await this.getGraphQueryService().getGraph(scope);
      this.lastGraphResult = result;
      await this.openGraphPanel(result);
      this.notifyGraphResult(FOLDER_GRAPH_READY_PREFIX, result);
    } catch (error) {
      new Notice(`폴더 그래프 조회 실패: ${sanitizeNeo4jError(error, this.settings)}`);
    }
  }

  private async promoteSelectionToLongTermMemory(selection: string, file: TFile | null): Promise<void> {
    if (!file || !isMarkdownFile(file)) {
      new Notice("컨텍스트 그래프 메모리: 기억으로 승격하려면 마크다운 노트를 열어주세요.");
      return;
    }

    const text = normalizeSelectedText(selection);
    if (text.length === 0) {
      new Notice("컨텍스트 그래프 메모리: 승격할 텍스트를 선택해주세요.");
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
      new Notice(`메모리 승격 실패: ${sanitizeNeo4jError(error, this.settings)}`);
      return;
    }

    try {
      await new MemoryInboxWriter(this.app.vault, this.settings.memoryInboxPath).append(memory);
    } catch (error) {
      new Notice(`Neo4j에 메모리를 저장했지만 메모리 인박스 저장 실패: ${sanitizeNeo4jError(error, this.settings)}`);
      return;
    }

    new Notice(`${formatMemoryTypeLabel(type)} 타입 메모리가 기록되었습니다.`);
  }

  private async chooseMemoryType(selection: string): Promise<MemoryType | null> {
    return new Promise((resolve) => {
      new MemoryTypeModal(this.app, selection, resolve).open();
    });
  }

  private async exportCodexContextForCurrentNote(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || !isMarkdownFile(activeFile)) {
      new Notice("컨텍스트 그래프 메모리: Codex 컨텍스트를 내보내려면 마크다운 노트를 열어주세요.");
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
      const warning = graphError ? " (그래프 조회 경고 포함)" : "";
      new Notice(`Codex 컨텍스트를${warning} 내보냈습니다: ${outputPath}.`);
    } catch (error) {
      new Notice(`Codex 컨텍스트 내보내기 실패: ${sanitizeNeo4jError(error, this.settings)}`);
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
      throw new Error("컨텍스트 그래프 메모리 그래프 뷰를 열지 못했습니다.");
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
    new Notice(`${prefix}: 노드 ${result.summary.nodeCount}개, 엣지 ${result.summary.edgeCount}개.`);
  }

  private openObsidianLocalGraph(
    successMessage: string,
    preferredCommandIds: readonly string[] = OBSIDIAN_LOCAL_GRAPH_COMMAND_IDS,
  ): boolean {
    const commands = (this.app as AppWithCommands).commands;
    const commandId = preferredCommandIds.find((id) =>
      commands?.listCommands?.().some((command) => command.id === id),
    );

    if (!commandId) {
      new Notice("Obsidian 기본 로컬 그래프 명령을 찾지 못했습니다. 코어 플러그인에서 그래프 뷰가 활성화되어 있는지 확인하세요.");
      return false;
    }

    commands?.executeCommandById?.(commandId);
    new Notice(successMessage);
    return true;
  }

  private async openObsidianFolderRawGraph(folderPath: string): Promise<boolean> {
    const search = buildFolderGraphSearch(folderPath);

    try {
      const leaf =
        getExistingGraphLeaf(this.app.workspace.getLeavesOfType("graph")) ??
        this.app.workspace.getRightLeaf(false) ??
        this.app.workspace.getLeaf(true);

      await leaf.setViewState(buildFolderGraphViewState(folderPath, leaf.getViewState()));
      await this.app.workspace.revealLeaf(leaf);
      await leaf.loadIfDeferred();

      const scopeText = search.length > 0 ? `${folderPath} (${search})` : "vault 전체";
      new Notice(`Obsidian Raw local graph를 폴더 범위로 열었습니다: ${scopeText}`);
      return true;
    } catch (error) {
      const opened = this.openObsidianLocalGraph(
        "Obsidian 기본 그래프는 열었지만 폴더 필터를 자동 적용하지 못했습니다.",
        OBSIDIAN_GLOBAL_GRAPH_COMMAND_IDS,
      );

      if (opened && search.length > 0) {
        new Notice(`그래프 검색 필터에 직접 입력하세요: ${search}`);
      }

      return opened;
    }
  }
}

function isMarkdownPath(path: string): boolean {
  return path.toLowerCase().endsWith(".md");
}

function formatMemoryTypeLabel(type: string): string {
  if (type === "Preference") {
    return "선호";
  }

  if (type === "Rule") {
    return "규칙";
  }

  if (type === "Decision") {
    return "결정";
  }

  return type;
}
