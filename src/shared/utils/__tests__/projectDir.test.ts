import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getProjectDir } from '../projectDir';

describe('getProjectDir', () => {
  beforeEach(() => {
    // Clear globalThis mocks before each test
    vi.stubGlobal('nwWrldSdk', undefined);
    vi.stubGlobal('nwWrldBridge', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return directory from SDK when available', () => {
    const mockDir = '/mock/project/dir';
    const mockSdk = {
      getWorkspaceDir: vi.fn(() => mockDir)
    };

    vi.stubGlobal('nwWrldSdk', mockSdk);

    const result = getProjectDir();

    expect(result).toBe(mockDir);
    expect(mockSdk.getWorkspaceDir).toHaveBeenCalledTimes(1);
  });

  it('should return directory from bridge when SDK is not available', () => {
    const mockDir = '/mock/bridge/dir';
    const mockBridge = {
      project: {
        getDir: vi.fn(() => mockDir)
      }
    };

    vi.stubGlobal('nwWrldSdk', undefined);
    vi.stubGlobal('nwWrldBridge', mockBridge);

    const result = getProjectDir();

    expect(result).toBe(mockDir);
    expect(mockBridge.project.getDir).toHaveBeenCalledTimes(1);
  });

  it('should prefer SDK over bridge when both are available', () => {
    const mockSdkDir = '/mock/sdk/dir';
    const mockBridgeDir = '/mock/bridge/dir';

    const mockSdk = {
      getWorkspaceDir: vi.fn(() => mockSdkDir)
    };

    const mockBridge = {
      project: {
        getDir: vi.fn(() => mockBridgeDir)
      }
    };

    vi.stubGlobal('nwWrldSdk', mockSdk);
    vi.stubGlobal('nwWrldBridge', mockBridge);

    const result = getProjectDir();

    expect(result).toBe(mockSdkDir);
    expect(mockSdk.getWorkspaceDir).toHaveBeenCalledTimes(1);
    expect(mockBridge.project.getDir).not.toHaveBeenCalled();
  });

  it('should return null when neither SDK nor bridge is available', () => {
    vi.stubGlobal('nwWrldSdk', undefined);
    vi.stubGlobal('nwWrldBridge', undefined);

    const result = getProjectDir();

    expect(result).toBeNull();
  });

  it('should return null when bridge exists but has no project property', () => {
    const mockBridge = {};

    vi.stubGlobal('nwWrldSdk', undefined);
    vi.stubGlobal('nwWrldBridge', mockBridge);

    const result = getProjectDir();

    expect(result).toBeNull();
  });

  it('should return null when bridge.project.getDir is not a function', () => {
    const mockBridge = {
      project: {
        getDir: 'not a function'
      }
    };

    vi.stubGlobal('nwWrldSdk', undefined);
    vi.stubGlobal('nwWrldBridge', mockBridge);

    const result = getProjectDir();

    expect(result).toBeNull();
  });

  it('should return null when SDK is not an object', () => {
    vi.stubGlobal('nwWrldSdk', null);
    vi.stubGlobal('nwWrldBridge', undefined);

    const result = getProjectDir();

    expect(result).toBeNull();
  });

  it('should return null when SDK.getWorkspaceDir is not a function', () => {
    const mockSdk = {
      getWorkspaceDir: 'not a function'
    };

    vi.stubGlobal('nwWrldSdk', mockSdk);
    vi.stubGlobal('nwWrldBridge', undefined);

    const result = getProjectDir();

    expect(result).toBeNull();
  });
});
