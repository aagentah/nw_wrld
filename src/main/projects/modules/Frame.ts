/*
@nwWrld name: Frame
@nwWrld category: 2D
@nwWrld imports: ModuleBase
*/

import { ModuleBase } from "../../../projector/helpers/moduleBase";

const randomInt = (min: number, max: number): number => {
  const minNum = Number(min);
  const maxNum = Number(max);
  if (!Number.isFinite(minNum) || !Number.isFinite(maxNum)) return 0;
  const lo = Math.min(minNum, maxNum);
  const hi = Math.max(minNum, maxNum);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
};

class Frame extends ModuleBase {
  // Module properties
  name!: string;
  elem!: HTMLElement;
  canvas!: HTMLCanvasElement;
  ctx!: CanvasRenderingContext2D | null;
  positionOptions!: {
    left: boolean;
    right: boolean;
    top: boolean;
    bottom: boolean;
  };

  static methods = [
    {
      name: "position",
      executeOnLoad: true,
      options: [
        {
          name: "left",
          defaultVal: true,
          type: "boolean",
        },
        {
          name: "right",
          defaultVal: false,
          type: "boolean",
        },
        {
          name: "top",
          defaultVal: false,
          type: "boolean",
        },
        {
          name: "bottom",
          defaultVal: false,
          type: "boolean",
        },
      ],
    },
    {
      name: "randomize",
      executeOnLoad: false,
      options: [],
    },
  ];

  constructor(container: HTMLElement | null) {
    super(container);
    this.name = Frame.name;
    this.positionOptions = {
      left: true,
      right: false,
      top: false,
      bottom: false,
    };
    this.init();
  }

  init(): void {
    let canvasWidth = this.elem?.clientWidth || 0;
    let canvasHeight = this.elem?.clientHeight || 0;

    this.canvas = document.createElement("canvas");
    this.canvas.width = canvasWidth;
    this.canvas.height = canvasHeight;
    this.ctx = this.canvas.getContext("2d");
    this.elem?.appendChild(this.canvas);
    this.canvas.className = "frame";

    this.updatePosition();
    this.drawFrame();
  }

  drawFrame(): void {
    if (!this.ctx) return;

    const padding = 10;
    const axisColor = "red";
    const textColor = "white";
    const lineWidth = 1;
    const numberOfMarkers = 30;
    const fontSize = 6;

    let paddingLeft = padding;
    let paddingRight = padding;
    let paddingTop = padding;
    let paddingBottom = padding;

    if (this.positionOptions.left) {
      paddingLeft += 20;
    }
    if (this.positionOptions.right) {
      paddingRight += 20;
    }
    if (this.positionOptions.top) {
      paddingTop += 20;
    }
    if (this.positionOptions.bottom) {
      paddingBottom += 20;
    }

    const width = this.canvas.width - paddingLeft - paddingRight;
    const height = this.canvas.height - paddingTop - paddingBottom;

    this.ctx.save();
    this.ctx.strokeStyle = axisColor;
    this.ctx.lineWidth = lineWidth;
    this.ctx.font = `${fontSize}px Arial`;
    this.ctx.fillStyle = textColor;

    if (this.positionOptions.bottom) {
      for (let i = 0; i <= numberOfMarkers; i++) {
        let markerPositionX = (width / numberOfMarkers) * i + paddingLeft;
        let markerLineHeight = randomInt(5, 15);

        this.ctx.beginPath();
        this.ctx.moveTo(markerPositionX, height + paddingTop + lineWidth);
        this.ctx.lineTo(
          markerPositionX,
          height + paddingTop + lineWidth + markerLineHeight
        );
        this.ctx.stroke();

        let number = randomInt(0, 100).toString();
        let textYPosition =
          height + paddingTop + lineWidth - markerLineHeight - 5;
        this.ctx.fillText(
          number,
          markerPositionX - fontSize / 2,
          textYPosition
        );
      }

      this.ctx.beginPath();
      this.ctx.moveTo(paddingLeft, height + paddingTop + lineWidth);
      this.ctx.lineTo(width + paddingLeft, height + paddingTop + lineWidth);
      this.ctx.stroke();
    }

    if (this.positionOptions.top) {
      for (let i = 0; i <= numberOfMarkers; i++) {
        let markerPositionX = (width / numberOfMarkers) * i + paddingLeft;
        let markerLineHeight = randomInt(5, 15);

        this.ctx.beginPath();
        this.ctx.moveTo(markerPositionX, paddingTop);
        this.ctx.lineTo(markerPositionX, paddingTop - markerLineHeight);
        this.ctx.stroke();

        let number = randomInt(0, 100).toString();
        let textYPosition = paddingTop + markerLineHeight + fontSize + 5;
        this.ctx.fillText(
          number,
          markerPositionX - fontSize / 2,
          textYPosition
        );
      }

      this.ctx.beginPath();
      this.ctx.moveTo(paddingLeft, paddingTop);
      this.ctx.lineTo(width + paddingLeft, paddingTop);
      this.ctx.stroke();
    }

    if (this.positionOptions.left) {
      for (let i = 0; i <= numberOfMarkers; i++) {
        let markerPositionY = (height / numberOfMarkers) * i + paddingTop;
        let markerLineWidth = randomInt(5, 15);

        this.ctx.beginPath();
        this.ctx.moveTo(paddingLeft, markerPositionY);
        this.ctx.lineTo(paddingLeft - markerLineWidth, markerPositionY);
        this.ctx.stroke();

        let number = randomInt(0, 100).toString();
        let textXPosition = paddingLeft - markerLineWidth - fontSize - 5;
        this.ctx.fillText(
          number,
          textXPosition,
          markerPositionY + fontSize / 2
        );
      }

      this.ctx.beginPath();
      this.ctx.moveTo(paddingLeft, paddingTop);
      this.ctx.lineTo(paddingLeft, height + paddingTop);
      this.ctx.stroke();
    }

    if (this.positionOptions.right) {
      for (let i = 0; i <= numberOfMarkers; i++) {
        let markerPositionY = (height / numberOfMarkers) * i + paddingTop;
        let markerLineWidth = randomInt(5, 15);

        this.ctx.beginPath();
        this.ctx.moveTo(width + paddingLeft, markerPositionY);
        this.ctx.lineTo(width + paddingLeft + markerLineWidth, markerPositionY);
        this.ctx.stroke();

        let number = randomInt(0, 100).toString();
        let textXPosition = width + paddingLeft + markerLineWidth + 5;
        this.ctx.fillText(
          number,
          textXPosition,
          markerPositionY + fontSize / 2
        );
      }

      this.ctx.beginPath();
      this.ctx.moveTo(width + paddingLeft, paddingTop);
      this.ctx.lineTo(width + paddingLeft, height + paddingTop);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  position({
    left = true,
    right = false,
    top = false,
    bottom = false,
  }: {
    left?: boolean;
    right?: boolean;
    top?: boolean;
    bottom?: boolean;
  } = {}): void {
    this.positionOptions = { left, right, top, bottom };
    this.updatePosition();
    this.randomize();
  }

  setPosition(options: Record<string, unknown> = {}): void {
    this.position(options as Parameters<typeof this.position>[0]);
  }

  updatePosition(): void {
    if (!this.canvas) return;

    const styles = {
      position: "absolute",
      left: this.positionOptions.left ? "0px" : "auto",
      right: this.positionOptions.right ? "0px" : "auto",
      top: this.positionOptions.top ? "0px" : "auto",
      bottom: this.positionOptions.bottom ? "0px" : "auto",
    };
    Object.assign(this.canvas.style, styles);
  }

  randomize(): void {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawFrame();
  }

  randomise(): void {
    this.randomize();
  }

  destroy(): void {
    if (this.canvas && this.canvas.parentNode === this.elem) {
      this.elem.removeChild(this.canvas);
    }
    super.destroy();
  }
}

export default Frame;
