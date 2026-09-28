import os
import json
import asyncio
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

app = FastAPI()

ALLOWED_ORIGINS = os.environ.get("CORS_ALLOWED_ORIGINS", "https://admin.pivas.su,https://mobile.pivas.su").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

BACKEND_URL = os.environ.get("BACKEND_URL", "http://backend:8000")

# Keepalive interval in seconds — prevents browser from closing idle SSE connections
KEEPALIVE_INTERVAL = 20


async def event_generator(request: Request, since_id: int, ticket: str = None):
    # Send retry directive: client waits 5s before reconnecting (default is ~3s)
    yield {"event": "message", "retry": 5000, "data": json.dumps({"type": "connected"})}

    try:
        last_ping = asyncio.get_running_loop().time()
        async with httpx.AsyncClient() as client:
            while True:
                if await request.is_disconnected():
                    break

                # Poll the authenticated API rather than forwarding the
                # global Redis channel. The API filters logs for this user.
                resp = await client.get(
                    f"{BACKEND_URL}/api/updates/",
                    params={"since_id": since_id, "ticket": ticket},
                    timeout=10,
                )
                if resp.status_code in (401, 403):
                    raise HTTPException(status_code=401, detail="Invalid or expired SSE ticket")
                resp.raise_for_status()
                data = resp.json()
                logs = data.get("logs", [])
                if logs:
                    since_id = data.get("last_id", since_id)
                    yield {
                        "event": "message",
                        "data": json.dumps({"type": "updates", "logs": logs})
                    }

                now = asyncio.get_running_loop().time()
                if now - last_ping >= KEEPALIVE_INTERVAL:
                    yield {"event": "message", "data": json.dumps({"type": "ping"})}
                    last_ping = now

                await asyncio.sleep(1)
    except httpx.HTTPError as e:
        print(f"Error fetching updates: {e}")


@app.get("/stream")
async def sse_stream(request: Request, since_id: int = 0, ticket: str = None):
    if not ticket:
        raise HTTPException(status_code=401, detail="SSE ticket is required")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{BACKEND_URL}/api/updates/",
                params={"since_id": since_id, "ticket": ticket},
                timeout=10,
            )
        if response.status_code in (401, 403):
            raise HTTPException(status_code=401, detail="Invalid or expired SSE ticket")
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Update service unavailable") from exc
    return EventSourceResponse(event_generator(request, since_id, ticket), ping=0)
