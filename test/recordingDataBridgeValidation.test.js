const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { sanitizeJsonForBridge } = require(path.join(
  __dirname,
  "..",
  "dist",
  "runtime",
  "shared",
  "validation",
  "jsonBridgeValidation.js"
));

test("recordingData.json sanitize is a no-op for valid recording data (reference preserved)", () => {
  const input = {
    recordings: {
      "1": {
        channels: [
          {
            name: "bass",
            sequences: [
              { time: 0.1, duration: 0.2 },
              { time: 1.5, duration: 0.25 },
            ],
          },
        ],
        sequencer: {
          pattern: {
            "1": [0, 4, 8, 12],
          },
        },
      },
    },
  };

  const res = sanitizeJsonForBridge("recordingData.json", input, { recordings: {} });
  assert.equal(res, input);
});

test("recordingData.json sanitize normalizes pattern steps and drops invalid channel/sequence entries", () => {
  const input = {
    recordings: {
      "1": {
        channels: [
          {
            name: "bass",
            sequences: [
              { time: 0.1, duration: 0.2 },
              { time: "x", duration: 1 },
              { time: 2, duration: null },
            ],
          },
          { name: "   ", sequences: [] },
          null,
        ],
        sequencer: {
          pattern: {
            a: [0, 0, 16, -1, 5, "2"],
            b: "not-an-array",
          },
        },
      },
    },
  };

  const res = sanitizeJsonForBridge("recordingData.json", input, { recordings: {} });
  assert.deepEqual(res, {
    recordings: {
      "1": {
        channels: [
          {
            name: "bass",
            sequences: [{ time: 0.1, duration: 0.2 }],
          },
        ],
        sequencer: { pattern: { a: [0, 5] } },
      },
    },
  });
});

