import logger from "../helpers/logger";

type AspectRatioSetting = {
  id: string;
  width: string;
  height: string;
};

type BackgroundColorSetting = {
  id: string;
  value: string;
};

type UiStyleContext = {
  config: { aspectRatio?: string; bgColor?: string };
  settings: {
    aspectRatios: AspectRatioSetting[];
    backgroundColors: BackgroundColorSetting[];
  };
  toggleAspectRatioStyle: (selectedRatioId: string) => void;
  setBg: (colorId: string) => void;
};

export function applyConfigSettings(this: UiStyleContext): void {
  const config = this.config;
  if (config.aspectRatio) {
    this.toggleAspectRatioStyle(config.aspectRatio);
  }
  if (config.bgColor) {
    this.setBg(config.bgColor);
  }
}

export function toggleAspectRatioStyle(
  this: UiStyleContext,
  selectedRatioId: string
): void {
  document.documentElement.classList.remove("reel", "portrait", "scale");

  const dispatchResize = () => {
    try {
      requestAnimationFrame(() => {
        try {
          window.dispatchEvent(new Event("resize"));
        } catch {}
      });
    } catch {
      try {
        window.dispatchEvent(new Event("resize"));
      } catch {}
    }
  };

  const ratio = this.settings.aspectRatios.find((r) => r.id === selectedRatioId);
  if (!ratio) {
    if (logger.debugEnabled) {
      logger.warn(`Aspect ratio "${selectedRatioId}" not found in settings`);
    }
    document.body.style.cssText = "";
    dispatchResize();
    return;
  }

  if (
    ratio.id === "default" ||
    ratio.id === "landscape" ||
    ratio.id === "fullscreen"
  ) {
    document.body.style.cssText = "";
  } else {
    if (ratio.id === "9-16") {
      document.documentElement.classList.add("reel");
    } else if (ratio.id === "4-5") {
      document.documentElement.classList.add("scale");
    }

    document.body.style.cssText = `
        width: ${ratio.width};
        height: ${ratio.height};
        position: relative;
        margin: 0 auto;
        transform-origin: center center;
      `;
  }

  dispatchResize();
}

export function setBg(this: UiStyleContext, colorId: string): void {
  const color = this.settings.backgroundColors.find((c) => c.id === colorId);
  if (!color) {
    if (logger.debugEnabled) {
      logger.warn(`Background color "${colorId}" not found in settings`);
    }
    return;
  }

  const currentStyle = document.documentElement.style.filter;
  const hasHueRotate = currentStyle.includes("hue-rotate");
  const hueRotateValue = hasHueRotate
    ? currentStyle.match(/hue-rotate\(([^)]+)\)/)![1]
    : "";

  document.documentElement.style.backgroundColor = color.value;
  document.documentElement.style.filter = hasHueRotate
    ? `invert(0) hue-rotate(${hueRotateValue})`
    : "invert(0)";
}

