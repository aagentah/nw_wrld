/**
 * Gets the project directory from either the SDK or bridge.
 * Checks SDK first, then falls back to bridge.
 *
 * @returns The project directory path or null if unavailable
 */
export const getProjectDir = (): string | null => {
  const sdk = globalThis.nwWrldSdk;
  if (sdk && typeof sdk.getWorkspaceDir === 'function') {
    return sdk.getWorkspaceDir();
  }

  const bridge = globalThis.nwWrldBridge as any;
  if (
    !bridge ||
    !bridge.project ||
    typeof bridge.project.getDir !== 'function'
  ) {
    return null;
  }

  return bridge.project.getDir();
};
