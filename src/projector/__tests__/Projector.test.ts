/**
 * Tests for Projector class
 * Tests the main projector module that manages tracks, modules, and IPC communication
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Projector from '../Projector';

// Mock logger to enable debug mode in tests
vi.mock('../helpers/logger', () => ({
  debugEnabled: true,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  default: {
    debugEnabled: true,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock global bridge
(globalThis as any).nwWrldBridge = {
  sandbox: {
    ensure: vi.fn(() => Promise.resolve({ ok: true, token: 'test-token' })),
    request: vi.fn(() => Promise.resolve({ ok: true })),
    destroy: vi.fn(),
  },
  workspace: {
    readModuleWithMeta: vi.fn(() => Promise.resolve({ text: 'export class TestModule {}', mtimeMs: Date.now() })),
    getModuleUrl: vi.fn(() => Promise.resolve({ mtimeMs: Date.now() })),
  },
};

// Mock messaging
const mockMessaging = {
  sendToDashboard: vi.fn(),
  onFromDashboard: vi.fn(),
  onWorkspaceModulesChanged: vi.fn(),
  onInputEvent: vi.fn(),
};

(globalThis as any).nwWrldBridge.messaging = mockMessaging;

// Mock app bridge
(globalThis as any).nwWrldAppBridge = {
  logToMain: vi.fn(),
};

describe('Projector', () => {
  beforeEach(() => {
    // Reset Projector state
    Projector.activeTrack = null;
    Projector.activeModules = {};
    Projector.activeChannelHandlers = {};
    Projector.userData = [];
    Projector.isDeactivating = false;
    Projector.isLoadingTrack = false;
    Projector.debugOverlayActive = false;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with null activeTrack', () => {
      expect(Projector.activeTrack).toBeNull();
    });

    it('should initialize with empty activeModules', () => {
      expect(Projector.activeModules).toEqual({});
    });

    it('should initialize with empty userData', () => {
      expect(Projector.userData).toEqual([]);
    });

    it('should initialize caches as Maps', () => {
      expect(Projector.moduleClassCache).toBeInstanceOf(Map);
      expect(Projector.workspaceModuleSourceCache).toBeInstanceOf(Map);
      expect(Projector.runtimeMatrixOverrides).toBeInstanceOf(Map);
    });
  });

  describe('getAssetsBaseUrlForSandboxToken', () => {
    it('should return null for empty token', () => {
      expect(Projector.getAssetsBaseUrlForSandboxToken('')).toBeNull();
    });

    it('should return null for null token', () => {
      expect(Projector.getAssetsBaseUrlForSandboxToken(null as any)).toBeNull();
    });

    it('should return properly formatted URL for valid token', () => {
      const result = Projector.getAssetsBaseUrlForSandboxToken('test-token');
      expect(result).toBe('nw-assets://app/test-token/');
    });

    it('should URL encode token', () => {
      const result = Projector.getAssetsBaseUrlForSandboxToken('test token with spaces');
      expect(result).toBe('nw-assets://app/test%20token%20with%20spaces/');
    });
  });

  describe('introspectModule', () => {
    it('should return error for invalid module ID', async () => {
      const result = await Projector.introspectModule('');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('INVALID_MODULE_ID');
    });

    it('should return error for null module ID', async () => {
      const result = await Projector.introspectModule(null as any);
      expect(result.ok).toBe(false);
      expect(result.error).toBe('INVALID_MODULE_ID');
    });

    it('should cache results', async () => {
      const result1 = await Projector.introspectModule('TestModule');
      const result2 = await Projector.introspectModule('TestModule');
      expect(result1).toBe(result2);
    });
  });

  describe('logToMain', () => {
    it('should call appBridge.logToMain if available', () => {
      Projector.logToMain('test message');
      expect((globalThis as any).nwWrldAppBridge.logToMain).toHaveBeenCalledWith('test message');
    });

    it('should not throw if appBridge is unavailable', () => {
      delete (globalThis as any).nwWrldAppBridge;
      expect(() => Projector.logToMain('test message')).not.toThrow();
    });
  });

  describe('queueDebugLog', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      Projector.debugOverlayActive = true;
      Projector.debugLogQueue = [];
      Projector.debugLogTimeout = null;
    });

    afterEach(() => {
      vi.useRealTimers();
      Projector.debugOverlayActive = false;
    });

    it('should queue logs when debug overlay is active', () => {
      Projector.queueDebugLog('test log');
      expect(Projector.debugLogQueue).toContain('test log');
    });

    it('should not queue logs when debug overlay is inactive', () => {
      Projector.debugOverlayActive = false;
      Projector.queueDebugLog('test log');
      expect(Projector.debugLogQueue).not.toContain('test log');
    });

    it('should flush logs after timeout', () => {
      Projector.queueDebugLog('log 1');
      Projector.queueDebugLog('log 2');

      vi.advanceTimersByTime(150);

      expect(mockMessaging.sendToDashboard).toHaveBeenCalledWith(
        'debug-log',
        { log: 'log 1\n\nlog 2' }
      );
      expect(Projector.debugLogQueue).toEqual([]);
    });
  });

  describe('toggleAspectRatioStyle', () => {
    beforeEach(() => {
      // Set up settings with aspectRatios
      Projector.settings = {
        aspectRatios: [
          { id: '16-9', name: '16:9' },
          { id: '9-16', name: '9:16' },
          { id: '4-5', name: '4:5' },
          { id: 'default', name: 'Default' },
          { id: 'landscape', name: 'Landscape' },
        ]
      };
    });

    afterEach(() => {
      // Clean up settings
      Projector.settings = {} as any;
    });

    it('should remove existing ratio classes', () => {
      document.documentElement.classList.add('reel');
      Projector.toggleAspectRatioStyle('16-9');
      expect(document.documentElement.classList.contains('reel')).toBe(false);
    });

    it('should add reel class for 9-16 ratio', () => {
      Projector.toggleAspectRatioStyle('9-16');
      expect(document.documentElement.classList.contains('reel')).toBe(true);
    });

    it('should add scale class for 4-5 ratio', () => {
      Projector.toggleAspectRatioStyle('4-5');
      expect(document.documentElement.classList.contains('scale')).toBe(true);
    });

    it('should trigger resize event', () => {
      vi.useFakeTimers();

      const resizeSpy = vi.fn();
      window.addEventListener('resize', resizeSpy);

      Projector.toggleAspectRatioStyle('16-9');

      // Run all timers to trigger requestAnimationFrame
      vi.runAllTimers();

      expect(resizeSpy).toHaveBeenCalled();
      window.removeEventListener('resize', resizeSpy);

      vi.useRealTimers();
    });
  });

  describe('setBg', () => {
    it('should set background color', () => {
      Projector.settings = {
        backgroundColors: [
          { id: 'red', value: '#ff0000' }
        ]
      };
      Projector.setBg('red');
      expect(document.documentElement.style.backgroundColor).toBe('#ff0000');
    });

    it('should set invert filter', () => {
      Projector.settings = {
        backgroundColors: [
          { id: 'red', value: '#ff0000' }
        ]
      };
      Projector.setBg('red');
      expect(document.documentElement.style.filter).toBe('invert(0)');
    });
  });

  describe('deactivateActiveTrack', () => {
    it('should return early if no active track', () => {
      Projector.activeTrack = null;
      Projector.deactivateActiveTrack();
      expect(Projector.isDeactivating).toBe(false);
    });

    it('should return early if already deactivating', () => {
      Projector.activeTrack = { name: 'test', modules: [], modulesData: {}, channelMappings: {} } as any;
      Projector.isDeactivating = true;
      Projector.deactivateActiveTrack();
      expect(Projector.isDeactivating).toBe(true);
    });

    it('should clear active track state', () => {
      const container = document.createElement('div');
      container.className = 'modules';
      document.body.appendChild(container);

      Projector.activeTrack = { name: 'test', modules: [], modulesData: {}, channelMappings: {} } as any;
      Projector.deactivateActiveTrack();

      expect(Projector.activeTrack).toBeNull();
      expect(Projector.activeModules).toEqual({});
      expect(Projector.isDeactivating).toBe(false);

      document.body.removeChild(container);
    });
  });

  describe('refreshPage', () => {
    it('should reload the page', () => {
      const reloadSpy = vi.fn();
      Object.defineProperty(window.location, 'reload', {
        value: reloadSpy,
        writable: true
      });
      Projector.refreshPage();
      expect(reloadSpy).toHaveBeenCalled();
    });
  });
});
