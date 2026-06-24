# Manual Release Verification Report

Date: 2026-06-24
Task: T15 - Manual Release Verification
Verified release: `0.0.2`

## Verdict

Release readiness: PASS for public BRAT release `0.0.2`.

The repository is public at <https://github.com/flytothesky23/obsidian-context-graph-memory> and is MIT licensed. GitHub Actions created release `0.0.2`, and BRAT installed that release into the active target vault config directory `.obsidian-macbook-brat`. The installed plugin loaded in Obsidian 1.12.7 and passed live Neo4j-backed smoke checks for settings, commands, note graph, folder graph, metadata preview, semantic approval, memory promotion, and Codex context export.

One limitation remains in the evidence: File Explorer menu behavior was verified through Obsidian's `file-menu` runtime event and the registered menu item `onClick` path, not by physical pointer input. The exact menu items and click handlers were present and executed.

During T15, release `0.0.1` exposed Neo4j 2026 Cypher compatibility defects in note and folder graph queries. Those defects were fixed, covered by regression tests, and released as `0.0.2`.

## Public Release Evidence

| Check | Status | Evidence |
|---|---|---|
| GitHub repository | PASS | `flytothesky23/obsidian-context-graph-memory`, visibility `PUBLIC`, default branch `main`. |
| License | PASS | GitHub reports MIT License; repo includes `LICENSE`. |
| Release workflow | PASS | GitHub Actions run `28078979837`, conclusion `success`, head `4e35566f71cb14e7dce9aedbb797004f1b3a4f5c`. |
| GitHub release | PASS | <https://github.com/flytothesky23/obsidian-context-graph-memory/releases/tag/0.0.2>. |
| BRAT install source | PASS | `flytothesky23/obsidian-context-graph-memory`. |
| BRAT frozen version | PASS | `.obsidian-macbook-brat/plugins/obsidian42-brat/data.json` `pluginSubListFrozenVersion` records version `0.0.2`. |
| Active vault config dir | PASS | Obsidian runtime reports `.obsidian-macbook-brat`. |
| Plugin load | PASS | Runtime plugin `context-graph-memory`, manifest version `0.0.2`, enabled `true`. |

Release asset hashes:

| Asset | Size | SHA-256 |
|---|---:|---|
| `manifest.json` | 262 bytes | `39c0081139e6c841aaa73bdaf79137e8790b0bd1e3db94c478fdf122313c6cb0` |
| `main.js` | 2,563,611 bytes | `6d27060e2508a4c195506ec264b4542548bcf17fcb8c12f0750d2cfa13e47de9` |
| `versions.json` | 43 bytes | `dd0370ed5b26018f646ec3551f39c611340ccfbf75aac4bdb809a48585754abd` |

Installed active-vault evidence:

| File | Status | Evidence |
|---|---|---|
| `main.js` | PASS | Installed SHA-256 exactly matches release digest `6d27060e2508a4c195506ec264b4542548bcf17fcb8c12f0750d2cfa13e47de9`. |
| `manifest.json` | PASS | BRAT stores minified JSON, so raw hash differs; normalized JSON fields match release manifest and version `0.0.2`. |
| `community-plugins.json` | PASS | Active config includes `context-graph-memory`. |

## Verification Commands

| Check | Status | Evidence |
|---|---|---|
| Unit tests | PASS | `npm test`: 19 files / 68 tests passed. |
| Build and release preflight | PASS | `RELEASE_TAG=0.0.2 npm run release:check` passed. |
| Release tag guard | PASS | GitHub workflow validates tag matches manifest version before publishing. |
| Git worktree | PASS | Repo clean after `4e35566`. |
| Export redaction scan | PASS | No credential/token/auth/runtime-log pattern found in `00_System/OCGM Verification/T15 Codex Context.md`; one earlier broad `sk-` scan matched `task-specific` as a false positive and was narrowed. |

## Obsidian Runtime Checks

Target vault:

```text
/Users/flytothesky/Library/CloudStorage/GoogleDrive-kskileco@gmail.com/내 드라이브/Obsidian
```

Verification sample files:

```text
00_System/OCGM Verification/T15 OCGM Release Verification Sample.md
00_System/OCGM Verification/T15 OCGM Linked Note.md
00_System/OCGM Verification/T15 Memory Inbox.md
00_System/OCGM Verification/T15 Codex Context.md
```

| Manual release gate | Status | Evidence |
|---|---|---|
| Settings UI | PASS | Obsidian settings modal opened `Context Graph Memory`; Neo4j, indexing, graph, Data Forge, and semantic settings rendered. |
| Command registration | PASS | 12 `context-graph-memory:*` commands registered in Obsidian runtime. |
| Graph side panel open | PASS | `context-graph-memory-graph-view` leaf opened; `Fit`, `Reset`, `Table`, summary, graph area, and node detail rendered. |
| Neo4j connection command | PASS | Command path executed against local Neo4j 2026.05.0. |
| Schema initialization command | PASS | Constraints and indexes created; constraints include note, tag, concept, preference, rule, and decision uniqueness. |
| Index Current Note | PASS | Sample note indexed into `Note`, `Tag`, `LINKS_TO`, and relation candidate relationships. |
| Note graph | PASS | BRAT `0.0.2` install returned note graph `10 nodes / 9 edges`, no warnings. |
| Folder graph command | PASS | Folder graph for `00_System/OCGM Verification` returned `10 nodes / 9 edges`, internal notes `2/2`, isolated `0`, internal links `1`. |
| File Explorer note menu | PASS | Runtime `file-menu` event added `Neo4j 그래프 보기` with icon `network` and executable click handler. |
| File Explorer folder menu | PASS | Runtime `file-menu` event added `Neo4j 폴더 그래프 보기` with icon `folder-tree`; handler rendered folder graph. |
| Cytoscape renderer | PASS | Graph DOM contained Cytoscape canvas/SVG elements and graph summary text after rendering. |
| Metadata preview | PASS | Modal showed `5` relation candidates: `RELATED_TO`, `SUPPORTS`, `DEPENDS_ON`, `MENTIONS`, `MENTIONS`; Data Forge runtime was not used. |
| Semantic enrichment preview/approval | PASS | Manual frontmatter candidate `AFFECTS -> Release readiness` appeared; `Save 1 approved candidate` stored `source=semantic-enrichment`, `approved=true`, `confidence=0.82`. |
| Memory promotion | PASS | Editor selection opened promotion modal; `Save as Preference` created `Memory:Preference` and `RECORDED_IN`. |
| Memory Inbox append | PASS | `T15 Memory Inbox.md` contains the date-grouped `[Preference]` entry and source wikilink. |
| Codex context export | PASS | `T15 Codex Context.md` includes `# Codex Implementation Context`, Related Notes, Graph Memory, `AFFECTS`, `RECORDED_IN`, and Preference memory. |

## Live Neo4j Evidence

Homebrew Neo4j 2026.05.0 was used as a one-off local process. Authentication was temporarily disabled for local verification to avoid creating or recording a credential. No password, token, auth file, or runtime log is stored in this report.

| Check | Status | Evidence |
|---|---|---|
| Neo4j version | PASS | `neo4j --version` reported `2026.05.0`. |
| Bolt port | PASS | `localhost:7687` accepted connections during smoke. |
| Cypher shell | PASS | `RETURN 1 AS ok` returned `1`. |
| Indexed note relationships | PASS | Sample note has `AFFECTS`, `DEPENDS_ON`, `HAS_TAG`, `LINKS_TO`, `MENTIONS` x2, `RELATED_TO`, `SUPPORTS`. |
| Semantic relation | PASS | `AFFECTS` to `Release readiness` stored with `source=semantic-enrichment`, `approved=true`, `confidence=0.82`. |
| Memory relation | PASS | `Memory:Preference` has `RECORDED_IN` to the sample note. |

## Defects Found and Fixed

| Defect | Impact | Fix |
|---|---|---|
| Note graph query mixed aggregation inside a list expression | Neo4j 2026 rejected related graph queries with implicit grouping errors. | Split neighbor aggregation into a prior `WITH` before building `candidateNodes`. |
| Folder graph query dropped `folderNodes` before later stages | Folder graph failed with `key not found: VariableSlotKey(folderNodes)`. | Carried `folderNodes` through the seed-node `WITH`. |
| Tests did not catch Neo4j 2026 query shape | Release `0.0.1` shipped with graph query defects. | Added regression tests for note and folder query Cypher shape. |

## Remaining Risks

| Risk | Status | Next action |
|---|---|---|
| Physical pointer right-click not performed | Low | Optional human spot-check in Obsidian File Explorer; runtime event and click path already passed. |
| `0.0.1` remains public but graph query is defective | Accepted | Users should install `0.0.2`; do not delete historical release. |
| Neo4j local auth-disabled verification | Accepted for local smoke | Production users should use normal Neo4j credentials stored only in Obsidian plugin data. |

## Post-Verification Cleanup

- Neo4j local auth override was restored to the commented default: `#dbms.security.auth_enabled=false`.
- The one-off Neo4j console process was stopped; no listeners remained on `localhost:7474` or `localhost:7687`.
- Active vault plugin data was reset to safe defaults after verification: empty Neo4j password, automatic indexing disabled, default Memory Inbox and Codex Context output paths, and semantic enrichment mode `off`.
