/*
@nwWrld name: Text
@nwWrld category: Text
@nwWrld imports: ModuleBase, assetUrl
*/

const FONT_FILE_EXT_RE = /\.(ttf|otf|woff2?|ttc)$/i;
const loadedFontByUrl = new Map();

const normalizeRelAssetPath = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return raw.replace(/^assets\//, "");
};

const guessFamilyFromFilename = (relPath) => {
  const raw = String(relPath ?? "").trim();
  const base = raw.split("/").filter(Boolean).pop() || "";
  const noExt = base.replace(/\.[^.]+$/, "");
  const cleaned = noExt.replace(/[^A-Za-z0-9 _-]+/g, " ").replace(/\s+/g, " ");
  return cleaned.trim() || "nw_wrld_font";
};

class Text extends ModuleBase {
  static methods = [
    {
      name: "text",
      executeOnLoad: true,
      options: [{ name: "text", defaultVal: "Hello, world.", type: "text" }],
    },
    {
      name: "randomText",
      executeOnLoad: false,
      options: [
        { name: "length", defaultVal: 8, type: "number", min: 1, max: 1000, allowRandomization: true },
        {
          name: "characters",
          defaultVal:
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
          type: "text",
        },
      ],
    },
    {
      name: "font",
      executeOnLoad: true,
      options: [
        {
          name: "font",
          defaultVal: "fonts/RobotoMono-VariableFont_wght.ttf",
          type: "assetFile",
          assetBaseDir: "fonts",
          assetExtensions: [".ttf", ".otf", ".woff", ".woff2", ".ttc"],
          allowCustom: true,
        },
      ],
    },
    {
      name: "color",
      executeOnLoad: true,
      options: [{ name: "color", defaultVal: "#ffffff", type: "color" }],
    },
    { name: "reset", executeOnLoad: false, options: [] },
    {
      name: "size",
      executeOnLoad: true,
      options: [{ name: "percentage", defaultVal: 100, type: "number", unit: "%", min: 1, max: 1000, allowRandomization: true }],
    },
  ];

  constructor(container) {
    super(container);
    this.name = Text.name;
    this.textElem = null;
    this.init();
  }

  init() {
    if (!this.elem) return;
    const html = `<div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 100%;
        color: #ffffff;
        text-align: center;
      ">Hello, world.</div>`;

    this.elem.insertAdjacentHTML("beforeend", html);
    this.textElem = this.elem.querySelector("div");
  }

  text({ text = "Hello, world." } = {}) {
    if (this.textElem) {
      this.textElem.textContent = String(text);
    }
  }

  color({ color = "#ffffff" } = {}) {
    if (this.textElem) {
      const isValidHex = /^#([0-9A-F]{3}){1,2}$/i.test(color);
      if (isValidHex) {
        this.textElem.style.color = color;
      } else {
        console.warn(`Invalid hex color: ${color}`);
      }
    }
  }

  randomText({
    length = 8,
    characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  } = {}) {
    if (this.textElem) {
      let randomText = "";
      for (let i = 0; i < length; i++) {
        randomText += characters.charAt(
          Math.floor(Math.random() * characters.length)
        );
      }
      this.textElem.textContent = randomText;
    }
  }

  async font({ font = "fonts/RobotoMono-VariableFont_wght.ttf" } = {}) {
    if (!this.textElem) return;

    const raw = String(font ?? "").trim();
    if (!raw) return;

    if (raw === "font-monospace") {
      this.textElem.className = "";
      this.textElem.style.fontFamily = "monospace";
      return;
    }

    if (!FONT_FILE_EXT_RE.test(raw)) {
      this.textElem.className = raw;
      return;
    }

    const relPath = normalizeRelAssetPath(raw);
    const url =
      typeof assetUrl === "function" && relPath ? assetUrl(relPath) : null;
    if (!url) {
      this.textElem.className = "";
      this.textElem.style.fontFamily = "monospace";
      return;
    }

    if (!loadedFontByUrl.has(url)) {
      const family = guessFamilyFromFilename(relPath);
      const p = (async () => {
        try {
          const FontFaceCtor = globalThis.FontFace;
          if (typeof FontFaceCtor !== "function") return null;
          const ff = new FontFaceCtor(family, `url(${url})`);
          const loaded = await ff.load();
          try {
            globalThis.document?.fonts?.add?.(loaded);
          } catch {}
          return family;
        } catch {
          return null;
        }
      })();
      loadedFontByUrl.set(url, p);
    }

    const family = await loadedFontByUrl.get(url);
    this.textElem.className = "";
    this.textElem.style.fontFamily = family
      ? `"${family}", monospace`
      : "monospace";
  }

  reset() {
    if (this.textElem) {
      this.textElem.textContent = "";
    }
  }

  size({ percentage = 100 } = {}) {
    if (this.textElem) {
      this.textElem.style.fontSize = `${percentage}%`;
    }
  }

  destroy() {
    if (this.textElem && this.textElem.parentNode === this.elem) {
      this.elem.removeChild(this.textElem);
      this.textElem = null;
    }
    super.destroy();
  }
}

export default Text;
