# Product Requirements Document (PRD)

> **Project Name:** TBD
> **Hackathon:** QHacks 2026 — "The Golden Age"
> **Team Size:** 2
> **Duration:** 24 hours
> **Tracks:** Gradium (Voice AI) + Gemini API (LLM Intelligence)

---

## 1. Problem Statement

There is no accessible way to immersively explore the history and culture of any place and time period. You can read Wikipedia or browse Google Maps, but neither captures the feeling of *being there*. For people without the resources to travel — students, curious minds, underserved communities — the richness of human history remains flat and disconnected.

## 2. Solution

An AI-guided voice experience where users select any place and time period on a 3D globe, converse with a knowledgeable AI guide, and then step into a photorealistic 3D world generated from that context. Era-appropriate music plays. Historical facts appear. The AI guide walks them through the world, narrating its significance.

**One sentence:** Talk to an AI guide, pick a place and time, and explore a generated 3D world of that moment in history.

## 3. Hackathon Alignment — "The Golden Age"

The theme calls for projects about prosperity and flourishing in Culture & Society. This project democratizes cultural exploration — giving anyone, anywhere, the ability to experience the richness of human civilization across all eras. It inspires curiosity and a deeper appreciation for the golden ages that shaped our world.

## 4. Target Users

- **Students** (K-12 and university) learning about history, geography, or culture
- **Educators** looking for immersive teaching tools
- **Curious individuals** who want to explore but lack travel resources
- **History enthusiasts** who want to "visit" past civilizations

## 5. User Flow

### Phase 1: Landing
- Full-screen particle star field animation (cosmic, exploratory feel)
- Single glassmorphism "Enter" button at center
- Gentle ambient music begins playing
- Clicking "Enter" triggers a fade transition to the globe view

### Phase 2: Globe & Time Selection
- Interactive 3D globe (Globe.gl) fills the screen
- User can rotate, zoom, and click any location on the globe
- A time period selector (scrollable lever/wheel) on the side lets users dial into an era
  - Spans from ancient history (~3000 BC) to modern day
  - Shows era labels (e.g., "Roman Empire", "Song Dynasty", "Renaissance")
- The AI guide greets the user via voice (Gradium TTS): *"Welcome, explorer. Where would you like to go?"*
- The user can speak back (Gradium STT) to discuss options with the guide
- The guide responds with context about the selected location and era
- A visual indicator shows the selected location + time period

### Phase 3: Conversation
- The user converses with the AI guide about the selected destination
- The guide (powered by Gemini) provides historical context, interesting facts, and suggestions
- The guide uses Google Search (via Gemini function calling) to pull real historical information
- When the user is ready, they say something like "Let's go" or "Take me there"
- The guide responds: *"Wonderful choice. Let me prepare your journey..."*

### Phase 4: Loading / Narration (~5 minutes)
- Screen transitions with a cinematic fade
- World Labs API begins generating the 3D world (async, ~5 min)
- During the wait:
  - The AI guide narrates the history of the destination in detail (Gemini generates, Gradium speaks)
  - Era-appropriate music fades in (selected by the LLM from a curated library)
  - Animated visual elements (particles, light effects, subtle imagery) keep the experience immersive
  - A subtle progress indicator shows generation status
- This is NOT dead time — it's a deliberate storytelling moment

### Phase 5: Exploration
- The generated 3D world renders (SparkJS + Three.js, Gaussian splats)
- The user can navigate/explore the world (orbit controls, click to move)
- The AI guide continues conversing — pointing out features, answering questions
- Historical facts appear as floating overlay cards periodically
- Era-appropriate music continues playing
- The voice conversation remains active throughout

## 6. Feature Priorities

### MVP (Must Ship)

| Feature | Description |
|---------|-------------|
| Landing page | Particle star field + glassmorphism Enter button + ambient audio |
| 3D Globe | Globe.gl interactive globe with click-to-select location |
| Time selector | Scrollable era picker with historical labels |
| Voice conversation | Gradium STT + TTS wrapping Gemini for AI guide dialogue |
| World generation | World Labs API triggered by location/era selection |
| Loading experience | AI narration + music + animated visuals during ~5 min generation |
| 3D world rendering | SparkJS renders Gaussian splat world from World Labs |
| Background music | Curated royalty-free tracks played during loading + exploration |

### Stretch Goals

| Feature | Description |
|---------|-------------|
| Facts overlay | Floating historical fact cards during world exploration |
| Voice cloning | Historically-themed guide voices (e.g., period-appropriate accent) |
| Pre-generated worlds | Instant transitions for demo showcase locations |
| Save/share sessions | Let users share their exploration journey |

## 7. Success Criteria

1. **Voice loop works:** User speaks → AI guide responds with audio (Gradium + Gemini)
2. **World generates:** At least 1 world successfully generates from World Labs and renders in SparkJS
3. **Full flow:** Landing → Globe → Conversation → Loading → Exploration is seamless
4. **Track compliance:** Gradium handles ALL voice I/O, Gemini handles ALL intelligence
5. **Demo impact:** Judges experience the "wow moment" of stepping into a generated historical world

## 8. Out of Scope (for 24 hours)

- User accounts / authentication
- Persistent data storage
- Mobile-native app
- Multiplayer / shared exploration
- Custom 3D asset creation
- Video generation
- AR/VR integration

## 9. Key Metrics (Demo Day)

- Time from "Enter" to first AI voice greeting: < 3 seconds
- Voice response latency (user speaks → AI audio begins): < 2 seconds
- World generation completes within loading experience window: ~5 minutes
- Number of distinct worlds demoed: 2-3 (including pre-generated)
