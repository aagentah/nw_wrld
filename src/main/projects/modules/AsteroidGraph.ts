/*
@nwWrld name: AsteroidGraph
@nwWrld category: 2D
@nwWrld imports: ModuleBase, p5, loadJson
*/

import { ModuleBase as ModuleBaseType } from "../../../projector/helpers/moduleBase";
import p5 from "p5";

// Runtime-injected globals from sandbox
declare const loadJson: <T = unknown>(relPath: string) => Promise<T | null>;

interface Meteor {
  mass: number;
  geolocation: {
    coordinates: [number, number];
  };
}

const getSdkMeteorDataset = async (): Promise<Meteor[] | null> => {
  try {
    const data = await loadJson<Meteor[]>("json/meteor.json");
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
};

const makeRandomMeteor = (): Meteor => {
  const mass = 10 + Math.random() * 500;
  const lon = -180 + Math.random() * 360;
  const lat = -90 + Math.random() * 180;
  return {
    mass,
    geolocation: { coordinates: [lon, lat] },
  };
};

class AsteroidGraph extends ModuleBaseType {
  // Module properties
  name!: string;
  meteors!: Meteor[];
  dataset!: Meteor[] | null;
  myp5!: p5 | null;
  elem!: HTMLElement;
  canvas!: p5.Renderer | null;

  static methods = [
    {
      name: "loadMeteors",
      executeOnLoad: true,
      options: [
        {
          name: "count",
          defaultVal: 5,
          type: "number",
        },
      ],
    },
  ];

  constructor(container) {
    super(container);
    this.name = AsteroidGraph.name;
    this.meteors = [];
    this.dataset = null;
    this.myp5 = null;
    this.init();
  }

  init(): void {
    if (!p5) return;
    const sketch = (p) => {
      this.myp5 = p;
      let noiseOffsetX = 0.0;
      let noiseOffsetY = 0.0;

      p.setup = () => {
        let canvasWidth = this.elem.clientWidth;
        let canvasHeight = this.elem.clientHeight;

        this.canvas = p.createCanvas(canvasWidth, canvasHeight);
        this.canvas.parent(this.elem);

        p.textSize(12);
        p.textAlign(p.CENTER, p.CENTER);
      };

      p.draw = () => {
        p.clear();
        const centerY = p.height / 2;
        let maxDistortion = (p.height / 2) * 0.9;

        this.meteors.forEach((meteor, index) => {
          p.stroke(255 - index * 50);
          p.noFill();
          p.beginShape();

          let highestDistortion = 0;
          let peakX = 0;
          let peakY = centerY;

          for (let x = 0; x < p.width; x += 5) {
            let distortionMagnitude = meteor ? meteor.mass / 10 : 1;
            distortionMagnitude = Math.min(distortionMagnitude, maxDistortion);

            let noiseVal = p.noise(
              noiseOffsetX + x * 0.01,
              noiseOffsetY + index
            );
            let distortion = (noiseVal - 0.5) * 2 * distortionMagnitude;

            let y = centerY - distortion;

            p.vertex(x, y);

            if (Math.abs(distortion) > highestDistortion) {
              highestDistortion = Math.abs(distortion);
              peakX = x;
              peakY = y;
            }
          }

          p.endShape();

          if (meteor.geolocation && meteor.geolocation.coordinates) {
            p.fill(255 - index * 50);
            p.text(
              `${meteor.geolocation.coordinates[0].toFixed(
                2
              )}, ${meteor.geolocation.coordinates[1].toFixed(2)}`,
              peakX,
              peakY - 15
            );
            p.noFill();
          }
        });

        noiseOffsetX += 0.01;
        noiseOffsetY += 0.01;
      };
    };

    this.myp5 = new p5(sketch);
  }

  async loadMeteors({ count = 5 } = {}) {
    const safeCount = Math.max(0, Math.min(50, Number(count) || 0));
    this.meteors = [];
    if (!this.dataset) {
      this.dataset = await getSdkMeteorDataset();
    }

    if (this.dataset && this.dataset.length > 0 && this.myp5) {
      for (let i = 0; i < safeCount; i++) {
        const raw =
          this.dataset[Math.floor(this.myp5.random(this.dataset.length))];
        const mass = Number(raw?.mass);
        const coords = raw?.geolocation?.coordinates;
        const lon = Number(coords?.[0]);
        const lat = Number(coords?.[1]);
        this.meteors.push({
          mass: Number.isFinite(mass) ? mass : 10 + Math.random() * 500,
          geolocation: {
            coordinates: [
              Number.isFinite(lon) ? lon : -180 + Math.random() * 360,
              Number.isFinite(lat) ? lat : -90 + Math.random() * 180,
            ] as [number, number],
          },
        });
      }
      return;
    }

    for (let i = 0; i < safeCount; i++) {
      this.meteors.push(makeRandomMeteor());
    }
  }

  destroy(): void {
    if (this.myp5) {
      this.myp5.remove();
      this.myp5 = null;
    }
    super.destroy();
  }
}

export default AsteroidGraph;
