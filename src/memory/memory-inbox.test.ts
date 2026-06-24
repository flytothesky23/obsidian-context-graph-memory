import { describe, expect, it } from "vitest";
import {
  appendEntryToInboxContent,
  formatMemoryInboxEntry,
  sanitizeMemoryInboxText,
} from "./memory-inbox";
import type { PromotedMemory } from "./memory-promotion";

describe("memory inbox", () => {
  it("formats a memory entry with type and Obsidian source link", () => {
    expect(formatMemoryInboxEntry(createMemory("Rule", "Always verify with npm test."))).toBe(
      "- [Rule] Always verify with npm test.\n  Source: [[Projects/Context Graph|Context Graph]]",
    );
  });

  it("masks credential-like key value pairs in inbox text", () => {
    expect(sanitizeMemoryInboxText('token="abc123" and password: hunter2')).toBe(
      "token=[masked] and password=[masked]",
    );
  });

  it("masks JSON auth fields and common token headers in inbox text", () => {
    expect(
      sanitizeMemoryInboxText(
        '"auth":"abc123", Bearer eyJhbGciOiJIUzI1NiIs, ghp_1234567890abcdef',
      ),
    ).toBe('"auth": "[masked]", Bearer [masked], [masked-token]');
  });

  it("creates a Memory Inbox document when content is empty", () => {
    const result = appendEntryToInboxContent(
      "",
      "2026-06-24",
      formatMemoryInboxEntry(createMemory("Preference", "Prefer explicit user approval.")),
    );

    expect(result).toBe(
      "# Memory Inbox\n\n## 2026-06-24\n\n- [Preference] Prefer explicit user approval.\n  Source: [[Projects/Context Graph|Context Graph]]\n",
    );
  });

  it("appends under an existing date heading before the next date", () => {
    const content = [
      "# Memory Inbox",
      "",
      "## 2026-06-24",
      "",
      "- [Rule] Existing rule",
      "  Source: [[A]]",
      "",
      "## 2026-06-23",
      "",
      "- [Decision] Older decision",
      "  Source: [[B]]",
      "",
    ].join("\n");

    const result = appendEntryToInboxContent(
      content,
      "2026-06-24",
      formatMemoryInboxEntry(createMemory("Decision", "Keep Neo4j as a derived index.")),
    );

    expect(result).toContain(
      [
        "## 2026-06-24",
        "",
        "- [Rule] Existing rule",
        "  Source: [[A]]",
        "",
        "- [Decision] Keep Neo4j as a derived index.",
        "  Source: [[Projects/Context Graph|Context Graph]]",
        "",
        "## 2026-06-23",
      ].join("\n"),
    );
  });
});

function createMemory(type: PromotedMemory["type"], text: string): PromotedMemory {
  return {
    id: `memory:${type.toLowerCase()}:1`,
    type,
    text,
    createdAt: "2026-06-24T00:00:00.000Z",
    source: {
      id: "note:abc",
      path: "Projects/Context Graph.md",
      title: "Context Graph",
      basename: "Context Graph",
      folder: "Projects",
    },
    properties: {},
  };
}
