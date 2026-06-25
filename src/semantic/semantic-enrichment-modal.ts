import { App, Modal, Setting } from "obsidian";
import type { SemanticEnrichmentCandidate, SemanticEnrichmentPreview } from "./semantic-enrichment";

export class SemanticEnrichmentApprovalModal extends Modal {
  private completed = false;
  private readonly selectedIds = new Set<string>();
  private saveButton: { setButtonText(text: string): void; setDisabled(disabled: boolean): void } | null = null;

  constructor(
    app: App,
    private readonly preview: SemanticEnrichmentPreview,
    private readonly onApprove: (candidates: SemanticEnrichmentCandidate[] | null) => void,
  ) {
    super(app);
    for (const candidate of preview.candidates) {
      this.selectedIds.add(candidate.id);
    }
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "시맨틱 보강 미리보기" });
    contentEl.createEl("p", {
      text: [
        `모드: ${formatSemanticMode(this.preview.mode)}`,
        `어댑터: ${formatAdapterId(this.preview.adapterId)}`,
        `출처: ${this.preview.source.path}`,
      ].join(" · "),
    });

    for (const warning of this.preview.warnings) {
      const warningEl = contentEl.createEl("p", { text: warning });
      warningEl.addClass("mod-warning");
    }

    if (this.preview.candidates.length === 0) {
      contentEl.createEl("p", { text: "승인할 후보가 없습니다." });
    }

    for (const candidate of this.preview.candidates) {
      new Setting(contentEl)
        .setName(`${formatRelationType(candidate.relationshipType)} -> ${candidate.targetName}`)
        .setDesc(formatCandidateDescription(candidate))
        .addToggle((toggle) => {
          toggle.setValue(true).onChange((value) => {
            if (value) {
              this.selectedIds.add(candidate.id);
            } else {
              this.selectedIds.delete(candidate.id);
            }
            this.updateSaveButton();
          });
        });
    }

    new Setting(contentEl)
      .addButton((button) => {
      this.saveButton = button;
        button.onClick(() => {
          this.completed = true;
          const approved = this.preview.candidates.filter((candidate) => this.selectedIds.has(candidate.id));
          this.close();
          this.onApprove(approved);
        });
        this.updateSaveButton();
      })
      .addButton((button) => {
        button.setButtonText("취소").onClick(() => {
          this.close();
        });
      });
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.completed) {
      this.onApprove(null);
    }
  }

  private updateSaveButton(): void {
    if (!this.saveButton) {
      return;
    }

    const count = this.selectedIds.size;
    this.saveButton.setButtonText(count === 1 ? "승인 후보 1개 저장" : `승인 후보 ${count}개 저장`);
    this.saveButton.setDisabled(count === 0);
  }
}

function formatCandidateDescription(candidate: SemanticEnrichmentCandidate): string {
  return [
    `유형=${formatConceptKind(candidate.conceptKind)}`,
    `신뢰도=${candidate.confidence}`,
    `기원=${formatSemanticOrigin(candidate.provenance.origin)}`,
    `근거=${candidate.reason}`,
    `근거필드=${candidate.provenance.sourceField}`,
  ].join(" · ");
}

function formatSemanticMode(mode: string): string {
  if (mode === "manual") {
    return "수동";
  }

  if (mode === "off") {
    return "비활성";
  }

  return mode;
}

function formatAdapterId(adapterId: string): string {
  if (adapterId === "manual-frontmatter") {
    return "수동 프론트매터";
  }

  return adapterId;
}

function formatSemanticOrigin(origin: string): string {
  if (origin === "manual") {
    return "수동";
  }

  if (origin === "data-forge") {
    return "Data Forge";
  }

  if (origin === "codex-cli") {
    return "Codex CLI";
  }

  if (origin === "codexian") {
    return "Codexian";
  }

  if (origin === "unknown") {
    return "미확인";
  }

  return origin;
}

function formatConceptKind(kind: string): string {
  if (kind === "concept") {
    return "개념";
  }

  if (kind === "source") {
    return "출처";
  }

  if (kind === "person") {
    return "인물";
  }

  if (kind === "organization") {
    return "조직";
  }

  if (kind === "system") {
    return "시스템";
  }

  if (kind === "project") {
    return "프로젝트";
  }

  return kind;
}

function formatRelationType(relationType: string): string {
  if (relationType === "RELATED_TO") {
    return "관련";
  }

  if (relationType === "SUPPORTS") {
    return "지지";
  }

  if (relationType === "DEPENDS_ON") {
    return "의존";
  }

  if (relationType === "PART_OF") {
    return "포함";
  }

  if (relationType === "AFFECTS") {
    return "영향";
  }

  if (relationType === "EVIDENCED_BY") {
    return "근거";
  }

  if (relationType === "MENTIONS") {
    return "언급";
  }

  return relationType;
}
