import { describe, expect, it } from "vitest";
import type { GraphResult } from "../graph/graph-scope";
import { buildCodexContext, sanitizeContextText } from "./codex-context-builder";

describe("CodexContextBuilder", () => {
  it("builds the required Codex Implementation Context structure", () => {
    const output = buildCodexContext({
      currentNote: {
        path: "Projects/Task.md",
        title: "Task",
        content: "Implement the export command.\n\n```ts\nconst token = 'abc';\n```",
      },
      graph: createGraph(),
      generatedAt: "2026-06-24T00:00:00.000Z",
      maxCurrentNoteChars: 1000,
    });

    expect(output).toContain("# Codex 구현 컨텍스트");
    expect(headings(output)).toEqual([
      "# Codex 구현 컨텍스트",
      "## 현재 노트",
      "## 연관 노트",
      "## 그래프 메모리",
      "### 선호",
      "### 결정",
      "## 작업",
      "## 검증",
    ]);
    expect(output).toContain("[[Projects/Related|Related]]");
    expect(output).toContain("- [선호] Prefer explicit task scopes.");
    expect(output).toContain("- [결정] Use Cytoscape for graph rendering.");
    expect(output).toContain("- 관계 유형: 기록=1, 링크=1");
  });

  it("redacts credential-like content from note body and graph memory", () => {
    const output = buildCodexContext({
      currentNote: {
        path: "Projects/Secret Task.md",
        title: "Secret Task",
        content: 'password: hunter2\n"auth": {"token":"abc"}\nBearer eyJhbGciOiJIUzI1NiIs\nsk-1234567890',
      },
      graph: createGraph("token=graphsecret and ghp_1234567890abcdef"),
      generatedAt: "2026-06-24T00:00:00.000Z",
      redactValues: ["hunter2"],
    });

    expect(output).not.toContain("hunter2");
    expect(output).not.toContain("graphsecret");
    expect(output).not.toContain("eyJhbGciOiJIUzI1NiIs");
    expect(output).not.toContain("ghp_1234567890abcdef");
    expect(output).not.toContain("sk-1234567890");
    expect(output).toContain("password=[마스킹]");
    expect(output).toContain('"auth": "[마스킹]"');
    expect(output).toContain("Bearer [마스킹]");
    expect(output).toContain("[마스킹-토큰]");
  });

  it("records graph warnings while keeping the export file usable", () => {
    const output = buildCodexContext({
      currentNote: {
        path: "Projects/Task.md",
        title: "Task",
        content: "Implement from this note.",
      },
      graphError: "password=secret failed",
      generatedAt: "2026-06-24T00:00:00.000Z",
    });

    expect(output).toContain("## 연관 노트");
    expect(output).toContain("- 연관 그래프는 내보내기 시 조회할 수 없었습니다.");
    expect(output).toContain("그래프 경고: password=[마스킹] failed");
    expect(output).toContain("이 플러그인 명령은 Codex CLI를 실행하지 않으며 마크다운 컨텍스트만 작성합니다.");
  });

  it("sanitizes direct secret values supplied by plugin settings", () => {
    expect(sanitizeContextText("Neo4j failed with super-secret-password", {
      redactValues: ["super-secret-password"],
    })).toBe("Neo4j failed with [마스킹]");
  });
});

function headings(markdown: string): string[] {
  return markdown
    .split("\n")
    .filter((line) => /^#{1,3}\s/u.test(line));
}

function createGraph(memoryText = "Use Cytoscape for graph rendering."): GraphResult {
  return {
    scope: {
      type: "note",
      path: "Projects/Task.md",
      depth: 2,
      maxNodes: 80,
    },
    nodes: [
      {
        id: "note-current",
        labels: ["Note"],
        kind: "Note",
        label: "Task",
        path: "Projects/Task.md",
        title: "Task",
        properties: {
          path: "Projects/Task.md",
          title: "Task",
        },
      },
      {
        id: "note-related",
        labels: ["Note"],
        kind: "Note",
        label: "Related",
        path: "Projects/Related.md",
        title: "Related",
        properties: {
          path: "Projects/Related.md",
          title: "Related",
        },
      },
      {
        id: "memory-pref",
        labels: ["Memory", "Preference"],
        kind: "Memory",
        label: "Prefer explicit task scopes.",
        properties: {
          type: "Preference",
          text: "Prefer explicit task scopes.",
          sourcePath: "Projects/Task.md",
          sourceTitle: "Task",
        },
      },
      {
        id: "memory-decision",
        labels: ["Memory", "Decision"],
        kind: "Memory",
        label: memoryText,
        properties: {
          type: "Decision",
          text: memoryText,
          sourcePath: "Projects/Related.md",
          sourceTitle: "Related",
        },
      },
    ],
    edges: [
      {
        id: "edge-link",
        source: "note-current",
        target: "note-related",
        type: "LINKS_TO",
        properties: {},
      },
      {
        id: "edge-memory",
        source: "memory-decision",
        target: "note-related",
        type: "RECORDED_IN",
        properties: {},
      },
    ],
    summary: {
      scopeType: "note",
      targetPath: "Projects/Task.md",
      depth: 2,
      maxNodes: 80,
      nodeCount: 4,
      edgeCount: 2,
      truncated: false,
      warnings: [],
    },
  };
}
