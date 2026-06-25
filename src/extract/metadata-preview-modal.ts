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

    contentEl.createEl("h2", { text: "메타데이터 추출 미리보기" });
    this.renderSummary(contentEl);
    this.renderDataForgeReport(contentEl);
    this.renderRelationCandidates(contentEl);
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private renderSummary(parentEl: HTMLElement): void {
    const { metadata, summary } = this.payload;
    const sectionEl = createSection(parentEl, "노트 요약");

    createKeyValueRow(sectionEl, "경로", metadata.note.path);
    createKeyValueRow(sectionEl, "제목", metadata.note.title);
    createKeyValueRow(
      sectionEl,
      "추출 건수",
      [
        `${summary.tags}개 태그`,
        `${summary.wikilinks}개 위키링크`,
        `${summary.markdownLinks}개 마크다운 링크`,
        `${summary.headings}개 제목`,
        `${summary.tasks}개 태스크`,
        `${summary.relationEdges}개 관계 값`,
        `${summary.dataForgeFields}개 Data Forge 필드`,
      ].join(", "),
    );
  }

  private renderDataForgeReport(parentEl: HTMLElement): void {
    const report = this.payload.dataForgeCompatibility;
    const sectionEl = createSection(parentEl, "Data Forge 호환성");

    createKeyValueRow(sectionEl, "모드", formatDataForgeMode(report.mode));
    createKeyValueRow(sectionEl, "감지됨", report.detected ? "예" : "아니오");
    createKeyValueRow(sectionEl, "런타임 호출", report.runtimeRequired ? "필요" : "미사용");
    createKeyValueRow(sectionEl, "관계 후보 수", String(report.relationCandidateCount));

    if (report.fields.length > 0) {
      createTable(
        sectionEl,
        ["필드", "값"],
        report.fields.map((field) => [field.name, formatFieldValue(field)]),
      );
    } else {
      sectionEl.createEl("p", { text: "Data Forge 전용 프론트매터 필드를 찾지 못했습니다." });
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
    const sectionEl = createSection(parentEl, "관계 후보");

    if (candidates.length === 0) {
      sectionEl.createEl("p", { text: "미리보기 가능한 관계 후보가 없습니다." });
      return;
    }

    createTable(
      sectionEl,
      ["필드", "관계", "대상", "유형"],
      candidates.map((candidate) => [
        candidate.field,
        formatRelationType(candidate.relationshipType),
        candidate.name,
        formatConceptKind(candidate.conceptKind),
      ]),
    );
  }
}

const SENSITIVE_PLACEHOLDER = "[마스킹]";
const SENSITIVE_TOKEN_PLACEHOLDER = "[토큰-마스킹]";

function formatDataForgeMode(mode: string): string {
  if (mode === "frontmatter") {
    return "프론트매터";
  }

  if (mode === "off") {
    return "비활성";
  }

  return mode;
}

function formatConceptKind(conceptKind: string): string {
  if (conceptKind === "concept") {
    return "개념";
  }

  if (conceptKind === "source") {
    return "출처";
  }

  if (conceptKind === "person") {
    return "인물";
  }

  if (conceptKind === "organization") {
    return "조직";
  }

  if (conceptKind === "system") {
    return "시스템";
  }

  if (conceptKind === "project") {
    return "프로젝트";
  }

  return conceptKind;
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
    return SENSITIVE_PLACEHOLDER;
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
    sanitized[key] = isSensitiveKey(key) ? SENSITIVE_PLACEHOLDER : sanitizePreviewValue(nestedValue);
  }
  return sanitized;
}

function formatRelationType(type: string): string {
  if (type === "RELATED_TO") {
    return "관련";
  }

  if (type === "SUPPORTS") {
    return "지원";
  }

  if (type === "DEPENDS_ON") {
    return "의존";
  }

  if (type === "PART_OF") {
    return "구성";
  }

  if (type === "AFFECTS") {
    return "영향";
  }

  if (type === "EVIDENCED_BY") {
    return "근거";
  }

  if (type === "MENTIONS") {
    return "언급";
  }

  if (type === "RECORDED_IN") {
    return "기록";
  }

  return type;
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
