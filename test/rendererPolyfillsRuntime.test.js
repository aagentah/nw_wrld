const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const polyfillsPath = path.join(__dirname, "..", "dist", "runtime", "rendererPolyfills.js");

const loadPolyfillsFresh = () => {
  delete require.cache[require.resolve(polyfillsPath)];
  require(polyfillsPath);
};

test("rendererPolyfills: sets globalThis.global when missing", () => {
  const prev = globalThis.global;
  try {
    delete globalThis.global;
    assert.equal(typeof globalThis.global, "undefined");
    loadPolyfillsFresh();
    assert.equal(globalThis.global, globalThis);
  } finally {
    if (typeof prev === "undefined") {
      delete globalThis.global;
    } else {
      globalThis.global = prev;
    }
  }
});

test("rendererPolyfills: does not overwrite existing globalThis.global", () => {
  const prev = globalThis.global;
  try {
    const sentinel = {};
    globalThis.global = sentinel;
    loadPolyfillsFresh();
    assert.equal(globalThis.global, sentinel);
  } finally {
    if (typeof prev === "undefined") {
      delete globalThis.global;
    } else {
      globalThis.global = prev;
    }
  }
});

