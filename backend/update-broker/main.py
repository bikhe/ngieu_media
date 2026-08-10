import os
import json
import asyncio
import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
import redis.asyncio as redis

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://backend:8000")

# Keepalive interval in seconds — prevents browser from closing idle SSE connections
KEEPALIVE_INTERVAL = 20


async def event_generator(request: Request, since_id: int):
    # Send retry directive: client waits 5s before reconnecting (default is ~3s)
    yield {"event": "message", "retry": 5000, "data": json.dumps({"type": "connected"})}

    # 1. Fetch missed logs from Django backend first
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{BACKEND_URL}/api/updates/?since_id={since_id}", timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                logs = data.get('logs', [])
                if logs:
                    yield {
                        "event": "message",
                        "data": json.dumps({"type": "updates", "logs": logs})
                    }
    except Exception as e:
        print(f"Error fetching initial logs: {e}")

    # 2. Listen to Redis for real-time updates
    redis_client = redis.Redis(host=REDIS_HOST, port=6379, db=0, decode_responses=True)
    pubsub = redis_client.pubsub()

    try:
        await pubsub.subscribe("ngieu_updates")
        last_ping = asyncio.get_event_loop().time()

        while True:
            if await request.is_disconnected():
                break

            # Send keepalive ping to prevent browser/proxy from closing the connection
            now = asyncio.get_event_loop().time()
            if now - last_ping >= KEEPALIVE_INTERVAL:
                yield {"event": "message", "data": json.dumps({"type": "ping"})}
                last_ping = now

            try:
                message = await asyncio.wait_for(
                    pubsub.get_message(ignore_subscribe_messages=True),
                    timeout=1.0
                )
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                print(f"Redis get_message error: {e}")
                await asyncio.sleep(1)
                continue

            if message:
                yield {
                    "event": "message",
                    "data": message["data"]
                }

    except Exception as e:
        print(f"SSE generator error: {e}")
    finally:
        try:
            await pubsub.unsubscribe("ngieu_updates")
            await redis_client.aclose()
        except Exception:
            pass


@app.get("/stream")
async def sse_stream(request: Request, since_id: int = 0):
    return EventSourceResponse(event_generator(request, since_id), ping=0)

