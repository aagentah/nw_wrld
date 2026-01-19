const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const {
  getRecordingForTrack,
  setRecordingForTrack,
  getSequencerForTrack,
  setSequencerForTrack,
  deleteRecordingsForTracks,
} = require(
  path.join(
    __dirname,
    "..",
    "dist",
    "runtime",
    "shared",
    "json",
    "recordingUtils.js"
  )
);

test("recordingUtils: get/set recording for track", () => {
  const r0 = {};
  assert.deepEqual(getRecordingForTrack(r0, "t1"), { channels: [] });
  const r1 = setRecordingForTrack(r0, "t1", { channels: [1] });
  assert.deepEqual(getRecordingForTrack(r1, "t1"), { channels: [1] });
});

test("recordingUtils: get/set sequencer for track", () => {
  const r0 = {};
  assert.deepEqual(getSequencerForTrack(r0, "t1"), { bpm: 120, pattern: {} });
  const r1 = setSequencerForTrack(r0, "t1", { bpm: 90, pattern: { a: 1 } });
  assert.deepEqual(getSequencerForTrack(r1, "t1"), { bpm: 90, pattern: { a: 1 } });
});

test("recordingUtils: deleteRecordingsForTracks removes only specified keys", () => {
  const r0 = { a: 1, b: 2, c: 3 };
  const r1 = deleteRecordingsForTracks(r0, ["b", "x"]);
  assert.deepEqual(r1, { a: 1, c: 3 });
  assert.deepEqual(r0, { a: 1, b: 2, c: 3 });
});

