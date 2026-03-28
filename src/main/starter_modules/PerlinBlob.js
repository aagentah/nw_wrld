/*
@nwWrld name: PerlinBlob
@nwWrld category: 2D
@nwWrld imports: ModuleBase, p5, loadJson
*/

const clampNumber = (v, min, max) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
};

const toNumericSeries = (raw, valueKey) => {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const first = raw[0];

  if (typeof first === "number") {
    return raw.map((x) => Number(x)).filter((x) => Number.isFinite(x));
  }

  if (!first || typeof first !== "object") return [];

  const key = typeof valueKey === "string" && valueKey.trim() ? valueKey : null;
  if (key) {
    return raw
      .map((row) => Number(row?.[key]))
      .filter((x) => Number.isFinite(x));
  }

  const candidateKey = Object.keys(first).find((k) =>
    Number.isFinite(Number(first?.[k]))
  );
  if (!candidateKey) return [];

  return raw
    .map((row) => Number(row?.[candidateKey]))
    .filter((x) => Number.isFinite(x));
};

const sampleSeries = (series, maxPoints) => {
  const arr = Array.isArray(series) ? series : [];
  const max = Math.floor(Number(maxPoints) || 0);
  if (max <= 0 || arr.length <= max) return arr;
  const out = [];
  const step = arr.length / max;
  for (let i = 0; i < max; i++) {
    const idx = Math.floor(i * step);
    const v = arr[idx];
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
};

class PerlinBlob extends ModuleBase {
  static methods = [
    {
      name: "loadData",
      executeOnLoad: true,
      options: [
        {
          name: "dataPath",
          defaultVal: "json/radiation.json",
          type: "assetFile",
          assetBaseDir: "json",
          assetExtensions: [".json"],
          allowCustom: true,
        },
        { name: "valueKey", defaultVal: "Estimated DGSR", type: "text" },
        {
          name: "maxPoints",
          defaultVal: 800,
          type: "number",
          min: 10,
          max: 5000,
          allowRandomization: true,
        },
      ],
    },
  ];

  constructor(container) {
    super(container);
    this.name = PerlinBlob.name;
    this.myp5 = null;
    this.canvas = null;
    this.destroyed = false;

    this.values = [];
    this.dataReady = false;
    this.dataIndex = 0;
    this.displayValue = 0;
    this.previousValue = 0;
    this.nextValue = 0;
    this.frameCounter = 0;

    this.noiseOffsets = [];
    this.init();
  }

  init() {
    if (!p5) return;
    const sketch = (p) => {
      this.myp5 = p;

      p.setup = () => {
        if (!this.elem) return;

        const canvasWidth = this.elem.clientWidth;
        const canvasHeight = this.elem.clientHeight;
        this.canvas = p.createCanvas(canvasWidth, canvasHeight);
        this.canvas.parent(this.elem);
        p.noFill();
        p.angleMode(p.DEGREES);

        const numLayers = 10;
        this.noiseOffsets = [];
        for (let i = 0; i < numLayers; i++) {
          this.noiseOffsets.push(p.random(1000));
        }
      };

      p.draw = () => {
        if (!this.dataReady || !this.elem) return;

        p.clear();
        p.translate(p.width / 2, p.height / 2);

        const numLayers = 10;
        if (this.noiseOffsets.length < numLayers) {
          while (this.noiseOffsets.length < numLayers) {
            this.noiseOffsets.push(p.random(1000));
          }
        }

        const cycleFrames = 600;
        if (p.frameCount % cycleFrames === 0) {
          this.dataIndex = (this.dataIndex + 1) % this.values.length;
          this.previousValue = this.nextValue;
          this.nextValue = this.values[this.dataIndex] ?? this.previousValue;
          this.frameCounter = 0;
        }

        const lerpFactor = this.frameCounter / cycleFrames;
        this.displayValue = p.lerp(
          this.previousValue,
          this.nextValue,
          lerpFactor
        );
        this.frameCounter = Math.min(cycleFrames, this.frameCounter + 1);

        const intensity = 5;
        const adjusted = Math.min(
          200,
          Math.abs(this.displayValue) * intensity + 5
        );

        const maxRadius = (Math.min(p.width, p.height) * 0.8) / 2;
        const minStrokeWeight = 0.1;
        const maxStrokeWeight = 1;
        let previousLayerRadii = [];

        for (let i = 0; i < numLayers; i++) {
          const radius = maxRadius - (i * maxRadius) / numLayers;
          p.strokeWeight(
            p.map(i, 0, numLayers - 1, minStrokeWeight, maxStrokeWeight)
          );

          const hue = p.map(i, 0, numLayers - 1, 200, 250);
          p.stroke(p.color(`hsb(${hue}, 70%, 70%)`));

          const applyCompression = p.random() < 0.5;
          let compressionAngle = 0;
          let minCompression = 1;
          if (applyCompression) {
            compressionAngle = p.random(0, 360);
            minCompression = 0.5;
          }

          const currentLayerRadii = [];
          p.beginShape();
          for (let angle = 0; angle <= 360; angle += 5) {
            const xoff = p.map(p.cos(angle), -1, 1, 0, 1);
            const yoff = p.map(p.sin(angle), -1, 1, 0, 1);
            const n = p.noise(
              (xoff + this.noiseOffsets[i]) * 0.5,
              (yoff + this.noiseOffsets[i]) * 0.5
            );

            const maxOffset = adjusted * ((numLayers - i) / numLayers);
            const offset = p.map(n, 0.4, 0.6, -maxOffset, maxOffset, true);
            let currentRadius = radius + offset;

            if (applyCompression) {
              let angleDifference = angle - compressionAngle;
              angleDifference = ((angleDifference + 180) % 360) - 180;
              const compressionFactor = p.map(
                p.cos(p.radians(angleDifference)),
                -1,
                1,
                1,
                minCompression
              );
              currentRadius = currentRadius * compressionFactor;
            }

            if (i > 0) {
              const prevRadius = previousLayerRadii[angle] || radius;
              const maxAllowedRadius = prevRadius - 1;
              if (currentRadius > maxAllowedRadius)
                currentRadius = maxAllowedRadius;
            } else if (currentRadius > maxRadius) {
              currentRadius = maxRadius;
            }

            const x = currentRadius * p.cos(angle);
            const y = currentRadius * p.sin(angle);

            currentLayerRadii[angle] = currentRadius;
            p.curveVertex(x, y);
          }
          p.endShape(p.CLOSE);

          previousLayerRadii = currentLayerRadii;
          this.noiseOffsets[i] += 0.005;
        }
      };
    };

    this.myp5 = new p5(sketch);
  }

  applyValues(values) {
    const series = Array.isArray(values) ? values : [];
    if (series.length === 0) {
      this.values = [];
      this.dataReady = false;
      return;
    }

    this.values = series;
    this.dataIndex = 0;
    this.previousValue = series[0];
    this.nextValue = series[0];
    this.displayValue = series[0];
    this.frameCounter = 0;
    this.dataReady = true;
  }

  generateFallbackValues() {
    const out = [];
    for (let i = 0; i < 80; i++) {
      out.push(Math.sin(i * 0.18) * 30 + 50);
    }
    return out;
  }

  async loadData({
    dataPath = "json/radiation.json",
    valueKey = "Estimated DGSR",
    maxPoints = 800,
  } = {}) {
    const safeMax = clampNumber(maxPoints, 10, 5000);
    const raw = await loadJson(String(dataPath || ""));
    if (this.destroyed) return;

    const parsed = sampleSeries(toNumericSeries(raw, valueKey), safeMax);
    if (parsed.length > 0) {
      this.applyValues(parsed);
      return;
    }

    this.applyValues(this.generateFallbackValues());
  }

  destroy() {
    this.destroyed = true;
    if (this.myp5) {
      this.myp5.remove();
      this.myp5 = null;
    }
    this.canvas = null;
    super.destroy();
  }
}

export default PerlinBlob;
