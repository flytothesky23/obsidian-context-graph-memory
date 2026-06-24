import { describe, expect, it } from "vitest";
import { buildRelationCandidatesFromFields } from "./relation-candidates";
import { extractRelationFields } from "./relation-fields";

describe("relation candidates", () => {
  it("maps normalized relation fields to graph relation candidates", () => {
    const relationFields = extractRelationFields({
      related: "Alpha",
      supports: "Decision A",
      mentions_people: "Ada Lovelace",
      mentions_orgs: "Neo4j",
      mentions_systems: "Obsidian",
      mentions_projects: "Context Graph Memory",
    });

    expect(buildRelationCandidatesFromFields(relationFields)).toEqual([
      {
        field: "related",
        relationshipType: "RELATED_TO",
        name: "Alpha",
        normalizedName: "alpha",
        conceptKind: "concept",
      },
      {
        field: "supports",
        relationshipType: "SUPPORTS",
        name: "Decision A",
        normalizedName: "decision a",
        conceptKind: "concept",
      },
      {
        field: "mentions_people",
        relationshipType: "MENTIONS",
        name: "Ada Lovelace",
        normalizedName: "ada lovelace",
        conceptKind: "person",
      },
      {
        field: "mentions_orgs",
        relationshipType: "MENTIONS",
        name: "Neo4j",
        normalizedName: "neo4j",
        conceptKind: "organization",
      },
      {
        field: "mentions_systems",
        relationshipType: "MENTIONS",
        name: "Obsidian",
        normalizedName: "obsidian",
        conceptKind: "system",
      },
      {
        field: "mentions_projects",
        relationshipType: "MENTIONS",
        name: "Context Graph Memory",
        normalizedName: "context graph memory",
        conceptKind: "project",
      },
    ]);
  });
});
