import type { Neo4jClient, Neo4jQueryResult } from "./client";
import { SCHEMA_QUERIES, type SchemaQuery } from "./queries";

export interface SchemaInitializationResult {
  applied: string[];
  queryResults: Neo4jQueryResult[];
}

export class Neo4jSchemaService {
  constructor(
    private readonly client: Pick<Neo4jClient, "run">,
    private readonly schemaQueries: SchemaQuery[] = SCHEMA_QUERIES,
  ) {}

  async initializeSchema(): Promise<SchemaInitializationResult> {
    const applied: string[] = [];
    const queryResults: Neo4jQueryResult[] = [];

    for (const query of this.schemaQueries) {
      const result = await this.client.run(query.cypher);
      applied.push(query.name);
      queryResults.push(result);
    }

    return { applied, queryResults };
  }
}
