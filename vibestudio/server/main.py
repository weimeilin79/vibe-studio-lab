"""Vibe Studio, the app: one process, one port.

    /              the React page (web/dist)
    /api/...       the REST surface and the SSE stream (server/api.py)
    /static/...    renders, thumbnails, the avatar (runs/media)

Run:  python -m vibestudio            (port 4700, or $PORT)
"""
from __future__ import annotations

import asyncio
import contextlib
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

from .agent import config
from .api import router
from .bus import bus
from .runner import studio

DIST = Path(__file__).resolve().parent.parent / "web" / "dist"


def create_app() -> FastAPI:
    @contextlib.asynccontextmanager
    async def lifespan(app: FastAPI):
        bus.attach(asyncio.get_running_loop(), studio.snapshot)
        yield

    app = FastAPI(title="Vibe Studio", lifespan=lifespan)
    app.include_router(router)
    app.mount("/static", StaticFiles(directory=config.MEDIA), name="media")

    if (DIST / "index.html").exists():
        app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        async def spa(path: str):
            candidate = DIST / path
            if path and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(DIST / "index.html")
    else:
        @app.get("/", include_in_schema=False)
        async def no_build():
            return PlainTextResponse("the page is not built: cd vibestudio/web && npm install && npm run build",
                                     status_code=503)
    return app


app = create_app()
