import neo4j from "neo4j-driver";
import { describe, expect, it } from "vitest";
import type { Driver, Session } from "neo4j-driver";
import { DEFAULT_SETTINGS } from "../types";
import { Neo4jClient, sanitizeNeo4jError } from "./client";

describe("Neo4jClient", () => {
  it("runs queries against the configured database and closes resources", async () => {
    const sessionCloseCalls: string[] = [];
    const driverCloseCalls: string[] = [];
    const sessionDatabases: Array<string | undefined> = [];
    const cypherCalls: string[] = [];
    const settings = { ...DEFAULT_SETTINGS, neo4jDatabase: "context_graph" };
    const session = {
      run: async (cypher: string) => {
        cypherCalls.push(cypher);
        return { records: [{ get: () => 1 }] };
      },
      close: async () => {
        sessionCloseCalls.push("closed");
      },
    } as unknown as Session;
    const driver = {
      session: (options: { database?: string }) => {
        sessionDatabases.push(options.database);
        return session;
      },
      verifyConnectivity: async () => undefined,
      close: async () => {
        driverCloseCalls.push("closed");
      },
    } as unknown as Driver;

    const client = new Neo4jClient(settings, () => driver);

    const result = await client.run("RETURN 1 AS ok");
    await client.close();

    expect(result).toEqual({ records: 1 });
    expect(cypherCalls).toEqual(["RETURN 1 AS ok"]);
    expect(sessionDatabases).toEqual(["context_graph"]);
    expect(sessionCloseCalls).toEqual(["closed"]);
    expect(driverCloseCalls).toEqual(["closed"]);
  });

  it("returns normalized query records for graph readers", async () => {
    const session = {
      run: async () => ({
        records: [
          {
            keys: ["nodes", "truncated"],
            get: (key: string) =>
              ({
                nodes: [{ id: "node-1", properties: { count: neo4j.int(2) } }],
                truncated: false,
              })[key],
          },
        ],
      }),
      close: async () => undefined,
    } as unknown as Session;
    const driver = {
      session: () => session,
      close: async () => undefined,
    } as unknown as Driver;
    const client = new Neo4jClient(DEFAULT_SETTINGS, () => driver);

    const result = await client.query("RETURN [] AS nodes, false AS truncated");

    expect(result).toEqual({
      records: [
        {
          nodes: [{ id: "node-1", properties: { count: 2 } }],
          truncated: false,
        },
      ],
    });
  });
});

describe("sanitizeNeo4jError", () => {
  it("redacts configured passwords from error messages", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      neo4jPassword: "super-secret-password",
    };

    const message = sanitizeNeo4jError(
      new Error("Authentication failed with password=super-secret-password"),
      settings,
    );

    expect(message).not.toContain("super-secret-password");
    expect(message).toContain("[redacted]");
  });

  it("redacts credential-like fragments from driver errors", () => {
    const message = sanitizeNeo4jError(new Error("Bad credentials=abc123"));

    expect(message).not.toContain("abc123");
    expect(message).toContain("[redacted]");
  });
});
