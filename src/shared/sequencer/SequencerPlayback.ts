import * as Tone from 'tone';

export interface SequencerPattern {
  [channelName: string]: number[];
}

export type OnStepCallback = (
  stepIndex: number,
  channelsToTrigger: string[],
  time: number,
  runId: number
) => void;

class SequencerPlayback {
  private isPlaying: boolean = false;
  private currentStep: number = 0;
  private pattern: SequencerPattern = {};
  private bpm: number = 120;
  private onStepCallback: OnStepCallback | null = null;
  private totalSteps: number = 16;
  private transportEventId: number | null = null;
  private runId: number = 0;

  constructor() {
    this.isPlaying = false;
    this.currentStep = 0;
    this.pattern = {};
    this.bpm = 120;
    this.onStepCallback = null;
    this.totalSteps = 16;
    this.transportEventId = null;
    this.runId = 0;
  }

  load(pattern: SequencerPattern, bpm = 120): void {
    this.pattern = pattern || {};
    this.bpm = bpm;
  }

  setOnStepCallback(callback: OnStepCallback | null): void {
    this.onStepCallback = callback;
  }

  getRunId(): number {
    return this.runId;
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
    if (this.isPlaying) {
      this.stop();
      this.play();
    }
  }

  play(): void {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.runId += 1;
    Tone.Transport.bpm.value = this.bpm;

    if (this.transportEventId !== null) {
      Tone.Transport.clear(this.transportEventId);
      this.transportEventId = null;
    }

    this.currentStep = 0;
    Tone.Transport.stop();
    Tone.Transport.position = 0;

    const scheduledRunId = this.runId;
    this.transportEventId = Tone.Transport.scheduleRepeat((time) => {
      if (!this.isPlaying) return;
      if (scheduledRunId !== this.runId) return;
      this.tick(time, scheduledRunId);
    }, '16n');

    Tone.Transport.start();
  }

  private tick(time: number, runId: number): void {
    if (!this.onStepCallback) return;
    if (!this.isPlaying) return;
    if (runId !== this.runId) return;

    const stepIndex = this.currentStep;
    const channelsToTrigger: string[] = [];
    Object.entries(this.pattern).forEach(([channelName, steps]) => {
      if (Array.isArray(steps) && steps.includes(stepIndex)) {
        channelsToTrigger.push(channelName);
      }
    });

    this.onStepCallback(stepIndex, channelsToTrigger, time, runId);
    this.currentStep = (stepIndex + 1) % this.totalSteps;
  }

  pause(): void {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    this.runId += 1;
    if (this.transportEventId !== null) {
      Tone.Transport.clear(this.transportEventId);
      this.transportEventId = null;
    }
    Tone.Transport.stop();
  }

  stop(): void {
    this.pause();
    this.currentStep = 0;
  }

  getCurrentStep(): number {
    return this.currentStep;
  }
}

export default SequencerPlayback;
