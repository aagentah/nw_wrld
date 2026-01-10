// src/projector/helpers/logger.ts

/**
 * Logger - Conditional logging utility for performance-critical code
 *
 * Console operations are synchronous and block the main thread.
 * In hot paths (MIDI handlers, animation loops), console logging can add
 * 20-40ms of latency per event when heavily used.
 *
 * Usage:
 * - Set DEBUG = true during development
 * - Set DEBUG = false for production/performance
 * - console.error is always active for critical errors
 */

type Logger = {
  debugEnabled: boolean;
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

const isPackaged = (() => {
  try {
    const bridge = (globalThis as unknown as Window & { nwWrldBridge?: unknown }).nwWrldBridge;
    const fn = bridge && typeof bridge === 'object' && 'app' in bridge
      ? (bridge as { app: { isPackaged?: () => unknown } }).app.isPackaged
      : undefined;
    if (typeof fn === "function") return Boolean(fn());
  } catch {}
  return true;
})();

const DEBUG = !isPackaged;

export const logger: Logger = {
  debugEnabled: DEBUG,
  /**
   * Debug logging - disabled in production for performance
   */
  log: DEBUG ? console.log.bind(console) : () => {},

  /**
   * Warning logging - disabled in production for performance
   */
  warn: DEBUG ? console.warn.bind(console) : () => {},

  /**
   * Error logging - always enabled for critical issues
   */
  error: console.error.bind(console),
};

export default logger;
