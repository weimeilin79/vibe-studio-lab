"""Wire types. The TypeScript mirror is web/src/lib/types.ts."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

StageStatus = Literal["idle", "now", "pass", "fail", "retry", "degraded",
                      "blocked", "skip", "stall", "wait"]


class StageRow(BaseModel):
    key: str
    label: str
    sub: str
    status: StageStatus
    note: str = ""


class GraphEdge(BaseModel):
    from_: str = Field(alias="from")
    to: str
    route: str | None = None

    model_config = {"populate_by_name": True}


class GraphView(BaseModel):
    edges: list[GraphEdge]
    nodes: dict[str, Literal["idle", "now", "done", "you"]]


class WorkerExit(BaseModel):
    verb: str
    code: int
    at: float


class RunSnapshot(BaseModel):
    run_id: str | None
    lap: int | None
    phase: str
    busy: str | None
    last_exit: WorkerExit | None
    hint: str = ""
    suggested_idea: str = ""
    candidates: list[dict[str, Any]] = []
    direction: str | None = None
    thumb: dict[str, Any] | None = None
    thumb_pending: bool = False
    published: dict[str, Any] | None = None
    blocked: dict[str, Any] | None = None
    room: dict[str, Any] | None = None
    stages: list[StageRow]
    graph: GraphView
    updated_at: float


class StartRun(BaseModel):
    idea: str = ""


class AnswerForm(BaseModel):
    pick: str = "1"


class Ack(BaseModel):
    ok: bool
    verb: str | None = None
    detail: str = ""


class CodeFile(BaseModel):
    path: str
    content: str
    validation: dict[str, Any]
    symbol: str | None = None
    span: list[int] | None = None


class CodeWrite(BaseModel):
    path: str
    content: str
    symbol: str | None = None
