const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_INPUT_CONFIG,
  DEFAULT_GLOBAL_MAPPINGS,
  DEFAULT_USER_DATA,
} = require("../dist/runtime/shared/config/defaultConfig.js");

test("defaultConfig exports expected shapes", () => {
  assert.equal(typeof DEFAULT_INPUT_CONFIG, "object");
  assert.equal(typeof DEFAULT_GLOBAL_MAPPINGS, "object");
  assert.equal(typeof DEFAULT_USER_DATA, "object");
});

test("DEFAULT_USER_DATA.config.input is DEFAULT_INPUT_CONFIG (same reference)", () => {
  assert.equal(DEFAULT_USER_DATA.config.input, DEFAULT_INPUT_CONFIG);
});

