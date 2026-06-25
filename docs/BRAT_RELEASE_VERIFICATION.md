# BRAT Release Verification

This project should be verified through the same install path used on other devices: GitHub release assets installed by BRAT. Directly copying files into `.obsidian/plugins/context-graph-memory` is useful for local smoke checks, but it is not the final release gate.

Current verified public release: `0.0.2`

- Repository: <https://github.com/flytothesky23/obsidian-context-graph-memory>
- Release: <https://github.com/flytothesky23/obsidian-context-graph-memory/releases/tag/0.0.2>
- License: MIT

## Release Contract

BRAT and Obsidian-compatible releases must provide these files as GitHub release assets:

| Asset | Required | Notes |
|---|---|---|
| `manifest.json` | Yes | `version` must match the release tag. |
| `main.js` | Yes | Built output from `npm run build`. |
| `styles.css` | Optional | Include only if the plugin adds CSS. |
| `versions.json` | Recommended | Maps plugin versions to minimum Obsidian versions. |

The current MVP does not need `styles.css`.

## Local Preflight

Run:

```bash
npm test
npm run release:check
RELEASE_TAG=0.0.2 npm run release:check
```

Expected result:

- unit tests pass
- production build passes
- `package.json` version matches `manifest.json` version
- `versions.json` includes the manifest version
- release assets exist and are non-empty
- release tag matches `manifest.json.version` when `RELEASE_TAG` or `GITHUB_REF_NAME` is set
- release asset sizes and SHA-256 hashes are printed for `manifest.json`, `main.js`, `versions.json`, and optional `styles.css`

## GitHub Release Flow

The repository is public at `flytothesky23/obsidian-context-graph-memory`.

1. Commit the repo.
2. Push to GitHub.
3. Create and push a tag exactly matching `manifest.json.version`, for example:

```bash
git tag 0.0.2
git push origin 0.0.2
```

4. The GitHub Actions release workflow builds, tests, checks, and uploads release assets.
5. Confirm the release contains `manifest.json`, `main.js`, and `versions.json`.

Initial repository creation command used for public release setup:

```bash
gh repo create flytothesky23/obsidian-context-graph-memory --public --source=. --remote=origin --push
```

Release inspection template:

```bash
gh release view 0.0.2 --json tagName,assets,url
```

Do not paste GitHub tokens, Neo4j credentials, Codex login state, or runtime logs into release notes, issue reports, screenshots, Obsidian notes, or exported context files.

## BRAT Install Verification

Install through BRAT using the GitHub repository URL, then verify in Obsidian:

1. Plugin appears under Community plugins as `Context Graph Memory`.
2. Settings UI opens and saves values.
3. `Context Graph Memory: Test Neo4j Connection` succeeds or reports a sanitized failure.
4. `Context Graph Memory: Initialize Neo4j Schema` applies schema.
5. `Index Current Note`, `Index Vault`, and `Reindex Changed Notes` run.
6. File Explorer note right-click shows `Neo4j 그래프 보기`.
7. File Explorer folder right-click shows `Neo4j 폴더 그래프 보기`.
8. File Explorer note right-click shows `Obsidian Raw local graph 열기`.
9. File Explorer folder right-click shows `Obsidian Raw local graph 열기` and opens Obsidian graph view with a `path:"folder/"` search filter.
10. Graph side panel renders with Cytoscape and supports zoom, pan, fit, node detail, and truncation summary.
11. Metadata preview, Data Forge compatibility preview, and semantic enrichment preview/approval work.
12. Memory promotion appends Memory Inbox and creates `RECORDED_IN`.
13. Codex context export writes the configured Markdown file and redacts secrets.

## Reporting

Record BRAT verification separately from local copy verification. If a gate passes only with direct local copy but fails with BRAT release installation, treat it as a release defect.

## Verified `0.0.2` Evidence

| Check | Status |
|---|---|
| GitHub Actions release workflow | PASS |
| Release assets uploaded | PASS |
| BRAT installed `flytothesky23/obsidian-context-graph-memory` | PASS |
| BRAT frozen version records `0.0.2` | PASS |
| Active vault plugin loaded as `context-graph-memory` `0.0.2` | PASS |
| `main.js` installed SHA-256 matches release digest | PASS |
| Obsidian note/folder graph smoke with Neo4j 2026.05.0 | PASS |
