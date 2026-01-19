type GlobalWithNwWrld = typeof globalThis & {
  nwWrldSdk?: { getWorkspaceDir?: () => unknown };
  nwWrldBridge?: { project?: { getDir?: () => unknown } };
};

export const getProjectDir = () => {
  const g = globalThis as unknown as GlobalWithNwWrld;

  const sdk = g.nwWrldSdk;
  if (sdk && typeof sdk.getWorkspaceDir === "function") {
    try {
      return sdk.getWorkspaceDir();
    } catch {
      return null;
    }
  }
  const bridge = g.nwWrldBridge;
  if (!bridge || !bridge.project || typeof bridge.project.getDir !== "function") {
    return null;
  }
  try {
    return bridge.project.getDir();
  } catch {
    return null;
  }
};
