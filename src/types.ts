export interface ContextGraphMemorySettings {
  neo4jUri: string;
  neo4jUsername: string;
  neo4jPassword: string;
  neo4jDatabase: string;
  indexOnStartup: boolean;
  autoIndexOnModify: boolean;
  includeFolders: string[];
  excludeFolders: string[];
  includeTags: string[];
  memoryInboxPath: string;
  codexContextOutputPath: string;
  maxGraphDepth: number;
  maxGraphNodes: number;
  graphRenderer: "cytoscape";
  graphLayout: "cose" | "breadthfirst" | "circle" | "grid";
  graphFitOnOpen: boolean;
  folderGraphIncludeExternalBridges: boolean;
  folderGraphRecursive: boolean;
  indexDebounceMs: number;
  metadataPreviewMaxChars: number;
  dataForgeCompatibilityMode: "off" | "frontmatter";
  semanticEnrichmentMode: "off" | "manual";
}

export const DEFAULT_SETTINGS: ContextGraphMemorySettings = {
  neo4jUri: "neo4j://localhost:7687",
  neo4jUsername: "neo4j",
  neo4jPassword: "",
  neo4jDatabase: "neo4j",
  indexOnStartup: false,
  autoIndexOnModify: true,
  includeFolders: [],
  excludeFolders: [".obsidian", "99_Attachments"],
  includeTags: [],
  memoryInboxPath: "00_System/Memory Inbox.md",
  codexContextOutputPath: "00_System/Codex Context.md",
  maxGraphDepth: 2,
  maxGraphNodes: 80,
  graphRenderer: "cytoscape",
  graphLayout: "cose",
  graphFitOnOpen: true,
  folderGraphIncludeExternalBridges: true,
  folderGraphRecursive: true,
  indexDebounceMs: 1500,
  metadataPreviewMaxChars: 12000,
  dataForgeCompatibilityMode: "frontmatter",
  semanticEnrichmentMode: "off",
};

export const GRAPH_LAYOUT_OPTIONS: ContextGraphMemorySettings["graphLayout"][] = [
  "cose",
  "breadthfirst",
  "circle",
  "grid",
];

export function mergeSettings(
  savedSettings: Partial<ContextGraphMemorySettings> | null | undefined,
): ContextGraphMemorySettings {
  return {
    ...DEFAULT_SETTINGS,
    ...savedSettings,
    graphRenderer: "cytoscape",
  };
}
