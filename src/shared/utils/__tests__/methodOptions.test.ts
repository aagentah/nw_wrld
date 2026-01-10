import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildMethodOptions, parseMatrixOptions, MethodOptionEntry } from '../methodOptions';

describe('buildMethodOptions', () => {
  let mockCache: Map<string, unknown>;

  beforeEach(() => {
    mockCache = new Map();
  });

  it('should handle empty or undefined method options', () => {
    expect(buildMethodOptions(undefined)).toEqual({});
    expect(buildMethodOptions(null)).toEqual({});
    expect(buildMethodOptions([])).toEqual({});
  });

  it('should set static values', () => {
    const methodOptions = [
      { name: 'option1', value: 'static value' },
      { name: 'option2', value: 42 },
    ];

    const result = buildMethodOptions(methodOptions);

    expect(result).toEqual({
      option1: 'static value',
      option2: 42,
    });
  });

  it('should pick random values from array', () => {
    const methodOptions = [
      { name: 'color', randomValues: ['red', 'green', 'blue'] },
    ];

    const result = buildMethodOptions(methodOptions);

    expect(result).toHaveProperty('color');
    expect(['red', 'green', 'blue']).toContain(result.color);
  });

  it('should generate random integer in range', () => {
    const methodOptions: MethodOptionEntry[] = [
      { name: 'number', randomRange: [1, 10] },
    ];

    const result = buildMethodOptions(methodOptions);

    expect(result).toHaveProperty('number');
    expect(typeof result.number).toBe('number');
    expect(result.number).toBeGreaterThanOrEqual(1);
    expect(result.number).toBeLessThanOrEqual(10);
    expect(Number.isInteger(result.number)).toBe(true);
  });

  it('should generate random float in range', () => {
    const methodOptions: MethodOptionEntry[] = [
      { name: 'float', randomRange: [1.5, 10.5] },
    ];

    const result = buildMethodOptions(methodOptions);

    expect(result).toHaveProperty('float');
    expect(typeof result.float).toBe('number');
    expect(result.float).toBeGreaterThanOrEqual(1.5);
    expect(result.float).toBeLessThanOrEqual(10.5);
  });

  it('should call onInvalidRandomRange for non-numeric ranges', () => {
    const onInvalidRandomRange = vi.fn();
    const methodOptions = [
      { name: 'invalid', randomRange: ['a', 'b'] as any, value: 'fallback' },
    ];

    const result = buildMethodOptions(methodOptions, { onInvalidRandomRange });

    expect(result.invalid).toBe('fallback');
    expect(onInvalidRandomRange).toHaveBeenCalledWith({
      name: 'invalid',
      min: 'a',
      max: 'b',
      value: 'fallback',
    });
  });

  it('should call onSwapRandomRange and swap min/max', () => {
    const onSwapRandomRange = vi.fn();
    const methodOptions: MethodOptionEntry[] = [
      { name: 'swapped', randomRange: [10, 1] },
    ];

    const result = buildMethodOptions(methodOptions, { onSwapRandomRange });

    expect(result.swapped).toBeGreaterThanOrEqual(1);
    expect(result.swapped).toBeLessThanOrEqual(10);
    expect(onSwapRandomRange).toHaveBeenCalledWith({
      name: 'swapped',
      min: 10,
      max: 1,
    });
  });

  it('should avoid repeating last random value when cache provided', () => {
    const methodOptions = [
      { name: 'noRepeat', randomValues: ['a', 'b', 'c'] },
    ];

    // First call - sets cache
    const result1 = buildMethodOptions(methodOptions, {
      noRepeatCache: mockCache,
      noRepeatKeyPrefix: 'test',
    });
    mockCache.clear();

    // Set a known value in cache
    mockCache.set('test:noRepeat:rv', 'a');

    // Should not return 'a' unless it's the only option
    const result2 = buildMethodOptions(methodOptions, {
      noRepeatCache: mockCache,
      noRepeatKeyPrefix: 'test',
    });

    expect(['b', 'c']).toContain(result2.noRepeat);
  });

  it('should avoid repeating last random range value when cache provided', () => {
    const methodOptions: MethodOptionEntry[] = [
      { name: 'noRepeatRange', randomRange: [1, 3] },
    ];

    // Set a known value in cache
    mockCache.set('test:noRepeatRange:rrInt', 2);

    const result = buildMethodOptions(methodOptions, {
      noRepeatCache: mockCache,
      noRepeatKeyPrefix: 'test',
    });

    expect(result.noRepeatRange).not.toBe(2);
    expect([1, 3]).toContain(result.noRepeatRange);
  });

  it('should skip entries without name', () => {
    const methodOptions = [
      { value: 'no name' } as MethodOptionEntry,
      { name: 'valid', value: 'has name' },
    ];

    const result = buildMethodOptions(methodOptions);

    expect(result).toEqual({ valid: 'has name' });
  });

  it('should prefer randomValues over value', () => {
    const methodOptions = [
      { name: 'priority', randomValues: ['a', 'b'], value: 'static' },
    ];

    const result = buildMethodOptions(methodOptions);

    expect(['a', 'b']).toContain(result.priority);
    expect(result.priority).not.toBe('static');
  });
});

describe('parseMatrixOptions', () => {
  it('should parse matrix from array format', () => {
    const methodOptions = [
      { name: 'matrix', value: [3, 4] },
    ];

    const result = parseMatrixOptions(methodOptions);

    expect(result.rows).toBe(3);
    expect(result.cols).toBe(4);
    expect(result.border).toBe(false);
    expect(result.excludedCells).toEqual([]);
  });

  it('should parse matrix from object format', () => {
    const methodOptions = [
      {
        name: 'matrix',
        value: {
          rows: 2,
          cols: 3,
          excludedCells: [0, 4],
        },
      },
    ];

    const result = parseMatrixOptions(methodOptions);

    expect(result.rows).toBe(2);
    expect(result.cols).toBe(3);
    expect(result.excludedCells).toEqual([0, 4]);
  });

  it('should respect border option', () => {
    const methodOptions = [
      { name: 'matrix', value: [2, 2] },
      { name: 'border', value: true },
    ];

    const result = parseMatrixOptions(methodOptions);

    expect(result.border).toBe(true);
  });

  it('should clamp rows and columns to 1-5 range', () => {
    const methodOptions = [
      { name: 'matrix', value: [10, 0] },
    ];

    const result = parseMatrixOptions(methodOptions);

    expect(result.rows).toBe(5);
    expect(result.cols).toBe(1);
  });

  it('should handle missing matrix with defaults', () => {
    const result = parseMatrixOptions([]);

    expect(result.rows).toBe(1);
    expect(result.cols).toBe(1);
    expect(result.border).toBe(false);
    expect(result.excludedCells).toEqual([]);
  });

  it('should handle partial array format', () => {
    const methodOptions = [
      { name: 'matrix', value: [3] },
    ];

    const result = parseMatrixOptions(methodOptions);

    expect(result.rows).toBe(3);
    expect(result.cols).toBe(1);
  });

  it('should handle partial object format', () => {
    const methodOptions = [
      {
        name: 'matrix',
        value: { rows: 4 },
      },
    ];

    const result = parseMatrixOptions(methodOptions);

    expect(result.rows).toBe(4);
    expect(result.cols).toBe(1);
  });

  it('should handle invalid excludedCells', () => {
    const methodOptions = [
      {
        name: 'matrix',
        value: {
          rows: 2,
          cols: 2,
          excludedCells: 'not an array',
        },
      },
    ];

    const result = parseMatrixOptions(methodOptions);

    expect(result.excludedCells).toEqual([]);
  });

  it('should use buildMethodOptions internally', () => {
    const methodOptions = [
      { name: 'matrix', value: { rows: 2, cols: 2 } },
      { name: 'other', value: 'test' },
    ];

    const result = parseMatrixOptions(methodOptions);

    expect(result.rows).toBe(2);
    expect(result.cols).toBe(2);
  });
});
