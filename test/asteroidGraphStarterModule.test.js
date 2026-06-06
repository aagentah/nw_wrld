const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const modPath = path.join(__dirname, "..", "src", "main", "starter_modules", "AsteroidGraph.js");

const loadAsteroidGraph = ({ loadJson }) => {
  const source = fs
    .readFileSync(modPath, "utf8")
    .replace(/export default AsteroidGraph;\s*$/, "module.exports = AsteroidGraph;\n");

  class P5Mock {
    constructor(sketch) {
      sketch(this);
    }
    remove() {
      this.removed = true;
    }
    createCanvas() {
      return { parent() {} };
    }
    textSize() {}
    textAlign() {}
    random() {
      return 0;
    }
    noise() {
      return 0.5;
    }
    clear() {}
    stroke() {}
    noFill() {}
    fill() {}
    beginShape() {}
    endShape() {}
    vertex() {}
    text() {}
    get CENTER() {
      return "center";
    }
    get width() {
      return 200;
    }
    get height() {
      return 100;
    }
  }

  const sandbox = {
    module: { exports: {} },
    exports: {},
    console,
    p5: P5Mock,
    loadJson,
    ModuleBase: class ModuleBase {
      constructor(container) {
        this.elem = container;
        this.name = this.constructor.name;
      }
      destroy() {
        this.elem = null;
      }
    },
  };

  vm.runInNewContext(source, sandbox, { filename: modPath });
  return sandbox.module.exports;
};

const createContainer = () => ({
  clientWidth: 200,
  clientHeight: 100,
  appendChild() {},
  removeChild() {},
});

test("AsteroidGraph: loadMeteors must not populate after the instance is destroyed", async () => {
  let resolveLoad;
  const loadJson = () => new Promise((res) => (resolveLoad = res));
  const AsteroidGraph = loadAsteroidGraph({ loadJson });

  const inst = new AsteroidGraph(createContainer());
  const pending = inst.loadMeteors({ count: 3 });
  // Destroyed mid-flight (the projector's deactivate/re-init churn) before the
  // async dataset load resolves.
  inst.destroy();
  resolveLoad(null);
  await pending;

  assert.equal(
    inst.meteors.length,
    0,
    "a destroyed instance must not keep populating its meteors after the async load resolves"
  );
});
