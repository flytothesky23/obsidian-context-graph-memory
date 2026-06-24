# Security Notes

The plugin reads local Markdown files and connects to Neo4j using credentials stored in Obsidian plugin data. Generated Markdown outputs must stay safe to open, search, sync, and share internally.

## Never Write These To Notes Or Exports

- Neo4j passwords
- API keys
- GitHub tokens
- Codex login details
- OAuth or auth JSON
- Runtime logs that include credentials or local secrets
- Raw exception output that contains credential values

## Storage Boundary

Neo4j settings are stored by Obsidian plugin data, not in Markdown notes. This is acceptable for MVP desktop use, but it is still local secret material. Protect the Obsidian profile and avoid copying plugin data into notes or issue reports.

## Generated Markdown Outputs

The plugin can write:

- `memoryInboxPath`
- `codexContextOutputPath`

Both writers mask common credential-like content before writing user-visible Markdown. The masking covers key/value fields, JSON auth fields, common token headers, OpenAI/GitHub token shapes, and the configured Neo4j password value where the writer has access to it.

Masking is a safety net, not permission to select or export secrets. Review generated files before sharing them.

## Neo4j Error Messages

Neo4j errors are sanitized before display. If a connection error appears in Obsidian, do not paste raw terminal or driver logs into Markdown. Summarize the failure without credentials.

## Codex Export Boundary

`Context Graph Memory: Export Codex Context for Current Note` writes a Markdown context file only. It does not execute Codex CLI, open a shell, call a language model, or send data to an external service.

Before using an exported context file in Codex CLI:

1. Open the file in Obsidian.
2. Confirm it contains the required sections.
3. Search for `password`, `token`, `secret`, `auth`, `api key`, and `runtime log`.
4. Remove anything that should not leave the vault.

## Semantic Enrichment Boundary

`Context Graph Memory: Preview Semantic Enrichment Candidates` is manual-only. It reads candidate frontmatter from the active note, opens a preview modal, and writes to Neo4j only after explicit approval.

The command does not call an LLM, execute Codex CLI, call Data Forge runtime, or modify Data Forge managed blocks. Candidate `reason` and `evidence` text is sanitized for credential-like key/value pairs and common token shapes before Neo4j storage.

## Sharing And Bug Reports

When reporting problems, include:

- command name
- sanitized error message
- plugin version
- whether Neo4j connection test passed
- whether schema initialization passed

Do not include:

- real passwords or tokens
- full auth files
- raw `.obsidian/plugins/*/data.json`
- raw runtime logs
