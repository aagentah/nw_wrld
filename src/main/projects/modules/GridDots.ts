/*
@nwWrld name: GridDots
@nwWrld category: 2D
@nwWrld imports: ModuleBase
*/

import { ModuleBase as ModuleBaseType } from "../../../projector/helpers/moduleBase";
import p5 from "p5";


class GridDots extends ModuleBaseType {
  // Module properties (extended)



  myp5!: p5 | null;
  canvas!: p5.Renderer | null;
  dotSize!: number;
  spacing!: number;
  isAnimating!: boolean;
  name!: string;
  elem!: HTMLElement;
  data!: any;
  dotColor!: string;
  gridElem!: HTMLCanvasElement | null;
  x!: number;
  y!: number;
  
  static methods = [
    {
      name: "size",
      executeOnLoad: true,
      options: [
        { name: "x", defaultVal: 10, type: "number", allowRandomization: true },
        {
          name: "y",
          defaultVal: 10,
          type: "number",
          allowRandomization: false,
        },
      ],
    },
    {
      name: "color",
      executeOnLoad: true,
      options: [{ name: "color", defaultVal: "#ffffff", type: "color" }],
    },
  ];

  constructor(container) {
    super(container);
    this.name = GridDots.name;
    this.gridElem = null;
    this.x = 10;
    this.y = 10;
    this.dotColor = "#ffffff";
    this.init();
  }

  init(): void {
    this.createGridDots();
  }

  createGridDots(): void {
    if (!this.elem) return;
    if (this.gridElem && this.gridElem.parentNode === this.elem) {
      this.elem.removeChild(this.gridElem);
    }

    this.gridElem = document.createElement("canvas");
    this.gridElem.width = this.elem.clientWidth;
    this.gridElem.height = this.elem.clientHeight;
    const ctx = this.gridElem.getContext("2d");
    if (!ctx) return;
    this.elem.style.opacity = "0.5";

    ctx.fillStyle = this.dotColor;

    const cellWidth = this.gridElem.width / this.x;
    const cellHeight = this.gridElem.height / this.y;
    const dotSize = 2;

    for (let i = 0; i <= this.x; i++) {
      for (let j = 0; j <= this.y; j++) {
        const x = i * cellWidth;
        const y = j * cellHeight;
        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    this.elem.appendChild(this.gridElem);
  }

  size({ x = 10, y = 10 }: { x?: number; y?: number } = {}): void {
    this.x = x;
    this.y = y;
    this.createGridDots();
  }

  color({ color = "#ffffff" }: { color?: string } = {}): void {
    this.dotColor = color;
    this.createGridDots();
  }

  destroy(): void {
    if (this.gridElem && this.gridElem.parentNode === this.elem) {
      this.elem.removeChild(this.gridElem);
      this.gridElem = null;
    }
    if (this.canvas) {
      this.canvas = null;
    }
    super.destroy();
  }
}

export default GridDots;
