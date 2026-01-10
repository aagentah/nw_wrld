/*
@nwWrld name: GridOverlay
@nwWrld category: 2D
@nwWrld imports: ModuleBase
*/

import { ModuleBase as ModuleBaseType } from "../../../projector/helpers/moduleBase";
import p5 from "p5";


class GridOverlay extends ModuleBaseType {
  // Module properties (extended)

  ctx!: CanvasRenderingContext2D | null;
  canvas!: HTMLCanvasElement;
  gridSpacing!: number;
  gridColor!: string;
  isAnimating!: boolean;
  name!: string;
  myp5!: p5 | null;
  elem!: HTMLElement;
  data!: any;
  gridElem!: any;
  x!: number;
  y!: number;
  
  static methods = [
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
  ];

  constructor(container) {
    super(container);
    this.name = GridOverlay.name;
    this.gridElem = null;
    this.x = 18;
    this.y = 18;
    this.gridColor = "#ffffff";
    this.init();
  }

  init(): void {
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

    ctx.strokeStyle = this.gridColor;
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

  size({ x = 18, y = 18 } = {}) {
    this.x = x;
    this.y = y;
    this.createGrid();
  }

  color({ color = "#ffffff" } = {}) {
    this.gridColor = color;
    this.createGrid();
  }

  destroy(): void {
    if (this.gridElem && this.gridElem.parentNode === this.elem) {
      this.elem.removeChild(this.gridElem);
      this.gridElem = null;
    }
    super.destroy();
  }
}

export default GridOverlay;
