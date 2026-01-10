/*
@nwWrld name: ScanLines
@nwWrld category: 2D
@nwWrld imports: ModuleBase
*/

import type { ModuleBase as ModuleBaseType } from "../../projector/helpers/moduleBase";

// Runtime-injected globals
declare const ModuleBase: typeof ModuleBaseType;

interface ScanOptions {
  duration?: number;
  direction?: "vertical" | "horizontal";
}

interface ColorOptions {
  color?: string;
}

type Direction = "vertical" | "horizontal";

interface ScanLine {
  duration: number;
  direction: Direction;
  color: string;
  startTime: number;
  position: number;
}

class ScanLines extends ModuleBase {
  static category = "2D";

  static methods = [
    ...ModuleBase.methods,
    {
      name: "scan",
      executeOnLoad: false,
      options: [
        {
          name: "duration",
          defaultVal: 2000,
          type: "number",
        },
        {
          name: "direction",
          defaultVal: "vertical",
          type: "select",
          values: ["vertical", "horizontal"],
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
    {
      name: "halt",
      executeOnLoad: false,
      options: [],
    },
    {
      name: "reset",
      executeOnLoad: false,
      options: [],
    },
    {
      name: "resume",
      executeOnLoad: false,
      options: [],
    },
  ];

  // Properties
  name!: string;
  canvas!: HTMLCanvasElement | null;
  ctx!: CanvasRenderingContext2D | null;
  scanLines!: ScanLine[];
  animationFrameId!: number | null;
  defaultColor!: string;
  paused!: boolean;
  boundResize!: ((this: Window, ev: Event) => any) | null;
  destroyed!: boolean;

  constructor(container: HTMLElement) {
    super(container);

    this.name = ScanLines.name;
    this.canvas = null;
    this.ctx = null;
    this.scanLines = [];
    this.animationFrameId = null;
    this.defaultColor = "#ffffff";
    this.paused = false;
    this.boundResize = null;
    this.destroyed = false;

    this.init();
  }

  init(): void {
    if (!this.elem) return;

    const html = `<canvas style="position:absolute; top:0; left:0; width:100%; height:100%;"></canvas>`;
    this.elem.insertAdjacentHTML("beforeend", html);
    this.canvas = this.elem.querySelector("canvas");
    this.ctx = this.canvas ? this.canvas.getContext("2d") : null;

    this.resizeCanvas();
    this.boundResize = this.resizeCanvas.bind(this);
    window.addEventListener("resize", this.boundResize);

    this.animate();
  }

  resizeCanvas(): void {
    if (this.canvas && this.elem) {
      this.canvas.width = this.elem.clientWidth;
      this.canvas.height = this.elem.clientHeight;
    }
  }

  scan({ duration = 2000, direction = "vertical" }: ScanOptions = {}): void {
    const timestamp = performance.now();
    const scanLine: ScanLine = {
      duration,
      direction,
      color: this.defaultColor,
      startTime: timestamp,
      position: 0,
    };
    this.scanLines.push(scanLine);
  }

  color({ color = "#ffffff" }: ColorOptions = {}): void {
    this.defaultColor = color;
    this.scanLines.forEach((line) => {
      line.color = color;
    });
  }

  halt(): void {
    this.paused = true;
  }

  reset(): void {
    this.paused = false;
    this.scanLines = [];
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  resume(): void {
    this.paused = false;
  }

  animate(): void {
    if (this.destroyed) return;

    this.animationFrameId = requestAnimationFrame(() => this.animate());

    const now = performance.now();
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    if (!this.paused && this.canvas) {
      this.scanLines = this.scanLines.filter((line) => {
        const elapsed = now - line.startTime;
        const progress = Math.min(elapsed / line.duration, 1);

        if (line.direction === "vertical") {
          line.position = progress * this.canvas!.width;
        } else {
          line.position = progress * this.canvas!.height;
        }

        return progress < 1;
      });
    }

    if (!this.ctx || !this.canvas) return;

    this.scanLines.forEach((line) => {
      this.ctx!.beginPath();
      this.ctx!.strokeStyle = line.color;
      this.ctx!.lineWidth = 2;

      if (line.direction === "vertical") {
        this.ctx!.moveTo(line.position, 0);
        this.ctx!.lineTo(line.position, this.canvas!.height);
      } else {
        this.ctx!.moveTo(0, line.position);
        this.ctx!.lineTo(this.canvas!.width, line.position);
      }

      this.ctx!.stroke();
    });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.boundResize) {
      window.removeEventListener("resize", this.boundResize);
      this.boundResize = null;
    }

    if (this.canvas && this.elem && this.elem.contains(this.canvas)) {
      this.elem.removeChild(this.canvas);
    }

    this.canvas = null;
    this.ctx = null;
    this.scanLines = [];

    super.destroy();
  }
}

export default ScanLines;
