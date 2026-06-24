# Codex Task Map

Use this file to orient future Codex implementation threads.

## Common Rules

- Implement one task at a time.
- Treat Markdown in the Obsidian vault as the source of truth.
- Treat Neo4j as a rebuildable derived index.
- Do not store credentials, tokens, auth files, Codex login details, or runtime logs in docs or generated exports.
- Data Forge runtime is not a required dependency for core indexing.
- MVP graph rendering uses Cytoscape.js.
- Run the verification command required by the active task before claiming completion.

## Source Context

- Project index: `/Users/flytothesky/Library/CloudStorage/GoogleDrive-kskileco@gmail.com/내 드라이브/Obsidian/21_업무노트/정보기술/neo4j/00 프로젝트 운영 인덱스.md`
- PRD: `/Users/flytothesky/Library/CloudStorage/GoogleDrive-kskileco@gmail.com/내 드라이브/Obsidian/21_업무노트/정보기술/neo4j/PRD/2026-06-23_PRD_Obsidian_Context_Graph_Memory.md`
- Output contract: `/Users/flytothesky/Library/CloudStorage/GoogleDrive-kskileco@gmail.com/내 드라이브/Obsidian/21_업무노트/정보기술/neo4j/02 출력 계약 관리.md`
- Decision log: `/Users/flytothesky/Library/CloudStorage/GoogleDrive-kskileco@gmail.com/내 드라이브/Obsidian/21_업무노트/정보기술/neo4j/03 의사결정 로그.md`
- Risk log: `/Users/flytothesky/Library/CloudStorage/GoogleDrive-kskileco@gmail.com/내 드라이브/Obsidian/21_업무노트/정보기술/neo4j/04 리스크와 재발 방지.md`
- Full task prompt document: `/Users/flytothesky/Library/CloudStorage/GoogleDrive-kskileco@gmail.com/내 드라이브/Obsidian/21_업무노트/정보기술/neo4j/PRD/2026-06-23_Implementation_Tasks_and_Goal_Prompts.md`

## Task Sequence

| ID | Name | Goal | Status |
|---|---|---|---|
| T00 | Repo Bootstrap | Create repo shell and local docs references | Complete |
| T01 | Plugin Skeleton | Add Obsidian plugin TypeScript skeleton and real build wiring | Complete |
| T02 | Settings | Implement settings model and settings tab | Complete |
| T03 | Neo4j Client and Schema | Add Neo4j client, connection test, schema initialization | Complete |
| T04 | Metadata Extractor | Extract frontmatter, links, tags, headings, tasks, Data Forge fields | Complete |
| T05 | Vault Indexer and Queue | Index current note/vault and queue changes | Complete |
| T06 | Graph Query and Context Menus | Add note/folder graph queries and File Explorer menus | Complete |
| T07 | Cytoscape Renderer | Render graph panel with Cytoscape.js | Complete |
| T08 | Memory Promotion | Promote selected text to Preference/Rule/Decision inbox records | Complete |
| T09 | Codex Context Export | Export graph context Markdown for Codex | Complete |
| T10 | Docs and Security Notes | Complete README, architecture, troubleshooting docs | Complete |
| T11 | Folder Graph Refinement | Improve folder graph summaries and bridge handling | Complete |
| T12 | Data Forge Compatibility | Import and preview Data Forge relation frontmatter | Complete |
| T13 | Optional Semantic Enrichment Adapter | Design manual semantic enrichment preview/approval | Complete |
| T14 | MVP Integration Verification | Verify MVP acceptance criteria end to end | Complete |
| T15 | Manual Release Verification | Run Obsidian desktop and live Neo4j release gates from T14 | Complete - public BRAT release `0.0.2` verified |

## Completed T03 Notes

- `neo4j-driver` is installed as a runtime dependency.
- `src/neo4j/client.ts` wraps driver creation, connectivity verification, query execution, resource close, and sanitized error messages.
- `src/neo4j/schema.ts` initializes schema statements from `src/neo4j/queries.ts`.
- Obsidian commands now cover connection test and schema initialization.
- Unit tests do not require a running Neo4j instance.

## Completed T04 Notes

- `src/extract/note-metadata.ts` exports `NoteMetadataExtractor`, `ExtractedNoteMetadata`, and `MetadataPreviewPayload`.
- `src/extract/markdown-structure.ts` extracts wikilinks, Markdown links, headings, tasks, and inline tags from note body text.
- `src/extract/relation-fields.ts` normalizes PRD relation fields and reads Data Forge compatibility fields.
- T04 does not write to Neo4j and does not modify Markdown source files.

## Completed T05 Notes

- `src/indexing/vault-indexer.ts` indexes the active Markdown note, the full vault, and queued note changes using the T04 extractor and T03 Neo4j query runner.
- `src/indexing/index-queue.ts` provides a debounce queue for create/modify/rename/delete and metadata-cache changes.
- `src/indexing/index-report.ts` provides the indexing report snapshot used by commands and queue callbacks.
- Indexing upserts `Note`, `Tag`, `HAS_TAG`, resolved wikilink `LINKS_TO`, and frontmatter relation candidates.
- Delete and rename-away operations archive old note paths with `archived: true`.
- T05 does not implement graph queries, context menus, or Cytoscape rendering.

## Completed T06 Notes

- `src/graph/graph-scope.ts` defines `GraphScope`, `GraphNode`, `GraphEdge`, `GraphSummary`, and `GraphResult`.
- `src/graph/graph-query.ts` builds note, folder, and selection graph queries and maps Neo4j rows into renderer-neutral graph results.
- `Neo4jClient.query()` returns normalized record payloads for graph readers while preserving the existing count-only `run()` API.
- Obsidian commands now include `Context Graph Memory: Show Related Graph` and `Context Graph Memory: Show Graph for Folder`.
- File Explorer context menus now include `Neo4j 그래프 보기` for Markdown notes and `Neo4j 폴더 그래프 보기` for folders.
- T06 does not implement Cytoscape rendering internals.

## Completed T07 Notes

- `cytoscape` is installed as a runtime dependency and bundled by esbuild.
- `src/graph/cytoscape-adapter.ts` converts renderer-neutral `GraphResult` payloads into Cytoscape elements without changing the graph query layer.
- `src/graph/cytoscape-renderer.ts` owns Cytoscape initialization, layout selection, relation styling, fit, reset, and cleanup.
- `src/views/graph-view.ts` registers the Obsidian side panel UI with summary, graph canvas, node detail, and table/JSON fallback.
- `src/main.ts` now opens the graph panel from command palette commands and File Explorer note/folder context menus.
- Adapter tests cover element conversion, id prefixing, and dangling edge filtering.

## Completed T08 Notes

- `src/memory/memory-promotion.ts` validates selected text, builds typed memory payloads, and upserts `Memory:Preference`, `Memory:Rule`, or `Memory:Decision` nodes into Neo4j.
- The memory upsert query guarantees a source `Note` by `path` and creates `RECORDED_IN`.
- `src/memory/memory-modal.ts` provides a `Preference`, `Rule`, `Decision` selection modal.
- `src/memory/memory-inbox.ts` appends date-grouped Memory Inbox bullets and masks credential-like key/value pairs, JSON auth fields, and common token headers in the note output.
- `src/main.ts` registers `Context Graph Memory: Promote Selection to Long-term Memory`.
- Unit tests cover empty selection rejection, Cypher shape, runner close behavior, inbox formatting, date-section append, and inbox sanitization.

## Completed T09 Notes

- `src/export/codex-context-builder.ts` builds the `# Codex Implementation Context` Markdown contract with Current Note, Related Notes, Graph Memory, Task, and Verification sections.
- `src/export/context-writer.ts` creates parent folders and writes or updates the configured `codexContextOutputPath`.
- `src/main.ts` registers `Context Graph Memory: Export Codex Context for Current Note`.
- The export command reads the active Markdown note, queries the related note graph, and writes context Markdown without running Codex CLI.
- If Neo4j graph query fails, the export still writes the current note context with a sanitized graph warning.
- Export sanitization masks credential-like key/value pairs, JSON auth fields, common token headers, OpenAI/GitHub token shapes, and the configured Neo4j password value.
- Unit tests cover required output headings, related notes, graph memory, graph summary, sanitization, and writer file creation/update.

## Completed T10 Notes

- `README.md` now provides quick start, Neo4j preparation, installation, basic workflow, commands, configuration, documentation links, development commands, and security rules.
- `docs/USAGE.md` documents Neo4j setup, indexing, note/folder graph viewing, memory promotion, and Codex context export.
- `docs/ARCHITECTURE.md` documents source-of-truth boundaries, component responsibilities, data flow, runtime boundaries, and build output.
- `docs/NEO4J_SCHEMA.md` documents Neo4j constraints, indexes, node labels, relationships, and rebuild policy.
- `docs/SECURITY.md` documents secret handling, generated Markdown output boundaries, Codex export boundaries, and safe bug-report guidance.
- `docs/TROUBLESHOOTING.md` documents common build, install, Neo4j, schema, indexing, graph, memory, and export failures.
- T10 does not add new plugin functionality.

## Completed T11 Notes

- `src/graph/graph-query.ts` now returns folder/internal node ids, external bridge node ids, folder note totals, external bridge totals, and truncation reason for folder scopes.
- `GraphSummary.folder` reports displayed versus total internal notes, isolated internal notes, internal `LINKS_TO`, note bridge edges, central notes, isolated notes, and external bridge notes.
- `src/views/graph-view.ts` renders compact folder summary lines for central notes, isolated notes, external bridge notes, and truncation reason.
- `src/graph/cytoscape-adapter.ts` adds folder role classes for internal notes, external bridge nodes, and isolated notes.
- `src/graph/cytoscape-renderer.ts` styles external bridge nodes and isolated folder notes distinctly.
- Unit tests cover folder query output fields, folder summary calculation, truncation warnings, and Cytoscape folder role classes.
- T11 does not implement selection graph changes.

## Completed T12 Notes

- `src/extract/relation-fields.ts` now normalizes common Data Forge-compatible aliases such as `related_notes`, `mentions_organization`, `mentions_system`, and `mentions_project`.
- `src/extract/relation-candidates.ts` centralizes relation candidate mapping so metadata preview and Neo4j indexing use the same `RELATED_TO`, `SUPPORTS`, `DEPENDS_ON`, `PART_OF`, `AFFECTS`, `EVIDENCED_BY`, and `MENTIONS` interpretation.
- `src/extract/data-forge-adapter.ts` builds a read-only compatibility report from extracted metadata without importing or calling the Data Forge runtime.
- `src/extract/metadata-preview-modal.ts` and `src/main.ts` add `Context Graph Memory: Show Metadata Extraction Preview`.
- Preview output reports Data Forge fields, relation candidates, and warnings without writing to Neo4j or running Codex CLI.
- `docs/DATA_FORGE_HANDOFF_PROMPT.md` provides a prompt for the separate Flytothesky Data Forge project thread.
- Unit tests cover alias normalization, relation candidate mapping, Data Forge sample note reporting, and preview payload reporting.

## Completed T13 Notes

- `src/semantic/semantic-enrichment.ts` defines the semantic enrichment adapter interface, manual frontmatter adapter, preview model, approval service, provenance model, and guarded Neo4j upsert query.
- `src/semantic/semantic-enrichment-modal.ts` previews candidates and saves only checked candidates after explicit approval.
- `src/main.ts` registers `Context Graph Memory: Preview Semantic Enrichment Candidates`.
- Candidate frontmatter is read from `ocgm_semantic_candidates` or `semantic_enrichment_candidates`.
- The implementation does not call an LLM, does not execute Codex CLI, does not call Data Forge runtime, and does not modify managed blocks.
- Unit tests cover candidate normalization, JSON frontmatter candidate parsing, off-mode blocking, no-op approval, approved-only storage, and dynamic relationship whitelist rejection.

## Completed T14 Notes

- `docs/RELEASE_READINESS_REPORT.md` records the T14 MVP checklist with explicit PASS and FAIL manual-gate items.
- `docs/REMAINING_RISKS.md` records release-gating risks and non-gating post-MVP risks.
- Automated verification passed: `npm test` 19 files / 68 tests, `npm run build`, README/docs local Markdown link check for 11 files.
- Static package checks confirm `neo4j-driver`, `cytoscape`, desktop-only manifest, and generated `main.js`.
- Source search found no automatic LLM, Codex CLI, Data Forge runtime, or automatic semantic enrichment execution path.
- Manual Obsidian desktop and live Neo4j checks were not run in T14 and are intentionally separated into proposed T15.

## Completed T15 Notes

- `docs/MANUAL_RELEASE_VERIFICATION_REPORT.md` records the final T15 public release verification.
- The GitHub repository is public at `flytothesky23/obsidian-context-graph-memory` and is MIT licensed.
- GitHub release `0.0.2` was built by Actions run `28078979837`.
- BRAT installed `flytothesky23/obsidian-context-graph-memory` into the active target vault config directory `.obsidian-macbook-brat`.
- BRAT `pluginSubListFrozenVersion` records `0.0.2` for this plugin.
- Obsidian 1.12.7 loaded and enabled `context-graph-memory` version `0.0.2`.
- Installed `main.js` SHA-256 matches the release digest `6d27060e2508a4c195506ec264b4542548bcf17fcb8c12f0750d2cfa13e47de9`.
- Settings UI opened and rendered Neo4j, indexing, graph, Data Forge, and semantic settings.
- Obsidian runtime command paths verified connection/schema/index current note/note graph/folder graph/export.
- File Explorer menu registration and menu item click handlers were verified through Obsidian's `file-menu` runtime event.
- Cytoscape side panel rendered note and folder graphs against live Neo4j 2026.05.0.
- Metadata preview showed relation candidates without Data Forge runtime calls.
- Manual semantic enrichment preview/approval stored an approved `AFFECTS` relation.
- Memory promotion from editor selection stored `Memory:Preference`, created `RECORDED_IN`, and appended Memory Inbox.
- Codex context export wrote the required Markdown contract and passed a secret-pattern scan.
- T15 found Neo4j 2026 Cypher compatibility defects in release `0.0.1`; they were fixed and released in `0.0.2`.

## Release Notes

- `versions.json` maps plugin `0.0.1` and `0.0.2` to Obsidian `1.5.0`.
- `.github/workflows/release.yml` builds, tests, checks, and uploads `manifest.json`, `main.js`, `versions.json`, and optional `styles.css` for tags matching `manifest.json.version`.
- `scripts/check-release.mjs` verifies release asset presence, version consistency, optional `RELEASE_TAG`/`GITHUB_REF_NAME` tag match, and release asset SHA-256 hashes.
- `RELEASE_TAG=0.0.2 npm run release:check` passed.
- `docs/BRAT_RELEASE_VERIFICATION.md` records the BRAT/GitHub release verification contract.
- Release `0.0.1` remains public for history but should be superseded by `0.0.2` because `0.0.1` has Neo4j 2026 graph-query defects.

## Next Task Prompt

Use this prompt for post-release operational setup. T15 release verification is complete.

```text
Obsidian Context Graph Memory 플러그인의 post-release 운영 설정을 진행해주세요.

목표:
- public GitHub/BRAT release `0.0.2`는 이미 검증됐습니다.
- 새 기능을 추가하지 말고 운영 범위와 안전한 indexing 기준을 정합니다.
- full-vault indexing 전에 includeFolders, excludeFolders, includeTags 정책을 먼저 정합니다.
- Neo4j credential은 Obsidian plugin data에만 저장하고 노트/export/docs에는 쓰지 않습니다.

기준 문서:
- docs/MANUAL_RELEASE_VERIFICATION_REPORT.md
- docs/REMAINING_RISKS.md
- docs/USAGE.md
- docs/TROUBLESHOOTING.md
- docs/BRAT_RELEASE_VERIFICATION.md

작업:
- 운영 Neo4j endpoint와 credential 저장 위치 확인
- include/exclude folder 초안 작성
- 작은 폴더 단위 indexing smoke 후 full-vault indexing 여부 판단
- 다른 기기에서 BRAT update/install 동작 확인이 필요한지 결정

보고:
- 운영 설정값
- indexing 범위
- 실행한 command와 결과
- 남은 운영 리스크
```
