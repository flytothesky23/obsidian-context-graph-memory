import { describe, expect, it } from "vitest";
import { extractDataForgeFields, extractRelationFields, normalizeStringList } from "./relation-fields";

describe("relation field extraction", () => {
  it("normalizes relation fields from strings, arrays, and wikilinks", () => {
    const relationFields = extractRelationFields({
      related: "[[Alpha]]",
      supports: ["Beta", "[[Gamma|Display Gamma]]", "Beta"],
      depends_on: "One, Two\nThree",
      part_of: null,
    });

    expect(relationFields.related).toEqual(["Alpha"]);
    expect(relationFields.supports).toEqual(["Beta", "Display Gamma"]);
    expect(relationFields.depends_on).toEqual(["One", "Two", "Three"]);
    expect(relationFields.part_of).toEqual([]);
    expect(relationFields.mentions_people).toEqual([]);
  });

  it("normalizes Data Forge-compatible relation aliases", () => {
    const relationFields = extractRelationFields({
      related_notes: "[[Alpha]]; [[Beta|Beta Display]]",
      support: "Decision A",
      mentions_person: ["Ada", "Grace"],
      mentions_organizations: "OpenAI, Neo4j",
      mentions_system: "Obsidian",
      mentions_project: "Context Graph Memory",
    });

    expect(relationFields.related).toEqual(["Alpha", "Beta Display"]);
    expect(relationFields.supports).toEqual(["Decision A"]);
    expect(relationFields.mentions_people).toEqual(["Ada", "Grace"]);
    expect(relationFields.mentions_orgs).toEqual(["OpenAI", "Neo4j"]);
    expect(relationFields.mentions_systems).toEqual(["Obsidian"]);
    expect(relationFields.mentions_projects).toEqual(["Context Graph Memory"]);
  });

  it("extracts only populated Data Forge fields", () => {
    expect(
      extractDataForgeFields({
        source_context: "ingest",
        template_style_id: "",
        project_name: "Context Graph",
        unrelated: "ignored",
      }),
    ).toEqual({
      source_context: "ingest",
      project_name: "Context Graph",
    });
  });

  it("keeps normalized string list order stable", () => {
    expect(normalizeStringList([" A ", "B", "A", "C, D; E"])).toEqual(["A", "B", "C", "D", "E"]);
  });
});
