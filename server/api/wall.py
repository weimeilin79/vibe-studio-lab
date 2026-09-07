"""The Wall API: the platform contract the pipeline publishes to.

This is the same contract the original Studio server exposed (agent/post.py
and world/platform.py call it over HTTP at config.STUDIO_URL), moved here so
the new server can stand alone. Idempotency-Key replay returns the original
response, so a retried publish never creates a duplicate.
"""
from __future__ import annotations

import json
import sqlite3
import time
import uuid

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from agent import config
from world import simulator
from world.platform import SEED_TRENDS

router = APIRouter(prefix="/api", tags=["wall"])


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(config.WALL_DB)
    conn.row_factory = sqlite3.Row
    return conn


def init() -> None:
    with db() as c:
        c.executescript("""
            CREATE TABLE IF NOT EXISTS creators(
              id TEXT PRIMARY KEY, handle TEXT UNIQUE, token TEXT, joined_at REAL);
            CREATE TABLE IF NOT EXISTS videos(
              id TEXT PRIMARY KEY, creator_id TEXT, title TEXT, description TEXT,
              duration_ms INTEGER, lap INTEGER, video_ref TEXT, thumb_ref TEXT,
              lineage TEXT, published_at REAL);
            CREATE TABLE IF NOT EXISTS views(
              id INTEGER PRIMARY KEY AUTOINCREMENT, video_id TEXT, viewer_id TEXT,
              watched_ms INTEGER, drop_ms INTEGER, completed INTEGER,
              is_synthetic INTEGER, at REAL);
            CREATE TABLE IF NOT EXISTS publish_keys(
              key TEXT PRIMARY KEY, response TEXT);
            """)


class Join(BaseModel):
    handle: str


class Publish(BaseModel):
    creator_id: str
    token: str
    title: str
    description: str = ""
    duration_ms: int
    lap: int = 1
    video_ref: str
    thumb_ref: str = ""
    lineage: dict


@router.post("/join")
def join(body: Join):
    with db() as c:
        row = c.execute("SELECT * FROM creators WHERE handle=?", (body.handle,)).fetchone()
        if row:
            return {"creator_id": row["id"], "token": row["token"]}
        cid, token = f"c_{uuid.uuid4().hex[:8]}", uuid.uuid4().hex
        c.execute("INSERT INTO creators VALUES (?,?,?,?)", (cid, body.handle, token, time.time()))
    return {"creator_id": cid, "token": token}


@router.get("/trends")
def trends():
    return {"trends": SEED_TRENDS}


def _auth(c, creator_id: str, token: str) -> None:
    row = c.execute("SELECT token FROM creators WHERE id=?", (creator_id,)).fetchone()
    if not row or row["token"] != token:
        raise HTTPException(401, "bad creator token")


@router.post("/publish")
def publish(body: Publish, idempotency_key: str = Header(alias="Idempotency-Key")):
    with db() as c:
        _auth(c, body.creator_id, body.token)
        seen = c.execute("SELECT response FROM publish_keys WHERE key=?", (idempotency_key,)).fetchone()
        if seen:
            return json.loads(seen["response"])
        vid = f"v_{uuid.uuid4().hex[:8]}"
        c.execute("INSERT INTO videos VALUES (?,?,?,?,?,?,?,?,?,?)",
                  (vid, body.creator_id, body.title, body.description, body.duration_ms,
                   body.lap, body.video_ref, body.thumb_ref, json.dumps(body.lineage), time.time()))
        for r in simulator.simulate_audience(vid, body.duration_ms, body.lineage):
            c.execute("INSERT INTO views(video_id,viewer_id,watched_ms,drop_ms,completed,is_synthetic,at)"
                      " VALUES (?,?,?,?,?,?,?)",
                      (vid, r["viewer_id"], r["watched_ms"], r["drop_ms"], int(r["completed"]), 1, time.time()))
        resp = {"video_id": vid, "url": f"/watch/{vid}"}
        c.execute("INSERT INTO publish_keys VALUES (?,?)", (idempotency_key, json.dumps(resp)))
    return resp


@router.get("/outcomes")
def outcomes(creator_id: str):
    with db() as c:
        vids = c.execute("SELECT * FROM videos WHERE creator_id=?", (creator_id,)).fetchall()
        out = []
        for v in vids:
            views = c.execute("SELECT * FROM views WHERE video_id=?", (v["id"],)).fetchall()
            n = len(views) or 1
            avg_pct = sum(r["watched_ms"] for r in views) / (n * v["duration_ms"]) * 100
            drops = sorted(r["drop_ms"] for r in views if r["drop_ms"] is not None)
            out.append({
                "video_id": v["id"], "title": v["title"], "lap": v["lap"],
                "duration_ms": v["duration_ms"], "views": n,
                "avg_watch_pct": round(avg_pct, 1),
                "median_drop_ms": drops[len(drops) // 2] if drops else None,
                "dropped_pct": round(len(drops) / n * 100, 1),
                "view_rows": [dict(r) for r in views],
            })
    return {"videos": out}


@router.get("/channel")
def channel():
    """Every published video with its thumbnail and file, for the Channel view."""
    with db() as c:
        rows = c.execute("SELECT id, title, description, lap, video_ref, thumb_ref, published_at "
                         "FROM videos ORDER BY published_at").fetchall()
    return {"videos": [dict(r) for r in rows]}
