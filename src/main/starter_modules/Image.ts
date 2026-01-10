/*
@nwWrld name: Image
@nwWrld category: 2D
@nwWrld imports: ModuleBase, assetUrl
*/

import type { ModuleBase as ModuleBaseType } from "../../projector/helpers/moduleBase";

// Runtime-injected globals (provided by sandbox)
declare const ModuleBase: typeof ModuleBaseType;
declare const assetUrl: (path: string) => string | null;

interface ImageMethodOptions {
  path?: string;
}

class Image extends ModuleBase {
  static methods = [
    {
      name: "image",
      executeOnLoad: true,
      options: [
        {
          name: "path",
          defaultVal: "images/blueprint.png",
          type: "assetFile",
          assetBaseDir: "images",
          assetExtensions: [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"],
          allowCustom: true,
        },
      ],
    },
  ];

  img!: HTMLImageElement | null;

  constructor(container: HTMLElement) {
    super(container);
    this.name = Image.name;
    this.img = null;
    this.init();
  }

  init(): void {
    this.img = document.createElement("img");
    this.img.style.cssText = [
      "width: 100%;",
      "height: 100%;",
      "object-fit: contain;",
      "display: block;",
    ].join(" ");
    if (this.elem) {
      this.elem.appendChild(this.img);
    }
  }

  image({ path = "images/blueprint.png" }: ImageMethodOptions = {}): void {
    const url = typeof assetUrl === "function" ? assetUrl(path) : null;
    if (this.img && url) {
      this.img.src = url;
    }
    this.show();
  }

  setImage(options: ImageMethodOptions = {}): void {
    return this.image(options);
  }

  destroy(): void {
    if (this.img && this.img.parentNode === this.elem) {
      this.elem.removeChild(this.img);
    }
    this.img = null;
    super.destroy();
  }
}

export default Image;
