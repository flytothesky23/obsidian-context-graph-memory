import neo4j, { type Driver, type Session } from "neo4j-driver";
import type { ContextGraphMemorySettings } from "../types";
import { TEST_CONNECTION_QUERY } from "./queries";

const REDACTED = "[마스킹]";

export type QueryParameters = Record<string, unknown>;

export interface Neo4jQueryResult {
  records: number;
}

export interface Neo4jQueryRecordsResult {
  records: Array<Record<string, unknown>>;
}

export interface Neo4jConnectionResult {
  ok: boolean;
  message: string;
}

export type Neo4jDriverFactory = (settings: ContextGraphMemorySettings) => Driver;

export class Neo4jClient {
  private driver: Driver | null = null;

  constructor(
    private readonly settings: ContextGraphMemorySettings,
    private readonly driverFactory: Neo4jDriverFactory = createNeo4jDriver,
  ) {}

  async verifyConnectivity(): Promise<Neo4jConnectionResult> {
    try {
      await this.getDriver().verifyConnectivity();
      await this.run(TEST_CONNECTION_QUERY);
      return { ok: true, message: "Neo4j 연결 성공." };
    } catch (error) {
      return { ok: false, message: sanitizeNeo4jError(error, this.settings) };
    }
  }

  async run(cypher: string, parameters: QueryParameters = {}): Promise<Neo4jQueryResult> {
    const session = this.createSession();

    try {
      const result = await session.run(cypher, parameters);
      return { records: result.records.length };
    } finally {
      await session.close();
    }
  }

  async query(cypher: string, parameters: QueryParameters = {}): Promise<Neo4jQueryRecordsResult> {
    const session = this.createSession();

    try {
      const result = await session.run(cypher, parameters);
      return {
        records: result.records.map((record) => {
          const values: Record<string, unknown> = {};
          for (const key of record.keys) {
            values[String(key)] = normalizeNeo4jValue(record.get(key));
          }
          return values;
        }),
      };
    } finally {
      await session.close();
    }
  }

  async close(): Promise<void> {
    if (!this.driver) {
      return;
    }

    await this.driver.close();
    this.driver = null;
  }

  private getDriver(): Driver {
    if (!this.driver) {
      this.driver = this.driverFactory(this.settings);
    }

    return this.driver;
  }

  private createSession(): Session {
    return this.getDriver().session({ database: this.settings.neo4jDatabase });
  }
}

export function createNeo4jDriver(settings: ContextGraphMemorySettings): Driver {
  return neo4j.driver(
    settings.neo4jUri,
    neo4j.auth.basic(settings.neo4jUsername, settings.neo4jPassword),
  );
}

export function sanitizeNeo4jError(
  error: unknown,
  settings?: Pick<ContextGraphMemorySettings, "neo4jPassword" | "neo4jUsername">,
): string {
  const rawMessage = error instanceof Error ? error.message : String(error);
  let message = localizeNeo4jError(rawMessage) ?? rawMessage ?? "알 수 없는 Neo4j 오류.";

  if (settings?.neo4jPassword) {
    message = message.split(settings.neo4jPassword).join(REDACTED);
  }

  if (settings?.neo4jUsername) {
    message = message.replace(new RegExp(`user(name)?\\s*[:=]\\s*${escapeRegExp(settings.neo4jUsername)}`, "giu"), `user=${REDACTED}`);
  }

  return message
    .replace(/password\s*[:=]\s*[^,\s)]+/giu, `password=${REDACTED}`)
    .replace(/credentials?\s*[:=]\s*[^,\s)]+/giu, `credentials=${REDACTED}`);
}

function localizeNeo4jError(message: string): string | null {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("could not perform discovery") ||
    normalized.includes("no routing servers available")
  ) {
    return "Neo4j 라우팅 서버를 찾지 못했습니다. 로컬 단일 Neo4j를 사용하는 경우 연결 URI를 `bolt://localhost:7687`로 설정하고 Neo4j가 실행 중인지 확인하세요.";
  }

  if (normalized.includes("authentication failed") || normalized.includes("unauthorized")) {
    return "Neo4j 인증에 실패했습니다. 사용자명과 비밀번호를 확인하세요.";
  }

  if (normalized.includes("credentials expired") || normalized.includes("must be changed")) {
    return "Neo4j 초기 비밀번호 변경이 필요합니다. Neo4j 서버 비밀번호를 8자 이상으로 먼저 변경한 뒤 플러그인 설정에 같은 비밀번호를 입력하세요.";
  }

  if (
    normalized.includes("websocket connection failure") ||
    normalized.includes("readystate")
  ) {
    return "Neo4j WebSocket 연결에 실패했습니다. 로컬 Neo4j가 실행 중인지, 연결 URI가 `bolt://localhost:7687`인지, 인증 정보가 맞는지 확인하세요.";
  }

  if (normalized.includes("connection refused") || normalized.includes("failed to connect")) {
    return "Neo4j에 연결하지 못했습니다. Neo4j가 실행 중인지, 연결 URI와 포트가 맞는지 확인하세요.";
  }

  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeNeo4jValue(value: unknown): unknown {
  if (neo4j.isInt(value)) {
    return value.inSafeRange() ? value.toNumber() : value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeNeo4jValue(item));
  }

  if (value && typeof value === "object") {
    const normalized: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      normalized[key] = normalizeNeo4jValue(item);
    }
    return normalized;
  }

  return value;
}
