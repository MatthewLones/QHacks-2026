"""World Labs Marble API client.

Handles 3D world generation, status polling, and asset retrieval.
See TECHNICAL.md Section 6 for full API details.

Auth: WLT-Api-Key header
Base URL: https://api.worldlabs.ai/marble/v1
Models: Marble 0.1-mini (~30-45s, 230 credits), Marble 0.1-plus (~5 min, 1580 credits)
"""

from __future__ import annotations

import asyncio
import logging

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://api.worldlabs.ai/marble/v1"
POLL_INTERVAL_S = 5
MAX_POLL_ATTEMPTS = 120  # 10 minutes max


class WorldLabsService:
    """Client for World Labs Marble API."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self._headers = {
            "WLT-Api-Key": api_key,
            "Content-Type": "application/json",
        }

    async def generate_world(
        self,
        scene_description: str,
        display_name: str = "QHacks World",
        model: str = "Marble 0.1-mini",
    ) -> str:
        """Start world generation. Returns operation_id for polling."""
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{BASE_URL}/worlds:generate",
                headers=self._headers,
                json={
                    "display_name": display_name,
                    "world_prompt": {
                        "type": "text",
                        "text_prompt": scene_description,
                    },
                    "model": model,
                },
            )
            response.raise_for_status()
            data = response.json()
            operation_id = data["operation_id"]
            logger.info("World generation started: operation_id=%s", operation_id)
            return operation_id

    async def poll_status(self, operation_id: str) -> dict:
        """Poll until generation is done. Returns the world result dict."""
        async with httpx.AsyncClient(timeout=30) as client:
            for attempt in range(MAX_POLL_ATTEMPTS):
                response = await client.get(
                    f"{BASE_URL}/operations/{operation_id}",
                    headers=self._headers,
                )
                response.raise_for_status()
                data = response.json()

                if data.get("done"):
                    if data.get("error"):
                        raise RuntimeError(f"World generation failed: {data['error']}")
                    logger.info(
                        "World generation complete: operation_id=%s (attempt %d)",
                        operation_id,
                        attempt + 1,
                    )
                    return data["response"]

                logger.debug(
                    "Polling operation_id=%s — not done yet (attempt %d)",
                    operation_id,
                    attempt + 1,
                )
                await asyncio.sleep(POLL_INTERVAL_S)

            raise TimeoutError(
                f"World generation timed out after {MAX_POLL_ATTEMPTS * POLL_INTERVAL_S}s"
            )

    async def get_world_assets(self, world_id: str) -> dict:
        """Fetch world details including asset URLs."""
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                f"{BASE_URL}/worlds/{world_id}",
                headers=self._headers,
            )
            response.raise_for_status()
            return response.json()

    @staticmethod
    def get_splat_url(world_data: dict, resolution: str = "500k") -> str | None:
        """Extract the SPZ URL for a given resolution from world data.

        resolution: '100k' | '500k' | 'full'
        """
        urls = world_data.get("assets", {}).get("splats", {}).get("spz_urls", [])
        for url in urls:
            if resolution in url:
                return url
        # Fallback: return last URL (usually highest quality)
        return urls[-1] if urls else None
