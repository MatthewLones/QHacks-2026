/**
 * WebSocket voice pipeline orchestrator.
 *
 * Framework-agnostic. Connects AudioCaptureService (mic → PCM) and
 * AudioPlaybackService (PCM → speaker) to the backend WebSocket at /ws/voice.
 *
 * Protocol (matches backend/routers/voice.py):
 *   Outbound: audio, context, phase
 *   Inbound:  transcript, audio, guide_text, fact, world_status, music, suggested_location
 */

import { AudioCaptureService } from "./AudioCaptureService";
import { AudioPlaybackService } from "./AudioPlaybackService";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export type VoiceEventMap = {
  transcript: (text: string) => void;
  guideText: (text: string) => void;
  fact: (text: string, category: string) => void;
  worldStatus: (
    status: string,
    worldId?: string,
    splatUrl?: string,
  ) => void;
  music: (trackUrl: string) => void;
  suggestedLocation: (lat: number, lng: number, name: string) => void;
  status: (status: ConnectionStatus) => void;
};

type Listener = (...args: never[]) => void;

export class VoiceConnection {
  private ws: WebSocket | null = null;
  private capture = new AudioCaptureService();
  private playback = new AudioPlaybackService();
  private listeners = new Map<string, Listener[]>();
  private _status: ConnectionStatus = "disconnected";

  get status(): ConnectionStatus {
    return this._status;
  }

  async connect(): Promise<void> {
    if (this.ws) return;

    this.setStatus("connecting");

    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws/voice`;
    this.ws = new WebSocket(url);

    this.ws.onopen = async () => {
      this.playback.start();

      try {
        await this.capture.start((pcmBytes: ArrayBuffer) => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            const base64 = arrayBufferToBase64(pcmBytes);
            this.ws.send(JSON.stringify({ type: "audio", data: base64 }));
          }
        });
        this.setStatus("connected");
      } catch (err) {
        console.error("[VoiceConnection] Mic capture failed:", err);
        this.setStatus("error");
        this.disconnect();
      }
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as Record<
          string,
          unknown
        >;
        this.handleMessage(msg);
      } catch (err) {
        console.error("[VoiceConnection] Bad message:", err);
      }
    };

    this.ws.onclose = () => {
      this.cleanup();
      this.setStatus("disconnected");
    };

    this.ws.onerror = () => {
      this.cleanup();
      this.setStatus("error");
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.cleanup();
    this.setStatus("disconnected");
  }

  sendContext(
    location: { lat: number; lng: number; name: string },
    timePeriod: { label: string; year: number },
  ): void {
    this.send({ type: "context", location, timePeriod });
  }

  sendPhase(phase: string): void {
    this.send({ type: "phase", phase });
  }

  on<K extends keyof VoiceEventMap>(
    event: K,
    listener: VoiceEventMap[K],
  ): void {
    const list = this.listeners.get(event) ?? [];
    list.push(listener as Listener);
    this.listeners.set(event, list);
  }

  off<K extends keyof VoiceEventMap>(
    event: K,
    listener: VoiceEventMap[K],
  ): void {
    const list = this.listeners.get(event);
    if (!list) return;
    const idx = list.indexOf(listener as Listener);
    if (idx !== -1) list.splice(idx, 1);
  }

  // --- private ---

  private emit(event: string, ...args: unknown[]): void {
    const list = this.listeners.get(event);
    if (!list) return;
    for (const fn of list) {
      (fn as (...a: unknown[]) => void)(...args);
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this._status = status;
    this.emit("status", status);
  }

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleMessage(msg: Record<string, unknown>): void {
    switch (msg.type) {
      case "transcript":
        this.emit("transcript", msg.text as string);
        break;

      case "audio": {
        const pcm = base64ToArrayBuffer(msg.data as string);
        this.playback.playChunk(pcm);
        break;
      }

      case "guide_text":
        this.emit("guideText", msg.text as string);
        break;

      case "fact":
        this.emit("fact", msg.text as string, msg.category as string);
        break;

      case "world_status":
        this.emit(
          "worldStatus",
          msg.status as string,
          msg.worldId as string | undefined,
          msg.splatUrl as string | undefined,
        );
        break;

      case "music":
        this.emit("music", msg.trackUrl as string);
        break;

      case "suggested_location":
        this.emit(
          "suggestedLocation",
          msg.lat as number,
          msg.lng as number,
          msg.name as string,
        );
        break;

      default:
        console.log("[VoiceConnection] Unknown message type:", msg.type);
    }
  }

  private cleanup(): void {
    this.capture.stop();
    this.playback.stop();
    this.ws = null;
  }
}

// --- base64 helpers ---

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
