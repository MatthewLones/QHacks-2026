"""Music track selector.

Matches era/region/mood to curated royalty-free tracks.
Stub for Phase 1 — will be fleshed out in Phase 3 when tracks are sourced.

See TECHNICAL.md Section 7 for library structure and selection flow.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# Placeholder library — will be populated with real tracks in Phase 3
MUSIC_LIBRARY: list[dict] = [
    {
        "id": "ancient-rome-majestic",
        "title": "Glory of the Forum",
        "file": "/music/ancient-rome-majestic.mp3",
        "era": "ancient",
        "region": "europe",
        "mood": "majestic",
        "attribution": "Placeholder — replace with real CC track",
    },
    {
        "id": "medieval-europe-contemplative",
        "title": "Stone Corridors",
        "file": "/music/medieval-europe-contemplative.mp3",
        "era": "medieval",
        "region": "europe",
        "mood": "contemplative",
        "attribution": "Placeholder — replace with real CC track",
    },
]


def select_track(era: str, region: str, mood: str) -> dict | None:
    """Find the best matching track for the given era, region, and mood.

    Scoring: +2 for era match, +1 for region match, +1 for mood match.
    Returns the highest-scoring track, or None if library is empty.
    """
    if not MUSIC_LIBRARY:
        return None

    def score(track: dict) -> int:
        s = 0
        if track["era"].lower() == era.lower():
            s += 2
        if track["region"].lower() == region.lower():
            s += 1
        if track["mood"].lower() == mood.lower():
            s += 1
        return s

    best = max(MUSIC_LIBRARY, key=score)
    if score(best) == 0:
        # No match at all — return first track as fallback
        return MUSIC_LIBRARY[0]
    return best
