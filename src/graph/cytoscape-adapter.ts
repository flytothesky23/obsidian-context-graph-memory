import type cytoscape from "cytoscape";
import type { GraphEdge, GraphNode, GraphResult } from "./graph-scope";
import { formatRelationType, shouldShowRelationLabel } from "./labels";

export interface CytoscapeNodeData {
  id: string;
  originalId: string;
  label: string;
  kind: string;
  labels: string[];
  path?: string;
  title?: string;
  scopeRole?: string;
  properties: Record<string, unknown>;
}

export interface CytoscapeEdgeData {
  id: string;
  originalId: string;
  source: string;
  target: string;
  label: string;
  displayLabel: string;
  type: string;
  properties: Record<string, unknown>;
}

export type CytoscapeGraphElement = cytoscape.ElementDefinition;

export function graphResultToCytoscapeElements(result: GraphResult): CytoscapeGraphElement[] {
  const graphNodeIds = new Set(result.nodes.map((node) => node.id));
  const isolatedFolderNodeIds = new Set(result.summary.folder?.isolatedNotes.map((node) => node.id) ?? []);
  const elements: CytoscapeGraphElement[] = [];

  for (const node of result.nodes) {
    elements.push(graphNodeToCytoscapeElement(node, isolatedFolderNodeIds.has(node.id)));
  }

  for (const edge of result.edges) {
    if (graphNodeIds.has(edge.source) && graphNodeIds.has(edge.target)) {
      elements.push(graphEdgeToCytoscapeElement(edge));
    }
  }

  return elements;
}

export function graphNodeToCytoscapeElement(node: GraphNode, isolatedFolderNode = false): CytoscapeGraphElement {
  return {
    group: "nodes",
    data: {
      id: toCytoscapeNodeId(node.id),
      originalId: node.id,
      label: node.label,
      kind: node.kind,
      labels: node.labels,
      path: node.path,
      title: node.title,
      scopeRole: node.scopeRole,
      properties: node.properties,
    } satisfies CytoscapeNodeData,
    classes: buildNodeClasses(node, isolatedFolderNode),
  };
}

export function graphEdgeToCytoscapeElement(edge: GraphEdge): CytoscapeGraphElement {
  return {
    group: "edges",
    data: {
      id: toCytoscapeEdgeId(edge.id),
      originalId: edge.id,
      source: toCytoscapeNodeId(edge.source),
      target: toCytoscapeNodeId(edge.target),
      label: formatRelationType(edge.type),
      displayLabel: shouldShowRelationLabel(edge.type) ? formatRelationType(edge.type) : "",
      type: edge.type,
      properties: edge.properties,
    } satisfies CytoscapeEdgeData,
    classes: buildEdgeClasses(edge),
  };
}

export function toCytoscapeNodeId(graphNodeId: string): string {
  return `node:${graphNodeId}`;
}

export function toCytoscapeEdgeId(graphEdgeId: string): string {
  return `edge:${graphEdgeId}`;
}

function buildNodeClasses(node: GraphNode, isolatedFolderNode: boolean): string {
  const classes = ["context-node", `kind-${toClassPart(node.kind)}`];
  for (const label of node.labels) {
    classes.push(`label-${toClassPart(label)}`);
  }
  if (node.scopeRole) {
    classes.push(`scope-${toClassPart(node.scopeRole)}`);
  }
  if (isolatedFolderNode) {
    classes.push("folder-isolated");
  }
  return classes.join(" ");
}

function buildEdgeClasses(edge: GraphEdge): string {
  return ["context-edge", `relation-${toClassPart(edge.type)}`].join(" ");
}

function toClassPart(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/gu, "-").replace(/^-+|-+$/gu, "");
  return normalized.length > 0 ? normalized : "unknown";
}
