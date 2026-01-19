const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const loggerPath = path.join(
  __dirname,
  "..",
  "dist",
  "runtime",
  "projector",
  "helpers",
  "logger.js"
);

const loadLoggerFresh = (bridge) => {
  const prev = globalThis.nwWrldBridge;
  try {
    if (typeof bridge === "undefined") {
      delete globalThis.nwWrldBridge;
    } else {
      globalThis.nwWrldBridge = bridge;
    }
    delete require.cache[require.resolve(loggerPath)];
    return require(loggerPath);
  } finally {
    if (typeof prev === "undefined") {
      delete globalThis.nwWrldBridge;
    } else {
      globalThis.nwWrldBridge = prev;
    }
  }
};

test("logger: debugEnabled is true when bridge reports not packaged", () => {
  const mod = loadLoggerFresh({ app: { isPackaged: () => false } });
  const logger = mod?.default || mod?.logger || mod;
  assert.equal(logger.debugEnabled, true);
});

test("logger: debugEnabled defaults to false when bridge is missing", () => {
  const mod = loadLoggerFresh(undefined);
  const logger = mod?.default || mod?.logger || mod;
  assert.equal(logger.debugEnabled, false);
});

