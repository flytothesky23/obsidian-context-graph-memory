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

    contentEl.createEl("h2", { text: "Semantic Enrichment Preview" });
    contentEl.createEl("p", {
      text: [
        `Mode: ${this.preview.mode}`,
        `Adapter: ${this.preview.adapterId}`,
        `Source: ${this.preview.source.path}`,
      ].join(" · "),
    });

    for (const warning of this.preview.warnings) {
      const warningEl = contentEl.createEl("p", { text: warning });
      warningEl.addClass("mod-warning");
    }

    if (this.preview.candidates.length === 0) {
      contentEl.createEl("p", { text: "No candidates available for approval." });
    }

    for (const candidate of this.preview.candidates) {
      new Setting(contentEl)
        .setName(`${candidate.relationshipType} -> ${candidate.targetName}`)
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
        button.setButtonText("Cancel").onClick(() => {
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
    this.saveButton.setButtonText(count === 1 ? "Save 1 approved candidate" : `Save ${count} approved candidates`);
    this.saveButton.setDisabled(count === 0);
  }
}

function formatCandidateDescription(candidate: SemanticEnrichmentCandidate): string {
  return [
    `kind=${candidate.conceptKind}`,
    `confidence=${candidate.confidence}`,
    `origin=${candidate.provenance.origin}`,
    `reason=${candidate.reason}`,
    `provenance=${candidate.provenance.sourceField}`,
  ].join(" · ");
}
