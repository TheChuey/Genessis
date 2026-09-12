# Terminator1 (Genessis)

A local lab for building and testing AI agents: **FastAPI** backend + vanilla JS
frontend + **Ollama** local LLMs.

The core idea:

```
Agent      = one reusable Python runtime (think / act / observe)
Markdown   = behavior        (engine/agent_library/*/agent.md)
JSON       = configuration   (engine/agent_library/*/agent.json)
Tools      = capabilities    (tools/, wired by ID)
Registry   = discovery       (engine/agent_library/ is scanned automatically)
Factory    = construction    (agent_id -> ready Agent)
Frontend   = selection       (GET /api/agents -> agent selector)
```

You can build 10, 20, or 100 agents without ever writing a new Python class:
a new agent is just a folder with `agent.md` + `agent.json` (+ tool IDs).

## One place for configuration

Open **/static/config.html** (the "Settings" button on the dashboard and in the
chat header) for EVERY configuration in one screen:

- **App defaults** — default agent (with a jump-link to that agent's card),
  default model, chat save path, data folder, RAG database path, chat
  versioning, and the RAG memory defaults. Stored in
  `dashboard/config/app_settings.json`.
- **Appearance** — one theme + font set for all pages.
- **Agents** — one card per agent, consolidating its whole config in one place:
  metadata + model + tools (its `agent.json`), its behavior prose (editable
  `agent.md`), and that agent's chat tests + an inline runner.
- **Shared tests** — tests with no agent that run for every agent.
- **Models** — read-only snapshot of the installed Ollama models.

Per-agent data lives with the agent (`engine/agent_library/<id>/agent.json` now
holds `tests`; `agent.md` is the behavior). The default agent for `/api/chat`
is read from the same `defaultAgentId` the dashboard uses.

## Quickstart (Windows PowerShell)

```powershell
py -3 -m venv venv
venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python server.py
```

`python server.py` can be run from ANY directory — the project root or
`server/` both work (the file bootstraps `sys.path` itself). Override the port
with `$env:PORT=9000`. The equivalent uvicorn launch (from the project root):

```powershell
venv\Scripts\python -m uvicorn server.server:app --host 127.0.0.1 --port 8000
```

Open **http://127.0.0.1:8000** (Chrome/Edge).

## Folder structure

```
terminator1/
├── server/                   # Thin glue: FastAPI app + chat log + path config
│   ├── server.py             # HTTP endpoints, static mount, lifespan. The ONLY
│   │                         # thing the browser talks to. `python server.py`
│   │                         # runs from any directory.
│   ├── paths.py              # Config-driven runtime path authority: dataDir /
│   │                         # chatSavePath / ragDbPath / RAG switches.
│   └── chat_store/           # Server-side chat session + chat log
│       ├── store.py          # ensure_session / append_turn / finalize_session,
│       │                     # the one-active-chat state, .txt transcripts,
│       │                     # chatRecord.jsonl (create/read/delete).
│       └── logger.py         # Small helpers the store uses to log rows.
│
├── engine/                   # The agent engine
│   ├── core/
│   │   ├── agent.py          # AgentProfile + the reusable Agent: think/act/observe
│   │   ├── llm.py            # ask_llm(), model resolution, context window, Ollama scan
│   │   └── prompt.py         # PromptManager: agent.md sections + tools -> system prompt
│   ├── agents/
│   │   ├── loader.py         # Read/parse engine/agent_library/{id}/agent.md + agent.json,
│   │   │                     # save_markdown / save_meta / save_tests (Settings page).
│   │   ├── registry.py       # Scans engine/agent_library/ -> available agents.
│   │   └── factory.py        # build_agent(agent_id, model) -> ready-to-use Agent.
│   └── agent_library/        # THE AGENTS - filesystem is the source of truth
│       ├── basic_chat/       # agent.md + agent.json  (mode: chat, no tools)
│       ├── dev_assistant/    # agent.md + agent.json  (mode: agent, tools)
│       ├── problem_discovery_agent/  # agent.md + agent.json (mode: agent)
│       └── rag_assistant/    # agent.md + agent.json  (mode: agent, chat-memory search)
│
├── tools/                    # Capabilities available to agents (per-agent IDs)
│   ├── registry.py           # TOOL_REGISTRY: tool ID -> Python function; resolve_tools/get_session
│   ├── state.py              # FileSession: shared/persisted file-working state
│   └── tools.py              # map_files, read_file, write_text_file, delete_files,
│                             # get_current_date, tell_me_the_date_and_time, search_chat_logs
│
├── memory/                   # RAG memory store
│   ├── ingest.py             # Transcript chunking (ingest_file / ingest_directory)
│   ├── search.py             # RAGStorage: Chroma store + fallback vector DB
│   ├── main.py               # Standalone RAG CLI / cognitive loop experiment
│   └── rag_commit.py         # status / rebuild_store / purge_store for the store
│
├── dashboard/                # Frontend (was "static/")
│   ├── index.html            # UI shell: agent cards + floating chat widget
│   ├── chat.html             # Standalone self-contained chat page
│   ├── config.html           # THE consolidated settings page (see above)
│   ├── config/               # app_settings.json (frontend-owned settings storage)
│   ├── css/styles.css
│   └── js/
│       ├── app.js            # index.html boot module (widget, sessions, agents)
│       ├── config-page.js    # config.html boot module (all settings sections)
│       ├── api/api.js        # All HTTP calls (chats, settings, agents, RAG, ...)
│       ├── classes/          # chat-window.js (widget UI), ChatSession.js (state)
│       ├── logic/            # models.js (model dropdown), chat-formatter.js
│       └── ui/               # markdown.js, appearance.js, config-form.js,
│                             # agents.js, agent-editor.js, header-nav.js
│
├── scripts/                  # CLI utilities
│   ├── rebuild_rag.py        # python scripts/rebuild_rag.py [build|purge|status]
│   └── version_chats.py      # list | import | bump | versioning on|off
│
├── about/                    # Site identity
│   ├── about.json            # title + subtitle served by GET /api/about
│   └── set_title.py          # Updates about.json.
│
├── config/
│   └── models.json           # AUTO-GENERATED at startup from installed Ollama models
├── docs/
│   ├── CHANGELOG.md          # Every recent change (incl. the Agent Monitor removal)
│   ├── RESTRUCTURE_README.md # History of the current package layout
│   └── documentation_CREATING_AGENTS.md  # Agent authoring guide
├── test/                     # PRE-INFECTION original snapshot, kept as a recovery
│                             # reference (not part of the running app).
├── requirements.txt
└── README.md
```

## How an answer is produced

```
Browser
  ↓ POST /api/chat {message, model, agent_id, history, session_id, title, new_chat, rag}
server.py
  ↓ chat_store.ensure_session()          server/chat_store/store.py (ONE active chat)
  ↓ build_agent(agent_id)                engine/agents/factory.py
loader: agent.md + agent.json            engine/agents/loader.py
tools:  IDs -> functions                 tools/registry.py
prompt: sections + tool docs -> system msg   engine/core/prompt.py
  ↓
Agent.think()                            engine/core/agent.py
  ↓ ask_llm()                            engine/core/llm.py
Ollama
  ↓
server.py appends the turn to the active chat and returns {reply, session_id, title}
  ↓ (on "Save chat" / new chat)
chat_store.finalize_session() writes data/chatlog/agent-text-records/<title>[-v].txt
+ logs it in data/chatlog/chatRecord.jsonl
```

## Chats: one server-side session at a time

The server tracks exactly ONE active chat session (it has its own start, middle
and end):

- First message of a chat (or `new_chat: true`) finalizes any previous chat and
  starts a new one; the server owns the conversation, so a page refresh never
  loses it.
- `data/chatlog/.active-chat.json` holds the live session (updates after every
  turn).
- Ending a chat (`POST /api/chats/end`, the "Save chat" button, or starting a
  new chat) writes ONE transcript per chat to
  `data/chatlog/agent-text-records/<title>.txt` — and on a name collision the
  NEXT version (`<title>-2.txt`, ...). Re-saving a chat you kept typing in
  produces the next version; old versions stay on disk.
- `data/chatlog/chatRecord.jsonl` is the LOG of those transcripts (title, agent,
  model, version, message/interaction counts, timestamps) used by the frontend
  drop-down — one line per chat VERSION; the drop-down shows the newest version
  of each chat. Existing `.txt` files are imported into the log once at startup.

Version helpers: `python scripts/version_chats.py list | import | bump
<id-or-title> [version] | versioning on|off`.

Agent modes:

- `chat`  — User → LLM → Response. The factory attaches no tools, so no tool loop can happen.
- `agent` — User → Agent → LLM → Tool? → Observation → LLM → Response. Same `Agent` class; only its configuration differs.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/models` | Model dropdown options (scanned from Ollama at startup) |
| `GET /api/agents` | All discovered agents: `{id, name, description, mode}` |
| `GET /api/tools` | Every tool ID an agent can pick (feeds the Settings checkboxes) |
| `GET /api/agents/{id}/config` | One agent's consolidated config (meta + `agent.md` + tests + shared tests) |
| `PUT /api/agents/{id}/config` | Partial update of one agent's config (`meta` / `markdown` / `tests`) |
| `GET /api/about` | Site identity (title + tagline from `about/about.json`) |
| `POST /api/chat` | `{message, model, agent_id, history, session_id?, title?, new_chat?, rag?}` → `{reply, session_id, title}` |
| `GET /api/chats` | Chat log + the active chat (feeds the chats drop-down) |
| `GET /api/chats/{id}` | One chat: log row + `.txt` content + parsed messages |
| `POST /api/chats/end` | Finalize the active chat into a versioned `.txt` + log it (`rag` bool overrides committing it to memory) |
| `DELETE /api/chats/{id}` | Permanently erase a chat (transcripts + log records) |
| `POST /api/chat-save` | Finalize the active chat (kept for legacy clients) |
| `GET /api/rag/status` | RAG store location + indexed chunk count + resolved paths |
| `POST /api/rag/rebuild` | Re-index every saved transcript into the RAG store |
| `POST /api/rag/reset` | Delete the RAG store so it starts empty (transcripts kept) |
| `GET/POST/DELETE /api/discussions` | CRUD over the same chat log (chatRecord.jsonl records) |
| `GET/POST/DELETE /api/history` | Saved message snapshots (`data/history.json`) |
| `GET/POST /api/settings` | The stored browser defaults (`dashboard/config/app_settings.json`) |
| `POST /api/exports` | Save one wizard prompt as `{name}.md` + `{name}.json` (data/exports) |

There is no `/api/activity` endpoint anymore — the Agent Monitor feature was
removed (see `docs/CHANGELOG.md`). Anything polling it will get a 404.

### RAG memory store

Saved chats can be committed to a persistent RAG store so agents using the
`search_chat_logs` tool can recall them. Controls:

- **Per chat:** flip the "Save to memory" toggle in the chat header before
  sending/saving (both the index.html flyout and the standalone `chat.html`
  page have it).
- **Default:** the "Commit saved chats to memory by default" toggle in
  Configuration → RAG memory (`rag.commitOnSave`).
- **Auto-loading:** when the store is empty, the first search ingests every
  transcript automatically unless "Auto-load transcripts..." is off
  (`rag.autoIngest`).
- **Paths:** Configuration → Data folder / RAG database path / Chat save path,
  stored in `dashboard/config/app_settings.json` and resolved by
  `server/paths.py` (absolute paths are used verbatim; relative paths resolve
  against the project root). Path changes apply after a server restart — the
  configuration page shows a "restart the server" banner until you do.
  Transcripts follow **Chat save path**, not the Data folder; blank means
  `<dataDir>/chatlog/agent-text-records`.
- **Manual maintenance:** `python scripts/rebuild_rag.py [build|purge|status]`,
  the "Rebuild memory"/"Forget everything" buttons in Configuration, or the
  "Clear Memory" button in the chat header (`chat.html`) — clear resets the
  store to zero entries.

The store lives at `data/rag_db/chroma.sqlite3` by default. The store keeps
embeddings even if the original transcripts are deleted, so recall keeps
working until you wipe it.

## Creating a new agent

No Python required: create a folder under `engine/agent_library/` containing
`agent.json` (configuration) + `agent.md` (behavior), pick tool IDs, and
refresh — the agent appears automatically in `GET /api/agents` and the frontend
selector.

Full field reference, tool catalog, copy-paste example, and troubleshooting:
**[docs/documentation_CREATING_AGENTS.md](docs/documentation_CREATING_AGENTS.md)**

## Adding a new tool

1. Write the function in `tools/tools.py` with a clear docstring — Ollama turns
   docstrings into the tool schema the LLM sees.
2. Add one line to `TOOL_REGISTRY` in `tools/registry.py`.
3. Reference the ID in any agent's `agent.json`.

## Recent changes

See **[docs/CHANGELOG.md](docs/CHANGELOG.md)** for the full history. The most
recent entry (2026-09-12) removed the Agent Monitor feature, restored
`engine/core/agent.py` and `server/server.py` to their working originals,
re-added the Settings-page endpoints (`/api/tools`,
`/api/agents/{id}/config`, `/api/about`), and made `python server.py` runnable
from any directory.

Recovery artifacts to be aware of:

- `test/` — a pre-infection snapshot of the original app, kept as a reference.
  Not part of the running app.
- `server/server.py.infected.bak` and `engine/core/agent.py.infected.bak` —
  copies of the pre-rollback monitor-era files, kept in case you need to
  diff/inspect them.

## Notes

- The backend tracks one active chat session at a time (see "Chats" above);
  `history` is still accepted for backwards compatibility.
- `/api/chat` is intentionally a sync endpoint so blocking LLM calls run in
  FastAPI's threadpool instead of stalling the event loop.
- Chat transcripts live in `data/chatlog/agent-text-records/` as `.txt` files;
  `data/chatlog/chatRecord.jsonl` is the header log that points at them.