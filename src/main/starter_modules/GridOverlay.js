const { ModuleBase } = globalThis.nwWrldSdk || {};

class GridOverlay extends ModuleBase {
  static name = "GridOverlay";
  static category = "2D";

  static methods = [
    ...((ModuleBase && ModuleBase.methods) || []),
    {
      name: "size",
      executeOnLoad: true,
      options: [
        {
          name: "x",
          defaultVal: 18,
          type: "number",
          allowRandomization: true,
        },
        {
          name: "y",
          defaultVal: 18,
          type: "number",
          allowRandomization: true,
        },
      ],
    },
    {
      name: "colour",
      executeOnLoad: true,
      options: [
        {
          name: "colour",
          defaultVal: "#ffffff",
          type: "color",
        },
      ],
    },
  ];

  constructor(container) {
    super(container);
    this.name = GridOverlay.name;
    this.gridElem = null;
    this.x = 10;
    this.y = 10;
    this.gridColour = "#ffffff";
    this.init();
  }

  init() {
    this.createGrid();
  }

  createGrid() {
    if (this.gridElem && this.gridElem.parentNode === this.elem) {
      this.elem.removeChild(this.gridElem);
    }

    this.gridElem = document.createElement("canvas");
    this.gridElem.width = this.elem.clientWidth;
    this.gridElem.height = this.elem.clientHeight;
    const ctx = this.gridElem.getContext("2d");

    ctx.strokeStyle = this.gridColour;
    ctx.lineWidth = 1;
    this.gridElem.style.opacity = 1;

    const cellWidth = this.gridElem.width / this.x;
    const cellHeight = this.gridElem.height / this.y;

    for (let i = 0; i <= this.x; i++) {
      const x = i * cellWidth;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.gridElem.height);
      ctx.stroke();
    }

    for (let i = 0; i <= this.y; i++) {
      const y = i * cellHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.gridElem.width, y);
      ctx.stroke();
    }

    this.elem.appendChild(this.gridElem);
  }

  size({ x = 10, y = 10 } = {}) {
    this.x = x;
    this.y = y;
    this.createGrid();
  }

  colour({ colour = "#ffffff" } = {}) {
    this.gridColour = colour;
    this.createGrid();
  }

  destroy() {
    if (this.gridElem && this.gridElem.parentNode === this.elem) {
      this.elem.removeChild(this.gridElem);
      this.gridElem = null;
    }
    super.destroy();
  }
}

export default GridOverlay;
