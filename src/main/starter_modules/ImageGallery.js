/*
@nwWrld name: ImageGallery
@nwWrld category: 2D
@nwWrld imports: ModuleBase, assetUrl, listAssets
*/

const normalizeRelAssetPath = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const withoutPrefix = raw.replace(/^assets\//, "");
  return withoutPrefix;
};

const parseImageListFromText = (text) => {
  const raw = String(text ?? "");
  const parts = raw
    .split(/[\n,]/g)
    .map((s) => String(s || "").trim())
    .filter(Boolean);
  return parts;
};

const looksLikeListInput = (raw) => {
  const s = String(raw ?? "");
  return s.includes("\n") || s.includes(",");
};

const coerceInt = (value, fallback = 0) => {
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
          min: -100,
          max: 100,
        },
      ],
    },
    { name: "random", executeOnLoad: false },
  ];

  constructor(container) {
    super(container);
    this.urls = [];
    this.currentIndex = 0;
    this.img = null;
    this.fit = "cover";
    this.init();
  }

  init() {
    this.img = document.createElement("img");
    this.img.style.cssText = [
      "width: 100%;",
      "height: 100%;",
      `object-fit: ${this.fit};`,
      "display: block;",
    ].join(" ");
    if (this.elem) this.elem.appendChild(this.img);
  }

  applyFit(fit) {
    const allowed = new Set(["cover", "contain", "fill", "none", "scale-down"]);
    const next = allowed.has(String(fit || "")) ? String(fit) : "cover";
    this.fit = next;
    if (this.img) this.img.style.objectFit = next;
  }

  setUrls(urls) {
    const list = Array.isArray(urls) ? urls : [];
    this.urls = list.filter(
      (u) => typeof u === "string" && u.trim().length > 0
    );
    this.currentIndex = 0;
    this.draw();
  }

  async imageDirectory({ directory = "", fit = "cover" } = {}) {
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
        .filter(Boolean);
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
      .filter(Boolean);
    this.setUrls(urls);
  }

  setImageDirectory(options = {}) {
    return this.imageDirectory(options);
  }

  draw() {
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

  setIndex({ index = 0 } = {}) {
    if (!this.urls.length) return;
    const next = coerceInt(index, 0);
    if (next < 0 || next >= this.urls.length) return;
    this.currentIndex = next;
    this.draw();
  }

  shift({ amount = 1 } = {}) {
    if (!this.urls.length) return;
    const delta = coerceInt(amount, 1);
    const len = this.urls.length;
    this.currentIndex = (((this.currentIndex + delta) % len) + len) % len;
    this.draw();
  }

  random() {
    if (!this.urls.length) return;
    if (this.urls.length === 1) {
      this.draw();
      return;
    }
    let nextIndex;
    do {
      nextIndex = Math.floor(Math.random() * this.urls.length);
    } while (nextIndex === this.currentIndex);
    this.currentIndex = nextIndex;
    this.draw();
  }

  destroy() {
    if (this.img && this.img.parentNode === this.elem) {
      this.elem.removeChild(this.img);
    }
    this.img = null;
    this.urls = [];
    super.destroy();
  }
}

export default ImageGallery;
