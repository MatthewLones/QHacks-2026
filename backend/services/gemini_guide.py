"""Gemini AI Guide — conversation engine with function calling.

Uses the google-genai SDK with Gemini 2.5 Flash for:
- Streaming text generation with system prompt
- Function calling (world gen, music, facts, location suggestion)
- Google Search grounding for real historical information
- Multi-turn conversation history

See TECHNICAL.md Sections 4-5 for full design.
"""

from __future__ import annotations

import logging
from typing import AsyncGenerator

from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

GUIDE_SYSTEM_PROMPT = """You are a warm, knowledgeable historical guide helping users explore any place \
and time period in human history. You speak conversationally — vivid but concise.

Current context:
- Location: {location_name} ({lat}, {lng})
- Time Period: {time_period} ({year})
- Phase: {phase} (globe_selection | loading | exploring)

Behavior by phase:
- globe_selection: Greet the user. When they select a location/time, share \
2-3 fascinating facts. Ask if they'd like to explore. If they say yes, \
call trigger_world_generation. If the user mentions a place by name, call \
suggest_location with the coordinates.
- loading: Narrate a rich, immersive description of the destination. Tell \
stories. Paint a picture with words. Keep talking until the world is ready. \
Call select_music to queue era-appropriate music.
- exploring: Be a tour guide. Point out features. Answer questions. Share \
facts via generate_fact. Keep responses to 2-3 sentences.

Personality: Enthusiastic but not over-the-top. Scholarly but accessible. \
Think David Attenborough meets a history professor who loves their subject."""


def _build_function_tools() -> list[types.FunctionDeclaration]:
    """Build all Gemini function calling tool declarations."""
    return [
        types.FunctionDeclaration(
            name="trigger_world_generation",
            description="Trigger 3D world generation when the user wants to explore a location/era",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "location": types.Schema(type="STRING", description="The place to generate"),
                    "time_period": types.Schema(type="STRING", description="The historical era"),
                    "scene_description": types.Schema(
                        type="STRING",
                        description="Vivid description of the scene to generate for World Labs",
                    ),
                },
                required=["location", "time_period", "scene_description"],
            ),
        ),
        types.FunctionDeclaration(
            name="select_music",
            description="Select background music that fits the era, region, and mood",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "era": types.Schema(type="STRING", description="Historical era"),
                    "region": types.Schema(type="STRING", description="Geographic region"),
                    "mood": types.Schema(
                        type="STRING",
                        description="Mood of the music",
                        enum=["contemplative", "majestic", "adventurous", "peaceful", "dramatic"],
                    ),
                },
                required=["era", "region", "mood"],
            ),
        ),
        types.FunctionDeclaration(
            name="generate_fact",
            description="Generate a historical fact to display as an overlay card",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "fact_text": types.Schema(
                        type="STRING",
                        description="A concise, interesting historical fact (1-2 sentences)",
                    ),
                    "category": types.Schema(
                        type="STRING",
                        description="Category of the fact",
                        enum=["culture", "technology", "politics", "daily_life", "art"],
                    ),
                },
                required=["fact_text", "category"],
            ),
        ),
        types.FunctionDeclaration(
            name="suggest_location",
            description="Suggest a specific location on the globe for the user to explore. The frontend will place a marker and fly the camera to this location.",
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "lat": types.Schema(type="NUMBER", description="Latitude of the location"),
                    "lng": types.Schema(type="NUMBER", description="Longitude of the location"),
                    "name": types.Schema(
                        type="STRING",
                        description="Human-readable name of the location (e.g., 'Rome, Italy')",
                    ),
                },
                required=["lat", "lng", "name"],
            ),
        ),
    ]


class GeminiGuide:
    """Stateful conversation engine wrapping Gemini 2.5 Flash."""

    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)
        self.conversation_history: list[types.Content] = []
        self.context: dict = {
            "location_name": "Not selected",
            "lat": "",
            "lng": "",
            "time_period": "Not selected",
            "year": "",
            "phase": "globe_selection",
        }

    def update_context(self, **kwargs) -> None:
        """Update guide context (location, time_period, phase, etc.)."""
        self.context.update(kwargs)

    def _system_prompt(self) -> str:
        return GUIDE_SYSTEM_PROMPT.format(**self.context)

    def _build_config(self) -> types.GenerateContentConfig:
        return types.GenerateContentConfig(
            system_instruction=self._system_prompt(),
            tools=[
                types.Tool(function_declarations=_build_function_tools()),
            ],
        )

    async def generate_response(
        self, user_text: str
    ) -> AsyncGenerator[dict, None]:
        """Stream a response from Gemini. Yields dicts:
          {"type": "text", "text": "..."}
          {"type": "function_call", "name": "...", "args": {...}}
        """
        self.conversation_history.append(
            types.Content(role="user", parts=[types.Part(text=user_text)])
        )

        config = self._build_config()

        response = self.client.models.generate_content_stream(
            model="gemini-2.5-flash",
            contents=self.conversation_history,
            config=config,
        )

        full_text = ""
        function_calls = []

        for chunk in response:
            if not chunk.candidates or not chunk.candidates[0].content:
                continue
            for part in chunk.candidates[0].content.parts:
                if part.function_call:
                    fc = {
                        "type": "function_call",
                        "name": part.function_call.name,
                        "args": dict(part.function_call.args) if part.function_call.args else {},
                    }
                    function_calls.append(fc)
                    yield fc
                elif part.text:
                    full_text += part.text
                    yield {"type": "text", "text": part.text}

        # Record model response in history
        parts = []
        if full_text:
            parts.append(types.Part(text=full_text))
        self.conversation_history.append(
            types.Content(role="model", parts=parts)
        )

    def add_function_result(self, name: str, result: dict) -> None:
        """Add function execution result to conversation history."""
        self.conversation_history.append(
            types.Content(
                role="user",
                parts=[
                    types.Part(
                        function_response=types.FunctionResponse(
                            name=name, response=result
                        )
                    )
                ],
            )
        )

    def reset(self) -> None:
        """Clear conversation history for a fresh session."""
        self.conversation_history.clear()
