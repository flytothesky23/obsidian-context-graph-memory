import { ItemView, type WorkspaceLeaf } from "obsidian";
import { CytoscapeRenderer } from "../graph/cytoscape-renderer";
import type { CytoscapeNodeData } from "../graph/cytoscape-adapter";
import type { FolderGraphSummary, GraphEdge, GraphNode, GraphResult } from "../graph/graph-scope";
import { formatRelationType } from "../graph/labels";
import type { ContextGraphMemorySettings } from "../types";

export const VIEW_TYPE_CONTEXT_GRAPH = "context-graph-memory-graph-view";

const KOREAN_TEXT = {
  displayText: "컨텍스트 그래프 메모리",
  fitButton: "맞춤",
  resetButton: "초기화",
  fitTooltip: "그래프를 패널 크기에 맞추기",
  resetTooltip: "줌/팬 초기화",
  emptyState: "명령 팔레트에서 '관련 그래프 보기' 또는 파일 탐색기 메뉴에서 'Neo4j 그래프 보기'로 그래프를 불러오세요.",
  noGraph: "로드된 그래프가 없습니다.",
  panelTabs: {
    summary: "요약",
    detail: "속성",
    table: "테이블",
  },
  nodeDetailTitle: "노드 상세",
  nodeDetailHint: "노드를 선택하면 라벨, 경로, 속성을 확인할 수 있습니다.",
  keyLabels: {
    kind: "유형",
    labels: "레이블",
    path: "경로",
    title: "제목",
    scope: "범위",
  },
  insight: {
    overview: "그래프 개요",
    folderHealth: "폴더 정합성",
    interpretation: "해석",
    readPriority: "읽기 우선순위",
    connectedNotes: "연결 노트",
    externalContext: "외부 문맥",
    relationTypes: "관계 유형",
    warnings: "주의",
    noCentralNotes: "아직 중심 노트를 판단할 만큼 내부 연결이 충분하지 않습니다.",
    noConnectedNotes: "현재 범위에서 직접 읽어야 할 연결 노트가 아직 없습니다.",
    noExternalContext: "폴더 밖으로 이어지는 주요 브릿지 노트가 없습니다.",
    noWarnings: "현재 결과에서 즉시 표시할 경고는 없습니다.",
    noRelations: "표시할 관계가 없습니다.",
  },
  properties: "속성",
  summary: {
    graph: (scopeType: string) => `${scopeType} 그래프`,
    scopeType: {
      note: "노트",
      folder: "폴더",
      selection: "선택",
      default: "범위",
    },
    nodeCount: (count: number) => `${count}개 노드`,
    edgeCount: (count: number) => `${count}개 엣지`,
    depth: (depth: number) => `깊이 ${depth}`,
    truncated: "잘림",
  },
  folderSummary: {
    folderNotes: (displayed: number, total: number) => `폴더 노트 ${displayed}/${total}`,
    isolated: (count: number) => `고립 노트 ${count}`,
    internalLinks: (count: number) => `내부 링크 ${count}`,
    bridgeNotes: (displayed: number, total: number) => `브릿지 노트 ${displayed}/${total}`,
    bridgeNodes: (displayed: number, total: number) => `브릿지 노드 ${displayed}/${total}`,
    centralLabel: "중심",
    isolatedLabel: "고립",
    bridgeLabel: "외부 브릿지",
    limitLabel: (reason: string) => `제한: ${reason}`,
  },
  fallback: {
    title: "렌더러 대체 보기",
    nodesHeader: "노드",
    edgesHeader: "엣지",
    jsonDebug: "JSON 디버그",
  },
  scopeRole: {
    folderInternal: "폴더 내부",
    externalBridge: "외부 브릿지",
  },
  truncationReason: {
    folderNoteLimit: "폴더 노트 제한",
    externalBridgeLimit: "외부 브릿지 제한",
  },
};

const SENSITIVE_PLACEHOLDER = "[마스킹]";
const NESTED_PLACEHOLDER = "[중첩]";
type GraphInspectorPanel = "summary" | "detail" | "table";

export class GraphView extends ItemView {
  private result: GraphResult | null = null;
  private renderer: CytoscapeRenderer | null = null;
  private graphContainerEl: HTMLDivElement | null = null;
  private summaryEl: HTMLDivElement | null = null;
  private detailEl: HTMLDivElement | null = null;
  private fallbackEl: HTMLDivElement | null = null;
  private inspectorTabsEl: HTMLDivElement | null = null;
  private activePanel: GraphInspectorPanel = "summary";
  private tabButtons = new Map<GraphInspectorPanel, HTMLButtonElement>();
  private fallbackReason: string | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly settings: ContextGraphMemorySettings,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_CONTEXT_GRAPH;
  }

  getDisplayText(): string {
    return KOREAN_TEXT.displayText;
  }

  getIcon(): string {
    return "network";
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.classList.add("context-graph-memory-view");
    applyStyles(this.contentEl, {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      height: "100%",
      minHeight: "0",
      overflow: "hidden",
      padding: "10px",
    });

    this.buildChrome();

    if (this.result) {
      this.renderResult();
    } else {
      this.renderEmptyState();
    }
  }

  async onClose(): Promise<void> {
    this.renderer?.destroy();
    this.renderer = null;
  }

  setGraphResult(result: GraphResult): void {
    this.result = result;
    this.activePanel = "summary";
    this.fallbackReason = null;
    this.renderResult();
  }

  fitGraph(): void {
    this.renderer?.fit();
  }

  resetGraphView(): void {
    this.renderer?.resetView();
  }

  private buildChrome(): void {
    const headerEl = this.contentEl.createDiv();
    applyStyles(headerEl, {
      display: "flex",
      flexDirection: "column",
      flexShrink: "0",
    });

    const titleRowEl = headerEl.createDiv();
    applyStyles(titleRowEl, {
      alignItems: "center",
      display: "flex",
      gap: "8px",
      justifyContent: "space-between",
    });

    titleRowEl.createEl("h3", { text: KOREAN_TEXT.displayText });
    const toolbarEl = titleRowEl.createDiv();
    applyStyles(toolbarEl, {
      alignItems: "center",
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
      justifyContent: "flex-end",
    });

    this.createToolbarButton(toolbarEl, KOREAN_TEXT.fitButton, KOREAN_TEXT.fitTooltip, () => this.fitGraph());
    this.createToolbarButton(toolbarEl, KOREAN_TEXT.resetButton, KOREAN_TEXT.resetTooltip, () => this.resetGraphView());

    const bodyEl = this.contentEl.createDiv();
    applyStyles(bodyEl, {
      display: "grid",
      flex: "1 1 auto",
      gap: "10px",
      gridTemplateRows: "minmax(300px, 1fr) minmax(170px, 34%)",
      minHeight: "0",
      overflow: "hidden",
    });

    this.graphContainerEl = bodyEl.createDiv();
    applyStyles(this.graphContainerEl, {
      background: "var(--background-primary)",
      border: "1px solid var(--background-modifier-border)",
      borderRadius: "6px",
      minHeight: "300px",
      overflow: "hidden",
      position: "relative",
      width: "100%",
    });

    const inspectorEl = bodyEl.createDiv();
    applyStyles(inspectorEl, {
      border: "1px solid var(--background-modifier-border)",
      borderRadius: "6px",
      display: "flex",
      flexDirection: "column",
      minHeight: "0",
      overflow: "hidden",
    });

    this.inspectorTabsEl = inspectorEl.createDiv();
    applyStyles(this.inspectorTabsEl, {
      alignItems: "center",
      borderBottom: "1px solid var(--background-modifier-border)",
      display: "flex",
      flexShrink: "0",
      gap: "4px",
      padding: "6px",
    });
    this.tabButtons.clear();
    this.createInspectorTab(this.inspectorTabsEl, "summary", KOREAN_TEXT.panelTabs.summary);
    this.createInspectorTab(this.inspectorTabsEl, "detail", KOREAN_TEXT.panelTabs.detail);
    this.createInspectorTab(this.inspectorTabsEl, "table", KOREAN_TEXT.panelTabs.table);

    const panelEl = inspectorEl.createDiv();
    applyStyles(panelEl, {
      flex: "1 1 auto",
      minHeight: "0",
      overflow: "hidden",
      position: "relative",
    });

    this.summaryEl = this.createInspectorPanel(panelEl);
    this.detailEl = this.createInspectorPanel(panelEl);
    this.fallbackEl = this.createInspectorPanel(panelEl);
    this.updateInspectorPanelVisibility();
  }

  private createToolbarButton(
    parentEl: HTMLElement,
    text: string,
    title: string,
    onClick: () => void,
  ): HTMLButtonElement {
    const buttonEl = parentEl.createEl("button", { text, title });
    buttonEl.type = "button";
    applyStyles(buttonEl, {
      fontSize: "12px",
      padding: "3px 8px",
      whiteSpace: "nowrap",
    });
    buttonEl.addEventListener("click", onClick);
    return buttonEl;
  }

  private createInspectorTab(parentEl: HTMLElement, panel: GraphInspectorPanel, text: string): HTMLButtonElement {
    const buttonEl = parentEl.createEl("button", { text });
    buttonEl.type = "button";
    applyStyles(buttonEl, {
      fontSize: "12px",
      padding: "3px 9px",
      whiteSpace: "nowrap",
    });
    buttonEl.addEventListener("click", () => this.setActivePanel(panel));
    this.tabButtons.set(panel, buttonEl);
    return buttonEl;
  }

  private createInspectorPanel(parentEl: HTMLElement): HTMLDivElement {
    const panelEl = parentEl.createDiv();
    applyStyles(panelEl, {
      boxSizing: "border-box",
      height: "100%",
      overflow: "auto",
      padding: "10px",
      width: "100%",
    });
    return panelEl;
  }

  private setActivePanel(panel: GraphInspectorPanel): void {
    this.activePanel = panel;
    this.updateInspectorPanelVisibility();
  }

  private renderEmptyState(): void {
    this.setActivePanel("summary");
    this.summaryEl?.empty();
    this.summaryEl?.createEl("p", { text: KOREAN_TEXT.emptyState });
    this.graphContainerEl?.empty();
    this.graphContainerEl?.createDiv({ text: KOREAN_TEXT.noGraph });
    this.renderNodeDetail(null);
    this.renderFallback(null);
  }

  private renderResult(): void {
    if (!this.result || !this.graphContainerEl) {
      return;
    }

    this.renderSummary(this.result);
    this.renderNodeDetail(null);
    this.renderFallback(null);

    this.renderer?.destroy();
    this.renderer = new CytoscapeRenderer(this.graphContainerEl, {
      layout: this.settings.graphLayout,
      fitOnOpen: this.settings.graphFitOnOpen,
      onNodeSelect: (node) => {
        this.renderNodeDetail(node);
        this.setActivePanel("detail");
      },
      onRenderFallback: (reason) => {
        this.fallbackReason = reason;
        this.renderFallback(reason);
        this.setActivePanel("table");
      },
    });
    this.renderer.render(this.result);
  }

  private renderSummary(result: GraphResult): void {
    if (!this.summaryEl) {
      return;
    }

    const summary = result.summary;
    const scopeType =
      formatScopeType(summary.scopeType) ?? KOREAN_TEXT.summary.scopeType.default;

    this.summaryEl.empty();

    const overviewEl = this.createSummarySection(this.summaryEl, KOREAN_TEXT.insight.overview);
    this.renderKeyValueTable(overviewEl, [
      ["범위", KOREAN_TEXT.summary.graph(scopeType)],
      ["대상", summary.targetPath ?? "-"],
      ["규모", `${KOREAN_TEXT.summary.nodeCount(summary.nodeCount)} · ${KOREAN_TEXT.summary.edgeCount(summary.edgeCount)}`],
      ["깊이", summary.depth ? KOREAN_TEXT.summary.depth(summary.depth) : "-"],
      ["제한", summary.truncated ? KOREAN_TEXT.summary.truncated : "없음"],
    ]);

    if (summary.folder) {
      this.renderFolderInsights(this.summaryEl, summary.folder);
    } else {
      this.renderNoteInsights(this.summaryEl, result);
    }

    this.renderRelationTypes(this.summaryEl, result.edges);

    if (summary.warnings.length > 0) {
      this.renderInsightList(this.summaryEl, KOREAN_TEXT.insight.warnings, summary.warnings, KOREAN_TEXT.insight.noWarnings);
    }
  }

  private renderNodeDetail(node: CytoscapeNodeData | null): void {
    if (!this.detailEl) {
      return;
    }

    this.detailEl.empty();

    if (!node) {
      this.detailEl.createEl("strong", { text: KOREAN_TEXT.nodeDetailTitle });
      this.detailEl.createEl("p", { text: KOREAN_TEXT.nodeDetailHint });
      return;
    }

    this.detailEl.createEl("strong", { text: node.label });
    const metaEl = this.detailEl.createDiv();
    applyStyles(metaEl, {
      display: "grid",
      gap: "4px",
      marginTop: "6px",
    });

    this.createKeyValueRow(metaEl, KOREAN_TEXT.keyLabels.kind, formatNodeKind(node.kind));
    this.createKeyValueRow(metaEl, KOREAN_TEXT.keyLabels.labels, node.labels.join(", "));
    if (node.path) {
      this.createKeyValueRow(metaEl, KOREAN_TEXT.keyLabels.path, node.path);
    }
    if (node.title) {
      this.createKeyValueRow(metaEl, KOREAN_TEXT.keyLabels.title, node.title);
    }
    if (node.scopeRole) {
      this.createKeyValueRow(metaEl, KOREAN_TEXT.keyLabels.scope, formatScopeRole(node.scopeRole));
    }

    const properties = sanitizeRecordForDisplay(node.properties);
    if (Object.keys(properties).length > 0) {
      this.detailEl.createEl("h4", { text: KOREAN_TEXT.properties });
      const propertyEl = this.detailEl.createEl("pre");
      applyStyles(propertyEl, {
        margin: "0",
        overflow: "auto",
        whiteSpace: "pre-wrap",
      });
      propertyEl.setText(JSON.stringify(properties, null, 2));
    }
  }

  private renderFolderInsights(parentEl: HTMLElement, folder: FolderGraphSummary): void {
    const healthEl = this.createSummarySection(parentEl, KOREAN_TEXT.insight.folderHealth);
    this.renderKeyValueTable(healthEl, [
      ["폴더 노트", KOREAN_TEXT.folderSummary.folderNotes(folder.displayedInternalNotes, folder.totalInternalNotes)],
      ["내부 링크", KOREAN_TEXT.folderSummary.internalLinks(folder.internalLinks)],
      ["고립 노트", KOREAN_TEXT.folderSummary.isolated(folder.isolatedInternalNotes)],
      [
        "외부 브릿지",
        `${KOREAN_TEXT.folderSummary.bridgeNotes(folder.displayedExternalBridgeNotes, folder.displayedExternalBridgeNotes)} · ${KOREAN_TEXT.folderSummary.bridgeNodes(folder.displayedExternalBridgeNodes, folder.totalExternalBridgeNodes)}`,
      ],
    ]);

    const diagnostics: string[] = [];
    if (folder.centralNotes.length > 0) {
      diagnostics.push(`먼저 읽을 중심 노트는 ${folder.centralNotes[0].label}입니다. 이 노트가 폴더 내부 연결을 가장 많이 모읍니다.`);
    }
    if (folder.isolatedInternalNotes > 0) {
      diagnostics.push(`고립 노트 ${folder.isolatedInternalNotes}개는 목차, 색인, 관련 노트 링크 보강 후보입니다.`);
    }
    if (folder.internalLinks === 0) {
      diagnostics.push("폴더 내부 링크가 아직 없습니다. 폴더 전체는 문서 모음처럼 보이지만 지식망으로는 연결되지 않았습니다.");
    }
    if (folder.externalBridgeNotes.length > 0) {
      diagnostics.push(`외부 브릿지는 ${folder.externalBridgeNotes[0].label}부터 확인하세요. 폴더 밖 맥락과 이어지는 지점입니다.`);
    }
    if (folder.truncationReason) {
      diagnostics.push(KOREAN_TEXT.folderSummary.limitLabel(formatTruncationReason(folder.truncationReason)));
    }

    this.renderInsightList(parentEl, KOREAN_TEXT.insight.interpretation, diagnostics, KOREAN_TEXT.insight.noWarnings);
    this.renderInsightList(
      parentEl,
      KOREAN_TEXT.insight.readPriority,
      folder.centralNotes.map((node) => `${node.label} · 전체 연결 ${node.degree} · 내부 ${node.internalDegree}`),
      KOREAN_TEXT.insight.noCentralNotes,
    );
    this.renderInsightList(
      parentEl,
      KOREAN_TEXT.folderSummary.isolatedLabel,
      folder.isolatedNotes.map((node) => node.label),
      "고립 노트가 없습니다.",
    );
    this.renderInsightList(
      parentEl,
      KOREAN_TEXT.insight.externalContext,
      folder.externalBridgeNotes.map((node) => `${node.label} · 외부 연결 ${node.bridgeDegree}`),
      KOREAN_TEXT.insight.noExternalContext,
    );
  }

  private renderNoteInsights(parentEl: HTMLElement, result: GraphResult): void {
    const connectedNotes = this.getTopConnectedNotes(result, 8);
    const diagnostics: string[] = [];

    if (connectedNotes.length > 0) {
      diagnostics.push(`현재 노트는 ${connectedNotes.length}개 주요 노트와 연결되어 있습니다. 먼저 연결 수가 큰 노트부터 읽으면 맥락 회복이 빠릅니다.`);
    }
    if (result.edges.length === 0) {
      diagnostics.push("현재 노트 주변에 표시할 관계가 없습니다. 링크, 태그, frontmatter 관계 필드를 보강해야 합니다.");
    }
    if (result.summary.truncated) {
      diagnostics.push("그래프가 노드 제한에 걸렸습니다. 설정의 최대 노드 수나 깊이를 조정해 확인하세요.");
    }

    this.renderInsightList(parentEl, KOREAN_TEXT.insight.interpretation, diagnostics, KOREAN_TEXT.insight.noWarnings);
    this.renderInsightList(
      parentEl,
      KOREAN_TEXT.insight.connectedNotes,
      connectedNotes.map((node) => `${node.label} · 연결 ${node.degree}`),
      KOREAN_TEXT.insight.noConnectedNotes,
    );
  }

  private renderRelationTypes(parentEl: HTMLElement, edges: GraphEdge[]): void {
    const counts = this.getRelationCounts(edges);
    const sectionEl = this.createSummarySection(parentEl, KOREAN_TEXT.insight.relationTypes);
    if (counts.length === 0) {
      sectionEl.createEl("p", { text: KOREAN_TEXT.insight.noRelations });
      return;
    }

    this.renderKeyValueTable(
      sectionEl,
      counts.map((item): [string, string] => [item.label, `${item.count}개`]),
    );
  }

  private createSummarySection(parentEl: HTMLElement, title: string): HTMLElement {
    const sectionEl = parentEl.createDiv();
    applyStyles(sectionEl, {
      borderTop: "1px solid var(--background-modifier-border)",
      marginTop: "10px",
      paddingTop: "8px",
    });
    sectionEl.createEl("h4", { text: title });
    return sectionEl;
  }

  private renderKeyValueTable(parentEl: HTMLElement, rows: Array<[string, string]>): void {
    const tableEl = parentEl.createEl("table");
    applyStyles(tableEl, {
      borderCollapse: "collapse",
      fontSize: "12px",
      width: "100%",
    });

    const bodyEl = tableEl.createEl("tbody");
    for (const [key, value] of rows) {
      const rowEl = bodyEl.createEl("tr");
      this.renderTableCell(rowEl, key);
      this.renderTableCell(rowEl, value);
    }
  }

  private renderInsightList(parentEl: HTMLElement, title: string, items: string[], emptyText: string): void {
    const sectionEl = this.createSummarySection(parentEl, title);
    const listEl = sectionEl.createEl("ul");
    applyStyles(listEl, {
      margin: "4px 0 0 16px",
      padding: "0",
    });

    const visibleItems = items.length > 0 ? items : [emptyText];
    for (const item of visibleItems) {
      const itemEl = listEl.createEl("li", { text: item });
      applyStyles(itemEl, {
        marginBottom: "3px",
        overflowWrap: "anywhere",
      });
      if (items.length === 0) {
        itemEl.style.color = "var(--text-muted)";
      }
    }
  }

  private getTopConnectedNotes(result: GraphResult, limit: number): Array<{ label: string; degree: number }> {
    const degreeById = new Map<string, number>();
    for (const edge of result.edges) {
      degreeById.set(edge.source, (degreeById.get(edge.source) ?? 0) + 1);
      degreeById.set(edge.target, (degreeById.get(edge.target) ?? 0) + 1);
    }

    return result.nodes
      .filter((node) => node.kind === "Note" && node.path !== result.summary.targetPath)
      .map((node) => ({
        label: node.label,
        degree: degreeById.get(node.id) ?? 0,
      }))
      .filter((node) => node.degree > 0)
      .sort((left, right) => right.degree - left.degree || left.label.localeCompare(right.label))
      .slice(0, limit);
  }

  private getRelationCounts(edges: GraphEdge[]): Array<{ label: string; count: number }> {
    const counts = new Map<string, number>();
    for (const edge of edges) {
      const label = formatRelationType(edge.type);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
  }

  private createKeyValueRow(parentEl: HTMLElement, key: string, value: string): void {
    const rowEl = parentEl.createDiv();
    applyStyles(rowEl, {
      display: "grid",
      gap: "6px",
      gridTemplateColumns: "72px minmax(0, 1fr)",
    });
    const keyEl = rowEl.createSpan({ text: key });
    applyStyles(keyEl, {
      color: "var(--text-muted)",
      fontSize: "12px",
    });
    const valueEl = rowEl.createSpan({ text: value });
    applyStyles(valueEl, {
      overflowWrap: "anywhere",
    });
  }

  private renderFallback(reason: string | null): void {
    if (!this.fallbackEl) {
      return;
    }

    this.fallbackEl.empty();

    if (reason) {
      this.fallbackEl.createEl("strong", { text: KOREAN_TEXT.fallback.title });
      this.fallbackEl.createEl("p", { text: reason });
    }

    if (this.result) {
      this.renderNodesTable(this.fallbackEl, this.result.nodes);
      this.renderEdgesTable(this.fallbackEl, this.result.edges, this.result.nodes);
      this.renderJsonDebug(this.fallbackEl, this.result);
    }

    this.updateInspectorPanelVisibility();
  }

  private renderNodesTable(parentEl: HTMLElement, nodes: GraphNode[]): void {
    parentEl.createEl("h4", { text: KOREAN_TEXT.fallback.nodesHeader });
    const tableEl = parentEl.createEl("table");
    applyStyles(tableEl, {
      borderCollapse: "collapse",
      fontSize: "12px",
      width: "100%",
    });
    this.renderTableHeader(tableEl, ["라벨", "유형", "경로"]);

    const bodyEl = tableEl.createEl("tbody");
    for (const node of nodes) {
      const rowEl = bodyEl.createEl("tr");
      this.renderTableCell(rowEl, node.label);
      this.renderTableCell(rowEl, formatNodeKind(node.kind));
      this.renderTableCell(rowEl, node.path ?? "");
    }
  }

  private renderEdgesTable(parentEl: HTMLElement, edges: GraphEdge[], nodes: GraphNode[]): void {
    const nodeLabelsById = new Map(nodes.map((node) => [node.id, node.label]));

    parentEl.createEl("h4", { text: KOREAN_TEXT.fallback.edgesHeader });
    const tableEl = parentEl.createEl("table");
    applyStyles(tableEl, {
      borderCollapse: "collapse",
      fontSize: "12px",
      width: "100%",
    });
    this.renderTableHeader(tableEl, ["유형", "시작", "끝"]);

    const bodyEl = tableEl.createEl("tbody");
    for (const edge of edges) {
      const rowEl = bodyEl.createEl("tr");
      this.renderTableCell(rowEl, formatRelationType(edge.type));
      this.renderTableCell(rowEl, nodeLabelsById.get(edge.source) ?? edge.source);
      this.renderTableCell(rowEl, nodeLabelsById.get(edge.target) ?? edge.target);
    }
  }

  private renderTableHeader(tableEl: HTMLTableElement, columns: string[]): void {
    const headEl = tableEl.createEl("thead");
    const rowEl = headEl.createEl("tr");
    for (const column of columns) {
      const cellEl = rowEl.createEl("th", { text: column });
      applyStyles(cellEl, {
        borderBottom: "1px solid var(--background-modifier-border)",
        padding: "3px 5px",
        textAlign: "left",
      });
    }
  }

  private renderTableCell(rowEl: HTMLTableRowElement, value: string): void {
    const cellEl = rowEl.createEl("td", { text: value });
    applyStyles(cellEl, {
      borderBottom: "1px solid var(--background-modifier-border)",
      maxWidth: "240px",
      overflowWrap: "anywhere",
      padding: "3px 5px",
      verticalAlign: "top",
    });
  }

  private renderJsonDebug(parentEl: HTMLElement, result: GraphResult): void {
    const detailsEl = parentEl.createEl("details");
    detailsEl.createEl("summary", { text: KOREAN_TEXT.fallback.jsonDebug });
    const preEl = detailsEl.createEl("pre");
    applyStyles(preEl, {
      margin: "8px 0 0",
      overflow: "auto",
      whiteSpace: "pre-wrap",
    });
    preEl.setText(JSON.stringify(sanitizeGraphResultForDisplay(result), null, 2));
  }

  private updateInspectorPanelVisibility(): void {
    const panels: Array<[GraphInspectorPanel, HTMLDivElement | null]> = [
      ["summary", this.summaryEl],
      ["detail", this.detailEl],
      ["table", this.fallbackEl],
    ];

    for (const [panel, panelEl] of panels) {
      if (panelEl) {
        panelEl.style.display = panel === this.activePanel ? "block" : "none";
      }
    }

    for (const [panel, buttonEl] of this.tabButtons.entries()) {
      const active = panel === this.activePanel;
      buttonEl.style.backgroundColor = active ? "var(--background-modifier-hover)" : "";
      buttonEl.style.fontWeight = active ? "600" : "";
    }
  }
}

function sanitizeGraphResultForDisplay(result: GraphResult): GraphResult {
  return {
    ...result,
    nodes: result.nodes.map((node) => ({
      ...node,
      properties: sanitizeRecordForDisplay(node.properties),
    })),
    edges: result.edges.map((edge) => ({
      ...edge,
      properties: sanitizeRecordForDisplay(edge.properties),
    })),
  };
}

function sanitizeRecordForDisplay(record: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    sanitized[key] = isSensitiveKey(key) ? SENSITIVE_PLACEHOLDER : sanitizeValueForDisplay(value, 0);
  }
  return sanitized;
}

function sanitizeValueForDisplay(value: unknown, depth: number): unknown {
  if (depth >= 4) {
    return NESTED_PLACEHOLDER;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValueForDisplay(item, depth + 1));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, childValue] of Object.entries(value)) {
    sanitized[key] = isSensitiveKey(key) ? SENSITIVE_PLACEHOLDER : sanitizeValueForDisplay(childValue, depth + 1);
  }
  return sanitized;
}

function formatScopeType(scopeType: GraphResult["summary"]["scopeType"]): string {
  return KOREAN_TEXT.summary.scopeType[scopeType] ?? KOREAN_TEXT.summary.scopeType.default;
}

function formatNodeKind(kind: string): string {
  if (kind === "Note") {
    return "노트";
  }

  if (kind === "Tag") {
    return "태그";
  }

  if (kind === "Memory") {
    return "메모리";
  }

  if (kind === "Concept") {
    return "개념";
  }

  if (kind === "Preference") {
    return "선호";
  }

  if (kind === "Rule") {
    return "규칙";
  }

  if (kind === "Decision") {
    return "결정";
  }

  if (kind === "Person") {
    return "인물";
  }

  if (kind === "Organization") {
    return "조직";
  }

  if (kind === "System") {
    return "시스템";
  }

  if (kind === "Project") {
    return "프로젝트";
  }

  return kind;
}

function isSensitiveKey(key: string): boolean {
  return /(password|passwd|token|secret|credential|auth|login|runtime[_-]?log)/iu.test(key);
}

function formatScopeRole(scopeRole: string): string {
  if (scopeRole === "folder-internal") {
    return KOREAN_TEXT.scopeRole.folderInternal;
  }

  if (scopeRole === "external-bridge") {
    return KOREAN_TEXT.scopeRole.externalBridge;
  }

  return scopeRole;
}

function formatTruncationReason(reason: string): string {
  if (reason === "folder-note-limit") {
    return KOREAN_TEXT.truncationReason.folderNoteLimit;
  }

  if (reason === "external-bridge-limit") {
    return KOREAN_TEXT.truncationReason.externalBridgeLimit;
  }

  return reason;
}

function applyStyles(element: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(element.style, styles);
}
