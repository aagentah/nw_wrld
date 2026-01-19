const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { loadJsonFile, loadJsonFileSync, saveJsonFile, saveJsonFileSync } = require(
  path.join(__dirname, "..", "dist", "runtime", "shared", "json", "jsonFileBase.js")
);

test("jsonFileBase: loadJsonFile returns default when bridge missing", async () => {
  const prev = globalThis.nwWrldAppBridge;
  try {
    delete globalThis.nwWrldAppBridge;
    const res = await loadJsonFile("x.json", { ok: true }, "warn");
    assert.deepEqual(res, { ok: true });
  } finally {
    globalThis.nwWrldAppBridge = prev;
  }
});

test("jsonFileBase: loadJsonFile uses bridge.read when available", async () => {
  const prev = globalThis.nwWrldAppBridge;
  try {
    globalThis.nwWrldAppBridge = {
      json: {
        read: async (filename, defaultValue) => {
          assert.equal(filename, "x.json");
          assert.deepEqual(defaultValue, { ok: true });
          return { ok: false };
        },
      },
    };
    const res = await loadJsonFile("x.json", { ok: true }, "warn");
    assert.deepEqual(res, { ok: false });
  } finally {
    globalThis.nwWrldAppBridge = prev;
  }
});

test("jsonFileBase: loadJsonFile returns default and warns when bridge.read throws", async () => {
  const prevBridge = globalThis.nwWrldAppBridge;
  const prevWarn = console.warn;
  let calls = 0;
  try {
    globalThis.nwWrldAppBridge = {
      json: {
        read: async () => {
          throw new Error("BOOM");
        },
      },
    };
    console.warn = () => {
      calls += 1;
    };
    const res = await loadJsonFile("x.json", { ok: true }, "warn");
    assert.deepEqual(res, { ok: true });
    assert.equal(calls, 1);
  } finally {
    console.warn = prevWarn;
    globalThis.nwWrldAppBridge = prevBridge;
  }
});

test("jsonFileBase: loadJsonFileSync returns default when bridge missing", () => {
  const prev = globalThis.nwWrldAppBridge;
  try {
    delete globalThis.nwWrldAppBridge;
    const res = loadJsonFileSync("x.json", { ok: true }, "err");
    assert.deepEqual(res, { ok: true });
  } finally {
    globalThis.nwWrldAppBridge = prev;
  }
});

test("jsonFileBase: loadJsonFileSync uses bridge.readSync when available", () => {
  const prev = globalThis.nwWrldAppBridge;
  try {
    globalThis.nwWrldAppBridge = {
      json: {
        readSync: (filename, defaultValue) => {
          assert.equal(filename, "x.json");
          assert.deepEqual(defaultValue, { ok: true });
          return { ok: false };
        },
      },
    };
    const res = loadJsonFileSync("x.json", { ok: true }, "err");
    assert.deepEqual(res, { ok: false });
  } finally {
    globalThis.nwWrldAppBridge = prev;
  }
});

test("jsonFileBase: loadJsonFileSync returns default and errors when bridge.readSync throws", () => {
  const prevBridge = globalThis.nwWrldAppBridge;
  const prevErr = console.error;
  let calls = 0;
  try {
    globalThis.nwWrldAppBridge = {
      json: {
        readSync: () => {
          throw new Error("BOOM");
        },
      },
    };
    console.error = () => {
      calls += 1;
    };
    const res = loadJsonFileSync("x.json", { ok: true }, "err");
    assert.deepEqual(res, { ok: true });
    assert.equal(calls, 1);
  } finally {
    console.error = prevErr;
    globalThis.nwWrldAppBridge = prevBridge;
  }
});

test("jsonFileBase: saveJsonFile logs and returns when bridge missing", async () => {
  const prevBridge = globalThis.nwWrldAppBridge;
  const prevErr = console.error;
  let calls = 0;
  try {
    delete globalThis.nwWrldAppBridge;
    console.error = () => {
      calls += 1;
    };
    await saveJsonFile("x.json", { a: 1 });
    assert.equal(calls, 1);
  } finally {
    console.error = prevErr;
    globalThis.nwWrldAppBridge = prevBridge;
  }
});

test("jsonFileBase: saveJsonFileSync logs and returns when bridge missing", () => {
  const prevBridge = globalThis.nwWrldAppBridge;
  const prevErr = console.error;
  let calls = 0;
  try {
    delete globalThis.nwWrldAppBridge;
    console.error = () => {
      calls += 1;
    };
    saveJsonFileSync("x.json", { a: 1 });
    assert.equal(calls, 1);
  } finally {
    console.error = prevErr;
    globalThis.nwWrldAppBridge = prevBridge;
  }
});

test("jsonFileBase: saveJsonFile logs when bridge.write throws", async () => {
  const prevBridge = globalThis.nwWrldAppBridge;
  const prevErr = console.error;
  let calls = 0;
  try {
    globalThis.nwWrldAppBridge = {
      json: {
        write: async () => {
          throw new Error("BOOM");
        },
      },
    };
    console.error = () => {
      calls += 1;
    };
    await saveJsonFile("x.json", { a: 1 });
    assert.equal(calls, 1);
  } finally {
    console.error = prevErr;
    globalThis.nwWrldAppBridge = prevBridge;
  }
});

test("jsonFileBase: saveJsonFileSync logs when bridge.writeSync throws", () => {
  const prevBridge = globalThis.nwWrldAppBridge;
  const prevErr = console.error;
  let calls = 0;
  try {
    globalThis.nwWrldAppBridge = {
      json: {
        writeSync: () => {
          throw new Error("BOOM");
        },
      },
    };
    console.error = () => {
      calls += 1;
    };
    saveJsonFileSync("x.json", { a: 1 });
    assert.equal(calls, 1);
  } finally {
    console.error = prevErr;
    globalThis.nwWrldAppBridge = prevBridge;
  }
});

test("jsonFileBase: saveJsonFile logs and returns when bridge.write returns ok:false", async () => {
  const prevBridge = globalThis.nwWrldAppBridge;
  const prevErr = console.error;
  let calls = 0;
  try {
    globalThis.nwWrldAppBridge = {
      json: {
        write: async () => ({ ok: false, reason: "NO_DIR" }),
      },
    };
    console.error = () => {
      calls += 1;
    };
    await saveJsonFile("x.json", { a: 1 });
    assert.equal(calls, 1);
  } finally {
    console.error = prevErr;
    globalThis.nwWrldAppBridge = prevBridge;
  }
});

test("jsonFileBase: saveJsonFileSync logs and returns when bridge.writeSync returns ok:false", () => {
  const prevBridge = globalThis.nwWrldAppBridge;
  const prevErr = console.error;
  let calls = 0;
  try {
    globalThis.nwWrldAppBridge = {
      json: {
        writeSync: () => ({ ok: false, reason: "NO_DIR" }),
      },
    };
    console.error = () => {
      calls += 1;
    };
    saveJsonFileSync("x.json", { a: 1 });
    assert.equal(calls, 1);
  } finally {
    console.error = prevErr;
    globalThis.nwWrldAppBridge = prevBridge;
  }
});

