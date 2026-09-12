# Changelog

All notable changes to this project. Format based on Keep a Changelog
(https://keepachangelog.com/), grouped by date.

## 2026-09-12 — Cross-platform paths + resilient model selection

The app now runs from the same checkout on both Windows and Linux, and never
crashes on a model that this machine does not have installed.

### Added — per-OS path overrides & platform detection

- `server/paths.py` — reads three new keys from
  `dashboard/config/app_settings.json`:
  - `dataDirLinux`, `chatSavePathLinux`, `ragDbPathLinux` — on non-Windows
    hosts these win over the plain `dataDir` / `chatSavePath` / `ragDbPath`,
    so one settings file can carry both a Windows layout and a Linux layout.
  - A plain value that is a Windows drive path (`E:\...` / `E:/...`) is
    ignored on non-Windows hosts when no `<key>Linux` override exists — the
    app falls back to a project default instead of creating a literal
    `E:\data\...` folder on Linux.
  - New `platform()` helper (`"win"` / `"nix"`); `about()` now reports it.
- `server/server.py` — `GET /api/settings` returns `platform`; the legacy
  `/api/chat-save` path resolver (`_resolve_chat_dir`) uses the same
  Windows-drive-path guard so crafted values can never become literal folders
  on Linux (already re-rooted inside `BASE_DIR`).
- `dashboard/js/ui/config-form.js` — a "Linux paths (overrides)" section with
  the three new fields is rendered on non-Windows machines and saved through
  the existing `POST /api/settings` merge. `config-page.js`/`api.js` pass the
  detected platform through.
- `.gitignore` — `[A-Z]:*` rule so accidental drive-letter folders can never
  be tracked.
- Stray `E:\data\rag_store` folders created by the old resolution on Linux
  were removed from the repo.

### Added — resilient model selection

- `engine/core/llm.py` — `_resolve_model()` no longer trusts a requested model
  blindly:
  - A model that is **not installed** on this machine is dropped with an
    `[ask_llm]` warning and the first detected model is used instead (this is
    what keeps Windows-authored settings working on a Linux/Chromebook Ollama
    that lacks `llama3.1:8b` / `gemma4:e2b`).
  - When the caller needs **tool calling**, models Ollama reports as not
    supporting tools are skipped, preferring a `tools`-capable detected model.
    `ask_llm()` only drops the tool schemas (the agent then answers without
    tools) when no tool-capable model exists at all.
  - Installed models and per-model capabilities are cached briefly so the
    checks do not hammer Ollama on every message.
  - When no models are visible at all (Ollama unreachable), the explicit
    request is still honoured as before.
- `dashboard/config/app_settings.json` — `defaultModel` is `""`: the app
  resolves to the first detected model and the user chooses any detected LLM
  from the dropdown (no hardcoded default).

### Fixed — launching on Linux

- README gained a "Quickstart (Linux / Chromebook Linux)" section
  (`python3 -m venv venv`, `source venv/bin/activate`, ...) with the uvicorn
  equivalent. Linux has no bare `python` binary, so `python server.py` only
  works inside an activated venv — documented in Notes.

### Documentation

- `README.md` — Linux quickstart, "Model selection" subsection, per-OS paths
  under RAG, `platform` note, updated "Recent changes".
- `docs/documentation_CREATING_AGENTS.md` — stale pre-restructure paths
  (`app/*`, root `agent_library/`) corrected to the `engine/`/`tools/` layout;
  the `model` field now documents the fallback-to-detected behavior;
  tool-using agents should pin a `tools`-capable model.
- `docs/RESTRUCTURE_README.md` — Linux launch line and refreshed component
  comments.

## 2026-09-12 — Agent Monitor removed; launch fixed; docs updated

The Agent Monitoring feature (live activity feed) was removed and the affected
backend modules were restored to their original, working versions. Chats are
fully functional again.

### Removed — Agent Monitor (frontend)

The monitor was a companion window that polled a live activity feed while an
agent worked. It is gone entirely:

- `dashboard/monitor.html` — deleted (the monitor page).
- `dashboard/js/monitor.js` — deleted (polling loop + rendering).
- `dashboard/js/api/api.js` — `getActivity()` / `clearActivity()` removed
  (they called `/api/activity` and `/api/activity/clear`).
- `dashboard/chat.html` — the "Monitor" header button and its click listener
  removed.
- `dashboard/js/app.js` — `openAgentMonitor()` and the `config.onObserve`
  wiring removed.
- `dashboard/config.html` + `dashboard/js/config-page.js` — the "Agent
  Monitor" settings section (`#monitor-section`, `renderMonitorSection()`)
  removed.
- `server/__pycache__/activity.cpython-314.pyc` — stale bytecode cleaned.

Note: `dashboard/js/classes/chat-window.js` still has a generic `onObserve`
extension hook, but nothing sets it, so it never triggers.

### Removed — Agent Monitor (backend)

- `server/activity.py` — deleted (the ActivityFeed singleton + `/api/activity`
  endpoints no longer exist, so the poller 404s are gone).

### Restored — backend modules rolled back to working originals

- `engine/core/agent.py` — restored from the original; the monitor-era
  sink/events/`_emit`/`_clip_args` and stdout-capturing `act()` are gone.
  `think()` / `act()` / `observe()` behave as before.
- `server/server.py` — restored from the original base and the legitimate
  pre-monitor endpoints re-added so the Settings page keeps working:
  - `GET /api/tools`
  - `GET /api/agents/{agent_id}/config`
  - `PUT /api/agents/{agent_id}/config`
  - `GET /api/about`

Pre-rollback copies are kept as recovery backups:
`server/server.py.infected.bak` and `engine/core/agent.py.infected.bak`.

### Fixed — launching `server.py` from any directory

`server/server.py` now bootstraps `sys.path` at the top: it inserts the
project root and drops its own folder from the path so this file can never
shadow the `server/` package. Previously `python server.py` failed with
`ModuleNotFoundError: No module named 'engine'` (and the `server`/`server.py`
name collision made a simple path fix impossible).

Now all three of these work:
`python server.py` (from `server/`), `python server/server.py` (from the
project root), and `venv\Scripts\python -m uvicorn server.server:app` (root).

### Changed — documentation

- `README.md` — rewritten to match the current layout (`engine/`, `server/`,
  `tools/`, `memory/`, `dashboard/`, ...), with a module-by-module inventory,
  up-to-date API table and launch instructions.
- `docs/RESTRUCTURE_README.md` — folder tree refreshed, monitor removal and
  launch-anywhere noted.