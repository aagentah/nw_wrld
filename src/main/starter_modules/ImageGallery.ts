/*
@nwWrld name: ImageGallery
@nwWrld category: 2D
@nwWrld imports: ModuleBase, assetUrl, listAssets
*/

import type { ModuleBase as ModuleBaseType } from "../../projector/helpers/moduleBase";

// Runtime-injected globals
declare const ModuleBase: typeof ModuleBaseType;
declare const assetUrl: (path: string) => string | null;
declare const listAssets: (dir: string) => Promise<string[]>;

interface ImageDirectoryOptions {
  directory?: string;
  fit?: string;
}

interface SetIndexOptions {
  index?: number;
}

interface ShiftOptions {
  amount?: number;
}

type FitMode = "cover" | "contain" | "fill" | "none" | "scale-down";

const normalizeRelAssetPath = (value: unknown): string | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const withoutPrefix = raw.replace(/^assets\//, "");
  return withoutPrefix;
};

const parseImageListFromText = (text: unknown): string[] => {
  const raw = String(text ?? "");
  const parts = raw
    .split(/[\n,]/g)
    .map((s) => String(s || "").trim())
    .filter(Boolean);
  return parts;
};

const looksLikeListInput = (raw: unknown): boolean => {
  const s = String(raw ?? "");
  return s.includes("\n") || s.includes(",");
};

const coerceInt = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value))
    return Math.trunc(value);
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
};

class ImageGallery extends ModuleBase {
  static methods = [
    {
      name: "imageDirectory",
      executeOnLoad: true,
      options: [
        {
          name: "directory",
          defaultVal: "images",
          type: "assetDir",
          assetBaseDir: "images",
          allowCustom: true,
        },
        {
          name: "fit",
          defaultVal: "cover",
          type: "select",
          values: ["cover", "contain", "fill", "none", "scale-down"],
        },
      ],
    },
    {
      name: "setIndex",
      executeOnLoad: false,
      options: [
        {
          name: "index",
          defaultVal: 0,
          min: 0,
          type: "number",
        },
      ],
    },
    {
      name: "shift",
      executeOnLoad: false,
      options: [
        {
          name: "amount",
          defaultVal: 1,
          type: "number",
        },
      ],
    },
    { name: "random", executeOnLoad: false, options: [] },
  ];

  // Properties
  urls: string[];
  currentIndex: number;
  img!: HTMLImageElement | null;
  fit: FitMode;

  constructor(container: HTMLElement) {
    super(container);
    this.urls = [];
    this.currentIndex = 0;
    this.img = null;
    this.fit = "cover";
    this.init();
  }

  init(): void {
    this.img = document.createElement("img");
    this.img.style.cssText = [
      "width: 100%;",
      "height: 100%;",
      `object-fit: ${this.fit};`,
      "display: block;",
    ].join(" ");
    if (this.elem) this.elem.appendChild(this.img);
  }

  applyFit(fit: string): void {
    const allowed = new Set<FitMode>(["cover", "contain", "fill", "none", "scale-down"]);
    const next = allowed.has(fit as FitMode) ? (fit as FitMode) : "cover";
    this.fit = next;
    if (this.img) this.img.style.objectFit = next;
  }

  setUrls(urls: string[]): void {
    const list = Array.isArray(urls) ? urls : [];
    this.urls = list.filter(
      (u) => typeof u === "string" && u.trim().length > 0
    );
    this.currentIndex = 0;
    this.draw();
  }

  async imageDirectory({ directory = "", fit = "cover" }: ImageDirectoryOptions = {}): Promise<void> {
    this.applyFit(fit);

    const raw = String(directory ?? "").trim();
    if (!raw) {
      this.setUrls([]);
      return;
    }

    const maybeList = parseImageListFromText(raw);
    if (looksLikeListInput(raw) || maybeList.length > 1) {
      const urls = maybeList
        .map(normalizeRelAssetPath)
        .map((p) => (typeof assetUrl === "function" && p ? assetUrl(p) : null))
        .filter((url): url is string => url !== null);
      this.setUrls(urls);
      return;
    }

    const base = normalizeRelAssetPath(raw);
    if (!base) {
      this.setUrls([]);
      return;
    }

    const baseDir = base.replace(/\/+$/, "");

    const extSet = new Set([
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".webp",
      ".svg",
    ]);

    const entries =
      typeof listAssets === "function" ? await listAssets(baseDir) : [];
    const files = Array.isArray(entries)
      ? entries
          .map((n) => String(n || "").trim())
          .filter(Boolean)
          .filter((name) => {
            const dot = name.lastIndexOf(".");
            if (dot <= 0) return false;
            const ext = name.slice(dot).toLowerCase();
            return extSet.has(ext);
          })
          .sort((a, b) => a.localeCompare(b))
      : [];

    const urls = files
      .map((name) => `${baseDir}/${name}`)
      .map((p) => (typeof assetUrl === "function" ? assetUrl(p) : null))
      .filter((url): url is string => url !== null);
    this.setUrls(urls);
  }

  setImageDirectory(options: ImageDirectoryOptions = {}): Promise<void> {
    return this.imageDirectory(options);
  }

  draw(): void {
    if (!this.img) return;
    if (!this.urls.length) {
      this.img.removeAttribute("src");
      return;
    }
    const idx = Math.max(0, Math.min(this.currentIndex, this.urls.length - 1));
    this.currentIndex = idx;
    this.img.src = this.urls[idx];
    this.show();
  }

  setIndex({ index = 0 }: SetIndexOptions = {}): void {
    if (!this.urls.length) return;
    const next = coerceInt(index, 0);
    if (next < 0 || next >= this.urls.length) return;
    this.currentIndex = next;
    this.draw();
  }

  shift({ amount = 1 }: ShiftOptions = {}): void {
    if (!this.urls.length) return;
    const delta = coerceInt(amount, 1);
    const len = this.urls.length;
    this.currentIndex = (((this.currentIndex + delta) % len) + len) % len;
    this.draw();
  }

  random(): void {
    if (!this.urls.length) return;
    if (this.urls.length === 1) {
      this.draw();
      return;
    }
    let nextIndex: number;
    do {
      nextIndex = Math.floor(Math.random() * this.urls.length);
    } while (nextIndex === this.currentIndex);
    this.currentIndex = nextIndex;
    this.draw();
  }

  destroy(): void {
    if (this.img && this.img.parentNode === this.elem) {
      this.elem.removeChild(this.img);
    }
    this.img = null;
    this.urls = [];
    super.destroy();
  }
}

export default ImageGallery;
