"""World generation REST endpoints.

Provides REST endpoints for the frontend to:
- Poll world generation status independently
- Fetch world assets

These supplement the WebSocket-based world status updates in voice.py.
See TECHNICAL.md Section 6 for World Labs API details.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import WORLD_LABS_API_KEY
from services.world_labs import WorldLabsService

router = APIRouter(prefix="/api/worlds", tags=["worlds"])

world_labs = WorldLabsService(api_key=WORLD_LABS_API_KEY)


class GenerateRequest(BaseModel):
    scene_description: str
    display_name: str = "QHacks World"
    model: str = "Marble 0.1-mini"


class GenerateResponse(BaseModel):
    operation_id: str


class StatusResponse(BaseModel):
    done: bool
    world_id: str | None = None
    splat_url: str | None = None
    error: str | None = None


@router.post("/generate", response_model=GenerateResponse)
async def generate_world(req: GenerateRequest):
    """Start world generation. Returns operation_id for polling."""
    try:
        operation_id = await world_labs.generate_world(
            scene_description=req.scene_description,
            display_name=req.display_name,
            model=req.model,
        )
        return GenerateResponse(operation_id=operation_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{operation_id}", response_model=StatusResponse)
async def get_status(operation_id: str):
    """Check generation status without blocking (single poll, not loop)."""
    import httpx

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                f"https://api.worldlabs.ai/marble/v1/operations/{operation_id}",
                headers={"WLT-Api-Key": WORLD_LABS_API_KEY},
            )
            response.raise_for_status()
            data = response.json()

            if data.get("done"):
                result = data.get("response", {})
                return StatusResponse(
                    done=True,
                    world_id=result.get("id"),
                    splat_url=WorldLabsService.get_splat_url(result),
                )
            return StatusResponse(done=False)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
