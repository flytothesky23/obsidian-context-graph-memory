import { App, PluginSettingTab, Setting } from "obsidian";
import type ContextGraphMemoryPlugin from "./main";
import { DEFAULT_SETTINGS, GRAPH_LAYOUT_OPTIONS, type ContextGraphMemorySettings } from "./types";

type StringSettingKey = {
  [K in keyof ContextGraphMemorySettings]: ContextGraphMemorySettings[K] extends string ? K : never;
}[keyof ContextGraphMemorySettings];

type BooleanSettingKey = {
  [K in keyof ContextGraphMemorySettings]: ContextGraphMemorySettings[K] extends boolean
    ? K
    : never;
}[keyof ContextGraphMemorySettings];

type NumberSettingKey = {
  [K in keyof ContextGraphMemorySettings]: ContextGraphMemorySettings[K] extends number ? K : never;
}[keyof ContextGraphMemorySettings];

type ListSettingKey = {
  [K in keyof ContextGraphMemorySettings]: ContextGraphMemorySettings[K] extends string[] ? K : never;
}[keyof ContextGraphMemorySettings];

export class ContextGraphMemorySettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: ContextGraphMemoryPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.createEl("h2", { text: "Context Graph Memory" });
    containerEl.createEl("p", {
      text:
        "Settings are stored in Obsidian plugin data. Do not put Neo4j credentials, tokens, auth files, or runtime logs in notes or exported context files.",
    });

    this.addNeo4jSettings();
    this.addIndexingSettings();
    this.addGraphSettings();
    this.addCompatibilitySettings();
  }

  private addNeo4jSettings(): void {
    this.addSection("Neo4j");
    this.addStringSetting("neo4jUri", "URI", "Neo4j connection URI.", DEFAULT_SETTINGS.neo4jUri);
    this.addStringSetting(
      "neo4jUsername",
      "Username",
      "Neo4j username. Connection tests are added in T03.",
      DEFAULT_SETTINGS.neo4jUsername,
    );
    this.addStringSetting(
      "neo4jPassword",
      "Password",
      "Stored in Obsidian plugin data. Do not write this value into notes or exports.",
      "",
      "password",
    );
    this.addStringSetting(
      "neo4jDatabase",
      "Database",
      "Neo4j database name.",
      DEFAULT_SETTINGS.neo4jDatabase,
    );
  }

  private addIndexingSettings(): void {
    this.addSection("Indexing");
    this.addToggleSetting("indexOnStartup", "Index on startup", "Run indexing when the plugin loads.");
    this.addToggleSetting(
      "autoIndexOnModify",
      "Auto-index on modify",
      "Queue changed Markdown notes for indexing after edits.",
    );
    this.addListSetting(
      "includeFolders",
      "Include folders",
      "Optional allow-list. One folder path per line. Empty means all folders except exclusions.",
    );
    this.addListSetting(
      "excludeFolders",
      "Exclude folders",
      "One folder path per line. These folders are skipped by indexing.",
    );
    this.addListSetting(
      "includeTags",
      "Include tags",
      "Optional tag allow-list. One tag per line. Empty means all tags are accepted.",
    );
    this.addNumberSetting(
      "indexDebounceMs",
      "Index debounce",
      "Milliseconds to wait before processing modified notes.",
      100,
      60000,
    );
    this.addNumberSetting(
      "metadataPreviewMaxChars",
      "Metadata preview max chars",
      "Maximum note text length used for metadata preview.",
      500,
      100000,
    );
  }

  private addGraphSettings(): void {
    this.addSection("Graph");
    this.addStringSetting(
      "memoryInboxPath",
      "Memory inbox path",
      "Markdown file used by later memory-promotion tasks.",
      DEFAULT_SETTINGS.memoryInboxPath,
    );
    this.addStringSetting(
      "codexContextOutputPath",
      "Codex context output path",
      "Markdown file path used by later context export tasks.",
      DEFAULT_SETTINGS.codexContextOutputPath,
    );
    this.addNumberSetting("maxGraphDepth", "Max graph depth", "Maximum graph traversal depth.", 1, 5);
    this.addNumberSetting("maxGraphNodes", "Max graph nodes", "Maximum nodes rendered in one graph.", 10, 1000);
    new Setting(this.containerEl)
      .setName("Graph renderer")
      .setDesc("MVP renderer is fixed to Cytoscape.js.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("cytoscape", "cytoscape")
          .setValue(this.plugin.settings.graphRenderer)
          .onChange(async () => {
            await this.updateSetting("graphRenderer", "cytoscape");
          }),
      );
    new Setting(this.containerEl)
      .setName("Graph layout")
      .setDesc("Default Cytoscape layout for graph views.")
      .addDropdown((dropdown) => {
        for (const layout of GRAPH_LAYOUT_OPTIONS) {
          dropdown.addOption(layout, layout);
        }
        dropdown.setValue(this.plugin.settings.graphLayout);
        dropdown.onChange(async (value) => {
          if (GRAPH_LAYOUT_OPTIONS.includes(value as ContextGraphMemorySettings["graphLayout"])) {
            await this.updateSetting("graphLayout", value as ContextGraphMemorySettings["graphLayout"]);
          }
        });
      });
    this.addToggleSetting("graphFitOnOpen", "Fit graph on open", "Fit the graph to the viewport when opened.");
    this.addToggleSetting(
      "folderGraphIncludeExternalBridges",
      "Folder graph external bridges",
      "Include one-hop external bridge relationships in folder graphs.",
    );
    this.addToggleSetting(
      "folderGraphRecursive",
      "Folder graph recursive",
      "Include nested Markdown notes when opening a folder graph.",
    );
  }

  private addCompatibilitySettings(): void {
    this.addSection("Data Forge compatibility");
    new Setting(this.containerEl)
      .setName("Data Forge compatibility")
      .setDesc("Read Data Forge frontmatter fields without calling the Data Forge runtime.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("off", "off")
          .addOption("frontmatter", "frontmatter")
          .setValue(this.plugin.settings.dataForgeCompatibilityMode)
          .onChange(async (value) => {
            await this.updateSetting(
              "dataForgeCompatibilityMode",
              value === "frontmatter" ? "frontmatter" : "off",
            );
          }),
      );
    new Setting(this.containerEl)
      .setName("Semantic enrichment")
      .setDesc("Keep semantic enrichment off or manual-only. Automatic LLM/runtime calls are out of scope.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("off", "off")
          .addOption("manual", "manual")
          .setValue(this.plugin.settings.semanticEnrichmentMode)
          .onChange(async (value) => {
            await this.updateSetting("semanticEnrichmentMode", value === "manual" ? "manual" : "off");
          }),
      );
  }

  private addSection(name: string): void {
    this.containerEl.createEl("h3", { text: name });
  }

  private addStringSetting(
    key: StringSettingKey,
    name: string,
    description: string,
    placeholder: string,
    inputType: "text" | "password" = "text",
  ): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(description)
      .addText((text) => {
        text.inputEl.type = inputType;
        text
          .setPlaceholder(placeholder)
          .setValue(this.plugin.settings[key])
          .onChange(async (value) => {
            await this.updateSetting(key, value.trim());
          });
      });
  }

  private addListSetting(key: ListSettingKey, name: string, description: string): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(description)
      .addTextArea((textArea) =>
        textArea
          .setPlaceholder(DEFAULT_SETTINGS[key].join("\n"))
          .setValue(this.plugin.settings[key].join("\n"))
          .onChange(async (value) => {
            await this.updateSetting(key, this.parseList(value));
          }),
      );
  }

  private addToggleSetting(key: BooleanSettingKey, name: string, description: string): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(description)
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings[key]).onChange(async (value) => {
          await this.updateSetting(key, value);
        }),
      );
  }

  private addNumberSetting(
    key: NumberSettingKey,
    name: string,
    description: string,
    min: number,
    max: number,
  ): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc(description)
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = String(min);
        text.inputEl.max = String(max);
        text.inputEl.step = "1";
        text
          .setPlaceholder(String(DEFAULT_SETTINGS[key]))
          .setValue(String(this.plugin.settings[key]))
          .onChange(async (value) => {
            await this.updateSetting(
              key,
              this.parseInteger(value, DEFAULT_SETTINGS[key], min, max),
            );
          });
      });
  }

  private parseList(value: string): string[] {
    return value
      .split(/[\n,]/u)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private parseInteger(value: string, fallback: number, min: number, max: number): number {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      return fallback;
    }
    return Math.min(Math.max(parsed, min), max);
  }

  private async updateSetting<K extends keyof ContextGraphMemorySettings>(
    key: K,
    value: ContextGraphMemorySettings[K],
  ): Promise<void> {
    this.plugin.settings[key] = value;
    await this.plugin.saveSettings();
  }
}
