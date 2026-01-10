import { describe, it, expect, vi } from 'vitest';
import { createSdkHelpers } from '../sdkHelpers';

describe('createSdkHelpers', () => {
  describe('assetUrl', () => {
    it('should return asset URL using implementation', async () => {
      const assetUrlImpl = vi.fn((path: string) => `https://cdn.example.com/${path}`);
      const helpers = createSdkHelpers({ assetUrlImpl });

      const result = helpers.assetUrl('assets/image.png');

      expect(assetUrlImpl).toHaveBeenCalledWith('assets/image.png');
      expect(result).toBe('https://cdn.example.com/assets/image.png');
    });

    it('should return null when normalize returns null', () => {
      const normalizeRelPath = vi.fn(() => null);
      const assetUrlImpl = vi.fn();
      const helpers = createSdkHelpers({ normalizeRelPath, assetUrlImpl });

      const result = helpers.assetUrl('test/path');

      expect(normalizeRelPath).toHaveBeenCalledWith('test/path');
      expect(assetUrlImpl).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null when no assetUrlImpl provided', () => {
      const helpers = createSdkHelpers();

      const result = helpers.assetUrl('assets/image.png');

      expect(result).toBeNull();
    });

    it('should return null when assetUrlImpl throws', () => {
      const assetUrlImpl = vi.fn(() => {
        throw new Error('Failed to get URL');
      });
      const helpers = createSdkHelpers({ assetUrlImpl });

      const result = helpers.assetUrl('assets/image.png');

      expect(assetUrlImpl).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should normalize path before calling assetUrlImpl', () => {
      const normalizeRelPath = vi.fn((path: string) => `normalized/${path}`);
      const assetUrlImpl = vi.fn((path: string) => `https://cdn.example.com/${path}`);
      const helpers = createSdkHelpers({ normalizeRelPath, assetUrlImpl });

      const result = helpers.assetUrl('assets/image.png');

      expect(normalizeRelPath).toHaveBeenCalledWith('assets/image.png');
      expect(assetUrlImpl).toHaveBeenCalledWith('normalized/assets/image.png');
      expect(result).toBe('https://cdn.example.com/normalized/assets/image.png');
    });
  });

  describe('readText', () => {
    it('should return text content using implementation', async () => {
      const readTextImpl = vi.fn(async () => 'file content');
      const helpers = createSdkHelpers({ readTextImpl });

      const result = await helpers.readText('test.txt');

      expect(readTextImpl).toHaveBeenCalledWith('test.txt');
      expect(result).toBe('file content');
    });

    it('should return null when normalize returns null', async () => {
      const normalizeRelPath = vi.fn(() => null);
      const readTextImpl = vi.fn();
      const helpers = createSdkHelpers({ normalizeRelPath, readTextImpl });

      const result = await helpers.readText('test.txt');

      expect(normalizeRelPath).toHaveBeenCalledWith('test.txt');
      expect(readTextImpl).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null when no readTextImpl provided', async () => {
      const helpers = createSdkHelpers();

      const result = await helpers.readText('test.txt');

      expect(result).toBeNull();
    });

    it('should return null when readTextImpl throws', async () => {
      const readTextImpl = vi.fn(() => {
        throw new Error('Read failed');
      });
      const helpers = createSdkHelpers({ readTextImpl });

      const result = await helpers.readText('test.txt');

      expect(readTextImpl).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null when readTextImpl returns non-string', async () => {
      const readTextImpl = vi.fn(async () => 123);
      const helpers = createSdkHelpers({ readTextImpl });

      const result = await helpers.readText('test.txt');

      expect(readTextImpl).toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should normalize path before calling readTextImpl', async () => {
      const normalizeRelPath = vi.fn((path: string) => `normalized/${path}`);
      const readTextImpl = vi.fn(async () => 'content');
      const helpers = createSdkHelpers({ normalizeRelPath, readTextImpl });

      const result = await helpers.readText('test.txt');

      expect(normalizeRelPath).toHaveBeenCalledWith('test.txt');
      expect(readTextImpl).toHaveBeenCalledWith('normalized/test.txt');
      expect(result).toBe('content');
    });
  });

  describe('loadJson', () => {
    it('should parse JSON from text file', async () => {
      const readTextImpl = vi.fn(async () => '{"key": "value"}');
      const helpers = createSdkHelpers({ readTextImpl });

      const result = await helpers.loadJson('data.json');

      expect(readTextImpl).toHaveBeenCalledWith('data.json');
      expect(result).toEqual({ key: 'value' });
    });

    it('should return null when readText returns null', async () => {
      const readTextImpl = vi.fn(async () => null);
      const helpers = createSdkHelpers({ readTextImpl });

      const result = await helpers.loadJson('data.json');

      expect(result).toBeNull();
    });

    it('should return null when JSON parsing fails', async () => {
      const readTextImpl = vi.fn(async () => 'invalid json');
      const helpers = createSdkHelpers({ readTextImpl });

      const result = await helpers.loadJson('data.json');

      expect(readTextImpl).toHaveBeenCalledWith('data.json');
      expect(result).toBeNull();
    });

    it('should return null when readText fails', async () => {
      const readTextImpl = vi.fn(() => {
        throw new Error('Read failed');
      });
      const helpers = createSdkHelpers({ readTextImpl });

      const result = await helpers.loadJson('data.json');

      expect(result).toBeNull();
    });

    it('should parse arrays from JSON', async () => {
      const readTextImpl = vi.fn(async () => '[1, 2, 3]');
      const helpers = createSdkHelpers({ readTextImpl });

      const result = await helpers.loadJson('data.json');

      expect(result).toEqual([1, 2, 3]);
    });

    it('should parse primitives from JSON', async () => {
      const readTextImpl = vi.fn(async () => '42');
      const helpers = createSdkHelpers({ readTextImpl });

      const result = await helpers.loadJson('data.json');

      expect(result).toBe(42);
    });
  });

  describe('integration', () => {
    it('should work with all implementations', async () => {
      const normalizeRelPath = vi.fn((path: string) => path.replace(/^..\//, ''));
      const assetUrlImpl = vi.fn((path: string) => `https://cdn.example.com/${path}`);
      const readTextImpl = vi.fn(async () => '{"test": "data"}');

      const helpers = createSdkHelpers({
        normalizeRelPath,
        assetUrlImpl,
        readTextImpl,
      });

      const urlResult = helpers.assetUrl('../assets/test.png');
      const jsonResult = await helpers.loadJson('../data/test.json');

      expect(normalizeRelPath).toHaveBeenCalledTimes(2);
      expect(urlResult).toBe('https://cdn.example.com/assets/test.png');
      expect(jsonResult).toEqual({ test: 'data' });
    });
  });
});
