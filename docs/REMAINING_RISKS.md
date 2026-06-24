# Remaining Risks

Date: 2026-06-24
Task: T14 - MVP Integration Verification

## Release-Gating Risks

| ID | Risk | Impact | Owner action |
|---|---|---|---|
| RR-001 | BRAT/GitHub release installation has not been run. Direct local copy passed only as smoke evidence. | Cross-device install/update behavior could fail even if local copied files load. | Publish a GitHub release with plugin assets, install through BRAT, then run T15 manual gates. |
| RR-002 | Direct live Neo4j driver/schema/sample Cypher smoke passed in T15, but Obsidian command-driven connection/schema/indexing was not run. | Query code works against local Neo4j 2026.05.0, but the actual plugin command path could still fail in Obsidian. | Run connection, schema, current note indexing, vault indexing, and reindex commands from Obsidian UI. |
| RR-003 | Cytoscape rendering was not visually checked inside Obsidian. | Canvas sizing, interaction, or theme styling issues could remain. | Verify side panel open, zoom/pan/fit, node click detail, and truncated summary. |
| RR-004 | File Explorer context menus were not exercised in the actual Obsidian UI. | Menu placement or clicked-path behavior could be wrong despite source registration. | Right-click Markdown note and folder in File Explorer during T15. |
| RR-005 | Memory Inbox append and Codex context export were not checked against a real vault file. | File path creation, existing content update, or rendering could differ from unit tests. | Verify configured paths and generated Markdown in Obsidian. |
| RR-006 | Data Forge generated sample notes were not manually previewed during T14. | Compatibility aliases may miss a real upstream field variant. | Use a representative Flytothesky Data Forge note in T15 or a focused compatibility follow-up. |
| RR-007 | The repo is still an untracked working tree with no remote. | GitHub release and BRAT installation cannot be treated as reproducible until the repo is committed and pushed. | Commit, create GitHub remote, push, tag a release matching `manifest.json.version`, and verify BRAT install. |
| RR-008 | T15 UI automation was unreliable. | Automated keyboard input can modify active notes instead of opening Obsidian command palette. | Use direct human UI checks for remaining gates; do not rely on keyboard automation for Obsidian command execution. |

## Non-Gating Risks

| ID | Risk | Why non-gating now | Follow-up |
|---|---|---|---|
| NR-001 | OS keychain storage for Neo4j credentials is not implemented. | PRD accepts Obsidian plugin data for MVP with clear security warnings. | Consider post-MVP credential storage hardening. |
| NR-002 | Cypher preview/export remains a draft contract. | It is not a PRD Must item for MVP release. | Treat as a separate advanced-user task if needed. |
| NR-003 | Automatic LLM semantic enrichment is absent. | The MVP explicitly requires manual preview/approval and no automatic LLM execution. | Keep future enrichment behind preview, provenance, and approval. |
