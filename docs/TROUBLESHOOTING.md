# Troubleshooting

Use this checklist from connection outward: Neo4j, schema, indexing, graph query, rendering, memory promotion, export.

## Build Fails

Run:

```bash
npm run typecheck
npm run build
```

Check the first TypeScript error. The production build depends on typecheck passing first.

## Plugin Does Not Appear In Obsidian

1. Confirm `manifest.json` and `main.js` are in `.obsidian/plugins/context-graph-memory`.
2. Confirm Obsidian Community plugins are enabled.
3. Confirm the plugin is enabled in `Settings > Community plugins`.
4. Restart Obsidian if the plugin folder was copied while Obsidian was open.

## Neo4j Connection Test Fails

Check:

- Neo4j is running.
- The URI matches the server, for example `bolt://localhost:7687` for a local single Neo4j instance.
- Username and password are entered in plugin settings.
- The selected database exists.
- Local firewall or VPN settings are not blocking Bolt traffic.

Run `Context Graph Memory: Test Neo4j Connection` after each change.

## Schema Initialization Fails

Check that the Neo4j user has permission to create constraints and indexes. Run `Context Graph Memory: Initialize Neo4j Schema` again after permission changes.

## Index Current Note Does Nothing Useful

Check:

- The active editor is a Markdown note.
- The note is not excluded by folder settings.
- `includeFolders` and `includeTags` are not unintentionally filtering the note.
- Neo4j connection test passes.

Then run `Context Graph Memory: Index Current Note` again.

## Vault Index Is Too Large Or Slow

Use settings to reduce the scope:

- add folders to `excludeFolders`
- use `includeFolders` for a focused subset
- lower `maxGraphNodes`
- keep `indexOnStartup` disabled until the initial manual index is stable

## Graph Panel Opens But Looks Empty

Check:

- The current note was indexed.
- Linked notes were indexed.
- `maxGraphDepth` is at least `1`.
- The graph is not truncated to a very small `maxGraphNodes` value.
- Neo4j contains `Note` nodes with matching `path` properties.

Use the table/JSON fallback in the graph panel to inspect returned nodes.

## Folder Graph Summary Looks Wrong

Check:

- The folder was indexed with `Context Graph Memory: Index Vault` or current-note indexing for its notes.
- `folderGraphRecursive` matches whether nested folders should be included.
- `folderGraphIncludeExternalBridges` is enabled when you expect outside-folder bridge nodes.
- `maxGraphNodes` is high enough to show all folder notes before bridge nodes.
- Isolated notes mean no displayed note-to-note relationship; tag-only notes can still be reported as isolated.

If the panel says the graph was truncated at the folder-note limit, increase `maxGraphNodes` or index a smaller folder. If it says external bridge limit, folder notes are shown first and outside bridge nodes were capped.

## File Explorer Menu Is Missing

The note menu appears only for Markdown files. The folder menu appears only for folders. Right-click the file or folder in Obsidian File Explorer, not inside the editor body.

`Obsidian Raw local graph 열기` on a folder opens Obsidian's graph view with a `path:"folder/"` search filter because Obsidian's built-in local graph is note-centric. If the graph opens without a filter, paste the Notice-provided `path:"folder/"` value into the graph search box and confirm the Graph core plugin is enabled.

## Memory Promotion Does Not Save

Check:

- Some text is selected in the active Markdown editor.
- A type was selected in the modal.
- Neo4j connection is working.
- `memoryInboxPath` parent folder can be created.

Empty selected text is intentionally rejected.

## Codex Context Export Missing Graph Memory

Check:

- The current note was indexed.
- Related notes were indexed.
- Memory was promoted from selected text and linked with `RECORDED_IN`.
- The graph query for the current note returns memory nodes.

If Neo4j query fails, the export still writes Current Note plus a sanitized graph warning. Fix the graph connection and rerun export.

## Generated Output Contains Sensitive Text

Stop using the generated file until it is reviewed. Delete the sensitive output, remove the secret from the source note if it should not be there, and regenerate. The sanitizer masks common patterns but cannot guarantee every possible secret format.
