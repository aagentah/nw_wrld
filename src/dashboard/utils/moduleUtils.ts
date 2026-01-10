/**
 * Gets base method names from the bridge.
 *
 * @returns Object with moduleBase and threeBase method name arrays
 */
export const getBaseMethodNames = () => {
  try {
    const bridge = globalThis.nwWrldBridge as any;
    if (
      !bridge ||
      !bridge.app ||
      typeof bridge.app.getBaseMethodNames !== "function"
    ) {
      return { moduleBase: [], threeBase: [] };
    }
    return bridge.app.getBaseMethodNames();
  } catch (error) {
    console.error("Error reading base files:", error);
    return { moduleBase: [], threeBase: [] };
  }
};
