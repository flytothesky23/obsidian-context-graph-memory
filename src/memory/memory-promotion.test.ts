import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../types";
import {
  buildMemoryUpsertParameters,
  buildMemoryUpsertQuery,
  buildPromotedMemory,
  MemoryPromotionService,
  type MemoryPromotionRunner,
} from "./memory-promotion";

describe("memory promotion", () => {
  it("builds typed memory nodes from selected text", () => {
    const memory = buildPromotedMemory({
      type: "Decision",
      text: "\nUse Cytoscape for the MVP graph.\n",
      source: createSource(),
      createdAt: "2026-06-24T00:00:00.000Z",
    });

    expect(memory).toMatchObject({
      type: "Decision",
      text: "Use Cytoscape for the MVP graph.",
      createdAt: "2026-06-24T00:00:00.000Z",
      properties: {
        date: "2026-06-24",
        status: "active",
      },
    });
    expect(memory.id).toMatch(/^memory:decision:/u);
  });

  it("rejects empty selected text before calling Neo4j", async () => {
    let called = false;
    const service = new MemoryPromotionService(DEFAULT_SETTINGS, () => ({
      run: async () => {
        called = true;
        return { records: 0 };
      },
    }));

    await expect(
      service.promote({
        type: "Preference",
        text: "   ",
        source: createSource(),
      }),
    ).rejects.toThrow("Cannot promote empty selection.");
    expect(called).toBe(false);
  });

  it("builds an upsert query with RECORDED_IN relation", () => {
    const query = buildMemoryUpsertQuery("Rule");

    expect(query).toContain("MERGE (memory:Memory:Rule {id: $memory.id})");
    expect(query).toContain("MERGE (memory)-[recorded:RECORDED_IN]->(source)");
  });

  it("runs the upsert query and closes the runner", async () => {
    const calls: Array<{ cypher: string; parameters?: Record<string, unknown> }> = [];
    const closeCalls: string[] = [];
    const runner: MemoryPromotionRunner = {
      run: async (cypher, parameters) => {
        calls.push({ cypher, parameters });
        return { records: 1 };
      },
      close: async () => {
        closeCalls.push("closed");
      },
    };
    const service = new MemoryPromotionService(DEFAULT_SETTINGS, () => runner);

    const memory = await service.promote({
      type: "Preference",
      text: "Prefer explicit graph scopes.",
      source: createSource(),
      createdAt: "2026-06-24T00:00:00.000Z",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].cypher).toContain(":Memory:Preference");
    expect(calls[0].parameters).toEqual(buildMemoryUpsertParameters(memory));
    expect(closeCalls).toEqual(["closed"]);
  });
});

function createSource() {
  return {
    id: "note:abc",
    path: "Projects/Context Graph.md",
    title: "Context Graph",
    basename: "Context Graph",
    folder: "Projects",
  };
}
