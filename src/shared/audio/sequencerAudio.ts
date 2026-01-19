import * as Tone from "tone";

type NwWrldBridge = {
  app?: {
    getKickMp3ArrayBuffer?: () => ArrayBuffer | null;
  };
};

class SequencerAudio {
  private channelNotes: string[];
  private lastPlayTime: number;
  private debounceMs: number;
  private lastScheduledTimeMs: number | null;
  private kickPlayer: Tone.Player | null;
  private isInitializing: boolean;
  private isInitialized: boolean;
  private isToneStarted: boolean;

  constructor() {
    this.channelNotes = ["E2"];
    this.lastPlayTime = 0;
    this.debounceMs = 50;
    this.lastScheduledTimeMs = null;
    this.kickPlayer = null;
    this.isInitializing = false;
    this.isInitialized = false;
    this.isToneStarted = false;
  }

  async initialize() {
    if (this.isInitialized || this.isInitializing) {
      return;
    }

    this.isInitializing = true;

    try {
      if (!this.isToneStarted) {
        await Tone.start();
        this.isToneStarted = true;
      }

      if (!this.kickPlayer) {
        const bridge = globalThis.nwWrldBridge as NwWrldBridge | undefined;
        const arrayBuffer =
          bridge &&
          bridge.app &&
          typeof bridge.app.getKickMp3ArrayBuffer === "function"
            ? bridge.app.getKickMp3ArrayBuffer()
            : null;
        if (!arrayBuffer) {
          throw new Error("kick.mp3 could not be loaded");
        }

        const audioContext = Tone.getContext().rawContext;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const toneBuffer = new Tone.ToneAudioBuffer(audioBuffer);

        this.kickPlayer = new Tone.Player({
          volume: -8,
        }).toDestination();

        this.kickPlayer.buffer = toneBuffer;
      }

      this.isInitialized = true;
    } catch (error) {
      console.error("[SequencerAudio] Initialization error:", error);
      this.isInitialized = false;
    } finally {
      this.isInitializing = false;
    }
  }

  async playChannelBeep(channelNumber: string | number, time?: number) {
    const hasScheduledTime = typeof time === "number" && Number.isFinite(time);
    if (hasScheduledTime) {
      const scheduledTimeMs = time * 1000;
      if (
        this.lastScheduledTimeMs !== null &&
        scheduledTimeMs - this.lastScheduledTimeMs < this.debounceMs
      ) {
        return;
      }
      this.lastScheduledTimeMs = scheduledTimeMs;
    } else {
      const now = Date.now();
      if (now - this.lastPlayTime < this.debounceMs) {
        return;
      }
      this.lastPlayTime = now;
    }

    if (!this.isInitialized && !this.isInitializing) {
      await this.initialize();
    }

    if (!this.isInitialized) {
      console.warn("[SequencerAudio] Not initialized, skipping beep");
      return;
    }

    const numericChannel = parseInt(String(channelNumber));
    if (isNaN(numericChannel) || numericChannel < 1) {
      console.warn(`Invalid channel number: ${channelNumber}`);
      return;
    }

    if (this.kickPlayer) {
      try {
        const channelIndex = numericChannel - 1;
        const semitones = channelIndex * 0.5;
        const playbackRate = Math.pow(2, semitones / 12);

        this.kickPlayer.playbackRate = playbackRate;
        if (hasScheduledTime) {
          this.kickPlayer.start(time);
        } else {
          this.kickPlayer.start();
        }
      } catch (error) {
        console.error("[SequencerAudio] Playback error:", error);
      }
    }
  }

  cleanup() {
    if (this.kickPlayer) {
      this.kickPlayer.dispose();
      this.kickPlayer = null;
    }
    this.isInitialized = false;
    this.isToneStarted = false;
  }
}

export default SequencerAudio;

