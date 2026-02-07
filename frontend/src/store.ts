import { create } from 'zustand';

export interface LocationData {
  lat: number;
  lng: number;
  name: string;
}

export interface TimePeriodData {
  year: number;
  era: string;
  label: string;
}

export type TileMode = 'dark' | 'voyager';

interface AppState {
  phase: 'landing' | 'globe' | 'loading' | 'exploring';
  setPhase: (phase: AppState['phase']) => void;

  tileMode: TileMode;
  setTileMode: (mode: TileMode) => void;

  showLabels: boolean;
  setShowLabels: (v: boolean) => void;

  location: LocationData | null;
  timePeriod: TimePeriodData | null;
  setLocation: (loc: LocationData | null) => void;
  setTimePeriod: (tp: TimePeriodData | null) => void;

  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  setListening: (v: boolean) => void;
  setSpeaking: (v: boolean) => void;
  setTranscript: (t: string) => void;

  worldStatus: 'idle' | 'generating' | 'ready' | 'error';
  worldId: string | null;
  splatUrl: string | null;
  setWorldStatus: (s: AppState['worldStatus']) => void;
  setWorldData: (id: string, url: string) => void;

  currentTrack: string | null;
  isMusicPlaying: boolean;
  setCurrentTrack: (t: string | null) => void;
  setMusicPlaying: (v: boolean) => void;

  messages: Array<{ role: 'user' | 'guide'; text: string }>;
  addMessage: (msg: { role: 'user' | 'guide'; text: string }) => void;

  facts: Array<{ text: string; category: string; visible: boolean }>;
  addFact: (f: { text: string; category: string }) => void;
}

export const useAppStore = create<AppState>((set) => ({
  phase: 'landing',
  setPhase: (phase) => set({ phase }),

  tileMode: 'voyager',
  setTileMode: (tileMode) => set({ tileMode }),

  showLabels: true,
  setShowLabels: (showLabels) => set({ showLabels }),

  location: null,
  timePeriod: null,
  setLocation: (location) => set({ location }),
  setTimePeriod: (timePeriod) => set({ timePeriod }),

  isListening: false,
  isSpeaking: false,
  transcript: '',
  setListening: (isListening) => set({ isListening }),
  setSpeaking: (isSpeaking) => set({ isSpeaking }),
  setTranscript: (transcript) => set({ transcript }),

  worldStatus: 'idle',
  worldId: null,
  splatUrl: null,
  setWorldStatus: (worldStatus) => set({ worldStatus }),
  setWorldData: (worldId, splatUrl) => set({ worldId, splatUrl, worldStatus: 'ready' }),

  currentTrack: null,
  isMusicPlaying: false,
  setCurrentTrack: (currentTrack) => set({ currentTrack }),
  setMusicPlaying: (isMusicPlaying) => set({ isMusicPlaying }),

  messages: [],
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  facts: [],
  addFact: (f) =>
    set((s) => ({ facts: [...s.facts, { ...f, visible: true }] })),
}));
