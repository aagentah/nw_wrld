/*
@nwWrld name: ScanLines
@nwWrld category: 2D
@nwWrld imports: ModuleBase
*/

class ScanLines extends ModuleBase {
  static name = "ScanLines";
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
          unit: "ms",
          min: 0,
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

  constructor(container) {
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

  init() {
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

  resizeCanvas() {
    if (this.canvas && this.elem) {
      this.canvas.width = this.elem.clientWidth;
      this.canvas.height = this.elem.clientHeight;
    }
  }

  scan({ duration = 2000, direction = "vertical" } = {}) {
    const timestamp = performance.now();
    const scanLine = {
      duration,
      direction,
      color: this.defaultColor,
      startTime: timestamp,
      position: 0,
    };
    this.scanLines.push(scanLine);
  }

  color({ color = "#ffffff" } = {}) {
    this.defaultColor = color;
    this.scanLines.forEach((line) => {
      line.color = color;
    });
  }

  halt() {
    this.paused = true;
  }

  reset() {
    this.paused = false;
    this.scanLines = [];
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  resume() {
    this.paused = false;
  }

  animate() {
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
          line.position = progress * this.canvas.width;
        } else {
          line.position = progress * this.canvas.height;
        }

        return progress < 1;
      });
    }

    if (!this.ctx || !this.canvas) return;

    this.scanLines.forEach((line) => {
      this.ctx.beginPath();
      this.ctx.strokeStyle = line.color;
      this.ctx.lineWidth = 2;

      if (line.direction === "vertical") {
        this.ctx.moveTo(line.position, 0);
        this.ctx.lineTo(line.position, this.canvas.height);
      } else {
        this.ctx.moveTo(0, line.position);
        this.ctx.lineTo(this.canvas.width, line.position);
      }

      this.ctx.stroke();
    });
  }

  destroy() {
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
