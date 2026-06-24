# Usage Guide

This guide walks through the daily plugin workflow after installation and Neo4j configuration.

## 1. Prepare Neo4j

1. Start a Neo4j database locally, in Neo4j Desktop, in Docker, or in Neo4j Aura.
2. In Obsidian, open `Settings > Context Graph Memory`.
3. Enter `neo4jUri`, `neo4jUsername`, `neo4jPassword`, and `neo4jDatabase`.
4. Run `Context Graph Memory: Test Neo4j Connection`.
5. Run `Context Graph Memory: Initialize Neo4j Schema`.

The schema command is idempotent. Running it again should not duplicate constraints or indexes.

## 2. Index Markdown Notes

Use `Context Graph Memory: Index Current Note` for the active note. The plugin extracts:

- file path, basename, title, folder
- frontmatter
- tags
- wikilinks
- Markdown links
- headings
- tasks
- relation fields
- Data Forge compatible frontmatter fields when enabled

Use `Context Graph Memory: Index Vault` when you want to build or rebuild the graph index for the whole vault. The indexer respects include/exclude folder and tag settings.

`autoIndexOnModify` queues changed Markdown notes after create, modify, rename, delete, and metadata cache updates. Use `Context Graph Memory: Reindex Changed Notes` to flush pending queue work manually.

## 3. Preview Metadata Extraction

Run this command before indexing when you want to inspect what OCGM will read from the active Markdown note:

```text
Context Graph Memory: Show Metadata Extraction Preview
```

The preview shows:

- note path and title
- tag, link, heading, task, relation, and Data Forge field counts
- Data Forge compatibility mode and detected fields
- relation candidates such as `RELATED_TO`, `SUPPORTS`, and `MENTIONS`

The preview reads Obsidian metadata cache and Markdown body text only. It does not write to Neo4j, does not call the Data Forge runtime, and does not run Codex CLI.

## 4. Preview Manual Semantic Enrichment

Set `semanticEnrichmentMode` to `manual` before using semantic enrichment. This keeps enrichment behind an explicit command and approval step.

Add candidate frontmatter to the current note:

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

Then run:

```text
Context Graph Memory: Preview Semantic Enrichment Candidates
```

The modal previews each candidate with relation type, target, confidence, origin, reason, and provenance. Supported candidate origins are `manual`, `data-forge`, `codexian`, and `codex-cli`. Checked candidates are saved only after clicking the approval button. Closing the modal, leaving all candidates unchecked, or keeping `semanticEnrichmentMode` set to `off` writes nothing to Neo4j.

This command does not call an LLM, does not run Codex CLI, does not call Data Forge runtime, and does not modify managed blocks.

## 5. View Note Graphs

Open a Markdown note, then run:

```text
Context Graph Memory: Show Related Graph
```

The side panel shows:

- scope and target path
- node and edge counts
- Cytoscape graph canvas
- node details
- table and JSON fallback views

You can also right-click a Markdown note in File Explorer and choose `Neo4j 그래프 보기`. This uses the clicked file path, not the active editor path.

## 6. View Folder Graphs

Right-click a folder in File Explorer and choose:

```text
Neo4j 폴더 그래프 보기
```

The folder graph uses the folder path as the scope. Settings control whether nested notes and one-hop external bridge relationships are included.

The side panel summary highlights:

- displayed folder notes versus total indexed folder notes
- isolated internal notes with no note-to-note links in the displayed graph
- internal `LINKS_TO` count
- central folder notes ranked by note-to-note degree
- external bridge notes and bridge node counts
- truncation reason when `maxGraphNodes` hides folder notes or bridge nodes

External bridge nodes are styled differently in the graph. Isolated folder notes are also marked so they are easy to find during folder cleanup.

## 7. Promote Explicit Memory

1. Open a Markdown note.
2. Select only the text that should become long-term memory.
3. Run `Context Graph Memory: Promote Selection to Long-term Memory`.
4. Choose `Preference`, `Rule`, or `Decision`.

The plugin upserts a memory node in Neo4j, links it to the current note with `RECORDED_IN`, and appends a safe Markdown entry to `memoryInboxPath`.

No automatic long-term memory extraction runs in the MVP. Empty selections are rejected.

## 8. Export Codex Context

Run:

```text
Context Graph Memory: Export Codex Context for Current Note
```

The plugin writes Markdown to `codexContextOutputPath`. The output follows this contract:

```markdown
# Codex Implementation Context

## Current Note

## Related Notes

## Graph Memory

## Task

## Verification
```

The export includes the current note content, related notes, graph summary, and related `Preference`, `Rule`, and `Decision` memory nodes. Codex CLI is not executed by the plugin.

## Recommended Task Flow

1. Preview metadata extraction for the current note when the frontmatter source is new or uncertain.
2. Preview and approve manual semantic enrichment only when candidate frontmatter has been reviewed.
3. Index the current note.
4. Confirm the related graph opens.
5. Promote any explicit memory only from selected text.
6. Export Codex context.
7. Open the exported Markdown and review the sections before using it in Codex CLI.
8. Run implementation work outside the plugin.
