import { TERMINAL_STYLES } from "./constants";

export const NW_WRLD_LEVA_THEME = {
  colors: {
    elevation1: TERMINAL_STYLES.bg,
    elevation2: TERMINAL_STYLES.bg,
    elevation3: "rgba(255, 255, 255, 0.06)",
    accent1: TERMINAL_STYLES.text,
    accent2: TERMINAL_STYLES.text,
    accent3: TERMINAL_STYLES.text,
    highlight1: TERMINAL_STYLES.border,
    highlight2: "rgba(217, 217, 217, 0.45)",
    highlight3: TERMINAL_STYLES.text,
    vivid1: "#ff4d4d",
    folderWidgetColor: "rgba(217, 217, 217, 0.35)",
    folderTextColor: TERMINAL_STYLES.text,
    toolTipBackground: TERMINAL_STYLES.bg,
    toolTipText: TERMINAL_STYLES.text,
  },
  fonts: {
    mono: TERMINAL_STYLES.fontFamily,
  },
  fontSizes: {
    root: TERMINAL_STYLES.fontSize,
  },
  radii: {
    xs: "2px",
    sm: "2px",
    lg: "4px",
  },
  sizes: {
    rootWidth: "140px",
    controlWidth: "80px",
    numberInputMinWidth: "32px",
    rowHeight: "20px",
    titleBarHeight: "30px",
  },
  shadows: {
    level1: "0 0 0 0 transparent",
    level2: "0 0 0 0 transparent",
  },
  borderWidths: {
    root: "1px",
    input: "1px",
    focus: "1px",
    hover: "1px",
    active: "1px",
    folder: "1px",
  },
} as const;

