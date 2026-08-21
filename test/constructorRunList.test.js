const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { resolveConstructorRunList } = require(
  path.join(__dirname, "..", "dist", "runtime", "projector", "internal", "track", "constructorRunList.js")
);

const names = (list) => list.map((m) => m.name);

test("resolveConstructorRunList: prepends a class executeOnLoad method missing from the saved constructor", () => {
  // Bug: AsteroidGraph saved as [matrix, show]; loadMeteors (its executeOnLoad data
  // loader) was dropped, so it never ran and the module drew nothing.
  const saved = [
    { name: "matrix", options: [{ name: "matrix", value: { rows: 1, cols: 1 } }] },
    { name: "show", options: [{ name: "duration", value: 0 }] },
  ];
  const classMethods = [
    { name: "loadMeteors", executeOnLoad: true, options: [{ name: "count", defaultVal: 5 }] },
  ];
  const runList = resolveConstructorRunList(saved, classMethods);
  assert.deepEqual(names(runList), ["loadMeteors", "show"]);
  const loader = runList.find((m) => m.name === "loadMeteors");
  assert.deepEqual(loader.options, [{ name: "count", value: 5 }]);
});

test("resolveConstructorRunList: never includes matrix (handled separately)", () => {
  const saved = [{ name: "matrix", options: [] }];
  const classMethods = [{ name: "matrix", executeOnLoad: true, options: [] }];
  assert.deepEqual(names(resolveConstructorRunList(saved, classMethods)), []);
});

test("resolveConstructorRunList: does not duplicate an executeOnLoad method already saved (keeps saved options)", () => {
  const saved = [
    { name: "matrix", options: [] },
    { name: "loadData", options: [{ name: "dataPath", value: "json/custom.json" }] },
  ];
  const classMethods = [
    { name: "loadData", executeOnLoad: true, options: [{ name: "dataPath", defaultVal: "json/radiation.json" }] },
  ];
  const runList = resolveConstructorRunList(saved, classMethods);
  assert.deepEqual(names(runList), ["loadData"]);
  // saved options preserved, not overwritten with defaults
  assert.deepEqual(runList[0].options, [{ name: "dataPath", value: "json/custom.json" }]);
});

test("resolveConstructorRunList: ignores non-executeOnLoad class methods", () => {
  const saved = [{ name: "matrix", options: [] }];
  const classMethods = [{ name: "color", executeOnLoad: false, options: [] }];
  assert.deepEqual(names(resolveConstructorRunList(saved, classMethods)), []);
});

test("resolveConstructorRunList: preserves saved non-matrix methods when nothing is missing", () => {
  const saved = [
    { name: "matrix", options: [] },
    { name: "size", options: [{ name: "size", value: 20 }] },
  ];
  assert.deepEqual(names(resolveConstructorRunList(saved, [])), ["size"]);
});
