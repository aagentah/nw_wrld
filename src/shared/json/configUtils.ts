import { loadJsonFile, loadJsonFileSync } from "./jsonFileBase";

const DEFAULT_SETTINGS = {
  aspectRatios: [
    {
      id: "default",
      label: "Default (Right 1/2)",
      width: "100vw",
      height: "100vh",
    },
    {
      id: "fullscreen",
      label: "Full Screen",
      width: "100vw",
      height: "100vh",
    },
    {
      id: "16-9",
      label: "16:9 (landscape)",
      width: "100vw",
      height: "56.25vw",
    },
    {
      id: "9-16",
      label: "9:16 (portrait)",
      width: "56.25vh",
      height: "100vh",
    },
    {
      id: "4-5",
      label: "4:5 (portrait)",
      width: "80vh",
      height: "100vh",
    },
  ],
  backgroundColors: [{ id: "grey", label: "Grey", value: "#151715" }],
  autoRefresh: false,
};

export const loadSettings = () =>
  loadJsonFile(
    "config.json",
    DEFAULT_SETTINGS,
    "Could not load config.json, using defaults."
  );

export const loadSettingsSync = () =>
  loadJsonFileSync(
    "config.json",
    DEFAULT_SETTINGS,
    "Error loading config.json:"
  );

