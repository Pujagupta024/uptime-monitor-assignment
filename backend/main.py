import asyncio
import httpx
import json
import sqlite3
import random
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import aiosqlite
import time

DATABASE_URL = "uptime.db"
REGIONS = ["us-east-1", "eu-west-1", "ap-south-1"]

async def init_db():
    async with aiosqlite.connect(DATABASE_URL) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS urls (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT UNIQUE NOT NULL,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS ping_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url_id INTEGER,
                status_code INTEGER,
                response_time_ms INTEGER,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_up BOOLEAN,
                FOREIGN KEY(url_id) REFERENCES urls(id)
            )
        """)
        
        # Migrations
        migrations = [
            "ALTER TABLE urls ADD COLUMN friendly_name TEXT",
            "ALTER TABLE urls ADD COLUMN http_method TEXT DEFAULT 'GET'",
            "ALTER TABLE urls ADD COLUMN custom_headers TEXT",
            "ALTER TABLE urls ADD COLUMN expected_body_snippet TEXT",
            "ALTER TABLE ping_logs ADD COLUMN region TEXT"
        ]
        
        for migration in migrations:
            try:
                await db.execute(migration)
            except sqlite3.OperationalError:
                pass # Column already exists
                
        await db.commit()

async def ping_urls():
    while True:
        try:
            async with aiosqlite.connect(DATABASE_URL) as db:
                db.row_factory = aiosqlite.Row
                async with db.execute("SELECT id, url, http_method, custom_headers, expected_body_snippet FROM urls") as cursor:
                    urls = await cursor.fetchall()
            
            if urls:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    for row in urls:
                        url_id = row["id"]
                        url = row["url"]
                        method = row["http_method"] or "GET"
                        headers_str = row["custom_headers"]
                        expected_snippet = row["expected_body_snippet"]
                        
                        headers = {}
                        if headers_str:
                            try:
                                headers = json.loads(headers_str)
                            except json.JSONDecodeError:
                                pass # Malformed JSON handled gracefully
                        
                        is_up = False
                        status_code = None
                        response_time_ms = None
                        region = random.choice(REGIONS)
                        
                        try:
                            start_time = asyncio.get_event_loop().time()
                            # Use the defined method and headers
                            response = await client.request(method, url, headers=headers)
                            end_time = asyncio.get_event_loop().time()
                            
                            status_code = response.status_code
                            response_time_ms = int((end_time - start_time) * 1000)
                            is_up = True
                            
                            # Deep health check assertion
                            if expected_snippet and expected_snippet not in response.text:
                                is_up = False
                                
                        except httpx.RequestError as e:
                            # DNS failure, connection timeout, etc.
                            is_up = False
                            
                        async with aiosqlite.connect(DATABASE_URL) as db:
                            await db.execute("""
                                INSERT INTO ping_logs (url_id, status_code, response_time_ms, is_up, region)
                                VALUES (?, ?, ?, ?, ?)
                            """, (url_id, status_code, response_time_ms, is_up, region))
                            await db.commit()
        except Exception as e:
            print(f"Error in background task: {e}")
            
        await asyncio.sleep(5)

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    task = asyncio.create_task(ping_urls())
    yield
    task.cancel()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class URLCreate(BaseModel):
    url: str
    friendly_name: Optional[str] = None
    http_method: Optional[str] = "GET"
    custom_headers: Optional[str] = None
    expected_body_snippet: Optional[str] = None

class URLResponse(BaseModel):
    id: int
    url: str
    added_at: str
    friendly_name: Optional[str] = None
    is_up: Optional[bool] = None
    response_time_ms: Optional[int] = None
    last_ping: Optional[str] = None
    region: Optional[str] = None
    history: List[bool] = []

class AnalyticsResponse(BaseModel):
    overall_uptime_pct: float
    p95_latency_ms: Optional[int] = None
    p99_latency_ms: Optional[int] = None
    recent_latencies: List[Optional[int]] = []

@app.post("/api/urls")
async def add_url(url_data: URLCreate):
    if not url_data.url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL must start with http:// or https://")
        
    # Validate custom headers JSON if provided
    if url_data.custom_headers:
        try:
            json.loads(url_data.custom_headers)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="custom_headers must be valid JSON")
            
    try:
        async with aiosqlite.connect(DATABASE_URL) as db:
            await db.execute(
                "INSERT INTO urls (url, friendly_name, http_method, custom_headers, expected_body_snippet) VALUES (?, ?, ?, ?, ?)", 
                (url_data.url, url_data.friendly_name, url_data.http_method, url_data.custom_headers, url_data.expected_body_snippet)
            )
            await db.commit()
            return {"message": "URL added successfully"}
    except aiosqlite.IntegrityError:
        raise HTTPException(status_code=400, detail="URL already exists")

@app.get("/api/urls", response_model=List[URLResponse])
async def get_urls():
    async with aiosqlite.connect(DATABASE_URL) as db:
        db.row_factory = aiosqlite.Row
        
        async with db.execute("SELECT id, url, added_at, friendly_name FROM urls") as cursor:
            urls = await cursor.fetchall()
            
        async with db.execute("SELECT url_id, is_up, response_time_ms, timestamp, region FROM ping_logs ORDER BY id DESC") as cursor:
            logs = await cursor.fetchall()
            
        from collections import defaultdict
        url_logs = defaultdict(list)
        for log in logs:
            url_logs[log["url_id"]].append(dict(log))
            
        results = []
        for u in urls:
            u_dict = dict(u)
            logs_for_u = url_logs.get(u["id"], [])
            
            latest = logs_for_u[0] if logs_for_u else {}
            u_dict["is_up"] = latest.get("is_up")
            u_dict["response_time_ms"] = latest.get("response_time_ms")
            u_dict["last_ping"] = latest.get("timestamp")
            u_dict["region"] = latest.get("region")
            
            # Extract up to 10 latest statuses, ordered chronologically
            u_dict["history"] = [bool(l.get("is_up")) for l in logs_for_u[:10]][::-1]
            
            # Default friendly name to URL if blank
            if not u_dict.get("friendly_name"):
                u_dict["friendly_name"] = u_dict["url"].split("//")[-1].split("/")[0]
            
            results.append(u_dict)
            
        return results

@app.delete("/api/urls/{url_id}")
async def delete_url(url_id: int):
    async with aiosqlite.connect(DATABASE_URL) as db:
        async with db.execute("SELECT id FROM urls WHERE id = ?", (url_id,)) as cursor:
            if not await cursor.fetchone():
                raise HTTPException(status_code=404, detail="URL not found")
                
        await db.execute("DELETE FROM ping_logs WHERE url_id = ?", (url_id,))
        await db.execute("DELETE FROM urls WHERE id = ?", (url_id,))
        await db.commit()
        return {"message": "URL deleted successfully"}

@app.get("/api/urls/{url_id}/analytics", response_model=AnalyticsResponse)
async def get_analytics(url_id: int):
    async with aiosqlite.connect(DATABASE_URL) as db:
        db.row_factory = aiosqlite.Row
        # Calculate uptime % overall
        async with db.execute("SELECT COUNT(is_up) as total, SUM(is_up) as up FROM ping_logs WHERE url_id = ?", (url_id,)) as cursor:
            row = await cursor.fetchone()
            total_pings = row["total"] or 0
            up_pings = row["up"] or 0
            uptime_pct = (up_pings / total_pings * 100) if total_pings > 0 else 100.0

        # Latency calculations for past 24 hours
        async with db.execute(
            "SELECT response_time_ms FROM ping_logs WHERE url_id = ? AND timestamp >= datetime('now', '-1 day') AND is_up = 1 AND response_time_ms IS NOT NULL",
            (url_id,)
        ) as cursor:
            latency_rows = await cursor.fetchall()
            
        latencies = sorted([r["response_time_ms"] for r in latency_rows])
        
        p95 = None
        p99 = None
        if latencies:
            import math
            p95_idx = max(0, math.ceil(len(latencies) * 0.95) - 1)
            p99_idx = max(0, math.ceil(len(latencies) * 0.99) - 1)
            p95 = latencies[p95_idx]
            p99 = latencies[p99_idx]
            
        # Recent latencies for sparkline (last 20 for example)
        async with db.execute(
            "SELECT response_time_ms FROM ping_logs WHERE url_id = ? AND response_time_ms IS NOT NULL ORDER BY id DESC LIMIT 20",
            (url_id,)
        ) as cursor:
            recent_rows = await cursor.fetchall()
            recent_latencies = [r["response_time_ms"] for r in recent_rows][::-1]
            
        return {
            "overall_uptime_pct": round(uptime_pct, 2),
            "p95_latency_ms": p95,
            "p99_latency_ms": p99,
            "recent_latencies": recent_latencies
        }
