/*
@nwWrld name: OrbitalPlane
@nwWrld category: 2D
@nwWrld imports: ModuleBase, p5
*/

import type { ModuleBase as ModuleBaseType } from "../../projector/helpers/moduleBase";

// Runtime-injected globals
declare const ModuleBase: typeof ModuleBaseType;
declare const p5: any;

interface P5Instance {
  setup: () => void;
  draw: () => void;
  remove: () => void;
  createCanvas: (width: number, height: number) => any;
  noFill: () => void;
  map: (value: number, start1: number, stop1: number, start2: number, stop2: number) => number;
  color: (r: number, g: number, b: number, a: number) => any;
  random: (min?: number, max?: number) => number;
  createVector: (x: number, y: number) => { x: number; y: number };
  clear: () => void;
  translate: (x: number, y: number) => void;
  stroke: (color: any) => void;
  strokeWeight: (weight: number) => void;
  ellipse: (x: number, y: number, diameter: number) => void;
  point: (x: number, y: number) => void;
  cos: (angle: number) => number;
  sin: (angle: number) => number;
  radians: (degrees: number) => number;
}

interface OrbitData {
  radius: number;
  color: any;
  rotationSpeed: number;
  points: number[];
  extraPoints: number[];
  offset: { x: number; y: number };
}

class OrbitalPlane extends ModuleBase {
  static methods = [];

  // Module-specific properties
  myp5!: P5Instance | null;
  orbits!: OrbitData[];
  canvasWidth!: number;
  canvasHeight!: number;
  canvas!: any;

  constructor(container: HTMLElement) {
    super(container);
    this.name = OrbitalPlane.name;
    this.myp5 = null;
    this.orbits = [];
    this.init();
  }

  init(): void {
    const sketch = (p: P5Instance): void => {
      this.myp5 = p;

      p.setup = (): void => {
        this.canvasWidth = this.elem.clientWidth;
        this.canvasHeight = this.elem.clientHeight;

        this.canvas = p.createCanvas(this.canvasWidth, this.canvasHeight);
        this.canvas.parent(this.elem);

        p.noFill();
        this.orbits = [];
        for (let i = 0; i < 5; i++) {
          const radius = p.map(i, 0, 4, 100, (this.canvasHeight / 2.5) * 0.8);
          const color =
            i % 2 == 0 ? p.color(255, 0, 0, 128) : p.color(255, 255, 255, 128);
          const rotationSpeed =
            p.random(0.01, 0.09) * (p.random() > 0.5 ? 1 : -1);
          const offset = p.createVector(p.random(-5, 5), p.random(-5, 5));
          this.orbits.push({
            radius,
            color,
            rotationSpeed,
            points: [],
            extraPoints: [],
            offset,
          });
          for (let angle = 0; angle < 360; angle += p.random(20, 45)) {
            this.orbits[i].points.push(angle);
          }
          this.orbits[i].extraPoints = [p.random(0, 360), p.random(0, 360)];
        }
      };

      p.draw = (): void => {
        p.clear();
        p.translate(this.canvasWidth / 2, this.canvasHeight / 2);
        this.orbits.forEach((orbit) => {
          p.stroke(orbit.color);
          p.strokeWeight(1);
          p.ellipse(orbit.offset.x, orbit.offset.y, orbit.radius * 2);
          p.strokeWeight(3);
          orbit.points.forEach((angle) => {
            const x = orbit.radius * p.cos(p.radians(angle)) + orbit.offset.x;
            const y = orbit.radius * p.sin(p.radians(angle)) + orbit.offset.y;
            p.point(x, y);
          });
          orbit.extraPoints.forEach((angle) => {
            const x = orbit.radius * p.cos(p.radians(angle)) + orbit.offset.x;
            const y = orbit.radius * p.sin(p.radians(angle)) + orbit.offset.y;
            const whiteWithAlpha = p.color(255, 255, 255, 128);
            p.stroke(whiteWithAlpha);
            p.point(x, y);
          });
          orbit.points = orbit.points.map(
            (angle) => (angle + orbit.rotationSpeed) % 360
          );
          orbit.extraPoints = orbit.extraPoints.map(
            (angle) => (angle + orbit.rotationSpeed) % 360
          );
        });
      };
    };

    this.myp5 = new p5(sketch);
  }

  destroy(): void {
    if (this.myp5) {
      this.myp5.remove();
      this.myp5 = null;
    }
    super.destroy();
  }
}

export default OrbitalPlane;
