const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const amPath = path.join(
  __dirname,
  "..",
  "dist",
  "runtime",
  "projector",
  "helpers",
  "animationManager.js"
);

const withRafStubs = (fn) => {
  const prevRaf = globalThis.requestAnimationFrame;
  const prevCancel = globalThis.cancelAnimationFrame;

  let nextId = 1;
  let lastCallback = null;
  const cancelled = new Set();
  const requestedIds = [];

  globalThis.requestAnimationFrame = (cb) => {
    const id = nextId++;
    requestedIds.push(id);
    lastCallback = cb;
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    cancelled.add(id);
  };

  try {
    return fn({
      tickOnce: () => {
        if (typeof lastCallback === "function") lastCallback(0);
      },
      requestedIds,
      cancelled,
    });
  } finally {
    globalThis.requestAnimationFrame = prevRaf;
    globalThis.cancelAnimationFrame = prevCancel;
  }
};

const loadAnimationManagerFresh = () => {
  delete require.cache[require.resolve(amPath)];
  return require(amPath);
};

test("animationManager: subscribe/unsubscribe manages RAF lifecycle and calls callbacks", () => {
  withRafStubs(({ tickOnce, requestedIds, cancelled }) => {
    const { animationManager } = loadAnimationManagerFresh();
    let calls = 0;
    const cb = () => {
      calls += 1;
    };

    animationManager.subscribe(cb);
    assert.equal(animationManager.getSubscriberCount(), 1);
    assert.equal(requestedIds.length, 1);

    tickOnce();
    assert.equal(calls, 1);

    animationManager.unsubscribe(cb);
    assert.equal(animationManager.getSubscriberCount(), 0);
    assert.ok(cancelled.has(requestedIds[requestedIds.length - 1]));
  });
});

test("animationManager: subscribe ignores non-functions", () => {
  withRafStubs(({ requestedIds }) => {
    const { animationManager } = loadAnimationManagerFresh();
    animationManager.subscribe(null);
    assert.equal(animationManager.getSubscriberCount(), 0);
    assert.equal(requestedIds.length, 0);
  });
});

