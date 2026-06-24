import { ItemView, type WorkspaceLeaf } from "obsidian";
import { CytoscapeRenderer } from "../graph/cytoscape-renderer";
import type { CytoscapeNodeData } from "../graph/cytoscape-adapter";
import type { FolderGraphSummary, FolderGraphSummaryNode, GraphEdge, GraphNode, GraphResult } from "../graph/graph-scope";
import type { ContextGraphMemorySettings } from "../types";

export const VIEW_TYPE_CONTEXT_GRAPH = "context-graph-memory-graph-view";

export class GraphView extends ItemView {
  private result: GraphResult | null = null;
  private renderer: CytoscapeRenderer | null = null;
  private graphContainerEl: HTMLDivElement | null = null;
  private summaryEl: HTMLDivElement | null = null;
  private detailEl: HTMLDivElement | null = null;
  private fallbackEl: HTMLDivElement | null = null;
  private tableButtonEl: HTMLButtonElement | null = null;
  private tableVisible = false;
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
    return "Context Graph Memory";
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
    this.tableVisible = false;
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
      gap: "6px",
      flexShrink: "0",
    });

    const titleRowEl = headerEl.createDiv();
    applyStyles(titleRowEl, {
      alignItems: "center",
      display: "flex",
      gap: "8px",
      justifyContent: "space-between",
    });

    titleRowEl.createEl("h3", { text: "Context Graph Memory" });
    const toolbarEl = titleRowEl.createDiv();
    applyStyles(toolbarEl, {
      alignItems: "center",
      display: "flex",
      flexWrap: "wrap",
      gap: "6px",
      justifyContent: "flex-end",
    });

    this.createToolbarButton(toolbarEl, "Fit", "Fit graph to panel", () => this.fitGraph());
    this.createToolbarButton(toolbarEl, "Reset", "Reset zoom and pan", () => this.resetGraphView());
    this.tableButtonEl = this.createToolbarButton(toolbarEl, "Table", "Toggle fallback table and JSON", () => {
      this.tableVisible = !this.tableVisible;
      this.updateFallbackVisibility();
    });

    this.summaryEl = headerEl.createDiv();
    applyStyles(this.summaryEl, {
      color: "var(--text-muted)",
      fontSize: "12px",
      lineHeight: "1.35",
    });

    const bodyEl = this.contentEl.createDiv();
    applyStyles(bodyEl, {
      display: "grid",
      flex: "1 1 auto",
      gap: "10px",
      gridTemplateRows: "minmax(260px, 1fr) minmax(112px, auto)",
      minHeight: "0",
      overflow: "hidden",
    });

    this.graphContainerEl = bodyEl.createDiv();
    applyStyles(this.graphContainerEl, {
      background: "var(--background-primary)",
      border: "1px solid var(--background-modifier-border)",
      borderRadius: "6px",
      minHeight: "260px",
      overflow: "hidden",
      position: "relative",
      width: "100%",
    });

    this.detailEl = bodyEl.createDiv();
    applyStyles(this.detailEl, {
      border: "1px solid var(--background-modifier-border)",
      borderRadius: "6px",
      maxHeight: "190px",
      minHeight: "112px",
      overflow: "auto",
      padding: "8px",
    });

    this.fallbackEl = this.contentEl.createDiv();
    applyStyles(this.fallbackEl, {
      border: "1px solid var(--background-modifier-border)",
      borderRadius: "6px",
      display: "none",
      flex: "0 0 auto",
      maxHeight: "260px",
      overflow: "auto",
      padding: "8px",
    });
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

  private renderEmptyState(): void {
    this.summaryEl?.setText("Run Show Related Graph or use the File Explorer context menu to load a graph.");
    this.graphContainerEl?.empty();
    this.graphContainerEl?.createDiv({ text: "No graph loaded." });
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
      onNodeSelect: (node) => this.renderNodeDetail(node),
      onRenderFallback: (reason) => {
        this.fallbackReason = reason;
        this.renderFallback(reason);
      },
    });
    this.renderer.render(this.result);
  }

  private renderSummary(result: GraphResult): void {
    if (!this.summaryEl) {
      return;
    }

    const summary = result.summary;
    const parts = [
      `${summary.scopeType} graph`,
      summary.targetPath ? summary.targetPath : undefined,
      `${summary.nodeCount} nodes`,
      `${summary.edgeCount} edges`,
      summary.depth ? `depth ${summary.depth}` : undefined,
      summary.truncated ? "truncated" : undefined,
    ].filter((part): part is string => Boolean(part));

    this.summaryEl.empty();
    this.summaryEl.createSpan({ text: parts.join(" · ") });
    this.renderFolderSummary(this.summaryEl, summary.folder);

    if (summary.warnings.length > 0) {
      this.summaryEl.createEl("br");
      this.summaryEl.createSpan({ text: summary.warnings.join(" ") });
    }
  }

  private renderNodeDetail(node: CytoscapeNodeData | null): void {
    if (!this.detailEl) {
      return;
    }

    this.detailEl.empty();

    if (!node) {
      this.detailEl.createEl("strong", { text: "Node detail" });
      this.detailEl.createEl("p", { text: "Select a node to inspect its labels, path, and properties." });
      return;
    }

    this.detailEl.createEl("strong", { text: node.label });
    const metaEl = this.detailEl.createDiv();
    applyStyles(metaEl, {
      display: "grid",
      gap: "4px",
      marginTop: "6px",
    });

    this.createKeyValueRow(metaEl, "Kind", node.kind);
    this.createKeyValueRow(metaEl, "Labels", node.labels.join(", "));
    if (node.path) {
      this.createKeyValueRow(metaEl, "Path", node.path);
    }
    if (node.title) {
      this.createKeyValueRow(metaEl, "Title", node.title);
    }
    if (node.scopeRole) {
      this.createKeyValueRow(metaEl, "Scope", formatScopeRole(node.scopeRole));
    }

    const properties = sanitizeRecordForDisplay(node.properties);
    if (Object.keys(properties).length > 0) {
      this.detailEl.createEl("h4", { text: "Properties" });
      const propertyEl = this.detailEl.createEl("pre");
      applyStyles(propertyEl, {
        margin: "0",
        overflow: "auto",
        whiteSpace: "pre-wrap",
      });
      propertyEl.setText(JSON.stringify(properties, null, 2));
    }
  }

  private renderFolderSummary(parentEl: HTMLElement, folder: FolderGraphSummary | undefined): void {
    if (!folder) {
      return;
    }

    parentEl.createEl("br");
    parentEl.createSpan({
      text: [
        `folder notes ${folder.displayedInternalNotes}/${folder.totalInternalNotes}`,
        `isolated ${folder.isolatedInternalNotes}`,
        `internal links ${folder.internalLinks}`,
        `bridge notes ${folder.displayedExternalBridgeNotes}`,
        `bridge nodes ${folder.displayedExternalBridgeNodes}/${folder.totalExternalBridgeNodes}`,
      ].join(" · "),
    });

    this.createFolderSummaryLine(parentEl, "Central", folder.centralNotes, (node) =>
      `${node.label} (${node.degree})`,
    );
    this.createFolderSummaryLine(parentEl, "Isolated", folder.isolatedNotes, (node) => node.label);
    this.createFolderSummaryLine(parentEl, "External bridges", folder.externalBridgeNotes, (node) =>
      `${node.label} (${node.bridgeDegree})`,
    );

    if (folder.truncationReason) {
      parentEl.createEl("br");
      parentEl.createSpan({ text: `Limit: ${formatTruncationReason(folder.truncationReason)}` });
    }
  }

  private createFolderSummaryLine(
    parentEl: HTMLElement,
    label: string,
    nodes: FolderGraphSummaryNode[],
    formatNode: (node: FolderGraphSummaryNode) => string,
  ): void {
    if (nodes.length === 0) {
      return;
    }

    parentEl.createEl("br");
    parentEl.createSpan({ text: `${label}: ${nodes.map(formatNode).join(", ")}` });
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
      this.fallbackEl.createEl("strong", { text: "Graph renderer fallback" });
      this.fallbackEl.createEl("p", { text: reason });
    }

    if (this.result) {
      this.renderNodesTable(this.fallbackEl, this.result.nodes);
      this.renderEdgesTable(this.fallbackEl, this.result.edges, this.result.nodes);
      this.renderJsonDebug(this.fallbackEl, this.result);
    }

    this.updateFallbackVisibility();
  }

  private renderNodesTable(parentEl: HTMLElement, nodes: GraphNode[]): void {
    parentEl.createEl("h4", { text: "Nodes" });
    const tableEl = parentEl.createEl("table");
    applyStyles(tableEl, {
      borderCollapse: "collapse",
      fontSize: "12px",
      width: "100%",
    });
    this.renderTableHeader(tableEl, ["Label", "Kind", "Path"]);

    const bodyEl = tableEl.createEl("tbody");
    for (const node of nodes) {
      const rowEl = bodyEl.createEl("tr");
      this.renderTableCell(rowEl, node.label);
      this.renderTableCell(rowEl, node.kind);
      this.renderTableCell(rowEl, node.path ?? "");
    }
  }

  private renderEdgesTable(parentEl: HTMLElement, edges: GraphEdge[], nodes: GraphNode[]): void {
    const nodeLabelsById = new Map(nodes.map((node) => [node.id, node.label]));

    parentEl.createEl("h4", { text: "Edges" });
    const tableEl = parentEl.createEl("table");
    applyStyles(tableEl, {
      borderCollapse: "collapse",
      fontSize: "12px",
      width: "100%",
    });
    this.renderTableHeader(tableEl, ["Type", "Source", "Target"]);

    const bodyEl = tableEl.createEl("tbody");
    for (const edge of edges) {
      const rowEl = bodyEl.createEl("tr");
      this.renderTableCell(rowEl, edge.type);
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
    detailsEl.createEl("summary", { text: "JSON debug" });
    const preEl = detailsEl.createEl("pre");
    applyStyles(preEl, {
      margin: "8px 0 0",
      overflow: "auto",
      whiteSpace: "pre-wrap",
    });
    preEl.setText(JSON.stringify(sanitizeGraphResultForDisplay(result), null, 2));
  }

  private updateFallbackVisibility(): void {
    if (!this.fallbackEl) {
      return;
    }

    const visible = this.tableVisible || Boolean(this.fallbackReason);
    this.fallbackEl.style.display = visible ? "block" : "none";
    if (this.tableButtonEl) {
      this.tableButtonEl.setText(visible ? "Hide table" : "Table");
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
    sanitized[key] = isSensitiveKey(key) ? "[masked]" : sanitizeValueForDisplay(value, 0);
  }
  return sanitized;
}

function sanitizeValueForDisplay(value: unknown, depth: number): unknown {
  if (depth >= 4) {
    return "[nested]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValueForDisplay(item, depth + 1));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, childValue] of Object.entries(value)) {
    sanitized[key] = isSensitiveKey(key) ? "[masked]" : sanitizeValueForDisplay(childValue, depth + 1);
  }
  return sanitized;
}

function isSensitiveKey(key: string): boolean {
  return /(password|passwd|token|secret|credential|auth|login|runtime[_-]?log)/iu.test(key);
}

function formatScopeRole(scopeRole: string): string {
  if (scopeRole === "folder-internal") {
    return "Folder internal";
  }

  if (scopeRole === "external-bridge") {
    return "External bridge";
  }

  return scopeRole;
}

function formatTruncationReason(reason: string): string {
  if (reason === "folder-note-limit") {
    return "folder note limit";
  }

  if (reason === "external-bridge-limit") {
    return "external bridge limit";
  }

  return reason;
}

function applyStyles(element: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(element.style, styles);
}
