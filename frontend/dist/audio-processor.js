/**
 * AudioWorklet processor for microphone capture.
 *
 * Runs on the audio rendering thread (not main thread).
 * Receives Float32 samples at 24kHz from the mic, converts to Int16 PCM,
 * accumulates into 1920-sample chunks (80ms at 24kHz = 3840 bytes),
 * and posts each chunk to the main thread.
 *
 * Gradium STT expects: PCM 24kHz, 16-bit signed int, mono.
 */

const CHUNK_SAMPLES = 1920; // 80ms at 24kHz

class AudioCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Int16Array(CHUNK_SAMPLES);
    this._offset = 0;
    this._stopped = false;

    this.port.onmessage = (event) => {
      if (event.data && event.data.command === "stop") {
        this._stopped = true;
      }
    };
  }

  process(inputs) {
    if (this._stopped) return false;

    const input = inputs[0];
    if (!input || !input[0]) return true;

    const samples = input[0]; // Float32Array, mono channel

    for (let i = 0; i < samples.length; i++) {
      // Clamp and convert Float32 [-1, 1] → Int16 [-32768, 32767]
      const s = Math.max(-1, Math.min(1, samples[i]));
      this._buffer[this._offset++] = s < 0 ? s * 0x8000 : s * 0x7fff;

      if (this._offset >= CHUNK_SAMPLES) {
        // Send a copy of the buffer as raw bytes
        this.port.postMessage(this._buffer.buffer.slice(0));
        this._offset = 0;
      }
    }

    return true;
  }
}

registerProcessor("audio-capture-processor", AudioCaptureProcessor);
