import { describe, expect, it } from "vitest";
import { SCHEMA_QUERIES } from "./queries";

describe("SCHEMA_QUERIES", () => {
  it("creates idempotent constraints and indexes for the MVP graph model", () => {
    const queryNames = SCHEMA_QUERIES.map((query) => query.name);

    expect(queryNames).toEqual([
      "note_path_unique",
      "note_id_unique",
      "tag_name_unique",
      "concept_normalized_name_unique",
      "preference_id_unique",
      "rule_id_unique",
      "decision_id_unique",
      "note_folder_index",
    ]);

    expect(SCHEMA_QUERIES.every((query) => query.cypher.includes("IF NOT EXISTS"))).toBe(true);
  });

  it("covers Note path uniqueness and folder lookup", () => {
    expect(SCHEMA_QUERIES.find((query) => query.name === "note_path_unique")?.cypher).toContain(
      "n.path IS UNIQUE",
    );
    expect(SCHEMA_QUERIES.find((query) => query.name === "note_folder_index")?.cypher).toContain(
      "ON (n.folder)",
    );
  });
});
