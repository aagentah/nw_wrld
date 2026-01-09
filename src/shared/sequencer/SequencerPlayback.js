import * as Tone from "tone";

class SequencerPlayback {
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

  load(pattern, bpm = 120) {
    this.pattern = pattern || {};
    this.bpm = bpm;
  }

  setOnStepCallback(callback) {
    this.onStepCallback = callback;
  }

  getRunId() {
    return this.runId;
  }

  setBpm(bpm) {
    this.bpm = bpm;
    if (this.isPlaying) Tone.Transport.bpm.value = this.bpm;
  }

  play() {
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
    }, "16n");

    Tone.Transport.start();
  }

  tick(time, runId) {
    if (!this.onStepCallback) return;
    if (!this.isPlaying) return;
    if (runId !== this.runId) return;

    const stepIndex = this.currentStep;
    const channelsToTrigger = [];
    Object.entries(this.pattern).forEach(([channelName, steps]) => {
      if (Array.isArray(steps) && steps.includes(stepIndex)) {
        channelsToTrigger.push(channelName);
      }
    });

    this.onStepCallback(stepIndex, channelsToTrigger, time, runId);
    this.currentStep = (stepIndex + 1) % this.totalSteps;
  }

  pause() {
    if (!this.isPlaying) return;

    this.isPlaying = false;
    this.runId += 1;
    if (this.transportEventId !== null) {
      Tone.Transport.clear(this.transportEventId);
      this.transportEventId = null;
    }
    Tone.Transport.stop();
  }

  stop() {
    this.pause();
    this.currentStep = 0;
  }

  getCurrentStep() {
    return this.currentStep;
  }
}

export default SequencerPlayback;
