import { expect, afterEach, vi } from 'vitest';

// Try to import React testing library, but don't fail if it's not available
try {
  const { cleanup } = require('@testing-library/react');
  const matchers = require('@testing-library/jest-dom/matchers');

  // Extend Vitest's expect with jest-dom matchers
  expect.extend(matchers);

  // Cleanup after each test
  afterEach(() => {
    cleanup();
  });
} catch (e) {
  // React testing library not available, skip React-specific setup
  console.debug('React testing library not available, skipping React-specific setup');
}

// Only set up browser-specific mocks if window is available (renderer process)
if (typeof window !== 'undefined') {
  // Mock the Electron API
  (globalThis as any).window.electronAPI = {
    sendMessage: vi.fn(),
    onMessage: vi.fn(),
    removeAllListeners: vi.fn(),
  };

  // Mock the nwWrldBridge
  (globalThis as any).window.nwWrldBridge = {
    send: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  };

  // Mock requestAnimationFrame for tests
  global.requestAnimationFrame = (callback: FrameRequestCallback) => {
    return setTimeout(callback, 16) as unknown as number;
  };

  global.cancelAnimationFrame = (id: number) => {
    clearTimeout(id);
  };
}
