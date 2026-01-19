const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const InputManager = require(path.join(__dirname, "..", "dist", "runtime", "main", "InputManager.js"))
  .default;

const { normalizeInputEventPayload } = require(path.join(
  __dirname,
  "..",
  "dist",
  "runtime",
  "shared",
  "validation",
  "inputEventValidation.js"
));

test("InputManager.broadcast sends only normalized input-event payloads", () => {
  const sent = { dashboard: [], projector: [] };

  const mkWindow = (bucket) => ({
    isDestroyed: () => false,
    webContents: {
      isDestroyed: () => false,
      send: (_channel, payload) => {
        bucket.push(payload);
      },
    },
  });

  const dash = mkWindow(sent.dashboard);
  const proj = mkWindow(sent.projector);

  const prevNow = Date.now;
  try {
    Date.now = () => 1700000000000;

    const mgr = new InputManager(dash, proj);
    mgr.broadcast("track-selection", { source: "midi", note: 60, channel: 1, velocity: 0.5 });

    assert.equal(sent.dashboard.length, 1);
    assert.equal(sent.projector.length, 1);

    const expected = normalizeInputEventPayload({
      type: "track-selection",
      data: { source: "midi", note: 60, channel: 1, velocity: 0.5, timestamp: 1700000000 },
    });
    assert.ok(expected);
    assert.deepEqual(sent.dashboard[0], expected);
    assert.deepEqual(sent.projector[0], expected);
  } finally {
    Date.now = prevNow;
  }
});

