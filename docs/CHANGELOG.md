# Changelog

All notable changes to this project will be documented in this file.

Each entry includes what changed, why it was changed, and which files were affected.

---

## [Session 8] - 2026-02-07 16:45

### Changed
- **Glassmorphic beacon marker replacing solid cylinder** — Removed the opaque polygon cylinder (`pointsData`) and built a custom Three.js beacon via `objectsData` + `objectThreeObject`. The beacon is a hollow open-ended tube with a custom GLSL shader: quadratic height-based alpha fade (solid at base, transparent at top), fresnel edge brightening for glass refraction illusion, additive blending for natural glow, double-sided rendering so the hollow center is visible. Includes a soft base glow disc (RingGeometry with additive blend) and a faint inner core glow line. Slight top-to-bottom taper for visual interest.
  - `frontend/src/components/Globe.tsx`
- **Enhanced ring ripples** — Replaced single ring with triple-layer concentric ripples at different speeds and radii (3.5/5.5/8 maxR, staggered repeat periods) for a richer pulsing effect around the beacon base
  - `frontend/src/components/Globe.tsx`

### Notes
- Used `objectsData` API (positions + orients automatically at lat/lng) instead of `customLayerData` (manual positioning) — much cleaner
- Three.js r182 confirmed available via react-globe.gl dependency
- Beacon mesh is cached and cloned per data-join for performance
- GLSL shaders defined as module-level constants to avoid re-creation

---

## [Session 7] - 2026-02-07 16:00

### Added
- **"Travel to..." pill with forward geocoding** — Dark glassmorphic pill sits above the location card. Click to enter a place name, press Enter to geocode via Nominatim, which moves the globe marker + camera and updates the location card. Escape or blur closes without action.
  - `frontend/src/components/TravelTo.tsx`
  - `frontend/src/utils/geocode.ts`
  - `frontend/src/App.tsx`

### Changed
- **LocationCard — dark glassmorphic styling, blue coordinates, pill shape** — Switched from light glass to dark glass (`rgba(0,0,0,0.45)` + blur), changed coordinate color from cyan to `#7db8ff`, bold Plus Jakarta Sans, rounded-full pill, increased padding
  - `frontend/src/components/LocationCard.tsx`
- **GlobeControls — dark glassmorphic buttons** — Matched Color/Labels buttons to the same dark glass style as the time-wheel pills
  - `frontend/src/components/GlobeControls.tsx`
- **Globe pin + ring color** — Changed from cyan `#00d4ff` to matching blue `#7db8ff`
  - `frontend/src/components/Globe.tsx`
- **Starfield particle tuning** — Reduced speed/size back to calm baseline, added rare shooting star streaks (3 particles, speed 3–8, long delay between spawns)
  - `frontend/src/components/Starfield.tsx`
  - `frontend/src/components/landing/LandingWarp.tsx`
- **Color mode brightness** — Reduced from 0.8 to 0.7 for a slightly dimmer, less washed-out globe
  - `frontend/src/index.css`

---

## [Session 6] - 2026-02-07 15:15

### Added
- **Animated starfield behind the globe** — Replaced the static dark radial gradient with a live tsParticles starfield matching the landing page aesthetic. The globe canvas is transparent so stars drift gently behind it, creating a cohesive "globe floating in space" look.
  - `frontend/src/components/Starfield.tsx` (new reusable component)
  - `frontend/src/index.css` (added `.starfield-bg` styles)
  - `frontend/src/App.tsx` (integrated Starfield inside `.globe-bg`)

### Notes
- Engine initialization is module-level guarded — safe even if both LandingWarp and Starfield mount (no double-init)
- Globe starfield uses slightly fewer particles (300 vs 380) and slower speed (0.5 vs 1.2) than the landing page for a calmer ambient feel that doesn't compete with the globe itself
- `pointer-events: none` on the starfield layer ensures it never interferes with globe interaction

---

## [Session 5] - 2026-02-07 15:00

### Changed
- **Globe auto-rotate speed increased** — Idle drift was too slow at 0.4; bumped to 0.8 for a more dynamic feel when not actively orbiting
  - `frontend/src/components/Globe.tsx`
- **Default tile mode changed to color** — Globe now opens in Voyager color mode instead of dark grayscale after the landing warp, making the first impression more vibrant
  - `frontend/src/store.ts`

---

## [Session 4] - 2026-02-07 14:30

### Fixed
- **Particles too slow/static** — Increased idle move speed from 0.3 to 1.2 and twinkle animation speed from 0.5 to 0.8 so the starfield feels alive instead of frozen
  - `frontend/src/components/landing/LandingWarp.tsx`
- **Keyboard input not registering** — Three root causes fixed: (1) tsParticles canvas was stealing pointer/keyboard focus, now has `pointer-events: none`; (2) overlay div now has `tabIndex={-1}` with auto-focus on mount and re-focus on click; (3) tsParticles interactivity events explicitly disabled in options
  - `frontend/src/components/landing/LandingWarp.tsx`
  - `frontend/src/components/landing/LandingWarp.css`
- **Warp animation not working / not transitioning to globe** — CSS custom property inheritance was unreliable across browsers. Switched from setting `--warp-*` variables on the parent to direct inline `style.transform` / `style.filter` / `style.opacity` on individual DOM refs (`starsRef`, `vignetteRef`, `glowRef`, `flashRef`, `portalAreaRef`). Also added strict-mode guard on `initParticlesEngine` to prevent double initialization.
  - `frontend/src/components/landing/LandingWarp.tsx`
  - `frontend/src/components/landing/LandingWarp.css`

### Notes
- Direct DOM manipulation (refs + inline styles) in the rAF loop is more reliable than CSS variable inheritance for cross-element animation
- `pointer-events: none` on the entire `.lw-stars` layer plus explicit `interactivity: { events: { onHover/onClick: false } }` ensures tsParticles never intercepts user input

---

## [Session 3] - 2026-02-07 14:00

### Added
- **Cinematic landing experience (LandingWarp)** — Implements the "hyperspace year entry" landing page: tsParticles starfield, glassmorphic portal, keyboard year input, and a Star Wars–style warp-to-globe transition. Phase machine (idle → collapse → warp → fade → done) runs in ~1.2s via rAF-driven CSS custom properties for GPU-accelerated blur/scale/brightness. Particles are nudged toward center each frame for genuine "star rush" effect. Supports prefers-reduced-motion (skip to fade). Micro-shake on empty Enter, caret blink, digit pop animation.
  - `frontend/src/components/landing/LandingWarp.tsx`
  - `frontend/src/components/landing/LandingWarp.css`
- **tsParticles dependencies** — `@tsparticles/react` and `@tsparticles/slim` for canvas-based starfield rendering
  - `frontend/package.json`

### Changed
- **App.tsx — Landing overlay integration** — Globe now renders underneath the landing overlay (pre-loading tiles in background). On warp completion, the chosen year is set in the selection store and phase transitions to 'globe', revealing the globe with UI controls. Clean handoff via `onComplete(year)` callback.
  - `frontend/src/App.tsx`
- **store.ts — Default phase changed to 'landing'** — App now starts with the cinematic landing experience instead of jumping directly to the globe
  - `frontend/src/store.ts`

### Notes
- Used CSS custom properties driven by rAF (not React state) for all warp animations to avoid re-renders and maintain 60fps
- Particle position manipulation via `container.particles.filter(() => true)` since the internal array is private in tsParticles v3
- Globe loads in background during landing phase so tiles are pre-cached when the warp fade reveals it
- Year input clamped to [1, 2026] silently per spec; selection store handles era/meta derivation

---

## [Unreleased]

### Added
- **Project documentation** — Establish shared understanding of scope, architecture, and execution plan before writing any code
  - `docs/PRD.md`
  - `docs/TECHNICAL.md`
  - `docs/ROADMAP.md`
  - `docs/CHANGELOG.md`

---

## [Session 10] - 2026-02-07

### Fixed
- **Gemini text formatting breaking TTS readability** — Gemini occasionally output text with newlines, ellipsis (`...`), and markdown formatting (asterisks, headers, backticks). TTS engines would skip lines or read formatting characters awkwardly. Two-part fix: (1) Added explicit "CRITICAL output rules" to the Gemini system prompt instructing plain spoken prose only — no markdown, no line breaks, no ellipsis, no special characters. (2) Added `_sanitize_for_tts()` function as a safety net that strips any formatting that slips through before text reaches TTS (collapses whitespace, removes markdown, replaces `...` with comma).
  - `backend/services/gemini_guide.py` — Added TTS output rules to `GUIDE_SYSTEM_PROMPT`
  - `backend/routers/voice.py` — Added `_sanitize_for_tts()` function, applied to text before `tts_stream.send_text()`

- **Sentence splitting under heavy barge-in** — When the user interrupted and spoke, their sentence was split into 2-3 separate turns (e.g. "No, no, you can tell me about Germany. Sorry, I interrupted you there before" became three turns). Root cause: after an interrupt, STT fragments arrive in bursts as the mic picks up both the tail of TTS audio and the user's actual speech. The standard 0.5s debounce was too short — fragments would pause just long enough to fire a premature turn. Fix: after a barge-in interrupt, use a longer debounce window (1.5s instead of 0.5s) for 3 seconds, giving the user time to finish their thought before a turn fires.
  - `backend/routers/voice.py` — Added `TURN_DEBOUNCE_AFTER_INTERRUPT_S = 1.5`, `INTERRUPT_DEBOUNCE_WINDOW_S = 3.0`, `last_interrupt_at` shared variable. Interrupt handler records timestamp. Debounced turn firing selects debounce duration based on time since last interrupt. Logs show which debounce mode was used.

### Changed
- **Archived frontend test UI and removed conflicting config for clean merge with EJ's frontend** — Since `frontend/` doesn't exist on `main`, both Matt's and EJ's branches add the entire directory. Any shared filenames (App.tsx, main.tsx, package.json, vite.config.ts, tsconfig.json, index.html) would conflict. Removed all files EJ will provide, archived Matt's test UI for reference, and kept only the unique voice pipeline files that won't conflict.
  - `frontend/src/App.tsx` → `frontend/src/_archived/TestApp.tsx` (archived)
  - `frontend/src/main.tsx` → `frontend/src/_archived/test-main.tsx` (archived)
  - `frontend/index.html` — Deleted (EJ provides)
  - `frontend/package.json` — Deleted (EJ provides)
  - `frontend/vite.config.ts` — Deleted (EJ provides; WS proxy config documented in integration notes)
  - `frontend/tsconfig.json` — Deleted (EJ provides)
  - `frontend/src/vite-env.d.ts` — Deleted (EJ provides)

### Added
- **Post-merge voice integration guide** — Created `docs/VOICE_INTEGRATION.md` documenting everything EJ needs to wire up Matt's voice pipeline into his frontend: Vite WS proxy config, React hook usage, event listeners for world/fact/music/location, context/phase sending, AudioWorklet serving requirements, and TypeScript config notes.
  - `docs/VOICE_INTEGRATION.md` — New file

---

## [Session 9] - 2026-02-07

### Added
- **Gemini integration analysis doc** — Created `docs/GEMINI_INTEGRATION.md` documenting the full voice pipeline flow, Gemini conversation history mechanics, function calling protocol, all 4 tool call definitions, and session state architecture. Written as reference for both team members.
  - `docs/GEMINI_INTEGRATION.md` — New file

- **Response isolation with responseId** — Added `responseId` tagging to `audio` and `guide_text` WebSocket messages. Backend sends `response_start` before each new response. Frontend tracks `activeResponseId` and drops audio/text from stale (cancelled) responses that are still in-flight in the WebSocket pipe. This prevents jumbled audio when rapidly interrupting — old audio chunks arriving after an interrupt are silently dropped instead of being played.
  - `backend/routers/voice.py` — Sends `{type: "response_start", responseId}` before each response. Tags `audio` and `guide_text` messages with `responseId`.
  - `frontend/src/audio/VoiceConnection.ts` — Added `activeResponseId` tracking. On `response_start`: sets active ID. On `audio`/`guide_text`: drops if `responseId` doesn't match active. On interrupt (frontend or backend): clears `activeResponseId` so all in-flight audio is rejected.

### Fixed
- **Function calls now produce voice responses** — When Gemini made a function call (e.g. `suggest_location`, `trigger_world_generation`), the function was executed but Gemini was never called again to generate the follow-up voice response. The guide would go silent after any tool use. Fixed by adding a function-call loop in `_process_gemini_response()`: after executing function calls and adding results to history, Gemini is called again (with `user_text=None`) to produce the natural language follow-up. Loop runs up to `MAX_FUNCTION_ROUNDS=3` to support chained calls.
  - `backend/routers/voice.py` — Wrapped Gemini streaming in a `for round_num in range(MAX_FUNCTION_ROUNDS + 1)` loop. Tracks `function_calls_this_round`; breaks on pure text response; continues with `input_text=None` after function calls.
  - `backend/services/gemini_guide.py` — Made `user_text` parameter optional (`str | None = None`). When `None`, skips appending a user message and calls Gemini with the existing history (which contains the function result from `add_function_result()`).

- **Graceful TTS teardown on interrupt** — Per Gradium best practices, now sends `end_of_stream` to TTS before closing the WebSocket on interrupt/cancellation. Previously just closed abruptly. The `end_of_stream` signal helps Gradium free the session faster, reducing concurrency limit issues during rapid interrupt cycles.
  - `backend/routers/voice.py` — `finally` block in `_process_gemini_response()` now calls `tts_stream.send_flush()` before `tts_stream.close()`

### Changed
- **Cleaned up debug logging in gemini_guide.py** — Replaced verbose `print()` statements with structured `logger.info()` and `logger.debug()` calls. Key milestones logged at INFO level, history dumps at DEBUG level.
  - `backend/services/gemini_guide.py` — All `print(f"[GEMINI_GUIDE]...")` → `logger.info/debug(...)`

---

## [Session 6/7/8] - 2026-02-07

### Added
- **Client-side voice activity detection for instant barge-in** — AudioWorklet now computes RMS energy on every audio frame. When voice is detected above threshold (0.015) while TTS is playing, the frontend immediately stops playback and sends an `interrupt` message to the backend. This is ~100ms latency vs 300-600ms for waiting on STT transcripts.
  - `frontend/public/audio-processor.js` — Added RMS computation, `VOICE_THRESHOLD=0.015`, `VOICE_COOLDOWN_MS=300`, posts `{type: "voice_activity", rms}` messages alongside PCM chunks
  - `frontend/src/audio/AudioCaptureService.ts` — Added optional `onVoiceActivity` callback parameter to `start()`. Distinguishes `ArrayBuffer` (PCM data) from `{type: "voice_activity"}` objects in worklet port messages
  - `frontend/src/audio/AudioPlaybackService.ts` — Added `isPlaying` getter (checks `scheduledSources.length > 0`) so VoiceConnection can detect when guide audio is active
  - `frontend/src/audio/VoiceConnection.ts` — Wired voice activity callback: when mic activity detected while `playback.isPlaying`, instantly calls `playback.interrupt()` and sends `{type: "interrupt"}` to backend

- **Backend frontend-interrupt handler** — Backend now processes `{type: "interrupt"}` messages from the frontend. When received, cancels any active Gemini/TTS response task immediately. Previously, interrupts could only come from STT-based barge-in detection.
  - `backend/routers/voice.py` — Added `elif msg_type == "interrupt"` handler in main WebSocket loop

- **Comprehensive logging across full pipeline** — Added detailed timestamped logging to trace every message through the pipeline. Enables debugging of timing issues between STT, VAD, Gemini, and TTS.
  - `backend/routers/voice.py` — `[timestamp][VOICE]`, `[timestamp][STT]`, `[timestamp][VAD]`, `[timestamp][GEMINI]`, `[timestamp][TTS]`, `[timestamp][FE→STT]`, `[timestamp][FE→BE]`, `[timestamp][WS→FE]` log prefixes. VAD logs show all qualifying horizons, buffer state, and trigger status. Turn counting. Session stats on disconnect.
  - `backend/services/gemini_guide.py` — Logs full conversation history dump before each Gemini call (role, parts summary for each entry), system prompt preview, input text, stream progress, chunk count, function calls
  - `frontend/src/audio/VoiceConnection.ts` — `[VC→BE]` outbound and `[BE→VC]` inbound logging with message sequence numbers, audio chunk counters, status transitions, cleanup stats

- **TTS retry with backoff for concurrency limits** — Gradium has a 2-session concurrency limit per API key, and closed sessions take time to free on their servers. When TTS creation fails with "Concurrencylimit exceeded", the backend now retries up to 3 times with 3-second delays instead of immediately falling back to text-only mode.
  - `backend/routers/voice.py` — `_process_gemini_response()` TTS creation wrapped in retry loop with `ConnectionError` detection for "Concurrencylimit" substring

### Fixed
- **Premature VAD turn detection splitting sentences** — Root cause: The 1.0s VAD horizon fires on brief inter-word pauses (~500ms between "the" and "world"), triggering a turn before the user finishes their sentence. The 2.0s horizon stays low (0.22) during these same gaps. Changed `VAD_MIN_HORIZON_S` from 1.0 to 2.0 and `VAD_INACTIVITY_THRESHOLD` from 0.5 to 0.7 so only sustained silence triggers a turn.
  - `backend/routers/voice.py` — `VAD_MIN_HORIZON_S = 2.0`, `VAD_INACTIVITY_THRESHOLD = 0.7`

- **False barge-in from trailing STT words** — Root cause: When VAD fires a turn, the STT pipeline still has words in flight. These arrive 0-150ms later and were treated as the user interrupting (barge-in), which cancelled the just-launched Gemini response. The late word then became its own broken turn with fragmentary text (e.g., "me all" instead of "Yeah, take me, tell me all about it"). Two-part fix:
  1. **Removed STT-based barge-in entirely** — Incoming STT transcripts during an active response no longer trigger cancellation. Barge-in is now handled exclusively by the frontend mic activity detection, which is faster and doesn't suffer from pipeline lag.
  2. **Debounced turn firing** — When VAD crosses the inactivity threshold, the turn is marked as "ready" but not immediately fired. It waits 500ms (`TURN_DEBOUNCE_S = 0.5`) for the STT pipeline to deliver any remaining words. Only after 500ms of no new STT words does the turn actually fire with the complete sentence.
  - `backend/routers/voice.py` — Added `TURN_DEBOUNCE_S = 0.5`, `turn_ready` flag, `last_stt_word_at` timestamp. Removed barge-in from STT transcript handler. Added debounced turn check after every STT message.

- **Gemini function call history not saved** — Root cause: `generate_response()` recorded model responses in conversation history with only `text` parts, ignoring `function_call` parts. When the model called `suggest_location`, the history entry was empty (`model:` with no parts), breaking Gemini's expected conversation flow (model function_call → user function_response → model text).
  - `backend/services/gemini_guide.py` — Model response history now includes both `types.Part(text=...)` and `types.Part(function_call=types.FunctionCall(name=..., args=...))` parts

- **TTS concurrency exhaustion from rapid barge-in cycles** — Root cause: False barge-in caused rapid create→cancel→create TTS session cycles. Each cancelled session took time to free on Gradium's servers, exhausting the 2-session limit. The debounced turn firing fix prevents most rapid cycles, and the TTS retry with backoff handles remaining cases.
  - `backend/routers/voice.py` — Combination of debounce fix (fewer cancellations) + retry logic (graceful recovery)

### Notes
- The debounced turn firing adds ~500ms latency to response start (waiting for STT to settle), but eliminates split sentences which caused much worse UX (broken turns, wasted Gemini calls, TTS session churn)
- Frontend mic activity detection provides faster interrupt response (~100ms) than the old STT-based barge-in (~300-600ms) since it operates directly on audio energy without waiting for speech recognition
- Gradium has no session management API — no way to list, kill, or reset sessions. Leaked sessions persist for 300 seconds before auto-expiring. The retry logic is the only mitigation.
- Gemini conversation history entry [4] in previous logs showed `model:` with empty parts — this was the function call history bug. Fixed entries now show `model: fn_call:suggest_location, text:"..."` correctly.
- AudioWorklet voice activity uses 300ms cooldown to prevent rapid-fire interrupt messages from continuous speech

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
