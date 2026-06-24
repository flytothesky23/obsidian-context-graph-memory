import { App, Modal } from "obsidian";
import type { DataForgeFieldEntry } from "./data-forge-adapter";
import type { MetadataPreviewPayload } from "./note-metadata";

export class MetadataPreviewModal extends Modal {
  constructor(
    app: App,
    private readonly payload: MetadataPreviewPayload,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("context-graph-memory-metadata-preview");
    applyStyles(contentEl, {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      maxHeight: "78vh",
      overflow: "auto",
    });

    contentEl.createEl("h2", { text: "Metadata Extraction Preview" });
    this.renderSummary(contentEl);
    this.renderDataForgeReport(contentEl);
    this.renderRelationCandidates(contentEl);
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderSummary(parentEl: HTMLElement): void {
    const { metadata, summary } = this.payload;
    const sectionEl = createSection(parentEl, "Note Summary");

    createKeyValueRow(sectionEl, "Path", metadata.note.path);
    createKeyValueRow(sectionEl, "Title", metadata.note.title);
    createKeyValueRow(
      sectionEl,
      "Extracted",
      [
        `${summary.tags} tags`,
        `${summary.wikilinks} wikilinks`,
        `${summary.markdownLinks} markdown links`,
        `${summary.headings} headings`,
        `${summary.tasks} tasks`,
        `${summary.relationEdges} relation values`,
        `${summary.dataForgeFields} Data Forge fields`,
      ].join(", "),
    );
  }

  private renderDataForgeReport(parentEl: HTMLElement): void {
    const report = this.payload.dataForgeCompatibility;
    const sectionEl = createSection(parentEl, "Data Forge Compatibility");

    createKeyValueRow(sectionEl, "Mode", report.mode);
    createKeyValueRow(sectionEl, "Detected", report.detected ? "yes" : "no");
    createKeyValueRow(sectionEl, "Runtime calls", report.runtimeRequired ? "required" : "not used");
    createKeyValueRow(sectionEl, "Relation candidates", String(report.relationCandidateCount));

    if (report.fields.length > 0) {
      createTable(
        sectionEl,
        ["Field", "Value"],
        report.fields.map((field) => [field.name, formatFieldValue(field)]),
      );
    } else {
      sectionEl.createEl("p", { text: "No Data Forge-specific frontmatter fields found." });
    }

    if (report.warnings.length > 0) {
      const warningEl = sectionEl.createDiv();
      applyStyles(warningEl, {
        color: "var(--text-warning)",
        fontSize: "12px",
      });
      warningEl.setText(report.warnings.join(" "));
    }
  }

  private renderRelationCandidates(parentEl: HTMLElement): void {
    const candidates = this.payload.dataForgeCompatibility.relationCandidates;
    const sectionEl = createSection(parentEl, "Relation Candidates");

    if (candidates.length === 0) {
      sectionEl.createEl("p", { text: "No relation candidates available for preview." });
      return;
    }

    createTable(
      sectionEl,
      ["Field", "Relationship", "Target", "Kind"],
      candidates.map((candidate) => [
        candidate.field,
        candidate.relationshipType,
        candidate.name,
        candidate.conceptKind,
      ]),
    );
  }
}

function createSection(parentEl: HTMLElement, title: string): HTMLDivElement {
  const sectionEl = parentEl.createDiv();
  applyStyles(sectionEl, {
    border: "1px solid var(--background-modifier-border)",
    borderRadius: "6px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "10px",
  });
  sectionEl.createEl("h3", { text: title });
  return sectionEl;
}

function createKeyValueRow(parentEl: HTMLElement, label: string, value: string): void {
  const rowEl = parentEl.createDiv();
  applyStyles(rowEl, {
    display: "grid",
    gap: "8px",
    gridTemplateColumns: "140px minmax(0, 1fr)",
    lineHeight: "1.35",
  });
  const labelEl = rowEl.createEl("strong", { text: label });
  applyStyles(labelEl, { color: "var(--text-muted)" });
  const valueEl = rowEl.createSpan({ text: value });
  applyStyles(valueEl, {
    overflowWrap: "anywhere",
  });
}

function createTable(
  parentEl: HTMLElement,
  headers: readonly string[],
  rows: readonly string[][],
): void {
  const tableEl = parentEl.createEl("table");
  applyStyles(tableEl, {
    borderCollapse: "collapse",
    fontSize: "12px",
    width: "100%",
  });

  const theadEl = tableEl.createEl("thead");
  const headerRowEl = theadEl.createEl("tr");
  for (const header of headers) {
    const thEl = headerRowEl.createEl("th", { text: header });
    applyCellStyles(thEl);
    applyStyles(thEl, {
      color: "var(--text-muted)",
      textAlign: "left",
    });
  }

  const tbodyEl = tableEl.createEl("tbody");
  for (const row of rows) {
    const rowEl = tbodyEl.createEl("tr");
    for (const value of row) {
      const cellEl = rowEl.createEl("td", { text: value });
      applyCellStyles(cellEl);
    }
  }
}

function formatFieldValue(field: DataForgeFieldEntry): string {
  return truncateText(stringifyPreviewValue(field.name, field.value), 240);
}

function stringifyPreviewValue(key: string, value: unknown): string {
  if (isSensitiveKey(key)) {
    return "[redacted]";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(sanitizePreviewValue(value));
  } catch {
    return String(value);
  }
}

function sanitizePreviewValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePreviewValue(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    sanitized[key] = isSensitiveKey(key) ? "[redacted]" : sanitizePreviewValue(nestedValue);
  }
  return sanitized;
}

function isSensitiveKey(key: string): boolean {
  return /(auth|credential|login|password|secret|token|runtime_log)/iu.test(key);
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}...`;
}

function applyCellStyles(cellEl: HTMLElement): void {
  applyStyles(cellEl, {
    borderTop: "1px solid var(--background-modifier-border)",
    padding: "5px 6px",
    verticalAlign: "top",
    overflowWrap: "anywhere",
  });
}

function applyStyles(element: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
  Object.assign(element.style, styles);
}
