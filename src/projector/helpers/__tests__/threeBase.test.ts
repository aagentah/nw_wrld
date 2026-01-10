/**
 * Tests for BaseThreeJsModule class
 * Tests the Three.js base class that extends ModuleBase with 3D rendering capabilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseThreeJsModule } from '../threeBase';
import { animationManager } from '../animationManager';

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

describe('BaseThreeJsModule', () => {
  let container: HTMLElement;
  let module: BaseThreeJsModule;
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

    // Mock canvas getContext for Three.js WebGLRenderer
    const mockWebGLContext = createWebGLMock();
    HTMLCanvasElement.prototype.getContext = vi.fn((contextType: string) => {
      if (contextType === 'webgl' || contextType === 'webgl2') {
        return mockWebGLContext;
      }
      return null;
    }) as any;

    // Don't clear all mocks - it breaks the getContext mock

    module = new BaseThreeJsModule(container);
  });

  afterEach(() => {
    if (module && !module.destroyed) {
      module.destroy();
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
      expect(module.elem).toBe(container);
    });

    it('should initialize Three.js scene', () => {
      expect(module.scene).toBeDefined();
    });

    it('should initialize Three.js camera', () => {
      expect(module.camera).toBeDefined();
    });

    it('should initialize Three.js renderer', () => {
      expect(module.renderer).toBeDefined();
    });

    it('should initialize OrbitControls', () => {
      expect(module.controls).toBeDefined();
    });

    it('should append renderer DOM element to container', () => {
      expect(container.contains(module.renderer?.domElement)).toBe(true);
    });

    it('should initialize camera settings', () => {
      expect(module.cameraSettings).toEqual({
        zoomLevel: 50,
        viewDirection: 'front',
        cameraAnimation: null,
        cameraSpeed: 1.0,
      });
    });

    it('should have static methods array', () => {
      expect(BaseThreeJsModule.methods).toBeInstanceOf(Array);
      expect(BaseThreeJsModule.methods.length).toBeGreaterThan(0);
    });

    it('should include parent ModuleBase methods', () => {
      const matrixMethod = BaseThreeJsModule.methods.find(m => m.name === 'matrix');
      expect(matrixMethod).toBeDefined();
    });

    it('should have Three.js specific methods', () => {
      const zoomLevelMethod = BaseThreeJsModule.methods.find(m => m.name === 'zoomLevel');
      const viewDirectionMethod = BaseThreeJsModule.methods.find(m => m.name === 'viewDirection');
      const cameraAnimationMethod = BaseThreeJsModule.methods.find(m => m.name === 'cameraAnimation');

      expect(zoomLevelMethod).toBeDefined();
      expect(viewDirectionMethod).toBeDefined();
      expect(cameraAnimationMethod).toBeDefined();
    });
  });

  describe('render method', () => {
    it('should render scene with camera', () => {
      const renderSpy = vi.spyOn(module.renderer!, 'render');
      module.render();
      expect(renderSpy).toHaveBeenCalledWith(module.scene, module.camera);
    });

    it('should not render if destroyed', () => {
      module.destroyed = true;
      const renderSpy = vi.spyOn(module.renderer!, 'render');
      module.render();
      expect(renderSpy).not.toHaveBeenCalled();
    });
  });

  describe('setCustomAnimate method', () => {
    it('should set custom animation callback', () => {
      const customAnimate = vi.fn();
      module.setCustomAnimate(customAnimate);
      expect(module.customAnimate).toBe(customAnimate);
    });
  });

  describe('zoomLevel method', () => {
    it('should update camera zoom setting', () => {
      module.zoomLevel({ zoomLevel: 75 });
      expect(module.cameraSettings.zoomLevel).toBe(75);
    });

    it('should clamp zoom level to valid range', () => {
      module.zoomLevel({ zoomLevel: 150 });
      expect(module.cameraSettings.zoomLevel).toBe(100);
    });

    it('should use default value if not provided', () => {
      module.zoomLevel({});
      expect(module.cameraSettings.zoomLevel).toBe(50);
    });
  });

  describe('viewDirection method', () => {
    it('should update view direction setting', () => {
      module.viewDirection({ viewDirection: 'top' });
      expect(module.cameraSettings.viewDirection).toBe('top');
    });

    it('should use default for invalid direction', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      module.viewDirection({ viewDirection: 'invalid' as any });
      expect(module.cameraSettings.viewDirection).toBe('front');
      consoleSpy.mockRestore();
    });
  });

  describe('cameraAnimation method', () => {
    it('should update camera animation setting', () => {
      module.cameraAnimation({ cameraAnimation: 'pan-forward' });
      expect(module.cameraSettings.cameraAnimation).toBe('pan-forward');
    });
  });

  describe('cameraSpeed method', () => {
    it('should update camera speed setting', () => {
      module.cameraSpeed({ cameraSpeed: 2.0 });
      expect(module.cameraSettings.cameraSpeed).toBe(2.0);
    });

    it('should clamp speed to valid range', () => {
      module.cameraSpeed({ cameraSpeed: 20 });
      expect(module.cameraSettings.cameraSpeed).toBe(10);
    });
  });

  describe('startCameraAnimation method', () => {
    it('should set current animation', () => {
      module.startCameraAnimation('pan-forward', 1.0);
      expect(module.currentAnimation).toBe('pan-forward');
    });

    it('should set animation speed', () => {
      module.startCameraAnimation('pan-forward', 2.0);
      expect(module.animationSpeed).toBe(2.0);
    });

    it('should clear animation for "none"', () => {
      module.startCameraAnimation('none', 1.0);
      expect(module.currentAnimation).toBeNull();
    });
  });

  describe('stopCameraAnimation method', () => {
    it('should clear current animation', () => {
      module.currentAnimation = 'pan-forward';
      module.stopCameraAnimation();
      expect(module.currentAnimation).toBeNull();
    });

    it('should disable auto rotate', () => {
      module.stopCameraAnimation();
      expect(module.controls?.autoRotate).toBe(false);
    });
  });

  describe('destroy method', () => {
    it('should unsubscribe from animation manager', () => {
      module.destroy();
      expect(animationManager.unsubscribe).toHaveBeenCalledWith(module.animate);
    });

    it('should clear controls', () => {
      module.destroy();
      expect(module.controls).toBeNull();
    });

    it('should clear renderer', () => {
      module.destroy();
      expect(module.renderer).toBeNull();
    });

    it('should remove renderer DOM element', () => {
      const canvas = module.renderer?.domElement;
      module.destroy();
      expect(canvas?.parentNode).toBeNull();
    });

    it('should clear scene', () => {
      module.destroy();
      expect(module.scene).toBeNull();
    });

    it('should clear camera', () => {
      module.destroy();
      expect(module.camera).toBeNull();
    });

    it('should set destroyed flag', () => {
      module.destroy();
      expect(module.destroyed).toBe(true);
    });
  });

  describe('Static methods', () => {
    it('should have zoomLevel method definition', () => {
      const method = BaseThreeJsModule.methods.find(m => m.name === 'zoomLevel');
      expect(method).toBeDefined();
      expect(method?.executeOnLoad).toBe(true);
    });

    it('should have viewDirection method definition', () => {
      const method = BaseThreeJsModule.methods.find(m => m.name === 'viewDirection');
      expect(method).toBeDefined();
      expect(method?.executeOnLoad).toBe(true);
    });

    it('should have cameraAnimation method definition', () => {
      const method = BaseThreeJsModule.methods.find(m => m.name === 'cameraAnimation');
      expect(method).toBeDefined();
      expect(method?.executeOnLoad).toBe(false);
    });

    it('should have cameraSpeed method definition', () => {
      const method = BaseThreeJsModule.methods.find(m => m.name === 'cameraSpeed');
      expect(method).toBeDefined();
      expect(method?.executeOnLoad).toBe(true);
    });
  });
});
