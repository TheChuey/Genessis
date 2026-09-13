# Terminator1 — Reorganized Layout

This is your original app, regrouped into four clear domains. All import
paths were rewritten to match — this isn't just a file shuffle, it's a
working package layout.

```
terminator1/
├── engine/                 # The agent factory ("engine")
│   ├── core/
│   │   ├── agent.py        # Agent runtime: think/act/observe loop
│   │   ├── llm.py          # ask_llm(), model resolution, Ollama scan
│   │   └── prompt.py       # agent.md sections + tools -> system prompt
│   ├── agents/
│   │   ├── loader.py       # Reads agent_library/{id}/agent.md + agent.json
│   │   ├── registry.py     # Scans agent_library/ -> available agents
│   │   └── factory.py      # build_agent(agent_id, model) -> ready Agent
│   └── agent_library/      # Agent definitions (data, not code)
│       ├── basic_chat/
│       ├── dev_assistant/
│       ├── problem_discovery_agent/
│       └── rag_assistant/
│
├── tools/                  # Tools available to agents (per-agent capabilities)
│   ├── registry.py         # TOOL_REGISTRY: tool IDs -> Python functions
│   ├── state.py            # FileSession: shared/persisted file-working state
│   └── tools.py            # map/read/write/delete + date/time + search tools
│
├── memory/                 # RAG memory store (was "rag/")
│   ├── ingest.py           # Transcript chunking (ingest_file / ingest_directory)
│   ├── search.py           # RAGStorage: Chroma store + fallback vector DB
│   ├── main.py             # Standalone RAG CLI / cognitive loop experiment
│   └── rag_commit.py       # Commit, purge, rebuild, status for the store
│
├── dashboard/               # Frontend (was "static/")
│   ├── index.html          # Main UI shell (agent cards, floating chat)
│   ├── chat.html           # Standalone self-contained chat page
│   ├── config.html         # NEW: consolidated settings page (one place for
│   │                       #      app defaults, appearance, every agent,
│   │                       #      shared tests, models)
│   ├── config/app_settings.json
│   ├── css/styles.css
│   └── js/
│       ├── app.js
│       ├── config-page.js  # NEW: boot module for config.html
│       ├── api/api.js
│       ├── classes/ (ChatSession.js, chat-window.js)
│       ├── logic/  (models.js, chat-formatter.js)
│       └── ui/     (markdown.js, agents.js, appearance.js, config-form.js,
│                    agent-editor.js, header-nav.js,
│                    interface-indicator.js,   # header "N updates" pill
│                    interface-manager.js)     # Settings "Updates/Interface" card
│
├── server/                  # Thin glue: FastAPI app + chat log + path config
│   ├── server.py            # HTTP endpoints, static mount, lifespan; also
│   │                        # discovers interface/updates at startup and
│   │                        # exposes update_manager + dispatcher on app.state;
│   │                        # /api/interface/{status,apply,snapshot,restore,
│   │                        # run,toggle-run} wire the UI to the update system
│   ├── paths.py             # Config-driven runtime path authority
│   └── chat_store/
│       ├── logger.py
│       └── store.py
│
├── config/
│   └── models.json          # auto-generated model snapshot (the old
│                            # settings.json is gone - one default now lives
│                            # in app_settings.json#defaultAgentId)
├── scripts/
│   ├── rebuild_rag.py
│   ├── version_chats.py
│   └── update_docs.py        # NEW: regenerates APP_STRUCTURE.md + APP_CODE_SNAPSHOT.md
├── interface/                # NEW: modular update & restore layer
│   ├── update_manager.py     #    discover/import interface/updates/<domain>/*
│   ├── interface_dispatcher.py  # trace_and_execute() caller line tracing
│   ├── restore_manager.py    #    baseline compare/restore + snapshot_baseline()
│   └── updates/              #    engine/ | tools/ | server/
├── about/
│   ├── about.json           # title/subtitle served by GET /api/about
│   └── set_title.py         # + 'apply' / 'snapshot' / 'restore' CLI triggers
├── docs/
│   ├── CHANGELOG.md
│   ├── RESTRUCTURE_README.md
│   ├── 01_IDEA_AND_ARCHITECTURE.md   # NEW: design doc for the update/restore layer
│   ├── APP_STRUCTURE.md              # AUTO-GENERATED
│   └── APP_CODE_SNAPSHOT.md          # AUTO-GENERATED
├── current-known-good-copy/ # GENERATED restore baseline (python about/set_title.py snapshot)
├── requirements.txt
└── README.md                 # Original project README (kept up to date)
```

## Launching

`python server.py` now works from any directory (a `sys.path` bootstrap at the
top of the file adds the project root and drops the script's own folder so the
`server` package is never shadowed). Equivalent launch from the project root:

```
venv\Scripts\python -m uvicorn server.server:app
```

The app is cross-platform (Windows / Linux / macOS / ChromeOS Linux). All
runtime storage is resolved by `server/paths.py` from `dataDir` /
`chatSavePath` / `ragDbPath` (defaults = project-relative `data/`), with
`GENESSIS_DATA_DIR` / `GENESSIS_CHAT_SAVE_PATH` / `GENESSIS_RAG_DB_PATH` env
overrides taking precedence. Windows absolute paths (`E:\...`) saved in
`app_settings.json` are auto-mapped to project-relative folders on non-Windows
OSes, and cleared on save from the Settings page. See the README's "Changing
where data is saved".

> The Agent Monitor feature (`dashboard/monitor.html`, `dashboard/js/monitor.js`,
> `server/activity.py` and the `/api/activity*` endpoints) was removed in
> 2026-09-12. See `docs/CHANGELOG.md`.

## What changed under the hood

Every cross-module import was rewritten to match the new folder names:

| Old import | New import |
|---|---|
| `from app.core.agent import Agent` | `from engine.core.agent import Agent` |
| `from app.core.llm import ask_llm` | `from engine.core.llm import ask_llm` |
| `from app.agents.factory import build_agent` | `from engine.agents.factory import build_agent` |
| `from app.tools.registry import resolve_tools` | `from tools.registry import resolve_tools` |
| `from app.tools.state import FileSession` | `from tools.state import FileSession` |
| `from rag.ingest import ingest_directory` | `from memory.ingest import ingest_directory` |
| `from rag.search import RAGStorage` | `from memory.search import RAGStorage` |
| `from app.rag_commit import status` | `from memory.rag_commit import status` |
| `from app.chat_store import store` | `from server.chat_store import store` |
| `from app import paths` | `from server import paths` |

`server/server.py`'s `STATIC_DIR` now points at `dashboard/` instead of
`static/`, and `server/paths.py`'s `APP_SETTINGS_FILE` now points at
`dashboard/config/app_settings.json`.

The dashboard's **Settings** page (`dashboard/config.html` +
`dashboard/js/config-page.js`) consolidates all configuration into one
place: app defaults, appearance, every agent's metadata/behavior/tests
(via `GET/PUT /api/agents/{id}/config`, writing the agent's own
`agent.json` / `agent.md`), the shared test pool, and the model list.

`engine/agents/loader.py`'s `AGENT_LIBRARY_DIR` now resolves to
`engine/agent_library/` (previously the project-root `agent_library/`).

## Verified

- Every `.py` file compiles (`python3 -m py_compile`).
- `engine.agents.registry.list_agents()` runs end-to-end and correctly
  discovers all four agents from `engine/agent_library/`.
- The only remaining import failures are missing third-party packages
  (`ollama`, `chromadb`, `docling`) — install with
  `pip install -r requirements.txt`, then run:

  ```
  python -m uvicorn server.server:app --reload
  ```

  (run this from the project root, i.e. the folder containing `server/`,
  `engine/`, `tools/`, `memory/`, `dashboard/`).

## Note on scope

This reorganization is based on `APP_SNAPSHOT.md` (the v1-11 era of your
project — before "Genessis Step 1/2" added `app/core/environment.py`,
`app/core/project_creator.py`, `app/contracts/`, and `app/engine/`). If
you want those newer modules folded into this same layout, upload the
current `APP_SNAPSHOT.md` (or the actual project files) for
`app/core/environment.py`, `app/core/project_creator.py`,
`app/contracts/*`, and `app/engine/*`, and I'll fold them in — they'd
naturally slot into `engine/` (project provisioning) and a new
`engine/contracts/` (the host class-library contracts) respectively.

## About the "dashboard" idea

The frontend files are copied over as-is (functionally identical, just
relocated). If you want an actual visual refresh — nicer typography, a
real dashboard layout with sidebar navigation between agents/memory/tools
status — say the word and I'll rework `dashboard/index.html` +
`styles.css` on top of this structure rather than just relocating files.
