# Integrations

## promptdirector

Vendored copy of [PromptDirector](https://github.com/wchao6891/PromptDirector) (Apache-2.0, see
`promptdirector/LICENSE` and `promptdirector/NOTICE`), minus `test/` and `docs/assets/`.
It stays a separate Chrome extension plus Node MCP connector; ArtCraft does not link its code.

Local changes to the vendored copy: the Chinese text visible from ArtCraft (connector messages and tool
descriptions in `connector/*.mjs` and `extension/*-specs.js`, the connector README/SKILL, `docs/`,
CHANGELOG, AGENTS and the privacy policy) is translated to English. Still Chinese: the extension UI
strings and locale, build tooling in `tools/`, and the `*.zh*` / Chinese-only install and listing docs.

How ArtCraft uses it:

```
ArtCraft UI -> invoke("promptdirector_call_tool_command")      (frontend/libs/tauri-api)
            -> Rust MCP client over stdio                        (crates/desktop/artcraft/src/services/promptdirector)
            -> node integrations/promptdirector/connector/mcp.mjs
            -> Chrome + PromptDirector extension (the prompt library)
```

Only read-only tools are exposed (`status`, `search_cases`, `read_case`, `describe_case_query`,
`read_workspace_context`, `read_workspace_content`, `resolve_reference`). Saving or editing the
library stays in PromptDirector.

Setup:

1. `cd integrations/promptdirector && npm install` and `cd connector && npm install`.
2. Load `integrations/promptdirector/extension` in Chrome and install the connector as described in
   `promptdirector/connector/INSTALL.en.md`.
3. Keep Chrome running. Override the connector location with `PROMPTDIRECTOR_CONNECTOR_PATH` if needed.

UI: `PromptDirectorButton` (frontend/libs/components/promptbox) sits in the image and video prompt box
toolbars. It searches the library and replaces the prompt with the picked case's original prompt.
The search result field names (`cases`/`items`/`results`, `caseId`/`id`) are parsed defensively and
still need a check against a live connector.
