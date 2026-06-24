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

    expect(output).toContain("# Codex Implementation Context");
    expect(headings(output)).toEqual([
      "# Codex Implementation Context",
      "## Current Note",
      "## Related Notes",
      "## Graph Memory",
      "### Preference",
      "### Decision",
      "## Task",
      "## Verification",
    ]);
    expect(output).toContain("[[Projects/Related|Related]]");
    expect(output).toContain("- [Preference] Prefer explicit task scopes.");
    expect(output).toContain("- [Decision] Use Cytoscape for graph rendering.");
    expect(output).toContain("- Relationship types: LINKS_TO=1, RECORDED_IN=1");
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
    expect(output).toContain("password=[masked]");
    expect(output).toContain('"auth": "[masked]"');
    expect(output).toContain("Bearer [masked]");
    expect(output).toContain("[masked-token]");
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

    expect(output).toContain("## Related Notes");
    expect(output).toContain("- Related graph was unavailable during export.");
    expect(output).toContain("Graph warning: password=[masked] failed");
    expect(output).toContain("Do not execute Codex CLI from this plugin command");
  });

  it("sanitizes direct secret values supplied by plugin settings", () => {
    expect(sanitizeContextText("Neo4j failed with super-secret-password", {
      redactValues: ["super-secret-password"],
    })).toBe("Neo4j failed with [masked]");
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
