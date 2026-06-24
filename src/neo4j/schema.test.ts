import { describe, expect, it } from "vitest";
import { Neo4jSchemaService } from "./schema";

describe("Neo4jSchemaService", () => {
  it("runs schema queries in the provided order", async () => {
    const calls: string[] = [];
    const service = new Neo4jSchemaService(
      {
        run: async (cypher: string) => {
          calls.push(cypher);
          return { records: 0 };
        },
      },
      [
        { name: "first", cypher: "CREATE CONSTRAINT first IF NOT EXISTS" },
        { name: "second", cypher: "CREATE INDEX second IF NOT EXISTS" },
      ],
    );

    const result = await service.initializeSchema();

    expect(calls).toEqual(["CREATE CONSTRAINT first IF NOT EXISTS", "CREATE INDEX second IF NOT EXISTS"]);
    expect(result.applied).toEqual(["first", "second"]);
    expect(result.queryResults).toEqual([{ records: 0 }, { records: 0 }]);
  });
});
