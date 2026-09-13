"""Project creator module.

LOCATION: interface/updates/engine/project_creator.py
USAGE (Option B Direct Access):
    mod = update_manager.get_active_module("engine", "project_creator")
    result = mod.create_project("MyNewProject", "C:\\Projects\\MyNewProject")
"""

import sys
import venv
import subprocess
from pathlib import Path
import logging

logger = logging.getLogger("app_change_tracker")

# Standard workspace folder layout
STANDARD_FOLDERS = [
    "config",
    "server",
    "dashboard",
    "modules",
    "project_scope",
    "to_do",
    "updates",
    "data",
]

DEFAULT_REQUIREMENTS = [
    "fastapi",
    "uvicorn",
    "streamlit",
]

STARTER_SERVER_CODE = """from fastapi import FastAPI

app = FastAPI(title="Project Server")

@app.get("/")
def read_root():
    return {"status": "online", "message": "Project server running"}

@app.get("/api/status")
def get_status():
    return {"status": "ready"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8500)
"""

STARTER_DASHBOARD_CODE = """import streamlit as st

st.set_page_config(page_title="Project Dashboard", layout="wide")
st.title("Project Dashboard")
st.write("Welcome to your standalone project workspace!")

st.header("Project Status")
st.info("Server & Workspace Initialized")
"""


def get_venv_python(project_path: Path) -> Path:
    """Returns the path to the Python executable in .venv based on OS."""
    if sys.platform == "win32":
        return project_path / ".venv" / "Scripts" / "python.exe"
    return project_path / ".venv" / "bin" / "python"


def create_project(project_name: str, target_dir: str, dependencies: list = None) -> dict:
    """Creates a standalone project environment with standard folders, .venv, server, and dashboard."""
    project_path = Path(target_dir).resolve()
    logger.info(f"[PROJECT BUILDER] Creating project '{project_name}' at {project_path}")

    # 1. Generate Standard Workspace Folders
    project_path.mkdir(parents=True, exist_ok=True)
    for folder in STANDARD_FOLDERS:
        (project_path / folder).mkdir(parents=True, exist_ok=True)

    # 2. Build Platform-Specific Virtual Environment
    venv_dir = project_path / ".venv"
    if not venv_dir.exists():
        builder = venv.EnvBuilder(with_pip=True)
        builder.create(venv_dir)

    # 3. Write requirements.txt and install dependencies
    req_list = dependencies or DEFAULT_REQUIREMENTS
    req_file = project_path / "requirements.txt"
    req_file.write_text("\n".join(req_list) + "\n", encoding="utf-8")

    venv_python = get_venv_python(project_path)
    subprocess.run(
        [str(venv_python), "-m", "pip", "install", "-r", str(req_file)],
        check=True,
    )

    # 4. Generate Starter Server & Dashboard
    (project_path / "server" / "server.py").write_text(STARTER_SERVER_CODE, encoding="utf-8")
    (project_path / "dashboard" / "app.py").write_text(STARTER_DASHBOARD_CODE, encoding="utf-8")

    return {
        "status": "success",
        "project_name": project_name,
        "path": str(project_path),
        "venv_python": str(venv_python),
    }