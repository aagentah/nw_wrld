/*
@nwWrld name: Text
@nwWrld category: Text
@nwWrld imports: ModuleBase
*/

import type { ModuleBase as ModuleBaseType } from "../../projector/helpers/moduleBase";

// Runtime-injected globals (provided by sandbox)
declare const ModuleBase: typeof ModuleBaseType;

interface TextMethodOptions {
  text?: string;
}

interface ColorMethodOptions {
  color?: string;
}

interface RandomTextMethodOptions {
  length?: number;
  characters?: string;
}

interface FontMethodOptions {
  font?: string;
}

interface SizeMethodOptions {
  percentage?: number;
}

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
        { name: "length", defaultVal: 8, type: "number" },
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
          defaultVal: "font-monospace",
          type: "select",
          values: ["font-monospace"],
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
      options: [{ name: "percentage", defaultVal: 100, type: "number" }],
    },
  ];

  textElem!: HTMLDivElement | null;

  constructor(container: HTMLElement) {
    super(container);
    this.name = Text.name;
    this.textElem = null;
    this.init();
  }

  init(): void {
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

  text({ text = "Hello, world." }: TextMethodOptions = {}): void {
    if (this.textElem) {
      this.textElem.textContent = String(text);
    }
  }

  color({ color = "#ffffff" }: ColorMethodOptions = {}): void {
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
  }: RandomTextMethodOptions = {}): void {
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

  font({ font = "font-monospace" }: FontMethodOptions = {}): void {
    if (this.textElem) {
      this.textElem.className = font;
    }
  }

  reset(): void {
    if (this.textElem) {
      this.textElem.textContent = "";
    }
  }

  size({ percentage = 100 }: SizeMethodOptions = {}): void {
    if (this.textElem) {
      this.textElem.style.fontSize = `${percentage}%`;
    }
  }

  destroy(): void {
    if (this.textElem && this.textElem.parentNode === this.elem) {
      this.elem.removeChild(this.textElem);
      this.textElem = null;
    }
    super.destroy();
  }
}

export default Text;
