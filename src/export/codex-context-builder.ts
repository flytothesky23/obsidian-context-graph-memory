import type { GraphEdge, GraphNode, GraphResult } from "../graph/graph-scope";

const DEFAULT_CURRENT_NOTE_MAX_CHARS = 12000;
const MEMORY_TYPES = ["Preference", "Rule", "Decision"] as const;

type MemoryType = (typeof MEMORY_TYPES)[number];

export interface CodexContextCurrentNote {
  path: string;
  title: string;
  content: string;
}

export interface CodexContextBuildInput {
  currentNote: CodexContextCurrentNote;
  graph?: GraphResult;
  graphError?: string;
  generatedAt?: string;
  maxCurrentNoteChars?: number;
  redactValues?: string[];
}

interface SanitizerOptions {
  redactValues?: string[];
}

export class CodexContextBuilder {
  build(input: CodexContextBuildInput): string {
    return buildCodexContext(input);
  }
}

export function buildCodexContext(input: CodexContextBuildInput): string {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const sanitizerOptions = { redactValues: input.redactValues };
  const currentNote = buildCurrentNoteSection(input, generatedAt, sanitizerOptions);
  const relatedNotes = buildRelatedNotesSection(input.currentNote.path, input.graph, sanitizerOptions);
  const graphMemory = buildGraphMemorySection(input.graph, input.graphError, sanitizerOptions);
  const task = buildTaskSection(input.graphError, sanitizerOptions);
  const verification = buildVerificationSection(input.graphError, sanitizerOptions);

  return [
    "# Codex Implementation Context",
    "",
    "## Current Note",
    "",
    currentNote,
    "",
    "## Related Notes",
    "",
    relatedNotes,
    "",
    "## Graph Memory",
    "",
    graphMemory,
    "",
    "## Task",
    "",
    task,
    "",
    "## Verification",
    "",
    verification,
    "",
  ].join("\n");
}

export function sanitizeContextText(text: string, options: SanitizerOptions = {}): string {
  let sanitized = text;

  for (const value of options.redactValues ?? []) {
    if (value.trim().length > 0) {
      sanitized = sanitized.split(value).join("[masked]");
    }
  }

  return sanitized
    .replace(
      /\b(password|passwd|token|secret|credential|credentials|api[_ -]?key|auth|authorization|login|runtime[_ -]?log|neo4jPassword)\b\s*[:=]\s*("[^"]*"|'[^']*'|\{[^}\n]*\}|[^\s,;]+)/giu,
      (_match, key: string) => `${key}=[masked]`,
    )
    .replace(
      /(["'])(password|passwd|token|secret|credential|credentials|api[_ -]?key|auth|authorization|login|runtime[_ -]?log|neo4jPassword)\1\s*:\s*(["'])(.*?)\3/giu,
      (_match, quote: string, key: string) => `${quote}${key}${quote}: "[masked]"`,
    )
    .replace(
      /(["'])(password|passwd|token|secret|credential|credentials|api[_ -]?key|auth|authorization|login|runtime[_ -]?log|neo4jPassword)\1\s*:\s*\{[^}\n]*\}/giu,
      (_match, quote: string, key: string) => `${quote}${key}${quote}: "[masked]"`,
    )
    .replace(
      /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/giu,
      (_match, scheme: string) => `${scheme} [masked]`,
    )
    .replace(
      /\b(sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{8,})\b/gu,
      "[masked-token]",
    );
}

function buildCurrentNoteSection(
  input: CodexContextBuildInput,
  generatedAt: string,
  sanitizerOptions: SanitizerOptions,
): string {
  const maxChars = normalizeMaxChars(input.maxCurrentNoteChars);
  const rawContent = input.currentNote.content;
  const truncated = rawContent.length > maxChars;
  const content = sanitizeContextText(
    truncated ? `${rawContent.slice(0, maxChars)}\n\n[Truncated at ${maxChars} characters]` : rawContent,
    sanitizerOptions,
  );

  return [
    `- Path: \`${sanitizeInline(input.currentNote.path, sanitizerOptions)}\``,
    `- Title: ${sanitizeInline(input.currentNote.title, sanitizerOptions)}`,
    `- Exported: ${sanitizeInline(generatedAt, sanitizerOptions)}`,
    `- Content truncated: ${truncated ? "yes" : "no"}`,
    "",
    fencedBlock("markdown", content),
  ].join("\n");
}

function buildRelatedNotesSection(
  currentPath: string,
  graph: GraphResult | undefined,
  sanitizerOptions: SanitizerOptions,
): string {
  if (!graph) {
    return "- Related graph was unavailable during export.";
  }

  const notes = graph.nodes
    .filter((node) => hasLabel(node, "Note") && node.path && node.path !== currentPath)
    .sort(compareNodesByLabel);

  if (notes.length === 0) {
    return "- No related notes returned by the graph query.";
  }

  return notes
    .map((note) => {
      const title = note.title ?? note.label;
      const path = note.path ?? "";
      const degree = getNodeDegree(note.id, graph.edges);
      return `- ${formatObsidianNoteLink(path, title, sanitizerOptions)} - \`${sanitizeInline(path, sanitizerOptions)}\`, ${degree} relationships`;
    })
    .join("\n");
}

function buildGraphMemorySection(
  graph: GraphResult | undefined,
  graphError: string | undefined,
  sanitizerOptions: SanitizerOptions,
): string {
  const lines: string[] = [];

  if (graphError) {
    lines.push(`- Graph warning: ${sanitizeInline(graphError, sanitizerOptions)}`);
  }

  if (!graph) {
    lines.push("- No graph summary or memory nodes were available.");
    return lines.join("\n");
  }

  lines.push(...buildGraphSummaryLines(graph, sanitizerOptions));

  const memoryNodes = graph.nodes
    .filter(isMemoryNode)
    .sort((left, right) => `${getMemoryType(left)}:${left.label}`.localeCompare(`${getMemoryType(right)}:${right.label}`));

  if (memoryNodes.length === 0) {
    lines.push("- No Preference/Rule/Decision memory nodes returned by the graph query.");
    return lines.join("\n");
  }

  lines.push("");
  for (const type of MEMORY_TYPES) {
    const nodes = memoryNodes.filter((node) => getMemoryType(node) === type);
    if (nodes.length === 0) {
      continue;
    }

    lines.push(`### ${type}`);
    for (const node of nodes) {
      lines.push(formatMemoryNode(node, sanitizerOptions));
    }
    lines.push("");
  }

  return trimTrailingBlankLines(lines).join("\n");
}

function buildTaskSection(graphError: string | undefined, sanitizerOptions: SanitizerOptions): string {
  const lines = [
    "- Use the Current Note section as the implementation source of truth.",
    "- Use Related Notes and Graph Memory only as supporting context.",
    "- Treat Neo4j graph data as a derived index that can be rebuilt from Markdown.",
    "- Do not execute Codex CLI from this plugin command; this export only writes Markdown context.",
  ];

  if (graphError) {
    lines.push(`- Resolve or accept the graph warning before relying on graph memory: ${sanitizeInline(graphError, sanitizerOptions)}`);
  }

  return lines.join("\n");
}

function buildVerificationSection(graphError: string | undefined, sanitizerOptions: SanitizerOptions): string {
  const lines = [
    "- Run the task-specific verification commands from the source note or PRD.",
    "- For plugin implementation tasks, run `npm test` and `npm run build` before reporting completion.",
    "- Check generated outputs for required headings and confirm no credential, token, auth JSON, API key, or runtime log payload is present.",
  ];

  if (graphError) {
    lines.push(`- Graph export warning captured: ${sanitizeInline(graphError, sanitizerOptions)}`);
  }

  return lines.join("\n");
}

function buildGraphSummaryLines(graph: GraphResult, sanitizerOptions: SanitizerOptions): string[] {
  const relationshipTypes = countRelationshipTypes(graph.edges);
  const target = graph.summary.targetPath ?? getScopeTarget(graph);
  const lines = [
    `- Scope: ${graph.summary.scopeType}`,
    `- Target: ${target ? `\`${sanitizeInline(target, sanitizerOptions)}\`` : "n/a"}`,
    `- Depth: ${graph.summary.depth ?? "n/a"}`,
    `- Nodes: ${graph.summary.nodeCount}`,
    `- Edges: ${graph.summary.edgeCount}`,
    `- Truncated: ${graph.summary.truncated ? "yes" : "no"}`,
    `- Relationship types: ${formatRelationshipTypeCounts(relationshipTypes, sanitizerOptions)}`,
  ];

  for (const warning of graph.summary.warnings) {
    lines.push(`- Warning: ${sanitizeInline(warning, sanitizerOptions)}`);
  }

  return lines;
}

function formatMemoryNode(node: GraphNode, sanitizerOptions: SanitizerOptions): string {
  const type = getMemoryType(node);
  const text = getStringProperty(node, "text") ?? node.label;
  const sourcePath = getStringProperty(node, "sourcePath");
  const sourceTitle = getStringProperty(node, "sourceTitle") ?? sourcePath?.split("/").pop()?.replace(/\.md$/iu, "");
  const createdAt = getStringProperty(node, "createdAt");
  const source = sourcePath
    ? formatObsidianNoteLink(sourcePath, sourceTitle ?? sourcePath, sanitizerOptions)
    : "unknown source";
  const suffix = createdAt ? ` (${sanitizeInline(createdAt, sanitizerOptions)})` : "";

  return `- [${type}] ${sanitizeInline(text, sanitizerOptions)}${suffix}\n  Source: ${source}`;
}

function isMemoryNode(node: GraphNode): boolean {
  return hasLabel(node, "Memory") || MEMORY_TYPES.some((type) => hasLabel(node, type));
}

function getMemoryType(node: GraphNode): MemoryType {
  const propertyType = getStringProperty(node, "type");
  if (isMemoryType(propertyType)) {
    return propertyType;
  }

  for (const type of MEMORY_TYPES) {
    if (hasLabel(node, type)) {
      return type;
    }
  }

  return "Decision";
}

function isMemoryType(value: string | undefined): value is MemoryType {
  return Boolean(value && MEMORY_TYPES.includes(value as MemoryType));
}

function hasLabel(node: GraphNode, label: string): boolean {
  return node.labels.includes(label);
}

function getStringProperty(node: GraphNode, key: string): string | undefined {
  const value = node.properties[key];
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return undefined;
}

function getNodeDegree(nodeId: string, edges: GraphEdge[]): number {
  return edges.filter((edge) => edge.source === nodeId || edge.target === nodeId).length;
}

function countRelationshipTypes(edges: GraphEdge[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    counts.set(edge.type, (counts.get(edge.type) ?? 0) + 1);
  }
  return counts;
}

function formatRelationshipTypeCounts(counts: Map<string, number>, sanitizerOptions: SanitizerOptions): string {
  if (counts.size === 0) {
    return "none";
  }

  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([type, count]) => `${sanitizeInline(type, sanitizerOptions)}=${count}`)
    .join(", ");
}

function getScopeTarget(graph: GraphResult): string | undefined {
  if (graph.scope.type === "note" || graph.scope.type === "folder") {
    return graph.scope.path;
  }

  return graph.scope.paths.join(", ");
}

function formatObsidianNoteLink(path: string, title: string, sanitizerOptions: SanitizerOptions): string {
  const linkPath = path.replace(/\.md$/iu, "");
  return `[[${escapeWikilinkPart(sanitizeInline(linkPath, sanitizerOptions))}|${escapeWikilinkPart(sanitizeInline(title, sanitizerOptions))}]]`;
}

function escapeWikilinkPart(value: string): string {
  return value.replace(/\|/gu, "\\|");
}

function sanitizeInline(value: string, options: SanitizerOptions): string {
  return sanitizeContextText(value, options).replace(/\s+/gu, " ").trim();
}

function fencedBlock(language: string, content: string): string {
  const normalizedContent = content.length > 0 ? content : "(empty)";
  let fence = "```";

  while (normalizedContent.includes(fence)) {
    fence += "`";
  }

  return `${fence}${language}\n${normalizedContent}\n${fence}`;
}

function normalizeMaxChars(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) {
    return DEFAULT_CURRENT_NOTE_MAX_CHARS;
  }

  return Math.max(1, Math.trunc(value));
}

function compareNodesByLabel(left: GraphNode, right: GraphNode): number {
  return left.label.localeCompare(right.label);
}

function trimTrailingBlankLines(lines: string[]): string[] {
  const result = [...lines];
  while (result.length > 0 && result[result.length - 1].trim().length === 0) {
    result.pop();
  }
  return result;
}
