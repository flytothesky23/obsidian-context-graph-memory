export interface SchemaQuery {
  name: string;
  cypher: string;
}

export const SCHEMA_QUERIES: SchemaQuery[] = [
  {
    name: "note_path_unique",
    cypher: "CREATE CONSTRAINT note_path_unique IF NOT EXISTS FOR (n:Note) REQUIRE n.path IS UNIQUE",
  },
  {
    name: "note_id_unique",
    cypher: "CREATE CONSTRAINT note_id_unique IF NOT EXISTS FOR (n:Note) REQUIRE n.id IS UNIQUE",
  },
  {
    name: "tag_name_unique",
    cypher: "CREATE CONSTRAINT tag_name_unique IF NOT EXISTS FOR (t:Tag) REQUIRE t.name IS UNIQUE",
  },
  {
    name: "concept_normalized_name_unique",
    cypher:
      "CREATE CONSTRAINT concept_normalized_name_unique IF NOT EXISTS FOR (c:Concept) REQUIRE c.normalizedName IS UNIQUE",
  },
  {
    name: "preference_id_unique",
    cypher: "CREATE CONSTRAINT preference_id_unique IF NOT EXISTS FOR (p:Preference) REQUIRE p.id IS UNIQUE",
  },
  {
    name: "rule_id_unique",
    cypher: "CREATE CONSTRAINT rule_id_unique IF NOT EXISTS FOR (r:Rule) REQUIRE r.id IS UNIQUE",
  },
  {
    name: "decision_id_unique",
    cypher: "CREATE CONSTRAINT decision_id_unique IF NOT EXISTS FOR (d:Decision) REQUIRE d.id IS UNIQUE",
  },
  {
    name: "note_folder_index",
    cypher: "CREATE INDEX note_folder_index IF NOT EXISTS FOR (n:Note) ON (n.folder)",
  },
];

export const TEST_CONNECTION_QUERY = "RETURN 1 AS ok";
