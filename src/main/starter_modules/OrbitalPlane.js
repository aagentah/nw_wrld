const { ModuleBase } = globalThis.nwWrldSdk || {};
const p5 = globalThis.p5;

class OrbitalPlane extends ModuleBase {
  static name = "OrbitalPlane";
  static category = "2D";

  static methods = [...((ModuleBase && ModuleBase.methods) || [])];

  constructor(container) {
    super(container);
    this.name = OrbitalPlane.name;
    this.myp5 = null;
    this.init();
  }

  init() {
    const sketch = (p) => {
      this.myp5 = p;

      p.setup = () => {
        this.canvasWidth = this.elem.clientWidth;
        this.canvasHeight = this.elem.clientHeight;

        this.canvas = p.createCanvas(this.canvasWidth, this.canvasHeight);
        this.canvas.parent(this.elem);

        p.noFill();
        this.orbits = [];
        for (let i = 0; i < 5; i++) {
          let radius = p.map(i, 0, 4, 100, (this.canvasHeight / 2.5) * 0.8);
          let color =
            i % 2 == 0 ? p.color(255, 0, 0, 128) : p.color(255, 255, 255, 128);
          let rotationSpeed =
            p.random(0.01, 0.09) * (p.random() > 0.5 ? 1 : -1);
          let offset = p.createVector(p.random(-5, 5), p.random(-5, 5));
          this.orbits.push({
            radius,
            color,
            rotationSpeed,
            points: [],
            offset,
          });
          for (let angle = 0; angle < 360; angle += p.random(20, 45)) {
            this.orbits[i].points.push(angle);
          }
          this.orbits[i].extraPoints = [p.random(0, 360), p.random(0, 360)];
        }
      };

      p.draw = () => {
        p.clear();
        p.translate(this.canvasWidth / 2, this.canvasHeight / 2);
        this.orbits.forEach((orbit) => {
          p.stroke(orbit.color);
          p.strokeWeight(1);
          p.ellipse(orbit.offset.x, orbit.offset.y, orbit.radius * 2);
          p.strokeWeight(3);
          orbit.points.forEach((angle) => {
            let x = orbit.radius * p.cos(p.radians(angle)) + orbit.offset.x;
            let y = orbit.radius * p.sin(p.radians(angle)) + orbit.offset.y;
            p.point(x, y);
          });
          orbit.extraPoints.forEach((angle) => {
            let x = orbit.radius * p.cos(p.radians(angle)) + orbit.offset.x;
            let y = orbit.radius * p.sin(p.radians(angle)) + orbit.offset.y;
            p.stroke(255, 255, 255, 128);
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

  destroy() {
    if (this.myp5) {
      this.myp5.remove();
      this.myp5 = null;
    }
    super.destroy();
  }
}

export default OrbitalPlane;
