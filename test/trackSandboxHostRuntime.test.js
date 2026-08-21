const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { TrackSandboxHost } = require(
  path.join(
    __dirname,
    "..",
    "dist",
    "runtime",
    "projector",
    "internal",
    "sandbox",
    "TrackSandboxHost.js"
  )
);

const withBridge = async (sandbox, fn) => {
  const prev = globalThis.nwWrldBridge;
  globalThis.nwWrldBridge = { sandbox };
  try {
    return await fn();
  } finally {
    globalThis.nwWrldBridge = prev;
  }
};

test("TrackSandboxHost: request reuses the cached token without re-ensuring", async () => {
  let ensureCalls = 0;
  const requests = [];
  await withBridge(
    {
      ensure: async () => {
        ensureCalls += 1;
        return { ok: true, token: "tok-1" };
      },
      request: async (token, type, props) => {
        requests.push({ token, type, props });
        return { ok: true };
      },
    },
    async () => {
      const host = new TrackSandboxHost(null);
      const first = await host.request("invokeOnInstance", { a: 1 });
      const second = await host.request("invokeOnInstance", { a: 2 });
      assert.equal(first.ok, true);
      assert.equal(second.ok, true);
      assert.equal(ensureCalls, 1);
      assert.deepEqual(
        requests.map((r) => r.token),
        ["tok-1", "tok-1"]
      );
    }
  );
});

test("TrackSandboxHost: stale token re-ensures and retries the same payload once", async () => {
  let ensureCalls = 0;
  const requests = [];
  await withBridge(
    {
      ensure: async () => {
        ensureCalls += 1;
        return { ok: true, token: `tok-${ensureCalls}` };
      },
      request: async (token, type, props) => {
        requests.push({ token, type, props });
        if (token === "tok-1") return { ok: false, error: "TOKEN_NOT_OWNED" };
        return { ok: true };
      },
    },
    async () => {
      const host = new TrackSandboxHost(null);
      const res = await host.request("invokeOnInstance", { x: 1 });
      assert.equal(res.ok, true);
      assert.equal(ensureCalls, 2);
      assert.equal(requests.length, 2);
      assert.equal(requests[0].token, "tok-1");
      assert.equal(requests[1].token, "tok-2");
      assert.deepEqual(requests[1].props, { x: 1 });
      assert.equal(requests[1].type, "invokeOnInstance");
    }
  );
});

test("TrackSandboxHost: a failing retry is returned without looping", async () => {
  let requestCalls = 0;
  await withBridge(
    {
      ensure: async () => ({ ok: true, token: "tok" }),
      request: async () => {
        requestCalls += 1;
        return { ok: false, error: "TOKEN_NOT_OWNED" };
      },
    },
    async () => {
      const host = new TrackSandboxHost(null);
      const res = await host.request("invokeOnInstance", {});
      assert.equal(res.ok, false);
      assert.equal(res.error, "TOKEN_NOT_OWNED");
      assert.equal(requestCalls, 2);
    }
  );
});

test("TrackSandboxHost: non-token errors are not retried", async () => {
  let requestCalls = 0;
  await withBridge(
    {
      ensure: async () => ({ ok: true, token: "tok" }),
      request: async () => {
        requestCalls += 1;
        return { ok: false, error: "TIMEOUT" };
      },
    },
    async () => {
      const host = new TrackSandboxHost(null);
      const res = await host.request("invokeOnInstance", {});
      assert.equal(res.error, "TIMEOUT");
      assert.equal(requestCalls, 1);
    }
  );
});

test("TrackSandboxHost: destroyed host does not re-ensure or retry", async () => {
  let ensureCalls = 0;
  let requestCalls = 0;
  await withBridge(
    {
      ensure: async () => {
        ensureCalls += 1;
        return { ok: true, token: "tok" };
      },
      request: async (token) => {
        requestCalls += 1;
        return token ? { ok: true } : { ok: false, error: "INVALID_TOKEN" };
      },
      destroy: async () => ({ ok: true }),
    },
    async () => {
      const host = new TrackSandboxHost(null);
      await host.destroy();
      const res = await host.request("invokeOnInstance", {});
      assert.equal(res.ok, false);
      assert.equal(ensureCalls, 0);
      assert.equal(requestCalls, 1);
    }
  );
});
