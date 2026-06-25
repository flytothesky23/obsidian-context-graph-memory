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

const TEXT = {
  heading: "컨텍스트 그래프 메모리",
  description:
    "설정은 Obsidian 플러그인 데이터에만 저장됩니다. Neo4j 인증 정보, 토큰, 인증 파일, 실행 로그를 노트나 내보내기 파일에 넣지 마세요.",
  neo4j: "Neo4j",
  uri: "연결 URI",
  uriDesc: "Neo4j 연결 URI입니다.",
  username: "사용자명",
  usernameDesc: "Neo4j 사용자명입니다. T03에서 연결 테스트를 수행합니다.",
  password: "비밀번호",
  passwordDesc: "Obsidian 플러그인 데이터에만 저장됩니다. 노트나 내보내기 파일에 기재하지 마세요.",
  database: "데이터베이스",
  databaseDesc: "Neo4j 데이터베이스 이름입니다.",

  indexing: "인덱싱",
  indexOnStartup: "시작 시 인덱싱",
  indexOnStartupDesc: "플러그인 로드 시 인덱싱을 실행합니다.",
  autoIndexOnModify: "수정 시 자동 인덱싱",
  autoIndexOnModifyDesc: "수정된 마크다운 노트를 인덱싱 큐에 등록합니다.",
  includeFolders: "포함할 폴더",
  includeFoldersDesc: "허용할 폴더 목록입니다. 한 줄에 경로 1개를 입력하세요. 비우면 예외 폴더를 제외한 전체 폴더를 허용합니다.",
  excludeFolders: "제외할 폴더",
  excludeFoldersDesc: "한 줄에 경로 1개를 입력하세요. 해당 폴더는 인덱싱에서 제외됩니다.",
  includeTags: "포함할 태그",
  includeTagsDesc: "허용할 태그 목록입니다. 한 줄에 태그 1개를 입력하세요. 비우면 모든 태그를 허용합니다.",
  indexDebounce: "인덱싱 디바운스",
  indexDebounceDesc: "수정된 노트를 처리하기 전 대기 시간(밀리초)입니다.",
  metadataPreviewMaxChars: "메타데이터 미리보기 최대 글자 수",
  metadataPreviewMaxCharsDesc: "메타데이터 미리보기에서 사용할 최대 텍스트 길이입니다.",

  graph: "그래프",
  memoryInboxPath: "메모리 인박스 경로",
  memoryInboxPathDesc: "기억 승격 항목을 기록할 마크다운 파일 경로입니다.",
  codexContextOutputPath: "Codex 컨텍스트 출력 경로",
  codexContextOutputPathDesc: "컨텍스트 내보내기에 사용할 마크다운 파일 경로입니다.",
  maxGraphDepth: "최대 그래프 깊이",
  maxGraphDepthDesc: "최대 그래프 탐색 깊이입니다.",
  maxGraphNodes: "최대 그래프 노드 수",
  maxGraphNodesDesc: "한 번에 렌더링할 최대 노드 수입니다.",
  graphRenderer: "그래프 렌더러",
  graphRendererDesc: "MVP 렌더러는 Cytoscape.js로 고정됩니다.",
  graphLayout: "그래프 레이아웃",
  graphLayoutDesc: "그래프 뷰 기본 Cytoscape 레이아웃입니다.",
  graphFitOnOpen: "열 때 화면 맞춤",
  graphFitOnOpenDesc: "열기 시 그래프를 뷰포트에 맞춥니다.",
  folderGraphExternalBridges: "폴더 그래프 외부 브릿지 표시",
  folderGraphExternalBridgesDesc: "폴더 그래프에서 1단계 외부 브릿지 관계를 표시합니다.",
  folderGraphRecursive: "폴더 그래프 재귀 탐색",
  folderGraphRecursiveDesc: "폴더 그래프에서 하위 폴더 노트를 포함합니다.",

  dataForgeCompatibility: "Data Forge 호환",
  dataForgeCompatibilityDesc: "Data Forge 런타임을 호출하지 않고 프론트매터 필드만 읽습니다.",
  compatibilityValue: "frontmatter",
  compatibilityValueLabel: "프론트매터",
  off: "비활성",

  semanticEnrichment: "시맨틱 보강",
  semanticEnrichmentDesc: "시맨틱 보강은 비활성 또는 수동 모드만 지원합니다. 자동 LLM/런타임 호출은 범위 밖입니다.",
  offValue: "비활성",
  manualValue: "수동",
};

export class ContextGraphMemorySettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: ContextGraphMemoryPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.createEl("h2", { text: TEXT.heading });
    containerEl.createEl("p", {
      text: TEXT.description,
    });

    this.addNeo4jSettings();
    this.addIndexingSettings();
    this.addGraphSettings();
    this.addCompatibilitySettings();
  }

  private addNeo4jSettings(): void {
    this.addSection(TEXT.neo4j);
    this.addStringSetting("neo4jUri", TEXT.uri, TEXT.uriDesc, DEFAULT_SETTINGS.neo4jUri);
    this.addStringSetting(
      "neo4jUsername",
      TEXT.username,
      TEXT.usernameDesc,
      DEFAULT_SETTINGS.neo4jUsername,
    );
    this.addStringSetting(
      "neo4jPassword",
      TEXT.password,
      TEXT.passwordDesc,
      "",
      "password",
    );
    this.addStringSetting(
      "neo4jDatabase",
      TEXT.database,
      TEXT.databaseDesc,
      DEFAULT_SETTINGS.neo4jDatabase,
    );
  }

  private addIndexingSettings(): void {
    this.addSection(TEXT.indexing);
    this.addToggleSetting("indexOnStartup", TEXT.indexOnStartup, TEXT.indexOnStartupDesc);
    this.addToggleSetting(
      "autoIndexOnModify",
      TEXT.autoIndexOnModify,
      TEXT.autoIndexOnModifyDesc,
    );
    this.addListSetting(
      "includeFolders",
      TEXT.includeFolders,
      TEXT.includeFoldersDesc,
    );
    this.addListSetting(
      "excludeFolders",
      TEXT.excludeFolders,
      TEXT.excludeFoldersDesc,
    );
    this.addListSetting(
      "includeTags",
      TEXT.includeTags,
      TEXT.includeTagsDesc,
    );
    this.addNumberSetting(
      "indexDebounceMs",
      TEXT.indexDebounce,
      TEXT.indexDebounceDesc,
      100,
      60000,
    );
    this.addNumberSetting(
      "metadataPreviewMaxChars",
      TEXT.metadataPreviewMaxChars,
      TEXT.metadataPreviewMaxCharsDesc,
      500,
      100000,
    );
  }

  private addGraphSettings(): void {
    this.addSection(TEXT.graph);
    this.addStringSetting(
      "memoryInboxPath",
      TEXT.memoryInboxPath,
      TEXT.memoryInboxPathDesc,
      DEFAULT_SETTINGS.memoryInboxPath,
    );
    this.addStringSetting(
      "codexContextOutputPath",
      TEXT.codexContextOutputPath,
      TEXT.codexContextOutputPathDesc,
      DEFAULT_SETTINGS.codexContextOutputPath,
    );
    this.addNumberSetting("maxGraphDepth", TEXT.maxGraphDepth, TEXT.maxGraphDepthDesc, 1, 5);
    this.addNumberSetting("maxGraphNodes", TEXT.maxGraphNodes, TEXT.maxGraphNodesDesc, 10, 1000);
    new Setting(this.containerEl)
      .setName(TEXT.graphRenderer)
      .setDesc(TEXT.graphRendererDesc)
      .addDropdown((dropdown) =>
        dropdown
          .addOption("cytoscape", "cytoscape")
          .setValue(this.plugin.settings.graphRenderer)
          .onChange(async () => {
            await this.updateSetting("graphRenderer", "cytoscape");
          }),
      );
    new Setting(this.containerEl)
      .setName(TEXT.graphLayout)
      .setDesc(TEXT.graphLayoutDesc)
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
    this.addToggleSetting("graphFitOnOpen", TEXT.graphFitOnOpen, TEXT.graphFitOnOpenDesc);
    this.addToggleSetting(
      "folderGraphIncludeExternalBridges",
      TEXT.folderGraphExternalBridges,
      TEXT.folderGraphExternalBridgesDesc,
    );
    this.addToggleSetting(
      "folderGraphRecursive",
      TEXT.folderGraphRecursive,
      TEXT.folderGraphRecursiveDesc,
    );
  }

  private addCompatibilitySettings(): void {
    this.addSection(TEXT.dataForgeCompatibility);
    new Setting(this.containerEl)
      .setName(TEXT.dataForgeCompatibility)
      .setDesc(TEXT.dataForgeCompatibilityDesc)
      .addDropdown((dropdown) =>
        dropdown
      .addOption("off", TEXT.off)
          .addOption(TEXT.compatibilityValue, TEXT.compatibilityValueLabel)
          .setValue(this.plugin.settings.dataForgeCompatibilityMode)
          .onChange(async (value) => {
            const mode = (value === TEXT.compatibilityValue ? "frontmatter" : "off") as
              ContextGraphMemorySettings["dataForgeCompatibilityMode"];
            await this.updateSetting(
              "dataForgeCompatibilityMode",
              mode,
            );
          }),
      );
    new Setting(this.containerEl)
      .setName(TEXT.semanticEnrichment)
      .setDesc(TEXT.semanticEnrichmentDesc)
      .addDropdown((dropdown) =>
        dropdown
          .addOption("off", TEXT.offValue)
          .addOption("manual", TEXT.manualValue)
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
