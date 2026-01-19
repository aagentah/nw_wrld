const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { isValidOSCTrackAddress, isValidOSCChannelAddress, validateOSCAddress } = require(
  path.join(__dirname, "..", "dist", "runtime", "shared", "validation", "oscValidation.js")
);

test("OSC validation accepts valid track/channel prefixes", () => {
  assert.equal(isValidOSCTrackAddress("/track"), true);
  assert.equal(isValidOSCTrackAddress("/track/intro"), true);
  assert.equal(isValidOSCChannelAddress("/ch/bass"), true);
  assert.equal(isValidOSCChannelAddress("/channel/bass"), true);
});

test("OSC validation rejects invalid addresses with stable errors", () => {
  assert.deepEqual(validateOSCAddress(""), {
    valid: false,
    error: "OSC address cannot be empty",
  });
  assert.deepEqual(validateOSCAddress("track/intro"), {
    valid: false,
    error: "OSC address must start with '/'",
  });
  assert.deepEqual(validateOSCAddress("/track/"), {
    valid: false,
    error: "OSC address '/track/' must include a name",
    suggestion: "Use '/track/name' for track selection (example: '/track/intro')",
  });
  assert.deepEqual(validateOSCAddress("/ch/"), {
    valid: false,
    error: "OSC address must include a name after the prefix",
    suggestion: "Use '/ch/name' or '/channel/name' for channel triggers (example: '/ch/bass')",
  });
  assert.deepEqual(validateOSCAddress("/x/y"), {
    valid: false,
    error: "OSC address must start with '/track/' or '/ch/' (or '/channel/')",
    suggestion: "Use '/track/name' for track selection or '/ch/name' for channel triggers",
  });
});
