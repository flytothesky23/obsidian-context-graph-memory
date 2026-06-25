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

    contentEl.createEl("h2", { text: "선택 텍스트 승격" });
    contentEl.createEl("p", {
      text: previewSelection(this.selectedText),
    });

    for (const type of MEMORY_TYPES) {
      new Setting(contentEl)
        .setName(getTypeLabel(type))
        .setDesc(getTypeDescription(type))
        .addButton((button) => {
          button.setButtonText(`선택 항목으로 저장 (${getTypeLabel(type)})`).onClick(() => {
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
    return "사용자나 프로젝트의 지속적인 선호사항입니다.";
  }

  if (type === "Rule") {
    return "향후 작업에서 참고해야 할 운영 규칙입니다.";
  }

  return "이 노트에 대한 근거를 남겨야 할 프로젝트 결정사항입니다.";
}

function getTypeLabel(type: MemoryType): string {
  if (type === "Preference") {
    return "선호사항";
  }

  if (type === "Rule") {
    return "규칙";
  }

  return "결정";
}
