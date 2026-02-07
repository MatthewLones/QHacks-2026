/**
 * Mic capture via AudioWorklet.
 *
 * Framework-agnostic service class. Captures microphone audio at 24kHz
 * (native Gradium STT rate — no resampling needed), converts to Int16 PCM
 * via the AudioWorklet, and delivers 1920-sample (80ms) chunks via callback.
 */

export class AudioCaptureService {
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;

  /**
   * Request mic permission, start capture, and call onChunk for each PCM chunk.
   * @param onChunk Called with raw Int16 PCM ArrayBuffer (3840 bytes = 1920 samples)
   */
  async start(onChunk: (pcmBytes: ArrayBuffer) => void): Promise<void> {
    // Create AudioContext at 24kHz BEFORE getUserMedia — the user gesture
    // is still active, so the context won't be suspended.
    this.audioContext = new AudioContext({ sampleRate: 24000 });

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: { ideal: 24000 },
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    // Safety net — resume if suspended (e.g. autoplay policy)
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    await this.audioContext.audioWorklet.addModule("/audio-processor.js");

    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
    this.workletNode = new AudioWorkletNode(
      this.audioContext,
      "audio-capture-processor",
    );

    this.workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      onChunk(event.data);
    };

    // Connect: mic source → worklet (no destination — capture only, no echo)
    this.sourceNode.connect(this.workletNode);
    // AudioWorklet must be connected to destination to keep processing
    this.workletNode.connect(this.audioContext.destination);
  }

  stop(): void {
    if (this.workletNode) {
      this.workletNode.port.postMessage({ command: "stop" });
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }
  }
}
