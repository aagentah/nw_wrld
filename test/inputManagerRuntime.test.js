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

test("InputManager.getAvailableMIDIDevices returns [] when WebMIDI enable throws", async () => {
  const prev = global.__nwWrldWebMidiOverride;
  try {
    global.__nwWrldWebMidiOverride = {
      enabled: false,
      inputs: [],
      enable: () => {
        throw new Error("enable failed");
      },
    };

    const devices = await InputManager.getAvailableMIDIDevices();
    assert.deepEqual(devices, []);
  } finally {
    if (prev === undefined) delete global.__nwWrldWebMidiOverride;
    else global.__nwWrldWebMidiOverride = prev;
  }
});

test("InputManager.getAvailableMIDIDevices returns [] when WebMIDI inputs getter throws", async () => {
  const prev = global.__nwWrldWebMidiOverride;
  try {
    const mock = {
      enabled: true,
      enable: (_arg) => {},
    };
    Object.defineProperty(mock, "inputs", {
      get() {
        throw new Error("inputs unavailable");
      },
    });
    global.__nwWrldWebMidiOverride = mock;

    const devices = await InputManager.getAvailableMIDIDevices();
    assert.deepEqual(devices, []);
  } finally {
    if (prev === undefined) delete global.__nwWrldWebMidiOverride;
    else global.__nwWrldWebMidiOverride = prev;
  }
});

test("InputManager.initialize rejects safely when WebMIDI enable throws", async () => {
  const prev = global.__nwWrldWebMidiOverride;
  try {
    global.__nwWrldWebMidiOverride = {
      enabled: false,
      inputs: [],
      enable: () => {
        throw new Error("enable failed");
      },
      addListener: () => {},
      removeListener: () => {},
      getInputById: () => null,
      getInputByName: () => null,
    };

    const mkWindow = () => ({
      isDestroyed: () => false,
      webContents: { isDestroyed: () => false, send: () => {} },
    });
    const mgr = new InputManager(mkWindow(), mkWindow());
    await assert.rejects(
      mgr.initialize({
        type: "midi",
        deviceName: "IAC Driver Bus 1",
        trackSelectionChannel: 2,
        methodTriggerChannel: 1,
        velocitySensitive: false,
        noteMatchMode: "pitchClass",
        port: 8000,
      }),
      /enable failed/
    );
  } finally {
    if (prev === undefined) delete global.__nwWrldWebMidiOverride;
    else global.__nwWrldWebMidiOverride = prev;
  }
});

test("InputManager.getAvailableMIDIDevices resolves [] when WebMIDI enable never calls callback (timeout)", async () => {
  const prev = global.__nwWrldWebMidiOverride;
  const prevTimeoutEnv = process.env.NW_WRLD_WEBMIDI_ENABLE_TIMEOUT_MS;
  try {
    process.env.NW_WRLD_WEBMIDI_ENABLE_TIMEOUT_MS = "1";

    let enableCalls = 0;
    global.__nwWrldWebMidiOverride = {
      enabled: false,
      inputs: [],
      enable: () => {
        enableCalls += 1;
      },
    };

    const devices1 = await InputManager.getAvailableMIDIDevices();
    const devices2 = await InputManager.getAvailableMIDIDevices();
    assert.deepEqual(devices1, []);
    assert.deepEqual(devices2, []);
    assert.equal(enableCalls, 2);
  } finally {
    if (prevTimeoutEnv === undefined) delete process.env.NW_WRLD_WEBMIDI_ENABLE_TIMEOUT_MS;
    else process.env.NW_WRLD_WEBMIDI_ENABLE_TIMEOUT_MS = prevTimeoutEnv;
    if (prev === undefined) delete global.__nwWrldWebMidiOverride;
    else global.__nwWrldWebMidiOverride = prev;
  }
});

