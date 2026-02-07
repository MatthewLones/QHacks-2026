/**
 * React hook wrapping VoiceConnection.
 *
 * Exposes connection state, transcripts, and guide text as React state.
 * Handles lifecycle (cleanup on unmount).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceConnection, type ConnectionStatus } from "../audio/VoiceConnection";

export interface VoiceState {
  status: ConnectionStatus;
  transcripts: string[];
  guideTexts: string[];
  connect: () => void;
  disconnect: () => void;
}

export function useVoiceConnection(): VoiceState {
  const vcRef = useRef<VoiceConnection | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [guideTexts, setGuideTexts] = useState<string[]>([]);

  // Create the VoiceConnection instance once
  useEffect(() => {
    const vc = new VoiceConnection();
    vcRef.current = vc;

    vc.on("status", (s: ConnectionStatus) => setStatus(s));
    vc.on("transcript", (text: string) =>
      setTranscripts((prev) => [...prev, text]),
    );
    vc.on("guideText", (text: string) =>
      setGuideTexts((prev) => [...prev, text]),
    );

    return () => {
      vc.disconnect();
      vcRef.current = null;
    };
  }, []);

  const connect = useCallback(() => {
    void vcRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    vcRef.current?.disconnect();
    setTranscripts([]);
    setGuideTexts([]);
  }, []);

  return { status, transcripts, guideTexts, connect, disconnect };
}
