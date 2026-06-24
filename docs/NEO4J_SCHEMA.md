# Neo4j Schema

Neo4j stores a derived index of the vault. The Neo4j database is an external instance, not an embedded database inside Obsidian. The schema can be initialized from Obsidian with:

```text
Context Graph Memory: Initialize Neo4j Schema
```

## Constraints And Indexes

| Name | Cypher |
|---|---|
| `note_path_unique` | `CREATE CONSTRAINT note_path_unique IF NOT EXISTS FOR (n:Note) REQUIRE n.path IS UNIQUE` |
| `note_id_unique` | `CREATE CONSTRAINT note_id_unique IF NOT EXISTS FOR (n:Note) REQUIRE n.id IS UNIQUE` |
| `tag_name_unique` | `CREATE CONSTRAINT tag_name_unique IF NOT EXISTS FOR (t:Tag) REQUIRE t.name IS UNIQUE` |
| `concept_normalized_name_unique` | `CREATE CONSTRAINT concept_normalized_name_unique IF NOT EXISTS FOR (c:Concept) REQUIRE c.normalizedName IS UNIQUE` |
| `preference_id_unique` | `CREATE CONSTRAINT preference_id_unique IF NOT EXISTS FOR (p:Preference) REQUIRE p.id IS UNIQUE` |
| `rule_id_unique` | `CREATE CONSTRAINT rule_id_unique IF NOT EXISTS FOR (r:Rule) REQUIRE r.id IS UNIQUE` |
| `decision_id_unique` | `CREATE CONSTRAINT decision_id_unique IF NOT EXISTS FOR (d:Decision) REQUIRE d.id IS UNIQUE` |
| `note_folder_index` | `CREATE INDEX note_folder_index IF NOT EXISTS FOR (n:Note) ON (n.folder)` |

## Node Labels

| Label | Source | Notes |
|---|---|---|
| `Note` | Markdown files | Main vault document node. |
| `Tag` | Frontmatter and inline tags | Name-normalized tag node. |
| `Concept` | Reserved schema | Used by planned semantic enrichment. |
| `Memory` | Explicit memory promotion | Base label for promoted memory nodes. |
| `Preference` | Explicit memory promotion | User/project preference memory. |
| `Rule` | Explicit memory promotion | Operating rule memory. |
| `Decision` | Explicit memory promotion | Decision memory. |

## Relationships

| Relationship | Direction | Created by |
|---|---|---|
| `HAS_TAG` | `(:Note)-[:HAS_TAG]->(:Tag)` | Indexing. |
| `LINKS_TO` | `(:Note)-[:LINKS_TO]->(:Note)` | Resolved wikilinks. |
| Relation field types | Usually `(:Note)-[:TYPE]->(:Note)` | Frontmatter relation fields and Data Forge compatible fields. |
| `RECORDED_IN` | `(:Memory)-[:RECORDED_IN]->(:Note)` | Explicit memory promotion. |

## Rebuild Policy

Neo4j is rebuildable. If the graph index is stale or corrupted:

1. Keep Markdown notes unchanged.
2. Reinitialize schema if needed.
3. Re-run `Context Graph Memory: Index Vault`.
4. Re-run targeted current-note indexing for recently changed notes.

Do not treat Neo4j as the only copy of a fact that matters. Store durable knowledge in Markdown notes or explicit Memory Inbox records.
