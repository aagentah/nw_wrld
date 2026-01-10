// src/projector/helpers/__tests__/logger.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let logger: any;

  beforeEach(async () => {
    // Spy on console methods BEFORE importing logger
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error');

    // Import logger after spies are set up
    const loggerModule = await import('../logger');
    logger = loggerModule.logger;
  });

  afterEach(() => {
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('debugEnabled property', () => {
    it('should be a boolean', () => {
      expect(typeof logger.debugEnabled).toBe('boolean');
    });
  });

  describe('log method', () => {
    it('should be a function', () => {
      expect(typeof logger.log).toBe('function');
    });

    it('should call console.log when debug is enabled', () => {
      // Only test if debug is enabled
      if (logger.debugEnabled) {
        logger.log('test message');
        expect(consoleLogSpy).toHaveBeenCalledWith('test message');
      } else {
        // When debug is disabled, log should be a no-op
        logger.log('test message');
        expect(consoleLogSpy).not.toHaveBeenCalled();
      }
    });

    it('should handle multiple arguments', () => {
      if (logger.debugEnabled) {
        logger.log('message', { data: 'test' }, 123);
        expect(consoleLogSpy).toHaveBeenCalledWith('message', { data: 'test' }, 123);
      } else {
        logger.log('message', { data: 'test' }, 123);
        expect(consoleLogSpy).not.toHaveBeenCalled();
      }
    });
  });

  describe('warn method', () => {
    it('should be a function', () => {
      expect(typeof logger.warn).toBe('function');
    });

    it('should call console.warn when debug is enabled', () => {
      if (logger.debugEnabled) {
        logger.warn('warning message');
        expect(consoleWarnSpy).toHaveBeenCalledWith('warning message');
      } else {
        // When debug is disabled, warn should be a no-op
        logger.warn('warning message');
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      }
    });

    it('should handle multiple arguments', () => {
      if (logger.debugEnabled) {
        logger.warn('warning', { context: 'test' });
        expect(consoleWarnSpy).toHaveBeenCalledWith('warning', { context: 'test' });
      } else {
        logger.warn('warning', { context: 'test' });
        expect(consoleWarnSpy).not.toHaveBeenCalled();
      }
    });
  });

  describe('error method', () => {
    it('should be a function', () => {
      expect(typeof logger.error).toBe('function');
    });

    it('should always be enabled regardless of debug mode', () => {
      // The error function should always be a bound version of console.error, not a no-op
      expect(logger.error.name).toBe('bound error');
    });

    it('should not throw when called with various arguments', () => {
      expect(() => {
        logger.error('error message');
        logger.error(new Error('Test error'));
        logger.error('error', { details: 'test' }, new Error('test'));
      }).not.toThrow();
    });
  });

  describe('performance characteristics', () => {
    it('should not throw errors when called with any arguments', () => {
      expect(() => {
        logger.log();
        logger.warn();
        logger.error();
        logger.log(null);
        logger.log(undefined);
        logger.warn({}, [], 123);
        logger.error(new Error('test'), { context: 'test' });
      }).not.toThrow();
    });
  });
});
