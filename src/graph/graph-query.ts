import { Neo4jClient, sanitizeNeo4jError, type Neo4jQueryRecordsResult, type QueryParameters } from "../neo4j/client";
import type { ContextGraphMemorySettings } from "../types";
import type {
  FolderGraphScope,
  FolderGraphSummary,
  FolderGraphSummaryNode,
  GraphEdge,
  GraphNode,
  GraphNodeScopeRole,
  GraphResult,
  GraphScope,
  NoteGraphScope,
  SelectionGraphScope,
} from "./graph-scope";

export interface GraphQuery {
  cypher: string;
  parameters: QueryParameters;
}

export interface GraphQueryRunner {
  query(cypher: string, parameters?: QueryParameters): Promise<Neo4jQueryRecordsResult>;
  close?(): Promise<void>;
}

export type GraphQueryRunnerFactory = () => GraphQueryRunner;

interface RawGraphNode {
  id: string;
  labels?: string[];
  properties?: Record<string, unknown>;
}

interface RawGraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  properties?: Record<string, unknown>;
}

interface GraphNodeRoleSets {
  folderNodeIds: Set<string>;
  externalBridgeNodeIds: Set<string>;
}

export class GraphQueryService {
  constructor(
    private readonly settings: ContextGraphMemorySettings,
    private readonly createRunner: GraphQueryRunnerFactory = () => new Neo4jClient(settings),
  ) {}

  async getGraph(scope: GraphScope): Promise<GraphResult> {
    const runner = this.createRunner();

    try {
      const query = buildGraphQuery(scope);
      const result = await runner.query(query.cypher, query.parameters);
      return buildGraphResult(scope, result);
    } catch (error) {
      throw new Error(sanitizeNeo4jError(error, this.settings));
    } finally {
      await runner.close?.();
    }
  }
}

export function buildGraphQuery(scope: GraphScope): GraphQuery {
  if (scope.type === "note") {
    return buildNoteGraphQuery(scope);
  }

  if (scope.type === "folder") {
    return buildFolderGraphQuery(scope);
  }

  return buildSelectionGraphQuery(scope);
}

export function buildGraphResult(scope: GraphScope, result: Neo4jQueryRecordsResult): GraphResult {
  const record = result.records[0] ?? {};
  const roleSets = scope.type === "folder" ? buildGraphNodeRoleSets(record) : undefined;
  const nodes = normalizeGraphNodes(record.nodes, roleSets);
  const edges = normalizeGraphEdges(record.edges, new Set(nodes.map((node) => node.id)));
  const truncated = Boolean(record.truncated);
  const targetPath = scope.type === "selection" ? undefined : scope.path;
  const folderSummary = scope.type === "folder" ? buildFolderGraphSummary(scope, nodes, edges, record) : undefined;
  const warnings = buildGraphWarnings(scope, truncated, folderSummary);

  return {
    scope,
    nodes,
    edges,
    summary: {
      scopeType: scope.type,
      targetPath,
      depth: scope.type === "note" ? scope.depth : undefined,
      maxNodes: scope.maxNodes,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      truncated,
      folderRecursive: scope.type === "folder" ? scope.recursive : undefined,
      folderExternalBridges: scope.type === "folder" ? scope.includeExternalBridges : undefined,
      folder: folderSummary,
      warnings,
    },
  };
}

function buildNoteGraphQuery(scope: NoteGraphScope): GraphQuery {
  const depth = clampDepth(scope.depth);

  return {
    cypher: `
MATCH (start:Note {path: $path})
WHERE coalesce(start.archived, false) = false
OPTIONAL MATCH graphPath = (start)-[*1..${depth}]-(neighbor)
WHERE all(node IN nodes(graphPath) WHERE NOT ("Note" IN labels(node)) OR coalesce(node.archived, false) = false)
WITH collect(DISTINCT graphPath) AS graphPaths, [node IN ([start] + collect(DISTINCT neighbor)) WHERE node IS NOT NULL] AS candidateNodes
WITH graphPaths, candidateNodes[0..$maxNodes] AS limitedNodes, size(candidateNodes) > $maxNodes AS truncated
CALL {
  WITH graphPaths, limitedNodes
  UNWIND graphPaths AS graphPath
  WITH graphPath, limitedNodes WHERE graphPath IS NOT NULL
  UNWIND relationships(graphPath) AS rel
  WITH DISTINCT rel, limitedNodes
  WHERE startNode(rel) IN limitedNodes AND endNode(rel) IN limitedNodes
  RETURN collect({
    id: elementId(rel),
    source: elementId(startNode(rel)),
    target: elementId(endNode(rel)),
    type: type(rel),
    properties: properties(rel)
  }) AS edges
}
RETURN [node IN limitedNodes | {
  id: elementId(node),
  labels: labels(node),
  properties: properties(node)
}] AS nodes,
edges,
truncated
`,
    parameters: {
      path: scope.path,
      maxNodes: scope.maxNodes,
    },
  };
}

function buildFolderGraphQuery(scope: FolderGraphScope): GraphQuery {
  return {
    cypher: `
MATCH (folderNote:Note)
WHERE coalesce(folderNote.archived, false) = false
  AND (
    folderNote.folder = $folderPath
    OR ($recursive = true AND ($folderPath = "" OR folderNote.folder STARTS WITH $folderPrefix))
  )
WITH DISTINCT folderNote
ORDER BY folderNote.path
WITH collect(folderNote) AS folderNodes
WITH folderNodes[0..$maxNodes] AS seedNodes, size(folderNodes) > $maxNodes AS folderTruncated
OPTIONAL MATCH (source)-[rel]-(target)
WHERE source IN seedNodes
  AND (target IN seedNodes OR $includeExternalBridges = true)
  AND (NOT ("Note" IN labels(target)) OR coalesce(target.archived, false) = false)
WITH folderNodes, seedNodes, folderTruncated, collect(DISTINCT rel) AS rels, collect(DISTINCT target) AS relatedNodes
WITH folderNodes,
     seedNodes,
     [node IN relatedNodes WHERE node IS NOT NULL AND $includeExternalBridges = true AND NOT (node IN seedNodes)] AS externalNodes,
     rels,
     folderTruncated
WITH folderNodes,
     seedNodes,
     externalNodes,
     rels,
     seedNodes + externalNodes AS candidateNodes,
     folderTruncated
WITH folderNodes,
     seedNodes,
     externalNodes,
     rels,
     candidateNodes,
     candidateNodes[0..$maxNodes] AS limitedNodes,
     folderTruncated OR size(candidateNodes) > $maxNodes AS truncated,
     CASE
       WHEN folderTruncated THEN "folder-note-limit"
       WHEN size(candidateNodes) > $maxNodes THEN "external-bridge-limit"
       ELSE null
     END AS truncationReason
WITH limitedNodes,
     seedNodes,
     externalNodes,
     [rel IN rels WHERE rel IS NOT NULL AND startNode(rel) IN limitedNodes AND endNode(rel) IN limitedNodes] AS filteredRels,
     truncated,
     truncationReason,
     size(folderNodes) AS totalFolderNoteCount,
     size(externalNodes) AS totalExternalBridgeNodeCount
RETURN [node IN limitedNodes | {
  id: elementId(node),
  labels: labels(node),
  properties: properties(node)
}] AS nodes,
[rel IN filteredRels | {
  id: elementId(rel),
  source: elementId(startNode(rel)),
  target: elementId(endNode(rel)),
  type: type(rel),
  properties: properties(rel)
}] AS edges,
truncated,
truncationReason,
[node IN limitedNodes WHERE node IN seedNodes | elementId(node)] AS folderNodeIds,
[node IN limitedNodes WHERE node IN externalNodes | elementId(node)] AS externalBridgeNodeIds,
totalFolderNoteCount,
totalExternalBridgeNodeCount
`,
    parameters: {
      folderPath: scope.path,
      folderPrefix: scope.path.length > 0 ? `${scope.path}/` : "",
      recursive: scope.recursive,
      includeExternalBridges: scope.includeExternalBridges,
      maxNodes: scope.maxNodes,
    },
  };
}

function buildSelectionGraphQuery(scope: SelectionGraphScope): GraphQuery {
  return {
    cypher: `
MATCH (seed:Note)
WHERE seed.path IN $paths
  AND coalesce(seed.archived, false) = false
WITH collect(DISTINCT seed) AS seedNodes
WITH seedNodes[0..$maxNodes] AS seedNodes, size(seedNodes) > $maxNodes AS seedTruncated
OPTIONAL MATCH (source)-[rel]-(target)
WHERE source IN seedNodes
  AND (target IN seedNodes OR $includeExternalBridges = true)
  AND (NOT ("Note" IN labels(target)) OR coalesce(target.archived, false) = false)
WITH seedNodes,
     seedTruncated,
     collect(DISTINCT rel) AS rels,
     [node IN collect(DISTINCT target) WHERE node IS NOT NULL AND $includeExternalBridges = true AND NOT (node IN seedNodes)] AS externalNodes
WITH (seedNodes + externalNodes)[0..$maxNodes] AS limitedNodes,
     rels,
     seedTruncated OR size(seedNodes + externalNodes) > $maxNodes AS truncated
WITH limitedNodes,
     [rel IN rels WHERE rel IS NOT NULL AND startNode(rel) IN limitedNodes AND endNode(rel) IN limitedNodes] AS filteredRels,
     truncated
RETURN [node IN limitedNodes | {
  id: elementId(node),
  labels: labels(node),
  properties: properties(node)
}] AS nodes,
[rel IN filteredRels | {
  id: elementId(rel),
  source: elementId(startNode(rel)),
  target: elementId(endNode(rel)),
  type: type(rel),
  properties: properties(rel)
}] AS edges,
truncated
`,
    parameters: {
      paths: scope.paths,
      includeExternalBridges: scope.includeExternalBridges,
      maxNodes: scope.maxNodes,
    },
  };
}

function normalizeGraphNodes(value: unknown, roleSets?: GraphNodeRoleSets): GraphNode[] {
  const nodes = asArray<RawGraphNode>(value);
  const byId = new Map<string, GraphNode>();

  for (const node of nodes) {
    if (!isRawGraphNode(node)) {
      continue;
    }

    const labels = Array.isArray(node.labels) ? node.labels : [];
    const properties = isRecord(node.properties) ? node.properties : {};
    byId.set(node.id, {
      id: node.id,
      labels,
      kind: labels[0] ?? "Node",
      label: resolveNodeLabel(labels, properties),
      path: typeof properties.path === "string" ? properties.path : undefined,
      title: typeof properties.title === "string" ? properties.title : undefined,
      scopeRole: resolveGraphNodeScopeRole(node.id, roleSets),
      properties,
    });
  }

  return [...byId.values()];
}

function buildGraphNodeRoleSets(record: Record<string, unknown>): GraphNodeRoleSets {
  return {
    folderNodeIds: new Set(asArray<string>(record.folderNodeIds).filter((id) => typeof id === "string")),
    externalBridgeNodeIds: new Set(asArray<string>(record.externalBridgeNodeIds).filter((id) => typeof id === "string")),
  };
}

function resolveGraphNodeScopeRole(id: string, roleSets: GraphNodeRoleSets | undefined): GraphNodeScopeRole | undefined {
  if (!roleSets) {
    return undefined;
  }

  if (roleSets.folderNodeIds.has(id)) {
    return "folder-internal";
  }

  if (roleSets.externalBridgeNodeIds.has(id)) {
    return "external-bridge";
  }

  return undefined;
}

function buildFolderGraphSummary(
  scope: FolderGraphScope,
  nodes: GraphNode[],
  edges: GraphEdge[],
  record: Record<string, unknown>,
): FolderGraphSummary {
  const noteIds = new Set(nodes.filter(isNoteNode).map((node) => node.id));
  const internalNoteNodes = nodes.filter((node) => node.scopeRole === "folder-internal" && isNoteNode(node));
  const externalBridgeNodes = nodes.filter((node) => node.scopeRole === "external-bridge");
  const externalBridgeNoteNodes = externalBridgeNodes.filter(isNoteNode);
  const internalNoteIds = new Set(internalNoteNodes.map((node) => node.id));
  const externalBridgeNoteIds = new Set(externalBridgeNoteNodes.map((node) => node.id));
  const noteEdges = edges.filter((edge) => noteIds.has(edge.source) && noteIds.has(edge.target));
  const internalEdges = noteEdges.filter((edge) => internalNoteIds.has(edge.source) && internalNoteIds.has(edge.target));
  const bridgeEdges = noteEdges.filter(
    (edge) =>
      (internalNoteIds.has(edge.source) && externalBridgeNoteIds.has(edge.target)) ||
      (internalNoteIds.has(edge.target) && externalBridgeNoteIds.has(edge.source)),
  );
  const degreeMaps = buildFolderDegreeMaps(internalNoteIds, externalBridgeNoteIds, noteEdges);
  const isolatedNodes = internalNoteNodes.filter((node) => (degreeMaps.total.get(node.id) ?? 0) === 0);
  const centralNotes = internalNoteNodes
    .filter((node) => (degreeMaps.total.get(node.id) ?? 0) > 0)
    .sort((left, right) => compareFolderSummaryNodes(left, right, degreeMaps.total))
    .slice(0, 5)
    .map((node) => toFolderSummaryNode(node, degreeMaps));
  const isolatedNotes = isolatedNodes
    .sort((left, right) => left.label.localeCompare(right.label))
    .slice(0, 10)
    .map((node) => toFolderSummaryNode(node, degreeMaps));
  const externalBridgeNotes = externalBridgeNoteNodes
    .sort((left, right) => compareFolderSummaryNodes(left, right, degreeMaps.bridge))
    .slice(0, 5)
    .map((node) => toFolderSummaryNode(node, degreeMaps));

  return {
    totalInternalNotes: asNonNegativeInteger(record.totalFolderNoteCount) ?? internalNoteNodes.length,
    displayedInternalNotes: internalNoteNodes.length,
    isolatedInternalNotes: isolatedNodes.length,
    internalEdges: internalEdges.length,
    internalLinks: internalEdges.filter((edge) => edge.type === "LINKS_TO").length,
    bridgeEdges: bridgeEdges.length,
    displayedExternalBridgeNodes: externalBridgeNodes.length,
    displayedExternalBridgeNotes: externalBridgeNoteNodes.length,
    totalExternalBridgeNodes: scope.includeExternalBridges
      ? (asNonNegativeInteger(record.totalExternalBridgeNodeCount) ?? externalBridgeNodes.length)
      : 0,
    centralNotes,
    isolatedNotes,
    externalBridgeNotes,
    truncationReason: asNonEmptyString(record.truncationReason),
  };
}

function buildFolderDegreeMaps(
  internalNoteIds: Set<string>,
  externalBridgeNoteIds: Set<string>,
  noteEdges: GraphEdge[],
): { total: Map<string, number>; internal: Map<string, number>; bridge: Map<string, number> } {
  const total = new Map<string, number>();
  const internal = new Map<string, number>();
  const bridge = new Map<string, number>();

  for (const edge of noteEdges) {
    incrementMap(total, edge.source);
    incrementMap(total, edge.target);

    if (internalNoteIds.has(edge.source) && internalNoteIds.has(edge.target)) {
      incrementMap(internal, edge.source);
      incrementMap(internal, edge.target);
      continue;
    }

    const sourceIsBridge = externalBridgeNoteIds.has(edge.source);
    const targetIsBridge = externalBridgeNoteIds.has(edge.target);
    if ((internalNoteIds.has(edge.source) && targetIsBridge) || (internalNoteIds.has(edge.target) && sourceIsBridge)) {
      incrementMap(bridge, edge.source);
      incrementMap(bridge, edge.target);
    }
  }

  return { total, internal, bridge };
}

function toFolderSummaryNode(
  node: GraphNode,
  degreeMaps: { total: Map<string, number>; internal: Map<string, number>; bridge: Map<string, number> },
): FolderGraphSummaryNode {
  return {
    id: node.id,
    label: node.label,
    path: node.path,
    degree: degreeMaps.total.get(node.id) ?? 0,
    internalDegree: degreeMaps.internal.get(node.id) ?? 0,
    bridgeDegree: degreeMaps.bridge.get(node.id) ?? 0,
  };
}

function compareFolderSummaryNodes(left: GraphNode, right: GraphNode, degreeMap: Map<string, number>): number {
  const degreeDifference = (degreeMap.get(right.id) ?? 0) - (degreeMap.get(left.id) ?? 0);
  return degreeDifference !== 0 ? degreeDifference : left.label.localeCompare(right.label);
}

function buildGraphWarnings(
  scope: GraphScope,
  truncated: boolean,
  folderSummary: FolderGraphSummary | undefined,
): string[] {
  if (!truncated) {
    return [];
  }

  if (scope.type !== "folder" || !folderSummary?.truncationReason) {
    return [`Graph was truncated at ${scope.maxNodes} nodes.`];
  }

  if (folderSummary.truncationReason === "folder-note-limit") {
    return [
      `Folder graph was truncated at ${scope.maxNodes} nodes before all folder notes could be shown.`,
    ];
  }

  if (folderSummary.truncationReason === "external-bridge-limit") {
    return [
      `Folder graph was truncated at ${scope.maxNodes} nodes after showing folder notes and before all external bridges could be shown.`,
    ];
  }

  return [`Graph was truncated at ${scope.maxNodes} nodes.`];
}

function isNoteNode(node: GraphNode): boolean {
  return node.labels.includes("Note");
}

function incrementMap(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function asNonNegativeInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(0, Math.trunc(value));
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizeGraphEdges(value: unknown, nodeIds: Set<string>): GraphEdge[] {
  const edges = asArray<RawGraphEdge>(value);
  const byId = new Map<string, GraphEdge>();

  for (const edge of edges) {
    if (!isRawGraphEdge(edge) || !nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      continue;
    }

    byId.set(edge.id, {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      properties: isRecord(edge.properties) ? edge.properties : {},
    });
  }

  return [...byId.values()];
}

function resolveNodeLabel(labels: string[], properties: Record<string, unknown>): string {
  if (typeof properties.title === "string" && properties.title.length > 0) {
    return properties.title;
  }

  if (typeof properties.name === "string" && properties.name.length > 0) {
    return properties.name;
  }

  if (typeof properties.path === "string" && properties.path.length > 0) {
    return properties.path.split("/").pop()?.replace(/\.md$/u, "") ?? properties.path;
  }

  return labels[0] ?? "Node";
}

function isRawGraphNode(value: RawGraphNode): value is RawGraphNode {
  return isRecord(value) && typeof value.id === "string";
}

function isRawGraphEdge(value: RawGraphEdge): value is RawGraphEdge {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.source === "string" &&
    typeof value.target === "string" &&
    typeof value.type === "string"
  );
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function clampDepth(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(Math.max(Math.trunc(value), 1), 5);
}
