import { App, Modal, Setting } from "obsidian";
import { MEMORY_TYPES, type MemoryType } from "./memory-promotion";

export class MemoryTypeModal extends Modal {
  private completed = false;

  constructor(
    app: App,
    private readonly selectedText: string,
    private readonly onChoose: (type: MemoryType | null) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "Promote selection" });
    contentEl.createEl("p", {
      text: previewSelection(this.selectedText),
    });

    for (const type of MEMORY_TYPES) {
      new Setting(contentEl)
        .setName(type)
        .setDesc(getTypeDescription(type))
        .addButton((button) => {
          button.setButtonText(`Save as ${type}`).onClick(() => {
            this.completed = true;
            this.close();
            this.onChoose(type);
          });
        });
    }
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.completed) {
      this.onChoose(null);
    }
  }
}

function previewSelection(text: string): string {
  const compact = text.replace(/\s+/gu, " ").trim();
  if (compact.length <= 220) {
    return compact;
  }

  return `${compact.slice(0, 217)}...`;
}

function getTypeDescription(type: MemoryType): string {
  if (type === "Preference") {
    return "A stable user or project preference.";
  }

  if (type === "Rule") {
    return "An operating rule that should guide future work.";
  }

  return "A project decision that should remain traceable to this note.";
}
