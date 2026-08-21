const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const {
  duplicateName,
  duplicateTrack,
  duplicateSet,
  duplicateModuleInstanceInTrack,
  copyRecordingEntries,
} = require(
  path.join(__dirname, "..", "dist", "runtime", "shared", "utils", "duplicateUtils.js")
);

const makeTrack = () => ({
  id: "track_1",
  name: "My Track",
  trackSlot: 1,
  bpm: 120,
  signal: { audio: { thresholds: { low: 0.5, medium: 0.5, high: 0.5 }, minIntervalMs: 120 } },
  channelMappings: { 1: 1, 2: 2, 3: 3 },
  modules: [
    { id: "inst_a", type: "Text" },
    { id: "inst_b", type: "GridOverlay", disabled: true },
  ],
  modulesData: {
    inst_a: {
      constructor: [{ name: "show", options: [{ name: "duration", value: 0 }] }],
      methods: { 1: [{ name: "text", options: [{ name: "text", value: "hello" }] }] },
    },
    inst_b: { constructor: [], methods: {} },
  },
});

test("duplicateName: appends (Copy) and resolves collisions case-insensitively", () => {
  assert.equal(duplicateName("Foo", ["Foo"]), "Foo (Copy)");
  assert.equal(duplicateName("Foo", ["Foo", "foo (copy)"]), "Foo (Copy 2)");
  assert.equal(duplicateName("Foo (Copy)", ["Foo", "Foo (Copy)"]), "Foo (Copy 2)");
  assert.equal(
    duplicateName("Foo (Copy 2)", ["Foo", "Foo (Copy)", "Foo (Copy 2)"]),
    "Foo (Copy 3)"
  );
});

test("duplicateTrack: applies new id/name/slot, remaps module instance ids, leaves source intact", () => {
  const source = makeTrack();
  const sourceSnapshot = JSON.parse(JSON.stringify(source));
  let n = 0;
  const copy = duplicateTrack(source, {
    newId: "track_2",
    name: "My Track (Copy)",
    trackSlot: 4,
    makeModuleId: () => `inst_new_${++n}`,
  });

  assert.equal(copy.id, "track_2");
  assert.equal(copy.name, "My Track (Copy)");
  assert.equal(copy.trackSlot, 4);
  assert.deepEqual(
    copy.modules.map((m) => m.id),
    ["inst_new_1", "inst_new_2"]
  );
  assert.equal(copy.modules[1].disabled, true);
  assert.deepEqual(Object.keys(copy.modulesData).sort(), ["inst_new_1", "inst_new_2"]);
  assert.deepEqual(copy.modulesData.inst_new_1, source.modulesData.inst_a);
  assert.notEqual(copy.modulesData.inst_new_1, source.modulesData.inst_a);
  assert.deepEqual(copy.channelMappings, source.channelMappings);
  assert.notEqual(copy.signal, source.signal);
  assert.deepEqual(source, sourceSnapshot);
});

test("duplicateTrack: keeps the source slot when trackSlot is null", () => {
  const copy = duplicateTrack(makeTrack(), {
    newId: "track_2",
    name: "X",
    trackSlot: null,
    makeModuleId: () => "inst_new",
  });
  assert.equal(copy.trackSlot, 1);
});

test("duplicateSet: regenerates set and track ids and reports the track id map", () => {
  const source = {
    id: "set_1",
    name: "Main",
    tracks: [makeTrack(), { ...makeTrack(), id: "track_9", name: "Other", trackSlot: 2 }],
  };
  let t = 0;
  let m = 0;
  const { set: copy, trackIdMap } = duplicateSet(source, {
    newId: "set_2",
    name: "Main (Copy)",
    makeTrackId: () => `track_new_${++t}`,
    makeModuleId: () => `inst_new_${++m}`,
  });

  assert.equal(copy.id, "set_2");
  assert.equal(copy.name, "Main (Copy)");
  assert.deepEqual(
    copy.tracks.map((tr) => tr.id),
    ["track_new_1", "track_new_2"]
  );
  assert.deepEqual(trackIdMap, { track_1: "track_new_1", track_9: "track_new_2" });
  assert.equal(copy.tracks[0].name, "My Track");
  assert.equal(copy.tracks[0].trackSlot, 1);
  assert.equal(copy.tracks[1].trackSlot, 2);
  assert.equal(source.tracks[0].id, "track_1");
});

test("duplicateModuleInstanceInTrack: inserts the copy after the source with copied data", () => {
  const track = makeTrack();
  const ok = duplicateModuleInstanceInTrack(track, "inst_a", "inst_c");
  assert.equal(ok, true);
  assert.deepEqual(
    track.modules.map((mod) => mod.id),
    ["inst_a", "inst_c", "inst_b"]
  );
  assert.equal(track.modules[1].type, "Text");
  assert.deepEqual(track.modulesData.inst_c, track.modulesData.inst_a);
  assert.notEqual(track.modulesData.inst_c, track.modulesData.inst_a);
  track.modulesData.inst_c.methods["1"] = [];
  assert.equal(track.modulesData.inst_a.methods["1"].length, 1);
});

test("duplicateModuleInstanceInTrack: copies the disabled flag and tolerates missing modulesData entry", () => {
  const track = makeTrack();
  delete track.modulesData.inst_b;
  const ok = duplicateModuleInstanceInTrack(track, "inst_b", "inst_d");
  assert.equal(ok, true);
  assert.equal(track.modules[2].id, "inst_d");
  assert.equal(track.modules[2].disabled, true);
  assert.equal(track.modulesData.inst_d, undefined);
});

test("duplicateModuleInstanceInTrack: returns false for an unknown instance", () => {
  const track = makeTrack();
  assert.equal(duplicateModuleInstanceInTrack(track, "missing", "inst_x"), false);
  assert.equal(track.modules.length, 2);
});

test("copyRecordingEntries: deep-copies entries under new ids and skips missing sources", () => {
  const recordings = {
    track_1: { channels: [{ name: "ch1", sequences: [{ time: 0, duration: 0.1 }] }], sequencer: { bpm: 100, pattern: { 1: [0, 4] } } },
    track_other: { channels: [] },
  };
  const result = copyRecordingEntries(recordings, { track_1: "track_2", track_missing: "track_3" });
  assert.deepEqual(result.track_2, recordings.track_1);
  assert.notEqual(result.track_2, recordings.track_1);
  assert.equal(result.track_3, undefined);
  assert.deepEqual(result.track_other, { channels: [] });
  result.track_2.sequencer.pattern["1"].push(8);
  assert.deepEqual(recordings.track_1.sequencer.pattern["1"], [0, 4]);
});
