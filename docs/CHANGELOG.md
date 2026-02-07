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
