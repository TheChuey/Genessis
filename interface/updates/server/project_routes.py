"""
LOCATION: interface/updates/server/project_routes.py
"""
import os
from pathlib import Path
from pydantic import BaseModel
from interface.update_manager import UpdateManager

class CreateProjectRequest(BaseModel):
    project_name: str
    target_dir: str
    dependencies: list[str] = None

def register_routes(app):
    """Registers project manager API endpoints onto the FastAPI app."""
    
    @app.post("/api/projects/create")
    def api_create_project(req: CreateProjectRequest):
        mgr = UpdateManager()
        builder = mgr.get_active_module("engine", "project_creator")
        if not builder:
            return {"status": "error", "message": "project_creator module not found"}
        
        result = builder.create_project(
            project_name=req.project_name,
            target_dir=req.target_dir,
            dependencies=req.dependencies
        )
        return result

    @app.get("/api/projects/list")
    def api_list_projects(base_dir: str = "C:\\Projects"):
        """Lists created project folders at the target location."""
        path = Path(base_dir)
        if not path.exists():
            return {"projects": []}
        
        projects = [
            d.name for d in path.iterdir() 
            if d.is_dir() and (d / "requirements.txt").exists()
        ]
        return {"base_dir": str(path), "projects": projects}

