# Manual Release Verification Report

Date: 2026-06-24
Task: T15 - Manual Release Verification

## Verdict

Release readiness: HOLD.

The built plugin was installed into the target Obsidian vault by direct local copy and enabled at the vault config level. This is valid as a local smoke check, but it is not enough for release-grade verification across devices. Release-grade verification must use a GitHub release installed through BRAT, as documented in [BRAT Release Verification](./BRAT_RELEASE_VERIFICATION.md).

A local Homebrew Neo4j 2026.05.0 instance was started for direct live DB smoke testing. `neo4j-driver` connectivity, schema initialization statements, and sample Cypher checks for `Note`, `Tag`, `HAS_TAG`, `LINKS_TO`, and `RECORDED_IN` passed against that live DB.

Actual Obsidian desktop command execution, settings UI, File Explorer context menus, Cytoscape side panel behavior, memory modal/inbox append, and Codex export still require direct human UI verification. UI command-palette automation was not reliable enough to count as a manual plugin-load verification and must not be used for the remaining gates.

No product defect was confirmed during T15.

## Environment Evidence

| Check | Status | Evidence |
|---|---|---|
| Unit tests | PASS | `npm test` passed 19 files / 68 tests after T15 documentation updates. |
| Build | PASS | `npm run build` passed after target-vault install and T15 documentation updates. |
| README/docs links | PASS | Local Markdown link check passed for 12 files. |
| Obsidian app installed | PASS | `/Applications/Obsidian.app`, version 1.12.7. |
| Target vault opened by Obsidian | PASS | Obsidian app state marks `/Users/flytothesky/Library/CloudStorage/GoogleDrive-kskileco@gmail.com/내 드라이브/Obsidian` as `open=true`. |
| Direct local plugin files installed in target vault | PASS | `.obsidian/plugins/context-graph-memory/manifest.json` and `main.js` exist. This is local smoke evidence, not BRAT release evidence. |
| Installed file integrity | PASS | Installed `manifest.json` and `main.js` SHA-256 hashes match the repo build outputs. |
| Community plugin enable config | PASS | `.obsidian/community-plugins.json` contains `context-graph-memory`. |
| GitHub release assets | NOT RUN | No GitHub release has been created from this repo yet. |
| BRAT install path | NOT RUN | Plugin has not yet been installed through BRAT from a GitHub release. |
| Homebrew Neo4j | PASS | `neo4j --version` reports 2026.05.0. |
| Cypher shell | PASS | `cypher-shell --version` reports 2026.05.0. |
| Neo4j local port 7687 | PASS | One-off `neo4j console` process listened on `localhost:7687` during verification. |
| Neo4j browser port 7474 | PASS | One-off `neo4j console` process listened on `localhost:7474` during verification. |
| Neo4j driver connectivity | PASS | `neo4j-driver` `verifyConnectivity()` and `RETURN 1 AS ok` succeeded against `bolt://localhost:7687`. |
| Neo4j schema smoke | PASS | 8 plugin schema statements completed against live Neo4j. |
| Neo4j sample Cypher smoke | PASS | Sample `Note`, `Tag`, `HAS_TAG`, `LINKS_TO`, and `RECORDED_IN` counts returned 1 each; temporary sample data was deleted after verification. |
| Neo4j cleanup | PASS | One-off Neo4j console process was stopped and temporary local auth/usage-report config changes were restored. |
| Docker | NOT USED | `docker` command is still unavailable; Homebrew Neo4j was used instead. |

## T15 Checklist

| Manual release gate | T15 status | Notes |
|---|---|---|
| Install built plugin into target vault | PASS - local smoke | `manifest.json` and `main.js` copied to target vault plugin folder and hash-verified. Release-grade pass still requires BRAT install from GitHub release. |
| Install through BRAT from GitHub release | NOT RUN | Required for cross-device release verification. |
| Obsidian desktop plugin load | PARTIAL | Target vault is open and plugin is enabled in config. Actual loaded-command verification was not completed. |
| Settings UI | NOT RUN | Requires reliable Obsidian UI interaction. |
| Neo4j connection test command | PARTIAL | Equivalent `neo4j-driver` connectivity passed against live Neo4j; Obsidian command palette invocation was not run. |
| Schema initialization command | PARTIAL | The exact schema statements from `src/neo4j/queries.ts` passed against live Neo4j; Obsidian command palette invocation was not run. |
| `Index Current Note` | NOT RUN | Requires direct Obsidian command execution. |
| `Index Vault` | NOT RUN | Requires direct Obsidian command execution. |
| `Reindex Changed Notes` | NOT RUN | Requires direct Obsidian command execution. |
| Sample Cypher for `Note`, `Tag`, `LINKS_TO`, `HAS_TAG`, `RECORDED_IN` | PASS | Direct live DB smoke created and counted the required nodes/relationships, then deleted the temporary sample data. |
| File Explorer note context menu | NOT RUN | Requires human UI check in Obsidian File Explorer. |
| File Explorer folder context menu | NOT RUN | Requires human UI check in Obsidian File Explorer. |
| Cytoscape side panel zoom/pan/fit/node detail/truncation | NOT RUN | Requires indexed graph data and human UI check. |
| Metadata preview | NOT RUN | Requires reliable Obsidian UI command execution. |
| Data Forge compatibility preview | NOT RUN | Requires a representative note and reliable Obsidian UI command execution. |
| Semantic enrichment preview/approval | NOT RUN | Requires manual candidate note and reliable Obsidian UI command execution. |
| Memory promotion and Memory Inbox append | NOT RUN | Requires editor selection, live Neo4j, and human UI check. |
| Codex context export and redaction | NOT RUN | Requires reliable Obsidian UI command execution. |

## Live Neo4j Direct Smoke

T15 started a one-off local Neo4j process with Homebrew Neo4j 2026.05.0 and used temporary auth-disabled local verification to avoid creating or recording a credential. No password, token, raw auth file, or runtime log was written to this report.

After direct smoke verification, the one-off Neo4j process was stopped and the temporary local config changes were restored.

Direct live DB checks:

| Check | Result |
|---|---|
| `cypher-shell -a bolt://localhost:7687 "RETURN 1 AS ok"` | PASS |
| `neo4j-driver` `verifyConnectivity()` | PASS |
| Plugin schema statements applied | PASS, 8 statements |
| `Note` sample node count | PASS, 2 temporary notes |
| `Tag` sample node count | PASS, 1 temporary tag |
| `HAS_TAG` relationship count | PASS, 1 |
| `LINKS_TO` relationship count | PASS, 1 |
| `RECORDED_IN` relationship count | PASS, 1 |
| Temporary sample cleanup | PASS, 0 T15 sample nodes remaining |

This direct smoke does not replace the remaining Obsidian UI command gates.

## Incident During UI Automation

An attempt to open the command palette through macOS UI automation was unreliable and typed `Context Graph Memory` into the active note instead of opening the palette. The unintended line was removed immediately from:

```text
/Users/flytothesky/Library/CloudStorage/GoogleDrive-kskileco@gmail.com/내 드라이브/Obsidian/21_업무노트/정보기술/Flytothesky Ops Forge/12 Mac mini 설치 격리 프롬프트.md
```

The report does not retain screenshots or raw UI logs from that attempt.

## Next Actions

1. Start or reuse a live Neo4j instance, then configure the plugin settings in Obsidian.
2. Open the target vault in Obsidian and verify the plugin is enabled in `Settings > Community plugins`.
3. Run the remaining T15 checklist manually from the Obsidian UI.
4. Record actual failures as product defects only after reproducing them with live Neo4j and a loaded plugin.
