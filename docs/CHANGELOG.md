# Changelog

All notable changes to this project will be documented in this file.

Each entry includes what changed, why it was changed, and which files were affected.

---

## [Unreleased]

### Added
- **Project documentation** — Establish shared understanding of scope, architecture, and execution plan before writing any code
  - `docs/PRD.md`
  - `docs/TECHNICAL.md`
  - `docs/ROADMAP.md`
  - `docs/CHANGELOG.md`

---

## [Session 4/5] - 2026-02-07

### Added
- **Production voice pipeline client** — Built the production-grade browser audio layer for the voice pipeline. Uses AudioWorklet (not deprecated ScriptProcessorNode) for mic capture, gapless Web Audio API scheduling for TTS playback, and a framework-agnostic TypeScript architecture that EJ can integrate into the visual frontend.
  - `frontend/public/audio-processor.js` — AudioWorklet processor: 24kHz Float32→Int16 PCM, 1920-sample (80ms) chunks on the audio rendering thread
  - `frontend/src/audio/AudioCaptureService.ts` — Mic → AudioWorklet → PCM chunk callback. Creates 24kHz AudioContext (native Gradium STT rate, no resampling). Handles getUserMedia, AudioWorklet loading, GC-safe node refs
  - `frontend/src/audio/AudioPlaybackService.ts` — TTS PCM → gapless 48kHz speaker playback. Int16→Float32 conversion, AudioBufferSourceNode scheduling with `nextStartTime` tracking, interrupt support
  - `frontend/src/audio/VoiceConnection.ts` — WebSocket orchestrator: ties capture + playback to backend `/ws/voice` protocol. Handles all message types (audio, transcript, guide_text, fact, world_status, music, suggested_location). Event emitter pattern for framework-agnostic use
  - `frontend/src/hooks/useVoiceConnection.ts` — Thin React hook wrapping VoiceConnection. Exposes status, transcripts, guideTexts as React state. Lifecycle cleanup on unmount
  - `frontend/src/App.tsx` — Minimal one-button test UI: Connect/Disconnect + transcript/guide text log panels
  - `frontend/package.json` — Vite + React 19 + TypeScript 5.7
  - `frontend/tsconfig.json` — Strict mode, ES2022 target
  - `frontend/vite.config.ts` — React plugin + WebSocket proxy (`/ws` → `http://localhost:8000`)
  - `frontend/index.html` — HTML shell
  - `frontend/src/main.tsx` — React root mount
  - `frontend/src/vite-env.d.ts` — Vite type declarations

### Changed
- **TECHNICAL.md — Corrected API formats** — Fixed multiple documentation errors discovered during live API testing (Session 3/4)
  - `docs/TECHNICAL.md`
- **ROADMAP.md — Reordered Phase 2, checked off Phase 1 Backend** — All Phase 1 Backend tasks marked complete. Added new "Matt (Voice Client)" section to Phase 2 — audio pipeline work pulled forward from EJ's scope so the full voice round-trip is proven before EJ starts visual frontend. Milestone 1 marked complete (27/27 tests).
  - `docs/ROADMAP.md`
- **backend/main.py — Removed /test route** — Throwaway test page replaced by production frontend
  - `backend/main.py`

### Removed
- **backend/static/test.html** — Throwaway browser test page with ScriptProcessorNode (deprecated, had GC bugs in Chrome causing zero audio). Replaced by production AudioWorklet-based frontend
  - `backend/static/test.html`
  - `backend/static/` (directory removed)

### Notes
- AudioWorklet chosen over ScriptProcessorNode because: (1) ScriptProcessorNode is deprecated, (2) Chrome GC bug causes audio nodes to be collected even when connected, (3) AudioWorklet runs on a dedicated thread with lower latency
- 24kHz capture AudioContext matches Gradium STT native rate — no client-side resampling needed
- 48kHz playback AudioContext matches Gradium TTS native rate — no client-side resampling needed
- Frontend TypeScript type-checks clean (`tsc --noEmit`), Vite builds clean (201kB gzip: 63kB)
- Previous browser test page debugging identified 3 bugs: (1) getUserMedia permission dialog timing, (2) AudioContext suspended state, (3) ScriptProcessorNode GC. All avoided by AudioWorklet architecture

---

## [Session 3] - 2026-02-07

### Changed
- **ROADMAP.md — Renamed Person A/B to EJ/Matt** — Personalized team references now that roles are assigned.
  - `docs/ROADMAP.md`

### Added
- **Phase 1 Backend — Complete FastAPI scaffolding and voice pipeline** — Implemented all Phase 1 Backend tasks from the ROADMAP: project scaffolding, Gradium STT/TTS service, Gemini Guide service with function calling, World Labs service (stub), Music Selector service (stub), Voice WebSocket router (full pipeline), REST world generation endpoints, and comprehensive test suite.
  - `backend/main.py` — FastAPI app with CORS, health endpoint, router mounts
  - `backend/config.py` — Environment variable loading from `.env`
  - `backend/requirements.txt` — Python dependencies (fastapi, uvicorn, websockets, gradium, google-genai, httpx, python-dotenv, pytest, pytest-asyncio)
  - `backend/.env.example` — API key template
  - `backend/routers/__init__.py` — Router package init
  - `backend/routers/voice.py` — WebSocket voice pipeline (`/ws/voice`): audio → STT → transcript → VAD turn detection → Gemini → TTS → audio back. Handles function call side-effects (world gen, music, facts, location suggestions)
  - `backend/routers/worlds.py` — REST endpoints: `POST /api/worlds/generate`, `GET /api/worlds/status/{operation_id}`
  - `backend/services/__init__.py` — Services package init
  - `backend/services/gradium_service.py` — Raw WebSocket client for Gradium STT (PCM 24kHz → transcript + VAD) and TTS (text → base64-encoded PCM 48kHz audio JSON)
  - `backend/services/gemini_guide.py` — Gemini 2.5 Flash conversation engine with system prompt, 4 function tools (`trigger_world_generation`, `select_music`, `generate_fact`, `suggest_location`), streaming responses, multi-turn history
  - `backend/services/world_labs.py` — World Labs Marble API client: `generate_world()`, `poll_status()`, `get_world_assets()`, SPZ URL extraction
  - `backend/services/music_selector.py` — Stub music track selector with scoring-based matching
  - `backend/tests/__init__.py` — Tests package init
  - `backend/tests/conftest.py` — Shared pytest fixtures: `requires_gradium`, `requires_gemini`, `requires_world_labs` skip markers, sys.path setup
  - `backend/tests/test_gradium_stt.py` — 3 STT integration tests
  - `backend/tests/test_gradium_tts.py` — 4 TTS integration tests
  - `backend/tests/test_gemini_guide.py` — 6 Gemini tests (4 integration, 2 unit)
  - `backend/tests/test_world_labs.py` — 8 World Labs unit tests (all mocked)
  - `backend/tests/test_voice_pipeline.py` — 6 smoke/unit tests (imports, music selector, FastAPI app, health endpoint)

### Fixed
- **Gradium TTS — Audio was not being received** — Root cause: TTS sends audio as base64-encoded JSON (`{"type": "audio", "audio": "<base64>"}`) not raw binary WebSocket frames. Fixed `iter_audio()` and `receive_audio()` to parse JSON and decode base64. Also fixed flush message from `{"type": "flush"}` to `{"type": "end_of_stream"}` per docs. Added waiting for `{"type": "ready"}` confirmation after setup.
  - `backend/services/gradium_service.py`
- **Gemini — Function calling combined with Google Search caused 400 error** — Root cause: Gemini 2.5 Flash does not support combining `function_declarations` tools with `google_search` tools in the same request (returns `"Tool use with function calling is unsupported by the model"`). Removed Google Search grounding tool; function calling tools work correctly alone.
  - `backend/services/gemini_guide.py`
- **VAD parsing format mismatch** — Root cause: Actual Gradium VAD format is `[{horizon_s, inactivity_prob}, ...]` (list of objects), not `[timestamp, duration, {inactivity_prob}]` as documented in TECHNICAL.md. Updated voice router to iterate over VAD entries correctly.
  - `backend/routers/voice.py`

### Test Results — 27/27 Passing

| # | Test | File | Type | Status | Metric |
|---|------|------|------|--------|--------|
| 1 | `test_stt_connection` | `test_gradium_stt.py` | Integration | PASS | Connection: **0.170s** |
| 2 | `test_stt_receives_vad_on_silence` | `test_gradium_stt.py` | Integration | PASS | VAD entries: 4 horizons (0.5s–3.0s) |
| 3 | `test_stt_transcript_on_audio` | `test_gradium_stt.py` | Integration | PASS | 14 messages (ready + VAD steps) |
| 4 | `test_tts_connection` | `test_gradium_tts.py` | Integration | PASS | Connection: **0.229s** |
| 5 | `test_tts_synthesize_text` | `test_gradium_tts.py` | Integration | PASS | 47 chunks, 360,960 bytes, **3.76s** audio, TTFC: **0.201s** |
| 6 | `test_tts_latency` | `test_gradium_tts.py` | Performance | PASS | TTFC: **0.201s** (target: <0.300s) |
| 7 | `test_tts_chunk_size` | `test_gradium_tts.py` | Integration | PASS | All chunks: **7,680 bytes** (3,840 samples, 80ms @ 48kHz) |
| 8 | `test_gemini_text_response` | `test_gemini_guide.py` | Integration | PASS | TTFC: **0.637s**, 91 chars, streaming text |
| 9 | `test_gemini_function_calling` | `test_gemini_guide.py` | Integration | PASS | 1 function call: `trigger_world_generation`, 4 text chunks |
| 10 | `test_gemini_conversation_history` | `test_gemini_guide.py` | Integration | PASS | 2-turn conversation, 4 history messages, context preserved |
| 11 | `test_gemini_response_latency` | `test_gemini_guide.py` | Performance | PASS | TTFT: **0.901s** (target: <1.0s) |
| 12 | `test_gemini_context_update` | `test_gemini_guide.py` | Unit | PASS | Context merges correctly |
| 13 | `test_gemini_reset` | `test_gemini_guide.py` | Unit | PASS | History clears |
| 14 | `test_app_imports` | `test_voice_pipeline.py` | Smoke | PASS | All modules import |
| 15 | `test_music_selector_exact_match` | `test_voice_pipeline.py` | Unit | PASS | "Glory of the Forum" matched |
| 16 | `test_music_selector_partial_match` | `test_voice_pipeline.py` | Unit | PASS | "Stone Corridors" partial match |
| 17 | `test_music_selector_no_match` | `test_voice_pipeline.py` | Unit | PASS | Fallback returned |
| 18 | `test_fastapi_app_creates` | `test_voice_pipeline.py` | Smoke | PASS | 8 routes registered |
| 19 | `test_health_endpoint` | `test_voice_pipeline.py` | Smoke | PASS | `GET /health` → 200 OK |
| 20 | `test_get_splat_url_500k` | `test_world_labs.py` | Unit | PASS | 500k SPZ URL extracted |
| 21 | `test_get_splat_url_100k` | `test_world_labs.py` | Unit | PASS | 100k SPZ URL extracted |
| 22 | `test_get_splat_url_full` | `test_world_labs.py` | Unit | PASS | Full SPZ URL extracted |
| 23 | `test_get_splat_url_fallback` | `test_world_labs.py` | Unit | PASS | Falls back to last URL |
| 24 | `test_get_splat_url_empty_assets` | `test_world_labs.py` | Unit | PASS | Returns None |
| 25 | `test_get_splat_url_missing_assets` | `test_world_labs.py` | Unit | PASS | Returns None |
| 26 | `test_service_headers` | `test_world_labs.py` | Unit | PASS | `WLT-Api-Key` header set |
| 27 | `test_world_data_structure` | `test_world_labs.py` | Unit | PASS | Schema matches TECHNICAL.md |

### Performance Summary

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Gradium STT connection | < 1s | **0.170s** | PASS |
| Gradium TTS connection | < 1s | **0.229s** | PASS |
| Gradium TTS time-to-first-chunk | < 300ms | **0.201s** | PASS |
| Gradium TTS chunk size | 7,680 bytes (80ms) | **7,680 bytes** | PASS |
| Gemini time-to-first-text | < 1s | **0.637s** | PASS |
| Gemini time-to-first-text (latency test) | < 1s | **0.901s** | PASS |

### API Doc Discrepancies Found
- **Gradium TTS audio format**: Docs confirmed audio arrives as base64-encoded JSON frames (`{"type": "audio", "audio": "..."}`) — not raw binary WebSocket frames. TECHNICAL.md previously implied binary.
- **Gradium TTS flush message**: Correct message is `{"type": "end_of_stream"}`, not `{"type": "flush"}`.
- **Gradium TTS ready message**: Server sends `{"type": "ready", "request_id": "..."}` after setup — must wait before sending text.
- **Gradium STT VAD format**: Actual format is `[{horizon_s: float, inactivity_prob: float}, ...]` — a list of objects per horizon. TECHNICAL.md documented it as `[timestamp, duration, {inactivity_prob}]`.
- **Gradium STT ready message**: Server sends `{"type": "ready", ...}` after setup (undocumented in TECHNICAL.md).
- **Gemini tool compatibility**: `google_search` and `function_declarations` cannot be combined in the same request for `gemini-2.5-flash`. Returns 400 error.
- **Gemini free tier rate limit**: 5 requests/min for `gemini-2.5-flash`. Integration tests must be run with delays between Gemini tests.

### Notes
- All 27 tests pass. Gemini integration tests hit free-tier rate limits (5 req/min) when run consecutively — run individually with ~20s delays or upgrade to paid tier.
- World Labs tests are fully mocked to avoid consuming API credits.
- `backend/venv/` was created with Python 3.12.4 and all dependencies installed successfully.
- FastAPI app serves 8 routes: `/health`, `/ws/voice`, `/api/worlds/generate`, `/api/worlds/status/{operation_id}`, plus OpenAPI docs.

---

## [Session 2] - 2026-02-07

### Changed
- **TECHNICAL.md — Globe integration specification** — Replaced generic Globe.gl reference with detailed react-globe.gl + CartoDB Dark Matter tile engine specification. Added new Section 3 covering: tile engine setup, click-to-coordinate with Nominatim reverse geocoding, marker rendering (pointsData + ringsData), camera fly-to animation, backend-driven location suggestion flow, styling, WebGL context cleanup, and TypeScript typing. Also added `suggest_location` to Gemini function tools, `suggested_location` to WebSocket protocol, `types/` directory to file structure, and updated dependencies from `globe.gl` to `react-globe.gl`.
  - `docs/TECHNICAL.md`
- **PRD.md — Globe & Time Selection phase updated** — Updated Phase 2 user flow to specify react-globe.gl with CartoDB tiles, real map imagery at zoom, glowing markers with pulsing rings, reverse geocoding for location names, AI-driven location suggestions, and glassmorphism info card. Updated MVP feature table with detailed globe description.
  - `docs/PRD.md`
- **ROADMAP.md — Globe tasks expanded** — Replaced generic Globe.gl task with 7 specific react-globe.gl implementation tasks in Phase 1 (tile engine, click handler, markers, fly-to, auto-rotate, type declaration, info card). Added `suggested_location` WebSocket handling and WebGL cleanup tasks to Phase 2 Person A. Added `suggest_location` Gemini function tool to Phase 1 Person B and handler to Phase 2 Person B. Updated MVP cut list.
  - `docs/ROADMAP.md`

### Notes
- Chose react-globe.gl over Mapbox GL JS, CesiumJS, and deck.gl based on: same Three.js stack as SparkJS, no API key needed, all required features (click-to-coordinate, markers, fly-to, tile imagery) built-in, lightweight for hackathon scope.
- CartoDB `dark_nolabels` tiles chosen over `dark_all` because flat text labels distort on a 3D sphere surface.
- Nominatim chosen for reverse geocoding: free, no API key, 1 req/s rate limit is fine for interactive click use.

---

## [Session 1] - 2026-02-07

### Changed
- **CLAUDE.md — Added mandatory changelog update rule** — Ensures every code change is tracked with justification and affected file paths, using the template format from CHANGELOG.md
  - `CLAUDE.md`

---

<!-- Template for new entries:

## [Session X] - YYYY-MM-DD HH:MM

### Added
- **Feature/item name** — Justification for why this was added
  - `path/to/file1.ts`
  - `path/to/file2.py`

### Changed
- **What changed** — Why this change was made
  - `path/to/modified/file.ts`

### Fixed
- **Bug description** — Root cause and how it was resolved
  - `path/to/fixed/file.py`

### Removed
- **What was removed** — Why it was removed
  - `path/to/deleted/file.ts`

### Notes
- Observations, decisions, blockers, or anything worth remembering

-->
