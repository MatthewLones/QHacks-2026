# Roadmap — 24-Hour Hackathon Execution Plan

> **Team:** 2 people
> **Person A:** Frontend (React, Globe, SparkJS, UI/UX, audio)
> **Person B:** Backend (FastAPI, Gradium, Gemini, World Labs, music curation)

---

## Phase 1: Foundation (Hours 0–4)

**Goal:** Scaffolds running, voice pipeline working end-to-end standalone.

| Hour | Person A (Frontend) | Person B (Backend) |
|------|--------------------|--------------------|
| 0–1 | Scaffold Vite + React + TS + Tailwind + Zustand. Set up file structure, `.gitignore`, basic `App.tsx` with phase routing | Scaffold FastAPI project. Install `gradium`, `google-genai`, `httpx`, `python-dotenv`. Create `.env` with all API keys. Verify each API key works with a simple test call |
| 1–2 | **Landing page:** tsParticles star field (cosmic preset), glassmorphism "Enter" button centered, fade transition on click. Add ambient audio autoplay | **Gradium service:** Connect to STT WebSocket, send test audio, receive transcript. Connect to TTS WebSocket, send test text, receive audio. Verify both work standalone |
| 2–3 | **Globe component:** Globe.gl rendering, click handler for location selection, glow effect on selected point, location name display | **Gemini guide service:** Set up system prompt, implement `generate_response()` with streaming, define function calling tool schemas (world gen, music, facts) |
| 3–4 | **Time selector:** Vertical scroll/wheel UI showing eras from 3000 BC to present. Era labels, visual indicator for selected period. Wire to Zustand store | **Voice WebSocket router:** Wire the full pipeline — receive audio → Gradium STT → transcript → Gemini → response text → Gradium TTS → audio out. Test with a WebSocket client |

### Milestone 1: Voice pipeline end-to-end
> Person B can speak into a WebSocket client, get a Gemini-powered AI guide response back as audio via Gradium. Person A has landing page + globe + time selector rendering.

---

## Phase 2: Core Integration (Hours 4–10)

**Goal:** Frontend and backend connected. Full user flow works from globe to world rendering.

| Hour | Person A (Frontend) | Person B (Backend) |
|------|--------------------|--------------------|
| 4–5 | **AudioWorklet:** Adapt `audio-processor.js` from KingHacks2026 (change to 24kHz). Create `useAudioCapture` hook for mic access + chunk streaming | **World Labs service:** Implement `generate_world()`, `poll_status()`, `get_assets()`. Test with a text prompt, verify world generates and returns SPZ URL |
| 5–6 | **WebSocket hook:** Create `useVoiceWebSocket` — connect to backend, send audio chunks, receive transcript/audio/status messages. Wire to Zustand | **World Labs + voice integration:** When Gemini calls `trigger_world_generation`, start generation. Send status updates back through WebSocket. Handle async polling |
| 6–7 | **Voice ↔ Globe integration:** Send selected location/time to backend via WebSocket `context` message. Show transcript + guide text in UI. Add mic button toggle | **Music selector:** Build track metadata index from curated library. Implement Gemini function call handler for `select_music` — match era/region/mood to track, return URL |
| 7–8 | **Loading experience:** Design transition animation (fade + particles). Show AI narration text with typewriter effect. Add progress bar for world generation status | **Narration mode:** When world starts generating, switch Gemini system prompt to narration mode (longer, storytelling responses). Stream narration text to frontend |
| 8–9 | **SparkJS prototype:** Set up Three.js scene + SparkJS. Load a test SPZ file. Get camera controls working (OrbitControls). Verify rendering works | **Voice pipeline polish:** Handle VAD-based turn detection, edge cases (empty transcripts, connection drops), improve response streaming latency |
| 9–10 | **World Explorer component:** Replace test splat with real World Labs splat URL. Handle loading states. Wire phase transition from loading → exploring when world is ready | **World status endpoint:** REST endpoint for frontend to poll world status independently. Serve splat URLs. Handle generation failures gracefully |

### Milestone 2: Full flow works
> User can: Land → Enter → See globe → Click location → Pick era → Talk to AI guide → Say "let's go" → See loading experience → World renders in SparkJS.

---

## Phase 3: Experience Polish (Hours 10–16)

**Goal:** Polished, beautiful, demo-ready experience.

| Hour | Person A (Frontend) | Person B (Backend) |
|------|--------------------|--------------------|
| 10–11 | **Music player:** Web Audio API integration, play tracks from `/public/music/`, volume control, crossfade between tracks. Wire to `music` WebSocket messages | **Music curation:** Source 15–20 royalty-free tracks from freemusicarchive.org or similar. Tag each with era/region/mood metadata. Download and add to repo |
| 11–12 | **Facts overlay:** Floating glass cards that animate in from the side during exploration. Auto-dismiss after 8 seconds. Wire to `fact` WebSocket messages | **Fact generation:** Implement `generate_fact` function call handler in Gemini service. Periodically trigger during exploration phase (every 30–45 seconds) |
| 12–13 | **Phase transitions:** Smooth CSS/Framer Motion animations between all phases. Landing fade-out, globe scale-in, loading cinematic transition, world reveal | **End-to-end testing:** Test complete flow multiple times. Fix integration bugs. Verify all WebSocket message types work correctly |
| 13–14 | **Voice UI polish:** Pulsing mic indicator when listening, waveform visualization when AI speaks, conversation transcript panel (collapsible) | **Voice quality:** Tune Gemini system prompt for better responses. Adjust Gradium voice parameters (speed, stability). Test different Gradium voices |
| 14–15 | **Visual polish:** Color palette refinement, typography, hover states, responsive layout. Glassmorphism consistency. Dark theme throughout | **Error handling:** Reconnection logic for WebSocket drops. Graceful degradation if World Labs fails (show panorama fallback). API rate limit handling |
| 15–16 | **Loading experience enhancement:** Add more visual elements — animated constellation lines, glowing orbs, historical imagery fade-ins | **Pre-generate demo worlds:** Generate 2–3 worlds for demo (e.g., Rome 80 AD, Kyoto 1600, Cairo 2500 BC). Store world IDs for instant loading |

### Milestone 3: Demo-ready
> Experience is polished, visually beautiful, and works reliably. 2–3 pre-generated worlds available for instant demo.

---

## Phase 4: Demo Prep (Hours 16–20)

| Hour | Person A (Frontend) | Person B (Backend) |
|------|--------------------|--------------------|
| 16–17 | Cross-browser testing (Chrome, Firefox, Safari). Performance profiling. Fix any rendering issues | Deploy backend to Railway/Render. Configure production environment variables. Test WebSocket connectivity over HTTPS |
| 17–18 | Deploy frontend to Vercel. Set `VITE_API_URL` to production backend. Verify full flow on deployed version | Stress test voice pipeline on production. Monitor API usage/credits. Add request logging |
| 18–19 | Bug fixes from production testing. Final visual adjustments. Ensure pre-generated worlds load smoothly | Bug fixes. Verify all API integrations work in production. Set up monitoring |
| 19–20 | **Demo script:** Write exact flow for presentation. Practice transitions. Prepare talking points for judges | **Demo script:** Practice together. Identify backup plans for each potential failure point |

---

## Phase 5: Buffer + Final (Hours 20–24)

| Hour | Both |
|------|------|
| 20–22 | Fix remaining bugs. Polish animations. Prepare backup demo plan (recorded video of working flow). Update README with project description + screenshots |
| 22–23 | Final rehearsal on production. Verify pre-generated worlds still load. Test voice pipeline reliability. Clear conversation state for clean demo |
| 23–24 | **Present / Submit** |

---

## Risk Mitigation Matrix

| Risk | Likelihood | Impact | Mitigation | Fallback |
|------|-----------|--------|------------|----------|
| World Labs generation takes >5 min | Medium | High | Rich loading experience makes wait feel intentional | Pre-generate all demo worlds, never generate live |
| World Labs free tier runs out (4/month) | High | Critical | Buy credits early ($5 min). Test with 1 world, save rest for demo | Pre-generate worlds before hackathon starts |
| Gradium API down or flaky | Low | Critical | Test early, report issues to support | Text input fallback — type instead of speak, display Gemini text instead of TTS |
| SparkJS fails to render | Medium | High | Prototype in Hour 8–9, catch issues early | Display World Labs panorama image as static background |
| Voice latency >3 seconds | Medium | Medium | Optimize chunk sizes, use streaming, show transcript while audio loads | Acceptable for demo if transcript appears fast |
| Gemini rate limits hit | Low | Medium | Cache responses for repeated queries | Reduce function calling frequency |
| WebSocket drops during demo | Medium | High | Auto-reconnect logic in frontend + backend | Refresh page (fast with pre-generated worlds) |

---

## MVP Cut List (If Behind Schedule)

If running out of time, cut in this order (last item cut first):

1. Facts overlay (stretch goal)
2. Music crossfade transitions (just hard-switch tracks)
3. Loading experience visual enhancements (keep narration, drop fancy visuals)
4. Time selector scroll animation (use a simple dropdown instead)
5. Globe.gl (use a static map image with click regions instead)

**Never cut:**
- Voice pipeline (Gradium + Gemini) — this IS the project
- World Labs generation + SparkJS rendering — this IS the wow factor
- Landing page — first impression for judges
