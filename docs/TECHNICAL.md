# Technical Document

> **Project Name:** TBD
> **Last Updated:** 2026-02-07

---

## 1. Tech Stack

| Layer | Technology | Version | Why |
|-------|-----------|---------|-----|
| Frontend Framework | Vite + React + TypeScript | React 19, Vite 6 | Fast dev server, minimal config, strong TS support |
| 3D Globe | Globe.gl | Latest | Three.js-based, lightweight (~200KB), beautiful defaults |
| 3D World Renderer | SparkJS (`@sparkjsdev/spark`) | 0.1.10 | World Labs' recommended Gaussian splat renderer, Three.js-based |
| 3D Engine | Three.js | r170+ | Required by Globe.gl and SparkJS |
| Particle Effects | tsParticles | Latest | Star field on landing page |
| State Management | Zustand | Latest | Minimal boilerplate, no providers, fast |
| Styling | Tailwind CSS v4 | Latest | Rapid prototyping, glassmorphism utilities |
| Backend Framework | Python FastAPI | Latest | WebSocket support, async, Gradium Python SDK compatibility |
| Voice STT | Gradium WebSocket API | Latest | `wss://us.api.gradium.ai/api/speech/asr` |
| Voice TTS | Gradium WebSocket API | Latest | `wss://us.api.gradium.ai/api/speech/tts` |
| LLM Intelligence | Google Gemini API | Gemini 2.5 Flash | Function calling, Google Search grounding, streaming |
| 3D World Generation | World Labs Marble API | v1 | Text → 3D Gaussian splat world |
| Audio Playback | Web Audio API | Native | Browser-native, low-latency audio streaming + music |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   FRONTEND (Vite + React)                │
│                                                          │
│  ┌────────────┐  ┌─────────────┐  ┌───────────────────┐ │
│  │  Landing   │  │  Globe +    │  │  World Explorer   │ │
│  │  (tsParti- │→ │  Time       │→ │  (SparkJS/Three)  │ │
│  │   cles)    │  │  Selector   │  │  + Facts Overlay  │ │
│  └────────────┘  └─────────────┘  └───────────────────┘ │
│                         ↕                                │
│  ┌──────────────────────────────────────────────────────┐│
│  │  Loading Experience (AI narration + visuals + music) ││
│  └──────────────────────────────────────────────────────┘│
│                                                          │
│  ┌──────────────────────────────────────────────────────┐│
│  │  Voice UI: AudioWorklet mic → WebSocket              ││
│  │  Audio Playback: Web Audio API (TTS + music)         ││
│  └──────────────────┬───────────────────────────────────┘│
└─────────────────────┼────────────────────────────────────┘
                      │ WebSocket (bidirectional)
                      │
┌─────────────────────┼────────────────────────────────────┐
│            BACKEND (Python FastAPI)                       │
│                     │                                    │
│  ┌──────────────────┴───────────────────────────┐        │
│  │         Voice WebSocket Router               │        │
│  │                                              │        │
│  │  Audio chunks in                             │        │
│  │    ↓                                         │        │
│  │  Gradium STT (WebSocket)                     │        │
│  │    ↓ transcript                              │        │
│  │  Gemini (streaming text generation)          │        │
│  │    ↓ response text                           │        │
│  │  Gradium TTS (WebSocket)                     │        │
│  │    ↓ audio chunks                            │        │
│  │  Audio chunks out                            │        │
│  └──────────────────────────────────────────────┘        │
│                                                          │
│  ┌───────────────────┐  ┌──────────────────────┐         │
│  │  World Labs       │  │  Music Selector      │         │
│  │  Service          │  │  Service             │         │
│  │  - Generate       │  │  - Track metadata    │         │
│  │  - Poll status    │  │  - LLM selection     │         │
│  │  - Fetch assets   │  │  - Serve track URL   │         │
│  └───────────────────┘  └──────────────────────┘         │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Voice Pipeline (Critical Path)

This is the most complex and important subsystem. The pipeline must feel real-time.

### 3.1 Audio Capture (Frontend)

Adapted from KingHacks2026 AudioWorklet (`KingHacks2026/frontend/renderer/audio-processor.js`).

```
Browser Microphone
  → MediaStream (getUserMedia)
  → AudioContext (sampleRate: 24000)
  → AudioWorkletNode ('audio-stream-processor')
  → Buffers Float32 → Int16 PCM (24kHz, 16-bit, mono)
  → Posts chunks to main thread
  → Main thread sends via WebSocket to backend
```

**Key adaptation from KingHacks:** Change sample rate from 16kHz to 24kHz (Gradium STT requires 24kHz).

### 3.2 Backend Voice Router

```python
# FastAPI WebSocket endpoint
@router.websocket("/ws/voice")
async def voice_ws(websocket: WebSocket):
    await websocket.accept()

    # Open Gradium STT + TTS connections
    stt_ws = await connect_gradium_stt()
    tts_ws = await connect_gradium_tts(voice_id="...")

    # Concurrent tasks:
    # 1. Receive audio from frontend → forward to Gradium STT
    # 2. Receive transcripts from Gradium STT → send to Gemini
    # 3. Receive Gemini response → send to Gradium TTS
    # 4. Receive TTS audio from Gradium → forward to frontend
```

### 3.3 Gradium STT Integration

```python
# WebSocket: wss://us.api.gradium.ai/api/speech/asr
# Auth header: x-api-key: YOUR_API_KEY
#
# IMPORTANT: Setup message MUST be the first message sent after connection.
# Server will close the connection if any other message is sent first.
#
# Setup message:
{
    "type": "setup",
    "model_name": "default",
    "input_format": "pcm",
    "language": "en"
}
# Audio input: PCM 24kHz, 16-bit signed int, mono
# Audio chunks must be base64-encoded in JSON: { "type": "audio", "audio": "<base64>" }
# Recommended chunk size: 1920 samples (80ms at 24kHz)
#
# Server returns two message types:
#
# Transcript: { "type": "text", "text": "...", "start_s": 0.5, "end_s": 2.3 }
# VAD:        { "type": "step", "vad": [timestamp, duration, {"inactivity_prob": 0.95}] }
#
# Turn detection: trigger when vad[2]["inactivity_prob"] > 0.5
```

**Python SDK (recommended over raw WebSocket):**
```python
import gradium

client = gradium.client.GradiumClient(api_key="...", region="us")

stream = await client.stt_stream(
    setup={"model_name": "default", "input_format": "pcm"}
)

# Feed audio chunks, iterate transcripts
async for message in stream.iter_text():
    print(f"Text: {message['text']}")  # start_s, end_s also available
```

### 3.4 Gemini Integration

```python
from google import genai

client = genai.Client(api_key=GEMINI_API_KEY)

response = client.models.generate_content_stream(
    model="gemini-2.5-flash",
    contents=conversation_history,
    config={
        "system_instruction": GUIDE_SYSTEM_PROMPT,
        "tools": [
            trigger_world_generation,
            select_music,
            generate_fact,
            google_search
        ]
    }
)
```

### 3.5 Gradium TTS Integration

```python
# WebSocket: wss://us.api.gradium.ai/api/speech/tts
# Auth header: x-api-key: YOUR_API_KEY
#
# IMPORTANT: Setup message MUST be the first message sent after connection.
#
# Setup message:
{
    "type": "setup",
    "voice_id": "SELECTED_VOICE_ID",
    "model_name": "default",
    "output_format": "pcm"
}
# output_format options: "wav", "pcm", "opus", "pcm_8000", "pcm_16000", "pcm_24000",
#                        "ulaw_8000", "alaw_8000"
#
# Send text: { "type": "text", "text": "Hello world" }  (can stream incrementally)
# Receive: binary PCM audio chunks (48kHz, 16-bit, mono, 3840 samples per chunk = 80ms)
# Latency: <300ms time-to-first-token
```

**Python SDK (recommended over raw WebSocket):**
```python
stream = await client.tts_stream(
    setup={
        "model_name": "default",
        "voice_id": "YTpq7expH9539ERJ",
        "output_format": "pcm"
    },
    text=text_generator()  # async generator yielding text chunks from Gemini
)

async for audio_chunk in stream.iter_bytes():
    # Forward audio_chunk to frontend via WebSocket
    pass
```

### 3.6 Audio Playback (Frontend)

```
WebSocket receives PCM audio chunks from backend
  → ArrayBuffer → Float32Array conversion
  → AudioBuffer creation (48kHz, mono)
  → Queue buffers in playback scheduler
  → AudioBufferSourceNode → AudioContext.destination
  → User hears AI guide speaking
```

---

## 4. Gemini AI Guide Design

### 4.1 System Prompt

```
You are a warm, knowledgeable historical guide helping users explore any place
and time period in human history. You speak conversationally — vivid but concise.

Current context:
- Location: {location_name} ({lat}, {lng})
- Time Period: {time_period} ({year})
- Phase: {current_phase} (globe_selection | loading | exploring)

Behavior by phase:
- globe_selection: Greet the user. When they select a location/time, share
  2-3 fascinating facts. Ask if they'd like to explore. If they say yes,
  call trigger_world_generation.
- loading: Narrate a rich, immersive description of the destination. Tell
  stories. Paint a picture with words. Keep talking until the world is ready.
  Call select_music to queue era-appropriate music.
- exploring: Be a tour guide. Point out features. Answer questions. Share
  facts via generate_fact. Keep responses to 2-3 sentences.

Personality: Enthusiastic but not over-the-top. Scholarly but accessible.
Think David Attenborough meets a history professor who loves their subject.
```

### 4.2 Function Calling Tools

```python
trigger_world_generation = {
    "name": "trigger_world_generation",
    "description": "Trigger 3D world generation when the user wants to explore a location/era",
    "parameters": {
        "type": "object",
        "properties": {
            "location": {"type": "string", "description": "The place to generate"},
            "time_period": {"type": "string", "description": "The historical era"},
            "scene_description": {"type": "string", "description": "Vivid description of the scene to generate"}
        },
        "required": ["location", "time_period", "scene_description"]
    }
}

select_music = {
    "name": "select_music",
    "description": "Select background music that fits the era, region, and mood",
    "parameters": {
        "type": "object",
        "properties": {
            "era": {"type": "string"},
            "region": {"type": "string"},
            "mood": {"type": "string", "enum": ["contemplative", "majestic", "adventurous", "peaceful", "dramatic"]}
        },
        "required": ["era", "region", "mood"]
    }
}

generate_fact = {
    "name": "generate_fact",
    "description": "Generate a historical fact to display as an overlay card",
    "parameters": {
        "type": "object",
        "properties": {
            "fact_text": {"type": "string", "description": "A concise, interesting historical fact (1-2 sentences)"},
            "category": {"type": "string", "enum": ["culture", "technology", "politics", "daily_life", "art"]}
        },
        "required": ["fact_text", "category"]
    }
}
```

---

## 5. World Labs Integration

### 5.1 Models

| Model | Generation Time | Cost (text input) | Quality |
|-------|----------------|-------------------|---------|
| `Marble 0.1-plus` | ~5 minutes | 1,580 credits | High |
| `Marble 0.1-mini` | **30–45 seconds** | 230 credits | Lower but usable |

**Recommendation:** Use `Marble 0.1-mini` for the live demo flow (30s wait is manageable). Use `Marble 0.1-plus` for pre-generated showcase worlds.

**Credits:** $1.00 = 1,250 credits. Min purchase $5 = 6,250 credits. Free tier: 4 generations/month.
**IMPORTANT:** API credits are separate from Marble app credits — must purchase at platform.worldlabs.ai.

### 5.2 Generation Flow

```python
import httpx
import asyncio

WORLD_LABS_BASE = "https://api.worldlabs.ai/marble/v1"

async def generate_world(scene_description: str, model: str = "Marble 0.1-mini") -> str:
    """Returns operation_id for polling."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{WORLD_LABS_BASE}/worlds:generate",
            headers={
                "WLT-Api-Key": API_KEY,
                "Content-Type": "application/json"
            },
            json={
                "display_name": "QHacks World",
                "world_prompt": {
                    "type": "text",
                    "text_prompt": scene_description
                },
                "model": model
            }
        )
        return response.json()["operation_id"]

async def poll_world_status(operation_id: str) -> dict:
    """Poll until world is ready. Returns world data with assets."""
    async with httpx.AsyncClient() as client:
        while True:
            response = await client.get(
                f"{WORLD_LABS_BASE}/operations/{operation_id}",
                headers={"WLT-Api-Key": API_KEY}
            )
            data = response.json()
            if data.get("done"):
                return data["result"]  # Contains world object with assets
            await asyncio.sleep(5)  # Poll every 5 seconds

async def get_world_assets(world_id: str) -> dict:
    """Fetch splat URLs, panorama, mesh."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{WORLD_LABS_BASE}/worlds/{world_id}",
            headers={"WLT-Api-Key": API_KEY}
        )
        return response.json()
```

### 5.3 Response Schema

```json
{
  "id": "world_abc123",
  "display_name": "QHacks World",
  "world_marble_url": "https://marble.worldlabs.ai/world/world_abc123",
  "assets": {
    "splats": {
      "spz_urls": [
        "https://...100k.spz",
        "https://...500k.spz",
        "https://...full.spz"
      ]
    },
    "mesh": {
      "collider_mesh_url": "https://...collider.glb"
    },
    "imagery": {
      "pano_url": "https://...pano.jpg"
    },
    "caption": "AI-generated description",
    "thumbnail_url": "https://...thumb.jpg"
  }
}
```

**Splat resolutions:** 100k (fast preview) | 500k (balanced) | full (best quality).
Use 500k for the demo — good balance of quality and load time.
**Note:** SPZ URLs are pre-signed and may expire — render them promptly.

### 5.4 SparkJS Rendering (Frontend)

```typescript
import * as THREE from 'three';
import { SplatMesh, SparkControls } from '@sparkjsdev/spark';

function WorldScene({ splatUrl }: { splatUrl: string }) {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

        // IMPORTANT: antialias must be false for splat rendering performance
        const renderer = new THREE.WebGLRenderer({ antialias: false });
        renderer.setSize(window.innerWidth, window.innerHeight);
        mountRef.current!.appendChild(renderer.domElement);

        // Load World Labs splat (use 500k resolution for balanced quality/speed)
        const world = new SplatMesh({
            url: splatUrl,
            onLoad: () => console.log('World loaded')
        });
        scene.add(world);

        // SparkJS built-in FPS controls (keyboard + mouse + gamepad + touch)
        const controls = new SparkControls();
        const clock = new THREE.Clock();

        renderer.setAnimationLoop(() => {
            controls.update(camera, clock.getDelta());
            renderer.render(scene, camera);
        });

        return () => {
            renderer.dispose();
            renderer.setAnimationLoop(null);
        };
    }, [splatUrl]);

    return <div ref={mountRef} className="w-full h-full" />;
}
```

**SplatMesh constructor options:**
```typescript
new SplatMesh({
    url: string,              // Fetch SPZ from URL
    fileBytes?: Uint8Array,   // Or provide raw bytes
    maxSplats?: number,       // Reserve space
    onLoad?: (mesh) => void,  // Load callback
    editable?: boolean        // Default: true
})
// Supported formats: .spz, .ply, .splat, .ksplat
```

---

## 6. Music System

### 6.1 Library Structure

```typescript
// frontend/src/data/musicLibrary.ts
interface MusicTrack {
    id: string;
    title: string;
    file: string;        // path in /public/music/
    era: string;          // "ancient", "medieval", "renaissance", "baroque", "classical", "modern"
    region: string;       // "europe", "asia", "middle_east", "africa", "americas"
    mood: string;         // "contemplative", "majestic", "adventurous", "peaceful", "dramatic"
    attribution: string;  // CC license info
}

export const musicLibrary: MusicTrack[] = [
    {
        id: "ancient-rome-majestic",
        title: "Glory of the Forum",
        file: "/music/ancient-rome-majestic.mp3",
        era: "ancient",
        region: "europe",
        mood: "majestic",
        attribution: "..."
    },
    // ... 15-20 tracks
];
```

### 6.2 Selection Flow

1. Gemini calls `select_music({ era: "ancient", region: "europe", mood: "majestic" })`
2. Backend matches against `musicLibrary` metadata
3. Returns best matching track URL to frontend
4. Frontend plays via Web Audio API with crossfade from previous track

---

## 7. Frontend State (Zustand)

```typescript
// frontend/src/store.ts
import { create } from 'zustand';

interface AppState {
    // App phase
    phase: 'landing' | 'globe' | 'loading' | 'exploring';
    setPhase: (phase: AppState['phase']) => void;

    // Location & time
    location: { lat: number; lng: number; name: string } | null;
    timePeriod: { year: number; era: string; label: string } | null;
    setLocation: (loc: AppState['location']) => void;
    setTimePeriod: (tp: AppState['timePeriod']) => void;

    // Voice state
    isListening: boolean;
    isSpeaking: boolean;
    transcript: string;
    setListening: (v: boolean) => void;
    setSpeaking: (v: boolean) => void;
    setTranscript: (t: string) => void;

    // World generation
    worldStatus: 'idle' | 'generating' | 'ready' | 'error';
    worldId: string | null;
    splatUrl: string | null;
    setWorldStatus: (s: AppState['worldStatus']) => void;
    setWorldData: (id: string, url: string) => void;

    // Music
    currentTrack: string | null;
    isMusicPlaying: boolean;
    setCurrentTrack: (t: string | null) => void;
    setMusicPlaying: (v: boolean) => void;

    // Conversation
    messages: Array<{ role: 'user' | 'guide'; text: string }>;
    addMessage: (msg: { role: 'user' | 'guide'; text: string }) => void;

    // Facts
    facts: Array<{ text: string; category: string; visible: boolean }>;
    addFact: (f: { text: string; category: string }) => void;
}
```

---

## 8. WebSocket Protocol (Frontend ↔ Backend)

All communication over a single WebSocket connection at `ws://backend/ws/voice`.

### Messages: Frontend → Backend

```typescript
// Audio chunk from microphone
{ type: "audio", data: "<base64 PCM>" }

// Set context (location/time selected)
{ type: "context", location: {...}, timePeriod: {...} }

// Phase change notification
{ type: "phase", phase: "globe" | "loading" | "exploring" }
```

### Messages: Backend → Frontend

```typescript
// Transcript from Gradium STT
{ type: "transcript", text: "...", partial: boolean }

// TTS audio chunk from Gradium
{ type: "audio", data: "<base64 PCM>" }

// World generation status
{ type: "world_status", status: "generating" | "ready" | "error", worldId?: string, splatUrl?: string }

// Music selection
{ type: "music", trackUrl: string }

// Fact to display
{ type: "fact", text: string, category: string }

// Guide text (for display alongside voice)
{ type: "guide_text", text: string }
```

---

## 9. File Structure

```
QHacks-2026/
├── docs/
│   ├── PRD.md
│   ├── TECHNICAL.md
│   ├── ROADMAP.md
│   └── CHANGELOG.md
├── frontend/
│   ├── public/
│   │   └── music/                    # Curated royalty-free tracks (.mp3)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Landing.tsx           # Particles + Enter button
│   │   │   ├── Globe.tsx             # Globe.gl + location selection
│   │   │   ├── TimeSelector.tsx      # Era scroll/wheel picker
│   │   │   ├── LoadingExperience.tsx  # Narration + visuals during generation
│   │   │   ├── WorldExplorer.tsx     # SparkJS 3D world renderer
│   │   │   ├── FactOverlay.tsx       # Floating historical fact cards
│   │   │   ├── VoiceUI.tsx           # Mic button + transcript display
│   │   │   └── MusicPlayer.tsx       # Background audio controls
│   │   ├── hooks/
│   │   │   ├── useVoiceWebSocket.ts  # WebSocket connection + message handling
│   │   │   └── useAudioCapture.ts    # AudioWorklet mic capture
│   │   ├── data/
│   │   │   └── musicLibrary.ts       # Track metadata
│   │   ├── workers/
│   │   │   └── audio-processor.js    # AudioWorklet (adapted from KingHacks)
│   │   ├── store.ts                  # Zustand state
│   │   ├── App.tsx                   # Phase router
│   │   └── main.tsx                  # Entry point
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
├── backend/
│   ├── main.py                       # FastAPI app, CORS, mount routers
│   ├── config.py                     # Environment variables, API keys
│   ├── routers/
│   │   ├── voice.py                  # WebSocket voice pipeline
│   │   └── worlds.py                 # World generation REST endpoints
│   ├── services/
│   │   ├── gradium_service.py        # Gradium STT/TTS WebSocket client
│   │   ├── gemini_guide.py           # Gemini conversation + function calling
│   │   ├── world_labs.py             # World Labs API client
│   │   └── music_selector.py         # Music metadata + selection logic
│   ├── requirements.txt
│   └── .env.example
├── README.md
└── .gitignore
```

---

## 10. Environment Variables

```bash
# .env.example
GRADIUM_API_KEY=gd_...
GEMINI_API_KEY=...
WORLD_LABS_API_KEY=WLT-...
FRONTEND_URL=http://localhost:5173   # For CORS
```

---

## 11. Deployment

| Component | Platform | Config |
|-----------|----------|--------|
| Frontend | Vercel | Auto-deploy from git, `VITE_API_URL` env var |
| Backend | Railway or Render | Python runtime, WebSocket support required, env vars |

---

## 12. Key Dependencies

### Frontend (`package.json`)
```json
{
    "dependencies": {
        "react": "^19",
        "react-dom": "^19",
        "three": "^0.170",
        "@sparkjsdev/spark": "^0.1.10",
        "globe.gl": "latest",
        "zustand": "latest",
        "@tsparticles/react": "latest",
        "@tsparticles/slim": "latest"
    },
    "devDependencies": {
        "vite": "^6",
        "@vitejs/plugin-react": "latest",
        "typescript": "^5",
        "tailwindcss": "^4",
        "@types/three": "latest"
    }
}
```

### Backend (`requirements.txt`)
```
fastapi
uvicorn[standard]
websockets
gradium
google-genai
httpx
python-dotenv
```
