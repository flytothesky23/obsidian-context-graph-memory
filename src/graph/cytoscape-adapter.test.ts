import { describe, expect, it } from "vitest";
import {
  graphResultToCytoscapeElements,
  toCytoscapeEdgeId,
  toCytoscapeNodeId,
} from "./cytoscape-adapter";
import type { GraphResult } from "./graph-scope";

describe("cytoscape adapter", () => {
  it("maps graph nodes and edges into Cytoscape elements", () => {
    const elements = graphResultToCytoscapeElements(createGraphResult());

    expect(elements).toHaveLength(3);
    expect(elements[0]).toMatchObject({
      group: "nodes",
      data: {
        id: "node:n1",
        originalId: "n1",
        label: "Source note",
        kind: "Note",
        path: "Notes/source.md",
      },
      classes: "context-node kind-note label-note",
    });
    expect(elements[2]).toMatchObject({
      group: "edges",
      data: {
        id: "edge:r1",
        originalId: "r1",
        source: "node:n1",
        target: "node:n2",
        label: "링크",
        displayLabel: "",
      },
      classes: "context-edge relation-links_to",
    });
  });

  it("adds folder role classes for external bridge and isolated folder nodes", () => {
    const result = createGraphResult();
    result.scope = {
      type: "folder",
      path: "Notes",
      recursive: true,
      includeExternalBridges: true,
      maxNodes: 80,
    };
    result.nodes[0].scopeRole = "folder-internal";
    result.nodes[1].scopeRole = "external-bridge";
    result.edges = [];
    result.summary = {
      ...result.summary,
      scopeType: "folder",
      targetPath: "Notes",
      depth: undefined,
      folderRecursive: true,
      folderExternalBridges: true,
      folder: {
        totalInternalNotes: 1,
        displayedInternalNotes: 1,
        isolatedInternalNotes: 1,
        internalEdges: 0,
        internalLinks: 0,
        bridgeEdges: 0,
        displayedExternalBridgeNodes: 1,
        displayedExternalBridgeNotes: 1,
        totalExternalBridgeNodes: 1,
        centralNotes: [],
        isolatedNotes: [
          {
            id: "n1",
            label: "Source note",
            path: "Notes/source.md",
            degree: 0,
            internalDegree: 0,
            bridgeDegree: 0,
          },
        ],
        externalBridgeNotes: [
          {
            id: "n2",
            label: "Target note",
            path: "Notes/target.md",
            degree: 0,
            internalDegree: 0,
            bridgeDegree: 0,
          },
        ],
      },
    };

    const elements = graphResultToCytoscapeElements(result);

    expect(elements[0].classes).toContain("scope-folder-internal");
    expect(elements[0].classes).toContain("folder-isolated");
    expect(elements[1].classes).toContain("scope-external-bridge");
    expect(elements[1].data.scopeRole).toBe("external-bridge");
  });

  it("skips edges that reference missing graph nodes", () => {
    const result = createGraphResult();
    result.edges.push({
      id: "dangling",
      source: "n1",
      target: "missing",
      type: "RELATED_TO",
      properties: {},
    });

    const edgeElements = graphResultToCytoscapeElements(result).filter((element) => element.group === "edges");

    expect(edgeElements).toHaveLength(1);
    expect(edgeElements[0].data.id).toBe("edge:r1");
  });

  it("uses Korean display labels for semantic relationship edges", () => {
    const result = createGraphResult();
    result.edges[0] = {
      id: "r1",
      source: "n1",
      target: "n2",
      type: "RELATED_TO",
      properties: {},
    };

    const edgeElement = graphResultToCytoscapeElements(result).find((element) => element.group === "edges");

    expect(edgeElement?.data).toMatchObject({
      label: "관련",
      displayLabel: "관련",
      type: "RELATED_TO",
    });
  });

  it("prefixes Cytoscape ids to avoid node and edge id collisions", () => {
    expect(toCytoscapeNodeId("42")).toBe("node:42");
    expect(toCytoscapeEdgeId("42")).toBe("edge:42");
  });
});

function createGraphResult(): GraphResult {
  return {
    scope: {
      type: "note",
      path: "Notes/source.md",
      depth: 2,
      maxNodes: 80,
    },
    nodes: [
      {
        id: "n1",
        labels: ["Note"],
        kind: "Note",
        label: "Source note",
        path: "Notes/source.md",
        title: "Source note",
        properties: { path: "Notes/source.md", title: "Source note" },
      },
      {
        id: "n2",
        labels: ["Note"],
        kind: "Note",
        label: "Target note",
        path: "Notes/target.md",
        title: "Target note",
        properties: { path: "Notes/target.md", title: "Target note" },
      },
    ],
    edges: [
      {
        id: "r1",
        source: "n1",
        target: "n2",
        type: "LINKS_TO",
        properties: { count: 2 },
      },
    ],
    summary: {
      scopeType: "note",
      targetPath: "Notes/source.md",
      depth: 2,
      maxNodes: 80,
      nodeCount: 2,
      edgeCount: 1,
      truncated: false,
      warnings: [],
    },
  };
}
