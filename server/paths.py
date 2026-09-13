"""
app/paths.py
============

Single source of truth for every runtime folder/file the app reads or
writes. Paths are configured from the dashboard's consolidated settings
page (config.html), stored in dashboard/config/app_settings.json via
/api/settings:

app_settings.json keys:
        dataDir        base data folder (default "data").
                       Relative -> project root; absolute -> used as-is.
        chatSavePath   where saved chat transcripts (.txt) are written.
                       Empty -> <dataDir>/chatlog/agent-text-records
        ragDbPath      where the RAG store (chroma.sqlite3) lives.
                       Empty -> <dataDir>/rag_db
        rag            { commitOnSave: bool, autoIngest: bool }

    Every key can ALSO come from an environment variable, which wins over the
    settings file (so a second machine / a Chromebook can redirect storage
    without touching any file):

        GENESSIS_DATA_DIR        -> dataDir
        GENESSIS_CHAT_SAVE_PATH  -> chatSavePath
        GENESSIS_RAG_DB_PATH     -> ragDbPath

    `~` and $VAR are expanded (e.g. GENESSIS_DATA_DIR=~/genessis-data).

CROSS-PLATFORM: the app runs on Windows, Linux and macOS. If a settings file
copied from a Windows machine still holds absolute Windows paths (E:\\data\\...)
and we are NOT on Windows, those are mapped to project-relative folders
(`E:\\data\\rag_store` -> <project>/data/rag_store) with a one-time warning,
so nothing silently writes into a garbage folder.

Everything else is derived from these so changing "data folder" moves the
chatlog, transcripts, history, exports and RAG store together.

Per-agent settings (agent.json metadata + tests, agent.md behavior) are the
agent's own files under engine/agent_library/ - edited from the same
config.html page, one agent card per agent.

Path config is resolved at import time - save settings in the UI, then
restart the server for dataDir/ragDbPath/chatSavePath changes to apply.
`restart_needed()` tells callers when a restart is required.
"""

import json
import os
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
APP_SETTINGS_FILE = BASE_DIR / "dashboard" / "config" / "app_settings.json"

_EMPTY = (None, "", "")

# Settings key -> environment variable override.
_ENV_KEYS = {
    "dataDir": "GENESSIS_DATA_DIR",
    "chatSavePath": "GENESSIS_CHAT_SAVE_PATH",
    "ragDbPath": "GENESSIS_RAG_DB_PATH",
}

# One-time warning guard per key (the message is printed on first use only).
_warned: set[str] = set()

_DRIVE_RE = re.compile(r"^[A-Za-z]:[/\\]")
_UNC_RE = re.compile(r"^([/\\]{2})")


def _get_text(value):
    """Normalize a config value to str; '' for empty/missing."""
    if value in _EMPTY:
        return ""
    return str(value).strip()


def _bool(value):
    return bool(value)


def is_windows_path(text: str) -> bool:
    """True when `text` is an absolute Windows-style path (X:\\... or \\\\UNC)."""
    return bool(text and (_DRIVE_RE.match(text) or _UNC_RE.match(text)))


def _portable_windows_path(text: str, source_label: str,
                           os_name: str | None = None) -> str:
    """Turn stored Windows absolute paths into project-relative paths when we
    are not running on Windows. Returns the path unchanged on Windows.

    `E:\\data\\rag_store` -> `data/rag_store`  (drive letter dropped,
    separators normalized, one-time warning printed)."""
    if os_name is None:
        os_name = os.name
    if os_name == "nt" or not text:
        return text

    norm = text.replace("\\", "/")
    rel = None
    drive = _DRIVE_RE.match(norm)
    unc = _UNC_RE.match(norm)
    if drive:
        rel = norm[drive.end():].lstrip("/")
    elif unc:
        rel = norm[unc.end():].lstrip("/")

    if rel is None:
        return text

    if not rel:
        rel = ""
    if source_label not in _warned:
        _warned.add(source_label)
        print(f"[paths] WARNING: '{text}' is a Windows absolute path - this is "
              f"not {os_name}; using it as project-relative '{rel or '(defaults)'}' "
              f"instead. Set {source_label} (or a GENESSIS_* env var) to override.")
    return rel


def _configured(key: str) -> tuple[str, str]:
    """(effective value, source label) for one path key.
    Precedence: environment variable > app_settings.json."""
    env_name = _ENV_KEYS.get(key)
    if env_name:
        env_value = os.environ.get(env_name)
        if env_value is not None and env_value.strip():
            return env_value.strip(), env_name
    return _get_text(_cfg.get(key)), key


def _load_app_settings() -> dict:
    try:
        return json.loads(APP_SETTINGS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def resolve_path(raw, *fallback_parts) -> Path:
    """Base folder for a configured location.

    `raw` is a folder path and is used verbatim when present (absolute paths
    are used as-is so the data/RAG store can live outside the project;
    relative paths resolve against the project root). When `raw` is empty,
    fall back to BASE_DIR/<fallback_parts>. Windows absolute paths are mapped
    to project-relative on non-Windows OSes (see `_portable_windows_path`).
    """
    text = _configured_portable(raw)
    if not text:
        return BASE_DIR.joinpath(*fallback_parts).resolve()
    path = Path(os.path.expandvars(text)).expanduser()
    if not path.is_absolute():
        path = BASE_DIR / path
    return path.resolve()


def _rooted(raw, default: Path) -> Path:
    """Like resolve_path, but the fallback is an already-resolved Path."""
    text = _configured_portable(raw)
    if not text:
        return default
    path = Path(os.path.expandvars(text)).expanduser()
    if not path.is_absolute():
        path = BASE_DIR / path
    return path.resolve()


def _configured_portable(raw) -> str:
    """Resolve a raw settings value (possibly an env override) into the
    OS-appropriate relative form. `raw` may be a path-setting key name (e.g.
    "dataDir" - reads the env override / settings through `_configured`) or an
    already-extracted path string (used by /api/settings)."""
    if isinstance(raw, str) and raw in _ENV_KEYS:
        text, source_label = _configured(raw)
    elif isinstance(raw, str):
        text, source_label = raw, "settings"
    else:
        text, source_label = _configured(raw)
    text = os.path.expandvars(text)
    return _portable_windows_path(text, source_label)


# --------------------------------------------------------------------------
# Runtime values (resolved once at import - restart server after editing).
# --------------------------------------------------------------------------

_cfg = _load_app_settings()

# Snapshot of the stored *path* settings at import. The UI can compare
# against the live file to tell the user a restart is required.
_PATH_KEYS = ("dataDir", "chatSavePath", "ragDbPath")
_path_keys_at_import = {key: _get_text(_cfg.get(key)) for key in _PATH_KEYS}

# Base data folder (dataDir overrides the default "data").
DATA_DIR = resolve_path("dataDir", "data")

# Chat log folder + transcripts (chatSavePath overrides the sub-folder).
CHATS_DIR = DATA_DIR / "chatlog"
CHAT_SAVE_PATH = _configured_portable("chatSavePath")
RECORDS_DIR = _rooted("chatSavePath", DATA_DIR / "chatlog" / "agent-text-records")
CHAT_RECORDS_DIR = RECORDS_DIR  # alias used by the RAG search tool

# RAG store (ragDbPath overrides <dataDir>/rag_db).
RAG_DB_DIR = _rooted("ragDbPath", DATA_DIR / "rag_db")

# Chat log metadata + active session.
LOG_FILE = CHATS_DIR / "chatRecord.jsonl"
ACTIVE_SESSION_FILE = CHATS_DIR / ".active-chat.json"

# History + exports (server.py).
HISTORY_FILE = DATA_DIR / "history.json"
EXPORTS_DIR = DATA_DIR / "exports"


# --------------------------------------------------------------------------
# RAG behavior switches (read live, so the UI changes apply immediately).
# --------------------------------------------------------------------------

def rag_config(default_commit: bool | None = None) -> dict:
    """The current RAG behavior settings: commitOnSave + autoIngest.

    `default_commit`: when supplied, an explicit per-chat flag overrides it;
    otherwise the stored commitOnSave value is returned.
    """
    rag = _cfg.get("rag") or {}
    commit = _bool(rag.get("commitOnSave", False))
    if default_commit is not None:
        commit = bool(default_commit)
    return {
        "commitOnSave": commit,
        "autoIngest": _bool(rag.get("autoIngest", True)),
    }


def restart_needed() -> bool:
    """True when stored path settings changed since import - the running
    server is still using the old resolved locations until a restart."""
    current = _load_app_settings()
    for key in _PATH_KEYS:
        if _get_text(current.get(key)) != _path_keys_at_import.get(key):
            return True
    return False


def about() -> dict:
    """Human-readable summary of the resolved locations (for the config UI
    and the /api/rag/status endpoint)."""
    def _source(key):
        return _configured(key)[1]
    return {
        "data_dir": str(DATA_DIR),
        "chat_records_dir": str(RECORDS_DIR),
        "chat_log_file": str(LOG_FILE),
        "active_session_file": str(ACTIVE_SESSION_FILE),
        "history_file": str(HISTORY_FILE),
        "exports_dir": str(EXPORTS_DIR),
        "rag_db_dir": str(RAG_DB_DIR),
        "sources": {
            "dataDir": _source("dataDir"),
            "chatSavePath": _source("chatSavePath"),
            "ragDbPath": _source("ragDbPath"),
        },
        "rag": rag_config(),
    }
