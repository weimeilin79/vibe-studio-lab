"""/api/run: the run's state, its live event stream, and the buttons.

Every POST starts one driver process and returns immediately. Progress
arrives on /api/run/events; the frontend never polls.
"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from agent import config

from ..schemas import Ack, AnswerForm, RunSnapshot, StartRun
from ..services import run_state
from ..services.events import bus, sse
from ..services.workers import workers

router = APIRouter(prefix="/api/run", tags=["run"])


@router.get("", response_model=RunSnapshot, response_model_by_alias=True)
async def get_run() -> RunSnapshot:
    return await run_state.snapshot()


@router.get("/events")
async def events():
    """Server-Sent Events: a snapshot on connect, then one per change."""
    async def stream():
        q = bus.subscribe()
        try:
            snap = await run_state.snapshot()
            yield sse({"type": "snapshot", "data": snap.model_dump(by_alias=True)})
            while True:
                try:
                    evt = await asyncio.wait_for(q.get(), timeout=20.0)
                    yield sse(evt)
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            bus.unsubscribe(q)
    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


def _ack(ok: bool, detail: str, verb: str) -> Ack:
    if not ok:
        raise HTTPException(409, detail)
    return Ack(ok=True, verb=verb, detail=detail)


@router.post("/start", response_model=Ack)
async def start(body: StartRun) -> Ack:
    ok, detail = await workers.start("run", body.idea.strip())
    return _ack(ok, detail, "run")


@router.post("/answer", response_model=Ack)
async def answer(body: AnswerForm) -> Ack:
    pick = body.pick.strip() or "1"
    ok, detail = await workers.start("auto", "direction", "--pick", pick)
    return _ack(ok, detail, "auto")


@router.post("/approve", response_model=Ack)
async def approve() -> Ack:
    ok, detail = await workers.start("auto", "ship", force=True)
    return _ack(ok, detail, "auto")


@router.post("/regenerate", response_model=Ack)
async def regenerate() -> Ack:
    ok, detail = await workers.start("auto", "rethumb", force=True)
    return _ack(ok, detail, "auto")


@router.post("/finish", response_model=Ack)
async def finish() -> Ack:
    ok, detail = await workers.start("finish")
    return _ack(ok, detail, "finish")


@router.post("/learn", response_model=Ack)
async def learn() -> Ack:
    ok, detail = await workers.start("learn")
    return _ack(ok, detail, "learn")


@router.post("/bank", response_model=Ack)
async def bank() -> Ack:
    ok, detail = await workers.start("bank")
    return _ack(ok, detail, "bank")


@router.post("/graph", response_model=Ack)
async def graph() -> Ack:
    ok, detail = await workers.start_shell("graph", "scripts/graph.sh")
    return _ack(ok, detail, "graph")


@router.post("/stop", response_model=Ack)
async def stop() -> Ack:
    stopped = await workers.stop_all()
    bus.mark_dirty()
    return Ack(ok=True, detail=", ".join(stopped) or "nothing was running")


@router.post("/reset", response_model=Ack)
async def reset() -> Ack:
    """Clear the current lap (runs/ files owned by a lap). The wall, the bank,
    and user: preferences are kept, exactly as the Restart button did."""
    await workers.stop_all()
    ok, detail = await workers.start_script("reset", str(config.ROOT / "scripts" / "reset.py"))
    return _ack(ok, detail, "reset")
