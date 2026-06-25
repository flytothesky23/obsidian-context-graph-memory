import type { GraphEdge, GraphNode, GraphResult } from "../graph/graph-scope";

const DEFAULT_CURRENT_NOTE_MAX_CHARS = 12000;
const MEMORY_TYPES = ["Preference", "Rule", "Decision"] as const;
const SENSITIVE_PLACEHOLDER = "[마스킹]";
const SENSITIVE_TOKEN_PLACEHOLDER = "[마스킹-토큰]";

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
    "# Codex 구현 컨텍스트",
    "",
    "## 현재 노트",
    "",
    currentNote,
    "",
    "## 연관 노트",
    "",
    relatedNotes,
    "",
    "## 그래프 메모리",
    "",
    graphMemory,
    "",
    "## 작업",
    "",
    task,
    "",
    "## 검증",
    "",
    verification,
    "",
  ].join("\n");
}

export function sanitizeContextText(text: string, options: SanitizerOptions = {}): string {
  let sanitized = text;

  for (const value of options.redactValues ?? []) {
    if (value.trim().length > 0) {
      sanitized = sanitized.split(value).join(SENSITIVE_PLACEHOLDER);
    }
  }

  return sanitized
    .replace(
      /\b(password|passwd|token|secret|credential|credentials|api[_ -]?key|auth|authorization|login|runtime[_ -]?log|neo4jPassword)\b\s*[:=]\s*("[^"]*"|'[^']*'|\{[^}\n]*\}|[^\s,;]+)/giu,
      (_match, key: string) => `${key}=${SENSITIVE_PLACEHOLDER}`,
    )
    .replace(
      /(["'])(password|passwd|token|secret|credential|credentials|api[_ -]?key|auth|authorization|login|runtime[_ -]?log|neo4jPassword)\1\s*:\s*(["'])(.*?)\3/giu,
      (_match, quote: string, key: string) => `${quote}${key}${quote}: "${SENSITIVE_PLACEHOLDER}"`,
    )
    .replace(
      /(["'])(password|passwd|token|secret|credential|credentials|api[_ -]?key|auth|authorization|login|runtime[_ -]?log|neo4jPassword)\1\s*:\s*\{[^}\n]*\}/giu,
      (_match, quote: string, key: string) => `${quote}${key}${quote}: "${SENSITIVE_PLACEHOLDER}"`,
    )
    .replace(
      /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/giu,
      (_match, scheme: string) => `${scheme} ${SENSITIVE_PLACEHOLDER}`,
    )
    .replace(
      /\b(sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{8,})\b/gu,
      SENSITIVE_TOKEN_PLACEHOLDER,
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
    truncated ? `${rawContent.slice(0, maxChars)}\n\n[${maxChars}자에서 잘림]` : rawContent,
    sanitizerOptions,
  );

  return [
    `- 경로: \`${sanitizeInline(input.currentNote.path, sanitizerOptions)}\``,
    `- 제목: ${sanitizeInline(input.currentNote.title, sanitizerOptions)}`,
    `- 내보낸 시각: ${sanitizeInline(generatedAt, sanitizerOptions)}`,
    `- 본문 잘림: ${truncated ? "예" : "아니오"}`,
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
    return "- 연관 그래프는 내보내기 시 조회할 수 없었습니다.";
  }

  const notes = graph.nodes
    .filter((node) => hasLabel(node, "Note") && node.path && node.path !== currentPath)
    .sort(compareNodesByLabel);

  if (notes.length === 0) {
    return "- 그래프 조회로 반환된 연관 노트가 없습니다.";
  }

  return notes
    .map((note) => {
      const title = note.title ?? note.label;
      const path = note.path ?? "";
      const degree = getNodeDegree(note.id, graph.edges);
      return `- ${formatObsidianNoteLink(path, title, sanitizerOptions)} - \`${sanitizeInline(path, sanitizerOptions)}\`, 관계 ${degree}개`;
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
    lines.push(`- 그래프 경고: ${sanitizeInline(graphError, sanitizerOptions)}`);
  }

  if (!graph) {
    lines.push("- 그래프 요약 또는 메모리 노드가 조회되지 않았습니다.");
    return lines.join("\n");
  }

  lines.push(...buildGraphSummaryLines(graph, sanitizerOptions));

  const memoryNodes = graph.nodes
    .filter(isMemoryNode)
    .sort((left, right) => `${getMemoryType(left)}:${left.label}`.localeCompare(`${getMemoryType(right)}:${right.label}`));

  if (memoryNodes.length === 0) {
    lines.push("- 그래프 조회에서 선호/규칙/결정 메모리 노드가 없습니다.");
    return lines.join("\n");
  }

  lines.push("");
  for (const type of MEMORY_TYPES) {
    const nodes = memoryNodes.filter((node) => getMemoryType(node) === type);
    if (nodes.length === 0) {
      continue;
    }

    lines.push(`### ${formatMemoryType(type)}`);
    for (const node of nodes) {
      lines.push(formatMemoryNode(node, sanitizerOptions));
    }
    lines.push("");
  }

  return trimTrailingBlankLines(lines).join("\n");
}

function buildTaskSection(graphError: string | undefined, sanitizerOptions: SanitizerOptions): string {
  const lines = [
    "- 구현의 출처는 '현재 노트' 섹션을 기준으로 삼으세요.",
    "- '연관 노트'와 '그래프 메모리'는 보조 콘텍스트로만 사용하세요.",
    "- Neo4j 그래프 데이터는 마크다운을 기반으로 재생성 가능한 파생 인덱스입니다.",
    "- 이 플러그인 명령은 Codex CLI를 실행하지 않으며 마크다운 컨텍스트만 작성합니다.",
  ];

  if (graphError) {
    lines.push(`- 그래프 메모리를 신뢰하기 전 경고를 해결하거나 수락하세요: ${sanitizeInline(graphError, sanitizerOptions)}`);
  }

  return lines.join("\n");
}

function buildVerificationSection(graphError: string | undefined, sanitizerOptions: SanitizerOptions): string {
  const lines = [
    "- 소스 노트나 PRD의 작업별 검증 명령을 실행하세요.",
    "- 플러그인 구현 완료 보고 전 `npm test`와 `npm run build`를 실행하세요.",
    "- 생성된 출력에서 필수 섹션이 존재하는지 확인하고 자격증명, 토큰, 인증/로그 페이로드가 포함되지 않았는지 점검하세요.",
  ];

  if (graphError) {
    lines.push(`- 그래프 내보내기 경고: ${sanitizeInline(graphError, sanitizerOptions)}`);
  }

  return lines.join("\n");
}

function buildGraphSummaryLines(graph: GraphResult, sanitizerOptions: SanitizerOptions): string[] {
  const relationshipTypes = countRelationshipTypes(graph.edges);
  const target = graph.summary.targetPath ?? getScopeTarget(graph);
  const lines = [
    `- 범위: ${formatScopeType(graph.summary.scopeType)}`,
    `- 대상: ${target ? `\`${sanitizeInline(target, sanitizerOptions)}\`` : "해당 없음"}`,
    `- 깊이: ${graph.summary.depth ?? "해당 없음"}`,
    `- 노드: ${graph.summary.nodeCount}개`,
    `- 엣지: ${graph.summary.edgeCount}개`,
    `- 잘림: ${graph.summary.truncated ? "예" : "아니오"}`,
    `- 관계 유형: ${formatRelationshipTypeCounts(relationshipTypes, sanitizerOptions)}`,
  ];

  for (const warning of graph.summary.warnings) {
    lines.push(`- 경고: ${sanitizeInline(warning, sanitizerOptions)}`);
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
    : "알 수 없는 출처";
  const suffix = createdAt ? ` (${sanitizeInline(createdAt, sanitizerOptions)})` : "";

  return `- [${formatMemoryType(type)}] ${sanitizeInline(text, sanitizerOptions)}${suffix}\n  출처: ${source}`;
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
    return "없음";
  }

  return [...counts.entries()]
    .sort(([left], [right]) => {
      const leftLabel = formatRelationshipTypeLabel(left);
      const rightLabel = formatRelationshipTypeLabel(right);
      return leftLabel.localeCompare(rightLabel) || left.localeCompare(right);
    })
    .map(([type, count]) => `${formatRelationshipTypeLabel(type)}=${count}`)
    .join(", ");
}

function formatScopeType(scopeType: GraphResult["summary"]["scopeType"]): string {
  if (scopeType === "note") {
    return "노트";
  }

  if (scopeType === "folder") {
    return "폴더";
  }

  if (scopeType === "selection") {
    return "선택";
  }

  return String(scopeType);
}

function formatRelationshipTypeLabel(type: string): string {
  if (type === "LINKS_TO") {
    return "링크";
  }

  if (type === "HAS_TAG") {
    return "태그";
  }

  if (type === "RELATED_TO") {
    return "관련";
  }

  if (type === "SUPPORTS") {
    return "지원";
  }

  if (type === "DEPENDS_ON") {
    return "의존";
  }

  if (type === "PART_OF") {
    return "구성";
  }

  if (type === "AFFECTS") {
    return "영향";
  }

  if (type === "EVIDENCED_BY") {
    return "근거";
  }

  if (type === "MENTIONS") {
    return "언급";
  }

  if (type === "RECORDED_IN") {
    return "기록";
  }

  return type;
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
  const normalizedContent = content.length > 0 ? content : "(내용 없음)";
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

function formatMemoryType(type: MemoryType): string {
  if (type === "Preference") {
    return "선호";
  }

  if (type === "Rule") {
    return "규칙";
  }

  return "결정";
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
