import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../types";
import { GraphQueryService, buildGraphQuery, buildGraphResult, type GraphQueryRunner } from "./graph-query";
import { createFolderGraphScope, createNoteGraphScope, createSelectionGraphScope } from "./graph-scope";

describe("buildGraphQuery", () => {
  it("builds a bounded note graph query with literal depth and safe parameters", () => {
    const scope = createNoteGraphScope("Projects/A.md", {
      ...DEFAULT_SETTINGS,
      maxGraphDepth: 2,
      maxGraphNodes: 42,
    });

    const query = buildGraphQuery(scope);

    expect(query.cypher).toContain("[*1..2]");
    expect(query.cypher).toContain('type(rel) <> "HAS_TAG"');
    expect(query.cypher).toContain("WITH start, collect(DISTINCT graphPath) AS graphPaths, collect(DISTINCT neighbor) AS neighbors");
    expect(query.cypher).toContain("WITH graphPaths, [node IN ([start] + neighbors) WHERE node IS NOT NULL] AS candidateNodes");
    expect(query.cypher).not.toContain("[start] + collect(DISTINCT neighbor)");
    expect(query.parameters).toEqual({ path: "Projects/A.md", maxNodes: 42 });
  });

  it("builds a folder graph query using folder scope settings", () => {
    const scope = createFolderGraphScope("Projects", {
      ...DEFAULT_SETTINGS,
      maxGraphNodes: 30,
      folderGraphRecursive: true,
      folderGraphIncludeExternalBridges: true,
    });

    const query = buildGraphQuery(scope);

    expect(query.cypher).toContain("folderNote.folder STARTS WITH $folderPrefix");
    expect(query.cypher).toContain("ORDER BY folderNote.path");
    expect(query.cypher).toContain("WITH folderNodes, folderNodes[0..$maxNodes] AS seedNodes");
    expect(query.cypher).toContain('type(rel) <> "HAS_TAG"');
    expect(query.cypher).toContain("truncationReason");
    expect(query.cypher).toContain("folderNodeIds");
    expect(query.cypher).toContain("externalBridgeNodeIds");
    expect(query.parameters).toMatchObject({
      folderPath: "Projects",
      folderPrefix: "Projects/",
      recursive: true,
      includeExternalBridges: true,
      maxNodes: 30,
    });
  });

  it("builds a selection graph query from explicit note paths", () => {
    const scope = createSelectionGraphScope(["A.md", "B.md"], DEFAULT_SETTINGS);

    const query = buildGraphQuery(scope);

    expect(query.cypher).toContain("seed.path IN $paths");
    expect(query.parameters).toMatchObject({ paths: ["A.md", "B.md"] });
  });
});

describe("GraphQueryService", () => {
  it("maps Neo4j rows into renderer-neutral graph results and closes the runner", async () => {
    const calls: Array<{ cypher: string; parameters?: Record<string, unknown> }> = [];
    const closeCalls: string[] = [];
    const scope = createNoteGraphScope("Projects/A.md", DEFAULT_SETTINGS);
    const service = new GraphQueryService(DEFAULT_SETTINGS, () => createRunner(calls, closeCalls));

    const result = await service.getGraph(scope);

    expect(result.scope).toBe(scope);
    expect(result.nodes).toEqual([
      {
        id: "node-1",
        labels: ["Note"],
        kind: "Note",
        label: "A",
        path: "Projects/A.md",
        title: "A",
        properties: { path: "Projects/A.md", title: "A" },
      },
      {
        id: "node-2",
        labels: ["Tag"],
        kind: "Tag",
        label: "alpha",
        path: undefined,
        title: undefined,
        properties: { name: "alpha" },
      },
    ]);
    expect(result.edges).toEqual([
      {
        id: "rel-1",
        source: "node-1",
        target: "node-2",
        type: "HAS_TAG",
        properties: { source: "frontmatter" },
      },
    ]);
    expect(result.summary).toMatchObject({
      scopeType: "note",
      targetPath: "Projects/A.md",
      nodeCount: 2,
      edgeCount: 1,
      truncated: false,
    });
    expect(calls).toHaveLength(1);
    expect(closeCalls).toEqual(["closed"]);
  });

  it("drops malformed rows and edges whose endpoints are absent", () => {
    const scope = createNoteGraphScope("Projects/A.md", DEFAULT_SETTINGS);
    const result = buildGraphResult(scope, {
      records: [
        {
          nodes: [{ id: "node-1", labels: ["Note"], properties: { path: "Projects/A.md" } }],
          edges: [{ id: "rel-1", source: "node-1", target: "missing", type: "LINKS_TO" }],
          truncated: true,
        },
      ],
    });

    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
    expect(result.summary.warnings).toEqual([`그래프는 ${DEFAULT_SETTINGS.maxGraphNodes}개 노드에서 잘렸습니다.`]);
  });

  it("summarizes folder internal notes, isolated notes, and external bridge notes", () => {
    const scope = createFolderGraphScope("Projects", {
      ...DEFAULT_SETTINGS,
      maxGraphNodes: 5,
      folderGraphIncludeExternalBridges: true,
    });

    const result = buildGraphResult(scope, {
      records: [
        {
          nodes: [
            { id: "internal-a", labels: ["Note"], properties: { path: "Projects/A.md", title: "A" } },
            { id: "internal-b", labels: ["Note"], properties: { path: "Projects/B.md", title: "B" } },
            { id: "internal-c", labels: ["Note"], properties: { path: "Projects/C.md", title: "C" } },
            { id: "external-x", labels: ["Note"], properties: { path: "Other/X.md", title: "X" } },
            { id: "tag-alpha", labels: ["Tag"], properties: { name: "alpha" } },
          ],
          edges: [
            { id: "internal-link", source: "internal-a", target: "internal-b", type: "LINKS_TO", properties: {} },
            { id: "bridge-link", source: "internal-a", target: "external-x", type: "RELATED_TO", properties: {} },
            { id: "tag-link", source: "internal-b", target: "tag-alpha", type: "HAS_TAG", properties: {} },
          ],
          truncated: true,
          truncationReason: "external-bridge-limit",
          folderNodeIds: ["internal-a", "internal-b", "internal-c"],
          externalBridgeNodeIds: ["external-x", "tag-alpha"],
          totalFolderNoteCount: 4,
          totalExternalBridgeNodeCount: 3,
        },
      ],
    });

    expect(result.nodes.find((node) => node.id === "internal-a")?.scopeRole).toBe("folder-internal");
    expect(result.nodes.find((node) => node.id === "external-x")?.scopeRole).toBe("external-bridge");
    expect(result.summary.warnings).toEqual([
      "폴더 그래프는 폴더 노트 표시 후 외부 브릿지 노드가 모두 표시되기 전에 5개 노드에서 잘렸습니다.",
    ]);
    expect(result.summary.folder).toMatchObject({
      totalInternalNotes: 4,
      displayedInternalNotes: 3,
      isolatedInternalNotes: 1,
      internalEdges: 1,
      internalLinks: 1,
      bridgeEdges: 1,
      displayedExternalBridgeNodes: 2,
      displayedExternalBridgeNotes: 1,
      totalExternalBridgeNodes: 3,
      truncationReason: "external-bridge-limit",
    });
    expect(result.summary.folder?.centralNotes).toEqual([
      {
        id: "internal-a",
        label: "A",
        path: "Projects/A.md",
        degree: 2,
        internalDegree: 1,
        bridgeDegree: 1,
      },
      {
        id: "internal-b",
        label: "B",
        path: "Projects/B.md",
        degree: 1,
        internalDegree: 1,
        bridgeDegree: 0,
      },
    ]);
    expect(result.summary.folder?.isolatedNotes).toEqual([
      {
        id: "internal-c",
        label: "C",
        path: "Projects/C.md",
        degree: 0,
        internalDegree: 0,
        bridgeDegree: 0,
      },
    ]);
    expect(result.summary.folder?.externalBridgeNotes).toEqual([
      {
        id: "external-x",
        label: "X",
        path: "Other/X.md",
        degree: 1,
        internalDegree: 0,
        bridgeDegree: 1,
      },
    ]);
  });
});

function createRunner(
  calls: Array<{ cypher: string; parameters?: Record<string, unknown> }>,
  closeCalls: string[],
): GraphQueryRunner {
  return {
    query: async (cypher, parameters) => {
      calls.push({ cypher, parameters });
      return {
        records: [
          {
            nodes: [
              { id: "node-1", labels: ["Note"], properties: { path: "Projects/A.md", title: "A" } },
              { id: "node-2", labels: ["Tag"], properties: { name: "alpha" } },
            ],
            edges: [
              {
                id: "rel-1",
                source: "node-1",
                target: "node-2",
                type: "HAS_TAG",
                properties: { source: "frontmatter" },
              },
            ],
            truncated: false,
          },
        ],
      };
    },
    close: async () => {
      closeCalls.push("closed");
    },
  };
}
