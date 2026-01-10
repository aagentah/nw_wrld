/*
@nwWrld name: Image
@nwWrld category: 2D
@nwWrld imports: ModuleBase, assetUrl
*/

import { ModuleBase as ModuleBaseType } from "../../../projector/helpers/moduleBase";
import p5 from "p5";

// Runtime-injected globals from sandbox
declare const assetUrl: (relPath: string) => string | null;


class Image extends ModuleBaseType {
  // Module properties (extended)

  img!: HTMLImageElement | null;
  canvas!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D | null;
  name!: string;
  myp5!: p5 | null;
  elem!: HTMLElement;
  isAnimating!: boolean;
  data!: any;
  
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

  constructor(container) {
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

  image({ path = "images/blueprint.png" } = {}) {
    const url = typeof assetUrl === "function" ? assetUrl(path) : null;
    if (this.img && url) {
      this.img.src = url;
    }
    this.show();
  }

  setImage(options: Record<string, unknown> = {}) {
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
