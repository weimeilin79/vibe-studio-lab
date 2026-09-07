"""The session helpers the lab shares: one session service per event loop,
and a sync bridge for the console commands."""
import asyncio

from google.adk.sessions import DatabaseSessionService

from . import config

# One session service - and therefore ONE SQLAlchemy async engine - per event
# loop. run() below disposes it before the loop closes.
_svc_by_loop: dict = {}


def svc() -> DatabaseSessionService:
    """The session service for the loop we are on, made once and reused.

    run() below disposes it before the loop closes. Called with no loop running
    (a caller driving its own asyncio), you get a fresh one and you own it."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return DatabaseSessionService(db_url=config.DB_URL)
    service = _svc_by_loop.get(loop)
    if service is None:
        service = _svc_by_loop[loop] = DatabaseSessionService(db_url=config.DB_URL)
    return service


def run(coro):
    """Sync bridge - every console command calls this.

    asyncio.run() builds a FRESH loop each time and closes it on the way out,
    so the engine svc() made inside must be disposed before that happens.
    Without this, aiosqlite's worker threads outlive their loop and every later
    callback raises `RuntimeError: Event loop is closed`."""
    async def _disposing():
        try:
            return await coro
        finally:
            service = _svc_by_loop.pop(asyncio.get_running_loop(), None)
            if service is not None:
                await service.close()   # DatabaseSessionService.close() -> db_engine.dispose()
    return asyncio.run(_disposing())
