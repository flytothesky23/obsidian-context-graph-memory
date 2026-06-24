# Remaining Risks

Date: 2026-06-24
Task: T15 - Manual Release Verification

## Release-Gating Risks

No release-gating risks remain for public BRAT release `0.0.2`.

## Residual Risks

| ID | Risk | Current status | Follow-up |
|---|---|---|---|
| RR-001 | Physical mouse right-click was not performed during File Explorer menu verification. | Runtime `file-menu` event and menu item `onClick` path passed for note and folder targets. | Optional human spot-check in Obsidian File Explorer. |
| RR-002 | Release `0.0.1` remains public but has Neo4j 2026 graph-query defects. | Fixed in `0.0.2`; historical release is not deleted. | Direct users to install `0.0.2` or newer. |
| RR-003 | Local verification used temporary auth-disabled Neo4j to avoid creating or recording credentials. | Acceptable for local smoke; plugin also supports normal Neo4j credentials in settings. | Production users should use normal Neo4j credentials and keep them only in Obsidian plugin data. |
| RR-004 | Full-vault indexing was not run across the entire personal vault during T15. | Current-note indexing and note/folder graph flows passed on controlled sample notes. | Run full-vault indexing only after deciding the desired include/exclude folders for the personal vault. |

## Non-Gating Risks

| ID | Risk | Why non-gating now | Follow-up |
|---|---|---|---|
| NR-001 | OS keychain storage for Neo4j credentials is not implemented. | MVP stores settings in Obsidian plugin data with security warnings. | Consider post-MVP credential storage hardening. |
| NR-002 | Cypher preview/export remains a draft contract. | It is not a PRD Must item for MVP release. | Treat as a separate advanced-user task if needed. |
| NR-003 | Automatic LLM semantic enrichment is absent. | MVP intentionally supports manual preview/approval only. | Keep future enrichment behind preview, provenance, and approval. |
