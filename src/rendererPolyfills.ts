// Ensure Node-ish globals expected by some deps exist even with nodeIntegration disabled.
// This runs before the main renderer entrypoint via webpack entry ordering.
try {
  const g = globalThis as typeof globalThis & { global?: typeof globalThis };
  if (typeof g.global === "undefined") {
    g.global = globalThis;
  }
} catch {}
