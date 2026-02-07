"""Voice WebSocket router — the core real-time pipeline.

Full flow (per TECHNICAL.md Section 4):
  Frontend audio chunks → Gradium STT → transcript text
  → Gemini (streaming) → response text → Gradium TTS → audio chunks
  → Frontend playback

Also handles: context updates, phase changes, function call side-effects
(world generation, music selection, fact generation, location suggestions).
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from config import GRADIUM_API_KEY, GEMINI_API_KEY, WORLD_LABS_API_KEY
from services.gradium_service import GradiumService
from services.gemini_guide import GeminiGuide
from services.world_labs import WorldLabsService
from services.music_selector import select_track

logger = logging.getLogger(__name__)
router = APIRouter()

# VAD inactivity threshold — when above this, consider the user done speaking
VAD_INACTIVITY_THRESHOLD = 0.5


async def _send_json(ws: WebSocket, msg: dict) -> None:
    """Send a JSON message to the frontend WebSocket."""
    await ws.send_text(json.dumps(msg))


async def _handle_function_call(
    fc: dict,
    ws: WebSocket,
    gemini: GeminiGuide,
    world_labs: WorldLabsService,
) -> None:
    """Execute a Gemini function call and send results to frontend."""
    name = fc["name"]
    args = fc["args"]
    logger.info("Gemini function call: %s(%s)", name, args)

    if name == "trigger_world_generation":
        await _send_json(ws, {"type": "world_status", "status": "generating"})
        try:
            operation_id = await world_labs.generate_world(
                scene_description=args["scene_description"],
                display_name=f"{args['location']} — {args['time_period']}",
            )
            # Poll in background — send status when done
            asyncio.create_task(
                _poll_world_and_notify(operation_id, ws, world_labs)
            )
            gemini.add_function_result(name, {"status": "generation_started", "operation_id": operation_id})
        except Exception as e:
            logger.error("World generation failed: %s", e)
            await _send_json(ws, {"type": "world_status", "status": "error"})
            gemini.add_function_result(name, {"status": "error", "error": str(e)})

    elif name == "select_music":
        track = select_track(era=args["era"], region=args["region"], mood=args["mood"])
        if track:
            await _send_json(ws, {"type": "music", "trackUrl": track["file"]})
            gemini.add_function_result(name, {"status": "playing", "track": track["title"]})
        else:
            gemini.add_function_result(name, {"status": "no_track_found"})

    elif name == "generate_fact":
        await _send_json(ws, {
            "type": "fact",
            "text": args["fact_text"],
            "category": args["category"],
        })
        gemini.add_function_result(name, {"status": "displayed"})

    elif name == "suggest_location":
        await _send_json(ws, {
            "type": "suggested_location",
            "lat": args["lat"],
            "lng": args["lng"],
            "name": args["name"],
        })
        gemini.add_function_result(name, {"status": "location_suggested"})

    else:
        logger.warning("Unknown function call: %s", name)


async def _poll_world_and_notify(
    operation_id: str, ws: WebSocket, world_labs: WorldLabsService
) -> None:
    """Background task: poll world generation status and notify frontend."""
    try:
        world_data = await world_labs.poll_status(operation_id)
        world_id = world_data.get("id", "")
        splat_url = WorldLabsService.get_splat_url(world_data, resolution="500k")
        await _send_json(ws, {
            "type": "world_status",
            "status": "ready",
            "worldId": world_id,
            "splatUrl": splat_url,
        })
    except Exception as e:
        logger.error("World polling failed: %s", e)
        await _send_json(ws, {"type": "world_status", "status": "error"})


async def _process_gemini_response(
    user_text: str,
    ws: WebSocket,
    gemini: GeminiGuide,
    gradium: GradiumService,
    world_labs: WorldLabsService,
) -> None:
    """Send user text to Gemini, stream response text to TTS and frontend."""
    tts_stream = None
    tts_send_task = None
    tts_recv_task = None

    try:
        tts_stream = await gradium.create_tts_stream()

        # Task: receive TTS audio and forward to frontend
        async def forward_tts_audio():
            async for audio_chunk in tts_stream.iter_audio():
                encoded = base64.b64encode(audio_chunk).decode("ascii")
                await _send_json(ws, {"type": "audio", "data": encoded})

        tts_recv_task = asyncio.create_task(forward_tts_audio())

        # Stream Gemini response
        full_text = ""
        async for chunk in gemini.generate_response(user_text):
            if chunk["type"] == "text":
                text_piece = chunk["text"]
                full_text += text_piece
                # Send text to frontend for display
                await _send_json(ws, {"type": "guide_text", "text": text_piece})
                # Stream text to TTS for audio synthesis
                await tts_stream.send_text(text_piece)

            elif chunk["type"] == "function_call":
                await _handle_function_call(chunk, ws, gemini, world_labs)

        # Signal TTS that we're done sending text
        await tts_stream.send_flush()

        # Wait for all TTS audio to be forwarded
        if tts_recv_task:
            await tts_recv_task

    except Exception as e:
        logger.error("Gemini/TTS pipeline error: %s", e)
    finally:
        if tts_stream:
            await tts_stream.close()


@router.websocket("/ws/voice")
async def voice_ws(websocket: WebSocket):
    """Main voice pipeline WebSocket endpoint."""
    await websocket.accept()
    print("[VOICE] WebSocket connected")

    gradium = GradiumService(api_key=GRADIUM_API_KEY)
    gemini = GeminiGuide(api_key=GEMINI_API_KEY)
    world_labs = WorldLabsService(api_key=WORLD_LABS_API_KEY)

    stt_stream = None
    transcript_buffer = ""

    try:
        print("[VOICE] Creating STT stream...")
        stt_stream = await gradium.create_stt_stream()
        print("[VOICE] STT stream created OK")

        # Task: receive STT messages (transcripts + VAD)
        async def receive_stt():
            nonlocal transcript_buffer
            msg_count = 0
            while True:
                try:
                    msg = await stt_stream.receive()
                    msg_count += 1
                    msg_type = msg.get("type", "unknown")
                    if msg_type not in ("step",):  # don't spam VAD steps
                        print(f"[STT] #{msg_count} type={msg_type}: {str(msg)[:120]}")
                except Exception as e:
                    print(f"[STT] receive error: {e}")
                    break

                if msg.get("type") == "text":
                    text = msg["text"]
                    transcript_buffer += " " + text
                    print(f"[STT] TRANSCRIPT: {text}")
                    await _send_json(websocket, {
                        "type": "transcript",
                        "text": text,
                        "partial": False,
                    })

                elif msg.get("type") == "step":
                    # VAD format: list of {horizon_s, inactivity_prob} objects
                    vad = msg.get("vad", [])
                    max_inactivity = 0.0
                    for entry in vad:
                        if isinstance(entry, dict):
                            max_inactivity = max(
                                max_inactivity, entry.get("inactivity_prob", 0)
                            )
                    if max_inactivity > VAD_INACTIVITY_THRESHOLD and transcript_buffer.strip():
                        # User finished speaking — process the turn
                        user_text = transcript_buffer.strip()
                        transcript_buffer = ""
                        logger.info("Turn detected, user said: %s", user_text[:100])
                        await _process_gemini_response(
                            user_text, websocket, gemini, gradium, world_labs
                        )

        stt_task = asyncio.create_task(receive_stt())
        print("[VOICE] STT receive task started, entering main loop")

        audio_msg_count = 0
        # Main loop: receive messages from frontend
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type")

            if msg_type == "audio":
                # Forward audio to Gradium STT
                pcm_bytes = base64.b64decode(msg["data"])
                audio_msg_count += 1
                if audio_msg_count <= 3 or audio_msg_count % 50 == 0:
                    print(f"[VOICE] Audio chunk #{audio_msg_count}: {len(pcm_bytes)} bytes")
                await stt_stream.send_audio(pcm_bytes)

            elif msg_type == "context":
                # Update Gemini guide context
                location = msg.get("location", {})
                time_period = msg.get("timePeriod", {})
                gemini.update_context(
                    location_name=location.get("name", ""),
                    lat=location.get("lat", ""),
                    lng=location.get("lng", ""),
                    time_period=time_period.get("label", ""),
                    year=time_period.get("year", ""),
                )

            elif msg_type == "phase":
                gemini.update_context(phase=msg.get("phase", "globe_selection"))

    except WebSocketDisconnect:
        print("[VOICE] WebSocket disconnected")
    except Exception as e:
        print(f"[VOICE] ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if stt_stream:
            await stt_stream.close()
        logger.info("Voice WebSocket closed")
