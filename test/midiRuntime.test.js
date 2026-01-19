const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { parseMidiTriggerValue, normalizeNoteMatchMode, buildMidiConfig } = require(
  path.join(__dirname, "..", "dist", "runtime", "shared", "midi", "midiUtils.js")
);

const MidiPlayback = require(
  path.join(__dirname, "..", "dist", "runtime", "shared", "midi", "midiPlayback.js")
).default;

test("midiUtils: normalizeNoteMatchMode preserves exactNote else defaults to pitchClass", () => {
  assert.equal(normalizeNoteMatchMode("exactNote"), "exactNote");
  assert.equal(normalizeNoteMatchMode("pitchClass"), "pitchClass");
  assert.equal(normalizeNoteMatchMode(null), "pitchClass");
});

test("midiUtils: parseMidiTriggerValue pitchClass accepts note names", () => {
  assert.equal(parseMidiTriggerValue("G#7", "pitchClass"), 8);
  assert.equal(parseMidiTriggerValue("C", "pitchClass"), 0);
});

test("midiUtils: parseMidiTriggerValue exactNote accepts numeric strings", () => {
  assert.equal(parseMidiTriggerValue("60", "exactNote"), 60);
  assert.equal(parseMidiTriggerValue("999", "exactNote"), null);
});

test("midiUtils: buildMidiConfig maps midi pitchClass trigger keys deterministically", () => {
  const tracks = [{ name: "T1", trackSlot: "ch1" }];
  const globalMappings = {
    input: { noteMatchMode: "pitchClass" },
    trackMappings: { midi: { pitchClass: { ch1: "C" } } },
  };
  const cfg = buildMidiConfig(tracks, globalMappings, "midi");
  assert.equal(cfg.trackTriggersMap["0"], "T1");
});

test("midiPlayback: smoke (empty channels) play/pause/stop are non-throwing and stop calls callback", () => {
  const engine = new MidiPlayback();
  let stops = 0;
  engine.setOnStopCallback(() => {
    stops += 1;
  });
  engine.load([], 120);
  assert.equal(stops, 1);
  assert.equal(engine.isPlaying, false);
  engine.play();
  assert.equal(engine.isPlaying, true);
  engine.pause();
  assert.equal(engine.isPlaying, false);
  engine.stop();
  assert.equal(stops, 2);
});

test("midiPlayback: load falls back to 120bpm for invalid bpm inputs", () => {
  const engine = new MidiPlayback();
  engine.load([], NaN);
  assert.equal(engine.bpm, 120);
  engine.load([], 0);
  assert.equal(engine.bpm, 120);
  engine.load([], -1);
  assert.equal(engine.bpm, 120);
  engine.load([], "120");
  assert.equal(engine.bpm, 120);
});
