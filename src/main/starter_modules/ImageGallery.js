import ModuleBase from "../helpers/moduleBase";
import fs from "fs";
import path from "path";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"]);

class ImageGallery extends ModuleBase {
  static name = "ImageGallery";
  static category = "2D";

  static methods = [
    ...ModuleBase.methods,
    {
      name: "setImageDirectory",
      executeOnLoad: true,
      options: [
        {
          name: "directory",
          defaultVal: "",
          type: "text",
        },
      ],
    },
    {
      name: "random",
      autoLoad: false,
    },
    {
      name: "shift",
      autoLoad: false,
      options: [
        {
          name: "amount",
          defaultVal: 1,
          type: "number",
        },
      ],
    },
    {
      name: "setIndex",
      autoLoad: false,
      options: [
        {
          name: "index",
          defaultVal: 0,
          min: 0,
          type: "number",
        },
      ],
    },
  ];

  constructor(container) {
    super(container);

    this.loadedImages = [];
    this.currentIndex = 0;
  }

  loadImages(directory) {
    return fs.promises.readdir(directory).then((files) => {
      const images = files
        .filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
        .map((file) => path.join(directory, file))
        .map((imagePath) => this.preloadImage(imagePath));

      return Promise.all(images);
    });
  }

  preloadImage(imagePath) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.onload = () => {
        resolve(img);
      };
      img.onerror = (err) => reject(err);
      img.src = imagePath;
    });
  }

  draw() {
    if (this.loadedImages.length === 0) return;

    const image = this.loadedImages[this.currentIndex];
    this.elem.replaceChildren(image);
  }

  /**
   * Loads image files from a directory path
   * @param {Object} options
   * @param {string} options.directory - directory path
   */
  setImageDirectory({ directory = "" }) {
    if (!directory) {
      this.loadedImages = []
      return
    }

    this.loadImages(directory).then((result) => {
      this.loadedImages = result;
      if (this.loadedImages.length > 0) {
        this.currentIndex = 0;
        this.draw();
      }
    }).catch(e => console.error(e));
  }

  /**
   * Sets the visible image to the one at the specified index. Ignored if the index is negative or larger than the number of available images.
   * @param {Object} options
   * @param {string} options.index - index
   */
  setIndex({ index = 0 }) {
    if (
      this.loadedImages.length === 0 ||
      index < 0 ||
      index >= this.loadedImages.length
    )
      return;

    this.currentIndex = index;
    this.draw();
  }

  /**
   * Shifts the current index forward or backward by the specified amount and shows the relevant image. Wraps around to the beginning/end if required.
   * @param {Object} options
   * @param {number} options.amount - how many steps to shift
   */
  shift({ amount = 1 }) {
    if (this.loadedImages.length === 0) return;

    if (typeof amount === "string") amount = parseInt(amount);
    if (!Number.isInteger(amount)) amount = Math.floor(amount);

    this.currentIndex = Math.abs(
      (this.currentIndex + amount) % this.loadedImages.length
    );

    this.draw();
  }
  /**
   * Selects a random index and shows the relevant image.
   */
  random() {
    if (this.loadedImages.length === 0) return;

    this.currentIndex = Math.floor(Math.random() * this.loadedImages.length);
    this.draw();
  }

  destroy() {
    this.elem.replaceChildren();
    super.destroy();
  }
}

export default ImageGallery;
