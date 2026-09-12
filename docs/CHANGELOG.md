# Changelog

All notable changes to this project. Format based on Keep a Changelog
(https://keepachangelog.com/), grouped by date.

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