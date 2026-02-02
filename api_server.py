#!/usr/bin/env python3
"""
OpenBotMan API Server

Usage:
    python api_server.py

Then make requests:
    curl -X POST http://localhost:8000/chat \
      -H "Content-Type: application/json" \
      -d '{"session_id": "test", "message": "Hello"}'
"""

import sys
import os
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from src.orchestrator import MultiAgentOrchestrator

app = FastAPI(
    title="OpenBotMan API",
    description="Multi-Agent Orchestrator REST API",
    version="0.1.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Session storage
orchestrators = {}


class ChatRequest(BaseModel):
    session_id: str
    message: str


class ChatResponse(BaseModel):
    response: str
    history: list


class StatusResponse(BaseModel):
    status: str
    version: str
    agents: list
    workflows: list


@app.get("/", response_model=StatusResponse)
async def root():
    """API status"""
    try:
        # Create temporary orchestrator to get config
        orch = MultiAgentOrchestrator()
        return StatusResponse(
            status="ok",
            version="0.1.0",
            agents=list(orch.config['agents'].keys()),
            workflows=list(orch.config.get('workflows', {}).keys())
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Process chat message"""

    try:
        # Get or create orchestrator for session
        if request.session_id not in orchestrators:
            orchestrators[request.session_id] = MultiAgentOrchestrator()

        orch = orchestrators[request.session_id]

        # Process message
        response = orch.chat(request.message)

        return ChatResponse(
            response=response,
            history=orch.get_history()
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/reset/{session_id}")
async def reset(session_id: str):
    """Reset session"""
    if session_id in orchestrators:
        orchestrators[session_id].reset()
        return {"status": "ok", "session_id": session_id}
    return {"status": "not_found", "session_id": session_id}


@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Delete session"""
    if session_id in orchestrators:
        del orchestrators[session_id]
        return {"status": "deleted", "session_id": session_id}
    return {"status": "not_found", "session_id": session_id}


@app.get("/sessions")
async def list_sessions():
    """List active sessions"""
    return {
        "sessions": list(orchestrators.keys()),
        "count": len(orchestrators)
    }


if __name__ == "__main__":
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))

    print(f"🚀 Starting OpenBotMan API Server on {host}:{port}")
    print(f"📖 API docs: http://localhost:{port}/docs")

    uvicorn.run(app, host=host, port=port)
