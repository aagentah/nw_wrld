/**
 * Tests for ThreeTemplate class
 * Tests the Three.js template module that extends BaseThreeJsModule
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ThreeTemplate } from '../ThreeTemplate';
import { animationManager } from '../../helpers/animationManager';
import * as THREE from 'three';

// Mock DOM methods
global.getComputedStyle = vi.fn(() => ({
  zIndex: '1',
  visibility: 'visible',
  width: '800px',
  height: '600px',
})) as any;

// Helper to create a comprehensive WebGL mock
const createWebGLMock = () => {
  // Create extension mock with all needed methods
  const createExtensionMock = () => new Proxy({}, {
    get() {
      return vi.fn(() => ({}));
    },
  });

  const mockMethods = {
    getExtension: vi.fn(() => createExtensionMock()),
    getParameter: vi.fn(() => 'WebGL 2.0'),
    getContextAttributes: vi.fn(() => ({ alpha: true, antialias: true })),
    // WebGL constants
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    HIGH_FLOAT: 36338,
    getShaderPrecisionFormat: vi.fn(() => ({
      precision: 0x0001,
      rangeMin: 1,
      rangeMax: 1,
    })),
    // Methods that need to return non-undefined values
    getProgramInfoLog: vi.fn(() => ''),
    getShaderInfoLog: vi.fn(() => ''),
    getProgramParameter: vi.fn(() => true),
    getActiveUniform: vi.fn(() => ({ name: 'test', size: 1, type: 0x8b5f })),
    getActiveAttrib: vi.fn(() => ({ name: 'test', size: 1, type: 0x8b5f })),
    getActiveUniforms: vi.fn(() => [0]),
    getUniformBlockIndex: vi.fn(() => 0),
  };

  // Return a Proxy that handles any WebGL method call automatically
  return new Proxy(mockMethods, {
    get(target, prop) {
      if (prop in target) {
        return target[prop];
      }
      // Auto-create stub for any undefined property
      return vi.fn(() => {});
    },
  });
};

// WebGL constants for createTexture, createBuffer, etc
let textureId = 1;
let bufferId = 1;
let programId = 1;
let shaderId = 1;

describe('ThreeTemplate', () => {
  let container: HTMLElement;
  let template: ThreeTemplate;
  let mockUnsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create spies for animation manager
    mockUnsubscribe = vi.fn();

    // Spy on animationManager.unsubscribe
    vi.spyOn(animationManager, 'unsubscribe').mockImplementation(mockUnsubscribe);

    // Create a fresh container for each test
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    // Mock canvas getContext for Three.js
    const mockWebGLContext = createWebGLMock();
    HTMLCanvasElement.prototype.getContext = vi.fn((contextType: string) => {
      if (contextType === 'webgl' || contextType === 'webgl2') {
        return mockWebGLContext;
      }
      return null;
    }) as any;

    // Don't clear all mocks - it breaks the getContext mock

    template = new ThreeTemplate(container);
  });

  afterEach(() => {
    if (template && !template.destroyed) {
      template.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    // Restore animation manager spy
    vi.mocked(animationManager.unsubscribe).mockRestore();
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with provided container element', () => {
      expect(template.elem).toBe(container);
    });

    it('should set name to ThreeTemplate', () => {
      expect(template.name).toBe('ThreeTemplate');
    });

    it('should initialize custom group', () => {
      expect(template.customGroup).toBeDefined();
    });

    it('should initialize custom objects array', () => {
      expect(template.customObjects).toBeInstanceOf(Array);
    });

    it('should have static name property', () => {
      expect(ThreeTemplate.moduleName).toBe('ThreeTemplate');
    });

    it('should have static category property', () => {
      expect(ThreeTemplate.category).toBe('primary');
    });

    it('should have static methods array', () => {
      expect(ThreeTemplate.methods).toBeInstanceOf(Array);
      expect(ThreeTemplate.methods.length).toBeGreaterThan(0);
    });

    it('should inherit parent methods', () => {
      const matrixMethod = ThreeTemplate.methods.find(m => m.name === 'matrix');
      expect(matrixMethod).toBeDefined();
    });
  });

  describe('createCustomObjects method', () => {
    it('should create cube geometry', () => {
      expect(template.customObjects.length).toBeGreaterThan(0);
      expect(template.customObjects[0]).toBeDefined();
    });

    it('should create sphere geometry', () => {
      expect(template.customObjects.length).toBeGreaterThan(1);
      expect(template.customObjects[1]).toBeDefined();
    });

    it('should add objects to custom group', () => {
      expect(template.customGroup.children.length).toBe(2);
    });
  });

  describe('animateLoop method', () => {
    it('should rotate custom objects', () => {
      const initialRotationX = template.customObjects[0].rotation.x;
      const initialRotationY = template.customObjects[0].rotation.y;

      template.animateLoop();

      expect(template.customObjects[0].rotation.x).toBe(initialRotationX + 0.01);
      expect(template.customObjects[0].rotation.y).toBe(initialRotationY + 0.01);
    });

    it('should update all custom objects', () => {
      template.animateLoop();
      template.customObjects.forEach(obj => {
        expect(obj.rotation.x).toBeGreaterThan(0);
        expect(obj.rotation.y).toBeGreaterThan(0);
      });
    });
  });

  describe('primary method', () => {
    it('should change object colors', () => {
      const material = template.customObjects[0].material;
      const initialColor = (Array.isArray(material) ? material[0] : material as any).color ? (material as any).color.getHex() : 0xffffff;

      template.primary({ duration: 0 });

      const newColor = (Array.isArray(material) ? material[0] : material as any).color ? (material as any).color.getHex() : 0xffffff;
      expect(newColor).not.toBe(initialColor);
    });

    it('should use default duration of 0', () => {
      expect(() => template.primary()).not.toThrow();
    });
  });

  describe('destroy method', () => {
    it('should dispose custom objects', () => {
      template.destroy();
      expect(template.customObjects).toBeNull();
    });

    it('should remove custom group from scene', () => {
      template.destroy();
      expect(template.customGroup).toBeNull();
    });

    it('should call parent destroy', () => {
      const parentDestroySpy = vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(template)), 'destroy');
      template.destroy();
      expect(parentDestroySpy).toHaveBeenCalled();
    });

    it('should set destroyed flag', () => {
      template.destroy();
      expect(template.destroyed).toBe(true);
    });
  });

  describe('Initialization', () => {
    it('should call init during construction', () => {
      expect(template.customObjects.length).toBe(2);
    });

    it('should set up custom animation loop', () => {
      expect(template.customAnimate).toBeNull();
      template.animateLoop();
      // Verify objects are rotated
      expect(template.customObjects[0].rotation.x).toBeGreaterThan(0);
    });
  });
});
