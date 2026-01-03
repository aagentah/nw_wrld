const { ModuleBase } = globalThis.nwWrldSdk || {};

class Image extends ModuleBase {
  static name = "Image";
  static category = "2D";

  static methods = [
    ...((ModuleBase && ModuleBase.methods) || []),
    {
      name: "setImage",
      executeOnLoad: true,
      options: [
        {
          name: "path",
          defaultVal: "images/blueprint.png",
          type: "text",
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

  init() {
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
    this.setImage({ path: "images/blueprint.png" });
  }

  setImage({ path = "images/blueprint.png" } = {}) {
    const sdk = globalThis.nwWrldSdk || {};
    const url = typeof sdk.assetUrl === "function" ? sdk.assetUrl(path) : null;
    if (this.img && url) {
      this.img.src = url;
    }
    this.show();
  }

  destroy() {
    if (this.img && this.img.parentNode === this.elem) {
      this.elem.removeChild(this.img);
    }
    this.img = null;
    super.destroy();
  }
}

export default Image;
