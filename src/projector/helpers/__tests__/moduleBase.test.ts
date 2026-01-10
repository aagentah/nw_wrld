/**
 * Tests for ModuleBase class
 * Tests the base class for all projector modules with transformation, visibility, and DOM manipulation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ModuleBase } from '../moduleBase';

// Mock DOM methods
global.getComputedStyle = vi.fn(() => ({
  zIndex: '1',
  visibility: 'visible',
  filter: 'none',
  backgroundColor: '#000000',
  opacity: '1',
  transform: 'none',
  width: '100px',
  height: '100px',
})) as any;

global.requestAnimationFrame = vi.fn((cb) => {
  return window.setTimeout(cb, 16) as unknown as number;
});

global.cancelAnimationFrame = vi.fn((id) => {
  clearTimeout(id as number);
});

describe('ModuleBase', () => {
  let container: HTMLElement;
  let module: ModuleBase;

  beforeEach(() => {
    // Create a fresh container for each test
    container = document.createElement('div');
    container.style.width = '100px';
    container.style.height = '100px';
    document.body.appendChild(container);
    module = new ModuleBase(container);
  });

  afterEach(() => {
    if (module && module.elem) {
      module.destroy();
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with provided container element', () => {
      expect(module.elem).toBe(container);
    });

    it('should set name to constructor name', () => {
      expect(module.name).toBe('ModuleBase');
    });

    it('should initialize transformation state', () => {
      expect(module.currentX).toBe(0);
      expect(module.currentY).toBe(0);
      expect(module.currentScale).toBe(1);
      expect(module.currentOpacity).toBe(1);
      expect(module.currentRotation).toBe(0);
    });

    it('should initialize empty external elements array', () => {
      expect(module.externalElements).toEqual([]);
    });

    it('should set initial visibility to hidden', () => {
      expect(container.style.visibility).toBe('hidden');
    });

    it('should set initial opacity', () => {
      expect(container.style.opacity).toBe('1');
    });

    it('should have static methods array', () => {
      expect(ModuleBase.methods).toBeInstanceOf(Array);
      expect(ModuleBase.methods.length).toBeGreaterThan(0);
    });
  });

  describe('show method', () => {
    it('should make element visible', () => {
      module.show();
      expect(container.style.visibility).toBe('visible');
    });

    it('should make external elements visible', () => {
      const externalElem = document.createElement('div');
      module.externalElements.push(externalElem);
      module.show();
      expect(externalElem.style.visibility).toBe('visible');
    });

    it('should hide element after duration', async () => {
      module.show({ duration: 100 });
      expect(container.style.visibility).toBe('visible');

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(container.style.visibility).toBe('hidden');
    });

    it('should handle duration of 0 (stay visible)', () => {
      module.show({ duration: 0 });
      expect(container.style.visibility).toBe('visible');
    });
  });

  describe('hide method', () => {
    it('should hide element', () => {
      container.style.visibility = 'visible';
      module.hide();
      expect(container.style.visibility).toBe('hidden');
    });

    it('should hide external elements', () => {
      const externalElem = document.createElement('div');
      externalElem.style.visibility = 'visible';
      module.externalElements.push(externalElem);
      module.hide();
      expect(externalElem.style.visibility).toBe('hidden');
    });

    it('should show element after duration', async () => {
      module.hide({ duration: 100 });
      expect(container.style.visibility).toBe('hidden');

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(container.style.visibility).toBe('visible');
    });
  });

  describe('offset method', () => {
    it('should update X offset', () => {
      module.offset({ x: 50 });
      expect(module.currentX).toBe(50);
    });

    it('should update Y offset', () => {
      module.offset({ y: 75 });
      expect(module.currentY).toBe(75);
    });

    it('should update both X and Y offsets', () => {
      module.offset({ x: 25, y: 50 });
      expect(module.currentX).toBe(25);
      expect(module.currentY).toBe(50);
    });

    it('should update transform style', () => {
      module.offset({ x: 50, y: 50 });
      expect(container.style.transform).toContain('translate(50%, 50%)');
    });

    it('should use default values of 0', () => {
      module.offset({});
      expect(module.currentX).toBe(0);
      expect(module.currentY).toBe(0);
    });
  });

  describe('scale method', () => {
    it('should update scale', () => {
      module.scale({ scale: 2 });
      expect(module.currentScale).toBe(2);
    });

    it('should update transform style', () => {
      module.scale({ scale: 1.5 });
      expect(container.style.transform).toContain('scale(1.5)');
    });

    it('should use default value of 1', () => {
      module.scale({});
      expect(module.currentScale).toBe(1);
    });

    it('should combine with offset in transform', () => {
      module.offset({ x: 50, y: 50 });
      module.scale({ scale: 2 });
      const transform = container.style.transform;
      expect(transform).toContain('translate(50%, 50%)');
      expect(transform).toContain('scale(2)');
    });
  });

  describe('opacity method', () => {
    it('should update opacity', () => {
      module.opacity({ opacity: 0.5 });
      expect(module.currentOpacity).toBe(0.5);
      expect(container.style.opacity).toBe('0.5');
    });

    it('should clamp values above 1 to 1', () => {
      module.opacity({ opacity: 1.5 });
      expect(module.currentOpacity).toBe(1);
      expect(container.style.opacity).toBe('1');
    });

    it('should clamp values below 0 to 0', () => {
      module.opacity({ opacity: -0.5 });
      expect(module.currentOpacity).toBe(0);
      expect(container.style.opacity).toBe('0');
    });

    it('should use default value of 1', () => {
      module.opacity({});
      expect(module.currentOpacity).toBe(1);
    });
  });

  describe('rotate method', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should start rotation animation', () => {
      module.rotate({ direction: 'clockwise', speed: 1 });
      expect(module.rotationInterval).not.toBeNull();
    });

    it('should not start rotation if already rotating', () => {
      module.rotate({ direction: 'clockwise', speed: 1 });
      const firstInterval = module.rotationInterval;
      module.rotate({ direction: 'clockwise', speed: 1 });
      expect(module.rotationInterval).toBe(firstInterval);
    });

    it('should apply rotation direction multiplier', () => {
      module.rotate({ direction: 'clockwise', speed: 1 });
      expect(module.currentRotation).toBeGreaterThanOrEqual(0);

      module.stopRotate();
      module.rotate({ direction: 'counter-clockwise', speed: 1 });
      expect(module.currentRotation).toBeGreaterThanOrEqual(0);
    });

    it('should update transform with rotation', () => {
      module.rotate({ direction: 'clockwise', speed: 1 });
      vi.advanceTimersByTime(100);
      expect(container.style.transform).toContain('rotate');
    });

    it('should stop rotation after duration', () => {
      module.rotate({ direction: 'clockwise', speed: 1, duration: 100 });
      expect(module.rotationInterval).not.toBeNull();

      vi.advanceTimersByTime(150);

      expect(module.rotationInterval).toBeNull();
    });
  });

  describe('stopRotate method', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should cancel animation frame', () => {
      module.rotate({ direction: 'clockwise', speed: 1 });
      const interval = module.rotationInterval;

      module.stopRotate();
      expect(global.cancelAnimationFrame).toHaveBeenCalledWith(interval);
    });

    it('should clear rotation interval', () => {
      module.rotate({ direction: 'clockwise', speed: 1 });
      module.stopRotate();
      expect(module.rotationInterval).toBeNull();
    });

    it('should clear rotation timeout', () => {
      module.rotate({ direction: 'clockwise', speed: 1, duration: 100 });
      module.stopRotate();
      expect(module.rotationTimeout).toBeNull();
    });
  });

  describe('updateTransform method', () => {
    it('should apply translation when offset exists', () => {
      module.offset({ x: 50, y: 50 });
      expect(container.style.transform).toBe('translate(50%, 50%)');
    });

    it('should apply scaling when scale is not 1', () => {
      module.scale({ scale: 2 });
      expect(container.style.transform).toBe('scale(2)');
    });

    it('should apply rotation when rotation is not 0', () => {
      module.currentRotation = 45;
      module.updateTransform();
      expect(container.style.transform).toContain('rotate(45deg)');
    });

    it('should combine all transforms', () => {
      module.offset({ x: 50, y: 50 });
      module.scale({ scale: 2 });
      module.currentRotation = 45;
      module.updateTransform();

      const transform = container.style.transform;
      expect(transform).toContain('translate(50%, 50%)');
      expect(transform).toContain('scale(2)');
      expect(transform).toContain('rotate(45deg)');
    });

    it('should reset to none when no transforms', () => {
      module.updateTransform();
      expect(container.style.transform).toBe('none');
    });
  });

  describe('randomZoom method', () => {
    it('should return random scale within range', () => {
      const result = module.randomZoom({ scaleFrom: 1, scaleTo: 2 });
      expect(result?.scale).toBeGreaterThanOrEqual(1);
      expect(result?.scale).toBeLessThanOrEqual(2);
    });

    it('should return random position when position is random', () => {
      const result = module.randomZoom({ scaleFrom: 1, scaleTo: 2, position: 'random' });
      expect(result?.x).toBeGreaterThanOrEqual(0);
      expect(result?.x).toBeLessThanOrEqual(100);
      expect(result?.y).toBeGreaterThanOrEqual(0);
      expect(result?.y).toBeLessThanOrEqual(100);
    });

    it('should use predefined positions', () => {
      const result = module.randomZoom({ scaleFrom: 1, scaleTo: 2, position: 'topLeft' });
      expect(result?.x).toBe(0);
      expect(result?.y).toBe(0);
    });

    it('should apply scale and offset transformations', () => {
      module.randomZoom({ scaleFrom: 1, scaleTo: 2, position: 'bottomRight' });
      expect(module.currentScale).not.toBe(1);
      expect(container.style.transform).toContain('translate');
      expect(container.style.transform).toContain('scale');
    });

    it('should return undefined for invalid scale values', () => {
      const result = module.randomZoom({ scaleFrom: NaN, scaleTo: 2 });
      expect(result).toBeUndefined();
    });
  });

  describe('viewportLine method', () => {
    it('should create SVG element', () => {
      module.viewportLine({ x: 50, y: 50, length: 100, opacity: 1 });
      expect(module.viewportLineElem).not.toBeNull();
      expect(module.viewportLineElem?.tagName).toBe('SVG'); // SVG tagName is uppercase
    });

    it('should add SVG to external elements', () => {
      module.viewportLine({ x: 50, y: 50, length: 100, opacity: 1 });
      expect(module.externalElements).toContain(module.viewportLineElem);
    });

    it('should remove existing line before creating new one', () => {
      module.viewportLine({ x: 50, y: 50, length: 100, opacity: 1 });
      const firstLine = module.viewportLineElem;

      module.viewportLine({ x: 25, y: 25, length: 50, opacity: 0.5 });
      expect(module.viewportLineElem).not.toBe(firstLine);
    });

    it('should match module visibility state', () => {
      container.style.visibility = 'visible';
      module.viewportLine({ x: 50, y: 50, length: 100, opacity: 1 });
      expect(module.viewportLineElem?.style.visibility).toBe('visible');
    });
  });

  describe('background method', () => {
    it('should set background color', () => {
      module.background({ color: '#ff0000' });
      expect(container.style.backgroundColor).toBe('#ff0000');
    });

    it('should use default color', () => {
      module.background({});
      expect(container.style.backgroundColor).toBe('#000000');
    });
  });

  describe('invert method', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should apply invert filter', () => {
      module.invert({});
      expect(container.style.filter).toBe('invert(1)');
    });

    it('should remove filter after duration', () => {
      module.invert({ duration: 100 });
      expect(container.style.filter).toBe('invert(1)');

      vi.advanceTimersByTime(150);

      expect(container.style.filter).toBe('none');
    });

    it('should keep filter when duration is 0', () => {
      module.invert({ duration: 0 });
      expect(container.style.filter).toBe('invert(1)');
    });
  });

  describe('destroy method', () => {
    it('should stop rotation animation', () => {
      vi.useFakeTimers();
      module.rotate({ direction: 'clockwise', speed: 1 });
      module.destroy();
      expect(module.rotationInterval).toBeNull();
      vi.restoreAllMocks();
    });

    it('should remove external elements from DOM', () => {
      const externalElem = document.createElement('div');
      document.body.appendChild(externalElem);
      module.externalElements.push(externalElem);

      module.destroy();
      expect(externalElem.parentNode).toBeNull();
    });

    it('should clear external elements array', () => {
      const externalElem = document.createElement('div');
      document.body.appendChild(externalElem);
      module.externalElements.push(externalElem);

      module.destroy();
      expect(module.externalElements).toEqual([]);
    });

    it('should remove container element from DOM', () => {
      module.destroy();
      expect(container.parentNode).toBeNull();
    });

    it('should set elem to null', () => {
      module.destroy();
      expect(module.elem).toBeNull();
    });
  });

  describe('Static methods', () => {
    it('should have matrix method definition', () => {
      const matrixMethod = ModuleBase.methods.find(m => m.name === 'matrix');
      expect(matrixMethod).toBeDefined();
      expect(matrixMethod?.executeOnLoad).toBe(true);
      expect(matrixMethod?.options).toBeInstanceOf(Array);
    });

    it('should have show method definition', () => {
      const showMethod = ModuleBase.methods.find(m => m.name === 'show');
      expect(showMethod).toBeDefined();
      expect(showMethod?.executeOnLoad).toBe(true);
    });

    it('should have hide method definition', () => {
      const hideMethod = ModuleBase.methods.find(m => m.name === 'hide');
      expect(hideMethod).toBeDefined();
      expect(hideMethod?.executeOnLoad).toBe(false);
    });

    it('should have offset method definition', () => {
      const offsetMethod = ModuleBase.methods.find(m => m.name === 'offset');
      expect(offsetMethod).toBeDefined();
      expect(offsetMethod?.options).toHaveLength(2);
    });

    it('should have scale method definition', () => {
      const scaleMethod = ModuleBase.methods.find(m => m.name === 'scale');
      expect(scaleMethod).toBeDefined();
    });

    it('should have randomZoom method definition', () => {
      const randomZoomMethod = ModuleBase.methods.find(m => m.name === 'randomZoom');
      expect(randomZoomMethod).toBeDefined();
    });

    it('should have opacity method definition', () => {
      const opacityMethod = ModuleBase.methods.find(m => m.name === 'opacity');
      expect(opacityMethod).toBeDefined();
    });

    it('should have rotate method definition', () => {
      const rotateMethod = ModuleBase.methods.find(m => m.name === 'rotate');
      expect(rotateMethod).toBeDefined();
    });

    it('should have viewportLine method definition', () => {
      const viewportLineMethod = ModuleBase.methods.find(m => m.name === 'viewportLine');
      expect(viewportLineMethod).toBeDefined();
    });

    it('should have background method definition', () => {
      const backgroundMethod = ModuleBase.methods.find(m => m.name === 'background');
      expect(backgroundMethod).toBeDefined();
    });

    it('should have invert method definition', () => {
      const invertMethod = ModuleBase.methods.find(m => m.name === 'invert');
      expect(invertMethod).toBeDefined();
    });
  });
});
