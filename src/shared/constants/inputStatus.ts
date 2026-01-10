const INPUT_STATUS = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  ERROR: "error",
} as const;

export default INPUT_STATUS;
export { INPUT_STATUS };
