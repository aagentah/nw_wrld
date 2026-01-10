// src/projector/helpers/__tests__/animationManager.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { animationManager } from '../animationManager';

describe('AnimationManager', () => {
  let requestAnimationFrameSpy: ReturnType<typeof vi.spyOn>;
  let cancelAnimationFrameSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  // Mock animation frame IDs
  let rafIdCounter = 0;
  const mockRafId = () => ++rafIdCounter;

  beforeEach(() => {
    // Reset state
    rafIdCounter = 0;

    // Clear all subscribers and stop animation manager to clean up previous test state
    animationManager._clearAllSubscribers();

    // Spy on requestAnimationFrame and cancelAnimationFrame
    requestAnimationFrameSpy = vi.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => mockRafId());
    cancelAnimationFrameSpy = vi.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Stop animation manager and restore spies
    animationManager.stop();
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('subscribe', () => {
    it('should accept a function callback', () => {
      const callback = vi.fn();
      expect(() => animationManager.subscribe(callback)).not.toThrow();
    });

    it('should start the animation loop when first subscriber is added', () => {
      const callback = vi.fn();
      animationManager.subscribe(callback);
      expect(requestAnimationFrameSpy).toHaveBeenCalled();
    });

    it('should not start the loop again if already running', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      animationManager.subscribe(callback1);
      const initialCallCount = requestAnimationFrameSpy.mock.calls.length;
      animationManager.subscribe(callback2);
      expect(requestAnimationFrameSpy.mock.calls.length).toBe(initialCallCount);
    });

    it('should log error when subscribing with non-function', () => {
      // @ts-expect-error - Testing invalid input
      animationManager.subscribe('not a function');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AnimationManager] Subscribe called with non-function:',
        'not a function'
      );
    });

    it('should not start loop when subscribing with non-function', () => {
      // @ts-expect-error - Testing invalid input
      animationManager.subscribe('not a function');
      expect(requestAnimationFrameSpy).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribe', () => {
    it('should remove a subscribed callback', () => {
      const callback = vi.fn();
      animationManager.subscribe(callback);
      animationManager.unsubscribe(callback);
      expect(animationManager.getSubscriberCount()).toBe(0);
    });

    it('should stop the animation loop when no subscribers remain', () => {
      const callback = vi.fn();
      animationManager.subscribe(callback);
      animationManager.unsubscribe(callback);
      expect(cancelAnimationFrameSpy).toHaveBeenCalled();
    });

    it('should handle unsubscribing a non-existent callback gracefully', () => {
      const callback = vi.fn();
      expect(() => animationManager.unsubscribe(callback)).not.toThrow();
    });

    it('should keep loop running when other subscribers remain', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      animationManager.subscribe(callback1);
      animationManager.subscribe(callback2);
      cancelAnimationFrameSpy.mockClear(); // Clear initial start call

      animationManager.unsubscribe(callback1);
      expect(cancelAnimationFrameSpy).not.toHaveBeenCalled();
      expect(animationManager.getSubscriberCount()).toBe(1);
    });
  });

  describe('tick', () => {
    it('should execute all subscriber callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      animationManager.subscribe(callback1);
      animationManager.subscribe(callback2);

      // Manually trigger tick by executing the RAF callback
      const rafCallback = requestAnimationFrameSpy.mock.calls[0]?.[0] as FrameRequestCallback;
      if (rafCallback) {
        rafCallback(0);
      }

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should schedule next frame', () => {
      const callback = vi.fn();
      animationManager.subscribe(callback);

      // Get the RAF callback before clearing
      const rafCallback = requestAnimationFrameSpy.mock.calls[0]?.[0] as FrameRequestCallback;
      requestAnimationFrameSpy.mockClear();

      if (rafCallback) {
        rafCallback(0);
      }

      expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in callbacks without stopping the loop', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Test error');
      });
      const normalCallback = vi.fn();

      animationManager.subscribe(errorCallback);
      animationManager.subscribe(normalCallback);

      const rafCallback = requestAnimationFrameSpy.mock.calls[0]?.[0] as FrameRequestCallback;
      if (rafCallback) {
        rafCallback(0);
      }

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[AnimationManager] Error in subscriber callback:',
        expect.any(Error)
      );
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('start', () => {
    it('should start the animation loop', () => {
      animationManager.start();
      expect(requestAnimationFrameSpy).toHaveBeenCalled();
    });

    it('should not start multiple loops if already running', () => {
      animationManager.start();
      const initialCallCount = requestAnimationFrameSpy.mock.calls.length;
      animationManager.start();
      expect(requestAnimationFrameSpy.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe('stop', () => {
    it('should stop the animation loop', () => {
      const callback = vi.fn();
      animationManager.subscribe(callback);
      animationManager.stop();
      expect(cancelAnimationFrameSpy).toHaveBeenCalled();
    });

    it('should handle stopping when not running', () => {
      expect(() => animationManager.stop()).not.toThrow();
    });
  });

  describe('getSubscriberCount', () => {
    it('should return 0 when no subscribers', () => {
      expect(animationManager.getSubscriberCount()).toBe(0);
    });

    it('should return correct count after subscriptions', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      animationManager.subscribe(callback1);
      expect(animationManager.getSubscriberCount()).toBe(1);

      animationManager.subscribe(callback2);
      expect(animationManager.getSubscriberCount()).toBe(2);
    });

    it('should return correct count after unsubscriptions', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      animationManager.subscribe(callback1);
      animationManager.subscribe(callback2);
      animationManager.unsubscribe(callback1);

      expect(animationManager.getSubscriberCount()).toBe(1);
    });

    it('should not count duplicate subscriptions', () => {
      const callback = vi.fn();
      animationManager.subscribe(callback);
      animationManager.subscribe(callback); // Subscribe same callback again

      expect(animationManager.getSubscriberCount()).toBe(1);
    });
  });

  describe('singleton pattern', () => {
    it('should export a singleton instance', () => {
      // The animationManager should be an object with expected methods
      expect(typeof animationManager.subscribe).toBe('function');
      expect(typeof animationManager.unsubscribe).toBe('function');
      expect(typeof animationManager.start).toBe('function');
      expect(typeof animationManager.stop).toBe('function');
      expect(typeof animationManager.getSubscriberCount).toBe('function');
    });
  });

  describe('lifecycle', () => {
    it('should handle subscribe-unsubscribe-subscribe cycle', () => {
      const callback = vi.fn();
      const rafCallsBefore = requestAnimationFrameSpy.mock.calls.length;

      animationManager.subscribe(callback);
      const rafCallsAfterFirstSubscribe = requestAnimationFrameSpy.mock.calls.length;

      animationManager.unsubscribe(callback);
      animationManager.subscribe(callback);
      const rafCallsAfterSecondSubscribe = requestAnimationFrameSpy.mock.calls.length;

      // Should have called requestAnimationFrame twice (once per subscribe)
      expect(rafCallsAfterSecondSubscribe).toBeGreaterThan(rafCallsBefore);
    });

    it('should handle multiple subscribers with different lifetimes', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      animationManager.subscribe(callback1);
      animationManager.subscribe(callback2);
      expect(animationManager.getSubscriberCount()).toBe(2);

      animationManager.unsubscribe(callback1);
      expect(animationManager.getSubscriberCount()).toBe(1);

      animationManager.subscribe(callback3);
      expect(animationManager.getSubscriberCount()).toBe(2);

      animationManager.unsubscribe(callback2);
      animationManager.unsubscribe(callback3);
      expect(animationManager.getSubscriberCount()).toBe(0);
    });
  });
});
