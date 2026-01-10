/**
 * Renderer polyfills for nw_wrld
 * Ensures Node-ish globals exist even with nodeIntegration disabled
 * This runs before the main renderer entrypoint via webpack entry ordering
 */

try {
  if (typeof globalThis.global === "undefined") {
    (globalThis as any).global = globalThis;
  }
} catch {
  // Ignore errors
}

export {};
