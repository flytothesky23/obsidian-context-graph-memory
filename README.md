# Obsidian Context Graph Memory

Obsidian plugin that indexes Markdown notes into Neo4j, renders note/folder graphs with Cytoscape.js, promotes selected text into explicit memory nodes, and exports current-note graph context for Codex CLI.

Status: Public BRAT release `0.0.2` verified against Obsidian 1.12.7 and local Neo4j 2026.05.0.

Markdown files in the Obsidian vault are the source of truth. Neo4j is a derived index that can be rebuilt from the vault.

## Quick Start

1. Install dependencies.

```bash
npm install
```

2. Build the plugin bundle.

```bash
npm run build
```

3. For normal installation, install through BRAT from the public GitHub release:

```text
flytothesky23/obsidian-context-graph-memory
```

See [BRAT Release Verification](./docs/BRAT_RELEASE_VERIFICATION.md).

For local development smoke testing only, install the built plugin into an Obsidian vault.

Create this folder in the target vault:

```text
.obsidian/plugins/context-graph-memory
```

Copy these files into that folder:

```text
manifest.json
main.js
```

4. Open Obsidian, go to `Settings > Community plugins`, turn off Restricted mode if needed, then enable `Context Graph Memory`.

5. Configure Neo4j settings in `Settings > Context Graph Memory`.

6. Run these commands from Obsidian's command palette:

```text
Context Graph Memory: Test Neo4j Connection
Context Graph Memory: Initialize Neo4j Schema
Context Graph Memory: Index Current Note
Context Graph Memory: Show Related Graph
```

## Plugin Dependencies

- `neo4j-driver`: connects the plugin to an external Neo4j database instance.
- `cytoscape`: renders the interactive graph side panel in Obsidian.

## Neo4j Preparation

Use an external Neo4j database instance such as local Neo4j, Neo4j Desktop, Docker, or Neo4j Aura. The plugin connects through the Neo4j JavaScript driver and defaults to:

| Setting | Default |
|---|---|
| URI | `neo4j://localhost:7687` |
| Username | `neo4j` |
| Database | `neo4j` |

For a local Docker smoke test, use your own password placeholder:

```bash
docker run --name obsidian-context-graph-neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/<choose-a-password> \
  neo4j:5
```

Then enter the same URI, username, password, and database in plugin settings. Do not write the password into Markdown notes or exported context files.

## Basic Workflow

1. Open a Markdown note in Obsidian.
2. Run `Context Graph Memory: Show Metadata Extraction Preview` when you want to inspect extracted relation fields before indexing.
3. Run `Context Graph Memory: Index Current Note`.
4. Run `Context Graph Memory: Show Related Graph`.
5. Use the graph side panel to inspect nodes, relationships, and node details.
6. Select important text and run `Context Graph Memory: Promote Selection to Long-term Memory`.
7. Run `Context Graph Memory: Export Codex Context for Current Note` to write a Codex-readable context file.

File Explorer shortcuts:

- Right-click a Markdown note and choose `Neo4j 그래프 보기`.
- Right-click a folder and choose `Neo4j 폴더 그래프 보기`.

## Commands

| Command | Purpose |
|---|---|
| `Context Graph Memory: Test Neo4j Connection` | Verifies driver connectivity and a simple query. |
| `Context Graph Memory: Initialize Neo4j Schema` | Creates constraints and indexes used by the plugin. |
| `Context Graph Memory: Index Current Note` | Extracts metadata from the active Markdown note and upserts it to Neo4j. |
| `Context Graph Memory: Index Vault` | Indexes Markdown notes in the vault subject to include/exclude settings. |
| `Context Graph Memory: Reindex Changed Notes` | Flushes queued create/modify/rename/delete indexing work. |
| `Context Graph Memory: Show Metadata Extraction Preview` | Shows current-note metadata, Data Forge compatible fields, and relation candidates without writing to Neo4j. |
| `Context Graph Memory: Preview Semantic Enrichment Candidates` | Shows manual semantic relation candidates and saves only approved candidates to Neo4j. |
| `Context Graph Memory: Show Related Graph` | Opens the graph panel for the active note. |
| `Context Graph Memory: Show Graph for Folder` | Opens the graph panel for the active note's folder. |
| `Context Graph Memory: Promote Selection to Long-term Memory` | Promotes selected text as `Preference`, `Rule`, or `Decision`. |
| `Context Graph Memory: Export Codex Context for Current Note` | Writes `# Codex Implementation Context` Markdown to `codexContextOutputPath`. |

## Configuration

| Setting | Default | Notes |
|---|---|---|
| `neo4jUri` | `neo4j://localhost:7687` | Bolt/Neo4j URI. |
| `neo4jUsername` | `neo4j` | Stored in Obsidian plugin data. |
| `neo4jPassword` | empty | Stored in Obsidian plugin data; never write it into notes or exports. |
| `neo4jDatabase` | `neo4j` | Database used for all sessions. |
| `indexOnStartup` | `false` | Run vault indexing when the plugin loads. |
| `autoIndexOnModify` | `true` | Queue changed Markdown notes for reindexing. |
| `includeFolders` | empty | Optional allow-list, one folder path per line. |
| `excludeFolders` | `.obsidian`, `99_Attachments` | Folders skipped by indexing. |
| `includeTags` | empty | Optional tag allow-list. |
| `memoryInboxPath` | `00_System/Memory Inbox.md` | Markdown inbox for promoted memories. |
| `codexContextOutputPath` | `00_System/Codex Context.md` | Markdown export target for Codex context. |
| `maxGraphDepth` | `2` | Related-note graph traversal depth. |
| `maxGraphNodes` | `80` | Graph query/render cap. |
| `graphRenderer` | `cytoscape` | Fixed MVP renderer. |
| `graphLayout` | `cose` | Cytoscape layout. |
| `graphFitOnOpen` | `true` | Fit graph when opened. |
| `folderGraphIncludeExternalBridges` | `true` | Include one-hop external bridge nodes in folder graphs. |
| `folderGraphRecursive` | `true` | Include nested Markdown notes for folder graphs. |
| `indexDebounceMs` | `1500` | Queue debounce delay. |
| `metadataPreviewMaxChars` | `12000` | Current-note text cap for metadata preview and Codex export. |
| `dataForgeCompatibilityMode` | `frontmatter` | Reads compatible frontmatter fields without Data Forge runtime calls. |
| `semanticEnrichmentMode` | `off` | Set to `manual` to allow preview-and-approve semantic enrichment. Automatic LLM/runtime enrichment is out of scope. |

## Data Forge Compatibility

The plugin reads Data Forge-compatible frontmatter from generated Markdown notes. It does not call the Data Forge runtime and does not require the Data Forge plugin to be installed.

Supported relation fields include `related`, `supports`, `depends_on`, `part_of`, `affects`, `evidenced_by`, `mentions_people`, `mentions_orgs`, `mentions_systems`, and `mentions_projects`. Common alias fields such as `related_notes`, `mentions_organization`, and `mentions_project` are normalized into the same relation candidates.

Use `Context Graph Memory: Show Metadata Extraction Preview` to check Data Forge fields and candidate graph relationships before indexing.

## Manual Semantic Enrichment

Semantic enrichment is guarded and manual-only. The plugin does not call an LLM, does not run Codex CLI, and does not save semantic candidates unless the user approves them in the preview modal.

When `semanticEnrichmentMode` is `manual`, the command `Context Graph Memory: Preview Semantic Enrichment Candidates` reads candidates from current-note frontmatter fields:

```yaml
ocgm_semantic_candidates:
  - relation: supports
    target: "[[Architecture Decision]]"
    kind: decision
    confidence: 0.8
    origin: data-forge
    source_uri: obsidian://data-forge/sample
    source_hash: hash-123
    reason: "This note supports the architecture decision."
```

Supported relation values map to `RELATED_TO`, `SUPPORTS`, `DEPENDS_ON`, `PART_OF`, `AFFECTS`, `EVIDENCED_BY`, and `MENTIONS`. Candidate origins can be `manual`, `data-forge`, `codexian`, or `codex-cli`. The modal shows target, reason, confidence, origin, and provenance. Closing the modal or approving zero items writes nothing to Neo4j.

## Release

- Repository: <https://github.com/flytothesky23/obsidian-context-graph-memory>
- Current verified release: `0.0.2`
- License: MIT

Release `0.0.1` remains public for history but should be superseded by `0.0.2` because `0.0.2` fixes Neo4j 2026 graph-query compatibility.

## Documentation

- [Usage Guide](./docs/USAGE.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Neo4j Schema](./docs/NEO4J_SCHEMA.md)
- [Security Notes](./docs/SECURITY.md)
- [Troubleshooting](./docs/TROUBLESHOOTING.md)
- [Codex Task Map](./docs/CODEX_TASKS.md)
- [PRD Reference Map](./docs/PRD.md)
- [Data Forge Handoff Prompt](./docs/DATA_FORGE_HANDOFF_PROMPT.md)
- [BRAT Release Verification](./docs/BRAT_RELEASE_VERIFICATION.md)
- [MVP Integration Verification Report](./docs/RELEASE_READINESS_REPORT.md)
- [Manual Release Verification Report](./docs/MANUAL_RELEASE_VERIFICATION_REPORT.md)
- [Remaining Risks](./docs/REMAINING_RISKS.md)

## Development

```bash
npm run build
npm run dev
npm run release:check
npm run typecheck
npm test
```

The build produces `main.js` for Obsidian. `npm run release:check` runs a production build and verifies release assets before BRAT/GitHub release publication. The plugin is desktop-only.

## Security Rule

Do not write Neo4j credentials, GitHub tokens, Codex login details, auth files, API keys, or runtime logs into Markdown notes, generated context exports, repository docs, screenshots, or issue reports. See [Security Notes](./docs/SECURITY.md).
