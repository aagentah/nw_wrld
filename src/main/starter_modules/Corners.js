/*
@nwWrld name: Corners
@nwWrld category: 2D
@nwWrld imports: ModuleBase
*/

class Corners extends ModuleBase {
  static methods = [
    {
      name: "color",
      executeOnLoad: true,
      options: [
        {
          name: "color",
          defaultVal: "#ffffff",
          type: "color",
        },
      ],
    },
    {
      name: "size",
      executeOnLoad: true,
      options: [
        {
          name: "size",
          defaultVal: 20,
          type: "number",
          min: 1,
          max: 500,
          allowRandomization: true,
        },
      ],
    },
  ];

  constructor(container) {
    super(container);

    this.name = Corners.name;
    this.canvas = null;
    this.ctx = null;
    this.color = "#ffffff";
    this.size = 20;
    this.init();
  }

  init() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.elem.offsetWidth;
    this.canvas.height = this.elem.offsetHeight;
    this.elem.appendChild(this.canvas);

    this.ctx = this.canvas.getContext("2d");

    this.drawCarets();
  }

  drawCarets() {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const size = this.size;
    const color = this.color;
    const paddingX = width * 0.05;
    const paddingY = height * 0.05;

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(paddingX, paddingY + size);
    ctx.lineTo(paddingX, paddingY);
    ctx.lineTo(paddingX + size, paddingY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(width - paddingX - size, paddingY);
    ctx.lineTo(width - paddingX, paddingY);
    ctx.lineTo(width - paddingX, paddingY + size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(paddingX, height - paddingY - size);
    ctx.lineTo(paddingX, height - paddingY);
    ctx.lineTo(paddingX + size, height - paddingY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(width - paddingX - size, height - paddingY);
    ctx.lineTo(width - paddingX, height - paddingY);
    ctx.lineTo(width - paddingX, height - paddingY - size);
    ctx.stroke();
  }

  color({ color = "#ffffff" } = {}) {
    this.color = color;
    this.drawCarets();
  }

  size({ size = 20 } = {}) {
    this.size = size;
    this.drawCarets();
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode === this.elem) {
      this.elem.removeChild(this.canvas);
      this.canvas = null;
      this.ctx = null;
    }
    super.destroy();
  }
}

export default Corners;
