/*
@nwWrld name: Image
@nwWrld category: 2D
@nwWrld imports: ModuleBase, assetUrl
*/

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
  }

  image({ path = "images/blueprint.png" } = {}) {
    const url = typeof assetUrl === "function" ? assetUrl(path) : null;
    if (this.img && url) {
      this.img.src = url;
    }
    this.show();
  }

  setImage(options = {}) {
    return this.image(options);
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
