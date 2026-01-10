// src/projector/helpers/animationManager.ts

import TWEEN from "@tweenjs/tween.js";

/**
 * AnimationManager - Centralized requestAnimationFrame coordinator
 *
 * Consolidates multiple animation loops into a single RAF loop to prevent
 * scheduling conflicts and reduce CPU overhead when multiple modules are active.
 *
 * Performance benefits:
 * - Single RAF callback instead of N callbacks (one per module instance)
 * - Guaranteed synchronization: all modules update in the same frame
 * - Reduced browser scheduler overhead
 * - Automatic cleanup when no subscribers remain
 */

type AnimationCallback = () => void;

class AnimationManager {
  private subscribers: Set<AnimationCallback>;
  private rafId: number | null;
  private boundTick: () => void;

  constructor() {
    this.subscribers = new Set();
    this.rafId = null;
    this.boundTick = this.tick.bind(this);
  }

  /**
   * Register a callback to be called on every animation frame
   * @param callback - The animation callback to execute each frame
   */
  subscribe(callback: AnimationCallback): void {
    if (typeof callback !== "function") {
      console.error(
        "[AnimationManager] Subscribe called with non-function:",
        callback
      );
      return;
    }

    this.subscribers.add(callback);

    // Start the loop if this is the first subscriber
    if (!this.rafId) {
      this.start();
    }
  }

  /**
   * Unregister a callback from the animation loop
   * @param callback - The callback to remove
   */
  unsubscribe(callback: AnimationCallback): void {
    this.subscribers.delete(callback);

    // Stop the loop if no subscribers remain
    if (this.subscribers.size === 0) {
      this.stop();
    }
  }

  /**
   * Main animation loop tick - executes all subscribed callbacks
   */
  private tick(): void {
    // Update tweens ONCE per frame globally
    TWEEN.update();

    // Execute all subscriber callbacks
    this.subscribers.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error(
          "[AnimationManager] Error in subscriber callback:",
          error
        );
      }
    });

    this.rafId = requestAnimationFrame(this.boundTick);
  }

  /**
   * Start the animation loop
   */
  start(): void {
    if (!this.rafId) {
      this.rafId = requestAnimationFrame(this.boundTick);
    }
  }

  /**
   * Stop the animation loop
   */
  stop(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /**
   * Get current subscriber count (useful for debugging)
   */
  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  /**
   * Clear all subscribers (useful for testing)
   * @internal
   */
  _clearAllSubscribers(): void {
    this.subscribers.clear();
    this.stop();
  }
}

// Singleton instance - shared across all modules
export const animationManager = new AnimationManager();
