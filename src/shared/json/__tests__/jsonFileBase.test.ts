import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getJsonDir,
  getJsonFilePath,
  loadJsonFile,
  loadJsonFileSync,
  saveJsonFile,
  saveJsonFileSync,
} from '../jsonFileBase';

describe('jsonFileBase', () => {
  const mockBridge = {
    json: {
      read: vi.fn(),
      readSync: vi.fn(),
      write: vi.fn(),
      writeSync: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.stubGlobal('nwWrldAppBridge', mockBridge);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getJsonDir', () => {
    it('should return null', () => {
      expect(getJsonDir()).toBeNull();
    });
  });

  describe('getJsonFilePath', () => {
    it('should return filename as-is', () => {
      expect(getJsonFilePath('test.json')).toBe('test.json');
      expect(getJsonFilePath('path/to/file.json')).toBe('path/to/file.json');
    });
  });

  describe('loadJsonFile', () => {
    it('should load JSON file successfully', async () => {
      const testData = { key: 'value' };
      mockBridge.json.read.mockResolvedValue(testData);

      const result = await loadJsonFile('test.json', {});

      expect(mockBridge.json.read).toHaveBeenCalledWith('test.json', {});
      expect(result).toEqual(testData);
    });

    it('should return default value when bridge is unavailable', async () => {
      vi.stubGlobal('nwWrldAppBridge', undefined);

      const result = await loadJsonFile('test.json', { default: true }, 'Warning');

      expect(result).toEqual({ default: true });
    });

    it('should return default value when json interface is missing', async () => {
      vi.stubGlobal('nwWrldAppBridge', {});

      const result = await loadJsonFile('test.json', { default: true });

      expect(result).toEqual({ default: true });
    });

    it('should return default value on error', async () => {
      mockBridge.json.read.mockRejectedValue(new Error('Read failed'));

      const result = await loadJsonFile('test.json', { default: true }, 'Warning');

      expect(result).toEqual({ default: true });
    });

    it('should warn when warning message is provided and operation fails', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      mockBridge.json.read.mockRejectedValue(new Error('Read failed'));

      await loadJsonFile('test.json', {}, 'Failed to load');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to load',
        expect.any(Error)
      );
      consoleWarnSpy.mockRestore();
    });
  });

  describe('loadJsonFileSync', () => {
    it('should load JSON file synchronously', () => {
      const testData = { key: 'value' };
      mockBridge.json.readSync.mockReturnValue(testData);

      const result = loadJsonFileSync('test.json', {});

      expect(mockBridge.json.readSync).toHaveBeenCalledWith('test.json', {});
      expect(result).toEqual(testData);
    });

    it('should return default value when bridge is unavailable', () => {
      vi.stubGlobal('nwWrldAppBridge', undefined);

      const result = loadJsonFileSync('test.json', { default: true }, 'Error');

      expect(result).toEqual({ default: true });
    });

    it('should return default value on error', () => {
      mockBridge.json.readSync.mockImplementation(() => {
        throw new Error('Read failed');
      });

      const result = loadJsonFileSync('test.json', { default: true });

      expect(result).toEqual({ default: true });
    });

    it('should log error when error message is provided and operation fails', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');
      mockBridge.json.readSync.mockImplementation(() => {
        throw new Error('Read failed');
      });

      loadJsonFileSync('test.json', {}, 'Failed to load');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('saveJsonFile', () => {
    it('should save JSON file successfully', async () => {
      mockBridge.json.write.mockResolvedValue({ ok: true });

      await saveJsonFile('test.json', { key: 'value' });

      expect(mockBridge.json.write).toHaveBeenCalledWith('test.json', { key: 'value' });
    });

    it('should error when bridge is unavailable', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');
      vi.stubGlobal('nwWrldAppBridge', undefined);

      await saveJsonFile('test.json', { key: 'value' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Refusing to write test.json: json bridge is unavailable.'
      );
      consoleErrorSpy.mockRestore();
    });

    it('should error when write returns ok: false', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');
      mockBridge.json.write.mockResolvedValue({ ok: false, reason: 'No project folder' });

      await saveJsonFile('test.json', { key: 'value' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Refusing to write test.json: project folder is not available (No project folder).'
      );
      consoleErrorSpy.mockRestore();
    });

    it('should not error when write returns undefined or ok: true', async () => {
      mockBridge.json.write.mockResolvedValue(undefined);

      await saveJsonFile('test.json', { key: 'value' });

      expect(mockBridge.json.write).toHaveBeenCalled();
    });
  });

  describe('saveJsonFileSync', () => {
    it('should save JSON file synchronously', () => {
      mockBridge.json.writeSync.mockReturnValue({ ok: true });

      saveJsonFileSync('test.json', { key: 'value' });

      expect(mockBridge.json.writeSync).toHaveBeenCalledWith('test.json', { key: 'value' });
    });

    it('should error when bridge is unavailable', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');
      vi.stubGlobal('nwWrldAppBridge', undefined);

      saveJsonFileSync('test.json', { key: 'value' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Refusing to write test.json (sync): json bridge is unavailable.'
      );
      consoleErrorSpy.mockRestore();
    });

    it('should error when writeSync returns ok: false', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');
      mockBridge.json.writeSync.mockReturnValue({ ok: false, reason: 'No project folder' });

      saveJsonFileSync('test.json', { key: 'value' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Refusing to write test.json (sync): project folder is not available (No project folder).'
      );
      consoleErrorSpy.mockRestore();
    });

    it('should not error when writeSync returns undefined or ok: true', () => {
      mockBridge.json.writeSync.mockReturnValue(undefined);

      saveJsonFileSync('test.json', { key: 'value' });

      expect(mockBridge.json.writeSync).toHaveBeenCalled();
    });
  });
});
