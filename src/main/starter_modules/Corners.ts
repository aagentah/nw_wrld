/*
@nwWrld name: Corners
@nwWrld category: 2D
@nwWrld imports: ModuleBase
*/

import type { ModuleBase as ModuleBaseType } from "../../projector/helpers/moduleBase";

// Runtime-injected globals (provided by sandbox)
declare const ModuleBase: typeof ModuleBaseType;

interface ColorMethodOptions {
  color?: string;
}

interface SizeMethodOptions {
  size?: number;
}

interface SetColorOptions {
  newColor?: string;
}

interface SetSizeOptions {
  newSize?: number;
}

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
        },
      ],
    },
  ];

  canvas!: HTMLCanvasElement | null;
  ctx!: CanvasRenderingContext2D | null;
  cornerColor!: string;
  cornerSize!: number;

  constructor(container: HTMLElement) {
    super(container);

    this.name = Corners.name;
    this.canvas = null;
    this.ctx = null;
    this.cornerColor = "#ffffff";
    this.cornerSize = 20;
    this.init();
  }

  init(): void {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.elem.offsetWidth;
    this.canvas.height = this.elem.offsetHeight;
    this.elem.appendChild(this.canvas);

    this.ctx = this.canvas.getContext("2d");

    this.drawCarets();
  }

  drawCarets(): void {
    const ctx = this.ctx;
    if (!ctx || !this.canvas) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const size = this.cornerSize;
    const color = this.cornerColor;
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

  setColor({ newColor = "#ffffff" }: SetColorOptions = {}): void {
    this.cornerColor = newColor;
    this.drawCarets();
  }

  color({ color = "#ffffff" }: ColorMethodOptions = {}): void {
    return this.setColor({ newColor: color });
  }

  setSize({ newSize = 20 }: SetSizeOptions = {}): void {
    this.cornerSize = newSize;
    this.drawCarets();
  }

  size({ size = 20 }: SizeMethodOptions = {}): void {
    return this.setSize({ newSize: size });
  }

  destroy(): void {
    if (this.canvas && this.canvas.parentNode === this.elem) {
      this.elem.removeChild(this.canvas);
      this.canvas = null;
      this.ctx = null;
    }
    super.destroy();
  }
}

export default Corners;
