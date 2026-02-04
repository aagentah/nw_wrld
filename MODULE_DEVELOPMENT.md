# Module Development Guide

This guide covers creating custom visual modules for nw_wrld, including the workspace (project folder) module contract and the runtime-injected SDK surface.

## Table of Contents

1. [Workspace Modules](#workspace-modules)
2. [Module Architecture](#module-architecture)
3. [Your First Module](#your-first-module)
4. [Module Lifecycle](#module-lifecycle)
5. [Working with Methods](#working-with-methods)
6. [Option Types Reference](#option-types-reference)
7. [SDK API Reference](#sdk-api-reference)
8. [Working with Assets](#working-with-assets)
9. [Using Libraries](#using-libraries)
10. [Advanced Patterns](#advanced-patterns)
11. [Debugging Modules](#debugging-modules)
12. [Best Practices](#best-practices)
13. [Performance Tips](#performance-tips)

---

## Workspace Modules

Modules live in your **project's `modules/` folder**, not in the application source code. This architecture enables:

- ✅ Edit modules without touching application code
- ✅ Hot-reload: changes apply immediately when you save
- ✅ Portability: share project folders with modules intact
- ✅ Trusted project code: modules are JavaScript files executed by nw_wrld
- ✅ No build step: pure JavaScript, runs directly

**Trust note:** Only open project folders you trust. Workspace modules are code.

### Where Modules Live

```
MyProject/
└── modules/           # ← Your modules go here
    ├── Text.js        # Included starter module
    ├── HelloWorld.js  # Included starter module
    └── MyModule.js    # Your custom module
```

### Creating a New Module

1. Navigate to your project folder
2. Open the `modules/` directory
3. Create `MyModule.js`
4. Save → nw_wrld detects and loads it automatically
5. The module appears in the Dashboard dropdown

### Module Structure for Workspace

All workspace modules must follow the **docblock contract**:

- **File identity**: `modules/Foo.js` → module id `Foo` (letters/numbers only; must start with a letter)
- **Required docblock fields**:
  - `@nwWrld name: ...` (display name in the UI)
  - `@nwWrld category: ...` (how it groups in the UI)
  - `@nwWrld imports: ...` (comma-separated dependency tokens; must include at least one)
- **Default export**: the module must end with `export default YourClass;`

Allowed `@nwWrld imports`:

- **SDK**: `ModuleBase`, `BaseThreeJsModule`, `assetUrl`, `readText`, `loadJson`
- **Global libs**: `THREE`, `p5`, `d3`, `Noise`
- **THREE.js Loaders**: `OBJLoader`, `PLYLoader`, `PCDLoader`, `GLTFLoader`, `STLLoader`

```javascript
/*
@nwWrld name: MyModule
@nwWrld category: 2D
@nwWrld imports: ModuleBase
*/

class MyModule extends ModuleBase {
  constructor(container) {
    super(container);
    this.init();
  }

  init() {
    // setup code
  }

  destroy() {
    // cleanup code
    super.destroy();
  }
}

export default MyModule;
```

**Important:** Do not use path-based `import ... from ...` inside workspace modules. Workspace modules are loaded from your project folder at runtime.

---

## Module Architecture

**Signal Flow:** Trigger (Sequencer/MIDI/OSC) → Dashboard (maps trigger to method) → Projector (calls method on module) → Module (updates visuals)

**Inheritance:** All modules extend `ModuleBase` (provides `this.elem`, built-in methods like `show`/`hide`, transformations, cleanup). For 3D graphics, extend `BaseThreeJsModule` instead.

**Hot Reloading:** When you save a module file in your workspace, nw_wrld detects the change, reloads the module definition, and updates the Dashboard. If the module is currently active in a track, it will be reloaded in the Projector.

---

## Your First Module

Let's create a simple pulsing circle module in your workspace.

### Create the File

Navigate to your project folder and create `modules/PulsingCircle.js`:

```javascript
/*
@nwWrld name: PulsingCircle
@nwWrld category: 2D
@nwWrld imports: ModuleBase
*/

class PulsingCircle extends ModuleBase {
  // Define available methods
  static methods = [
    {
      name: "pulse",
      executeOnLoad: false,
      options: [
        {
          name: "intensity",
          defaultVal: 1.5,
          type: "number",
        },
        {
          name: "duration",
          defaultVal: 500,
          type: "number",
        },
      ],
    },
    {
      name: "color",
      executeOnLoad: true,
      options: [
        {
          name: "color",
          defaultVal: "#00FF00",
          type: "color",
        },
      ],
    },
  ];

  constructor(container) {
    super(container);
    this.canvas = null;
    this.ctx = null;
    this.circleScale = 1;
    this.color = "#00FF00";
    this.init();
  }

  init() {
    // Create canvas
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.elem.offsetWidth;
    this.canvas.height = this.elem.offsetHeight;
    this.elem.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");

    // Draw initial circle
    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const radius = (Math.min(width, height) / 4) * this.circleScale;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw circle
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }

  pulse({ intensity = 1.5, duration = 500 }) {
    // Animate scale from 1 to intensity and back
    const startScale = this.circleScale;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      if (progress < 0.5) {
        // Growing phase
        this.circleScale = startScale + (intensity - startScale) * (progress * 2);
      } else if (progress < 1) {
        // Shrinking phase
        this.circleScale = intensity - (intensity - startScale) * ((progress - 0.5) * 2);
      } else {
        // Animation complete
        this.circleScale = startScale;
        this.draw();
        return;
      }

      this.draw();
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  color({ color = "#00FF00" }) {
    this.color = color;
    this.draw();
  }

  destroy() {
    if (this.canvas && this.canvas.parentNode === this.elem) {
      this.elem.removeChild(this.canvas);
      this.canvas = null;
      this.ctx = null;
    }
    super.destroy();
  }
}

export default PulsingCircle;
```

### Test Your Module

1. Save the file → nw_wrld automatically detects and loads it
2. In the Dashboard, create a track
3. Click **[+ MODULE]** → Select "PulsingCircle" from the dropdown
4. Add a channel and program a pattern in the sequencer grid
5. Assign the `pulse` method to the channel
6. Click **[PLAY]** to test your module

**Hot Reload:** Any changes you make to the file will be detected automatically when you save. No need to restart the app.

For live performance testing, switch to External Mode in Settings and trigger from your DAW.

---

## Module Lifecycle

### 1. Construction Phase

```javascript
constructor(container) {
  super(container); // Call this first

  // Initialize your instance variables
  this.myVariable = null;

  // Call your init method
  this.init();
}
```

`super()` sets up `this.elem`, transformation states, and hides the module by default.

### 2. Initialization Phase

```javascript
init() {
  // Create DOM elements
  // Set up canvases
  // Initialize libraries (p5, Three.js, etc.)
  // Load assets
}
```

Keep initialization fast. Set defaults but don't start animations.

### 3. Method Execution Phase

```javascript
myMethod({ param1 = defaultValue, param2 = defaultValue }) {
  // Validate parameters
  // Update visual state
  // Trigger animations
  // Redraw if needed
}
```

Methods with `executeOnLoad: true` run automatically after `init()` for initial setup. Methods with `executeOnLoad: false` wait for sequencer or external triggers. Always use default parameters.

### 4. Destruction Phase

```javascript
destroy() {
  // Stop animations
  // Remove event listeners
  // Clean up DOM elements
  // Destroy library instances

  super.destroy(); // Call this last
}
```

Critical for preventing memory leaks and stopping background processes.

---

## Working with Methods

### Method Definition

```javascript
static methods = [
  {
    name: "methodName",            // Must match function name
    executeOnLoad: true,           // Run on module load?
    options: [                     // Parameters
      {
        name: "paramName",         // Parameter name
        defaultVal: "value",       // Default value
        type: "text",              // UI control type
        min: 0,                    // (optional) for numbers
        max: 100,                  // (optional) for numbers
        unit: "ms",                // (optional) UI-only unit label
        values: ["a", "b"],        // (optional) for selects
        allowRandomization: true,  // (optional) add randomize button
      },
    ],
  },
];
```

### Option Schema (what the Dashboard understands)

Each entry in `static methods[].options[]` is an **option definition** that drives:

- What input control the Dashboard shows
- How values are saved in track/channel method configs
- What keys exist in the object passed to your method at runtime

Supported option fields:

- **`name`** (string, required): must match the property name your method reads (e.g. `pulse({ duration })`)
- **`type`** (string, required): one of the option types listed below
- **`defaultVal`** (optional): the value used when a method is first created in the UI
- **`min` / `max`** (optional, number): numeric bounds for number inputs (the UI clamps values to these bounds)
- **`unit`** (optional, string): UI-only display suffix (for example `ms`, `%`, `×`). This does not change runtime behavior.
- **`values`** (optional, string[]): required for `select` options; `defaultVal` should be one of these values
- **`allowRandomization`** (optional, boolean): enables the dice/random UI for this option
- **`assetBaseDir`** (optional, string): for `assetFile` / `assetDir` options (e.g. `"images"`, `"models"`, `"json"`, `"fonts"`)
- **`assetExtensions`** (optional, string[]): for `assetFile` options (e.g. `[".png", ".jpg"]`)
- **`allowCustom`** (optional, boolean): for asset options; when true, users can type a custom path/list instead of picking

### Units and numeric conventions (recommended)

- **Durations**: use **milliseconds** and label with `unit: "ms"`.
- **Percent values**: label with `unit: "%"`.
- **Multipliers**: label with `unit: "×"`.

### executeOnLoad Explained

`executeOnLoad: true` - Runs automatically when module loads (for initial setup: colors, sizes, text, positions)

`executeOnLoad: false` - Waits for sequencer or external trigger (for animations, effects, state changes)

### Method Naming

- Use camelCase: `myMethod`, `color`
- Be descriptive
- Method name in `static methods` must match function name exactly

---

## Option Types Reference

### Available Types

| Type        | Description                                       | Example                                                                                                                                                      |
| ----------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `text`      | Text input                                        | `{ name: "message", defaultVal: "Hello", type: "text" }`                                                                                                     |
| `number`    | Numeric input                                     | `{ name: "size", defaultVal: 50, type: "number", min: 10, max: 200 }`                                                                                        |
| `color`     | Color picker (hex)                                | `{ name: "color", defaultVal: "#FF0000", type: "color" }`                                                                                                    |
| `boolean`   | Toggle switch                                     | `{ name: "enabled", defaultVal: true, type: "boolean" }`                                                                                                     |
| `select`    | Dropdown menu                                     | `{ name: "mode", defaultVal: "bounce", type: "select", values: ["bounce", "slide"] }`                                                                        |
| `matrix`    | Grid position                                     | `{ name: "position", defaultVal: { rows: 1, cols: 1, excludedCells: [] }, type: "matrix" }`                                                                  |
| `assetFile` | Asset file picker (from workspace `assets/`)      | `{ name: "imagePath", defaultVal: "images/blueprint.png", type: "assetFile", assetBaseDir: "images", assetExtensions: [".png", ".jpg"], allowCustom: true }` |
| `assetDir`  | Asset directory picker (from workspace `assets/`) | `{ name: "directory", defaultVal: "images", type: "assetDir", assetBaseDir: "images", allowCustom: true }`                                                   |

All options create UI controls in the Dashboard and pass values to your methods.

---

## SDK API Reference

nw_wrld injects the identifiers you request in `@nwWrld imports` so your module code can use them directly (`ModuleBase`, `assetUrl`, `THREE`, etc.).

Internally, these are provided by the runtime; libraries are available as `globalThis.THREE/p5/d3`.

### Accessing the SDK

```javascript
// Recommended: declare imports in the docblock and use the injected identifiers.
/*
@nwWrld name: Uses SDK
@nwWrld category: 2D
@nwWrld imports: ModuleBase, assetUrl, readText, loadJson
*/
```

### Base Classes

#### ModuleBase

The foundation for all 2D and DOM-based modules.

```javascript
/*
@nwWrld name: MyModule
@nwWrld category: 2D
@nwWrld imports: ModuleBase
*/

class MyModule extends ModuleBase {
  static methods = [
    // your methods
  ];

  constructor(container) {
    super(container);
    // super() provides this.elem
    this.init();
  }
}
```

**Inherited Properties:**

- `this.elem` - The container DOM element for your module
- `this.externalElements` - Array for tracking external DOM elements

**Inherited Methods:**

- `show()` - Make module visible
- `hide()` - Hide module
- `offset({ x, y })` - Reposition module
- `scale({ scale })` - Scale module
- `opacity({ opacity })` - Set opacity
- `rotate({ direction, speed, duration })` - Rotate module (duration is milliseconds)
- `randomZoom({ scaleFrom, scaleTo, position })` - Random zoom effect
- `matrix({ matrix, border })` - Position using matrix grid
- `viewportLine({ x, y, length, opacity })` - Draw a viewport line (x/y/length are percentages)
- `background({ color })` - Set background color
- `invert({ duration })` - Invert colors (duration is milliseconds)

#### BaseThreeJsModule

Base class for Three.js 3D modules (extends ModuleBase).

```javascript
/*
@nwWrld name: My3DModule
@nwWrld category: 3D
@nwWrld imports: BaseThreeJsModule, THREE
*/

class My3DModule extends BaseThreeJsModule {
  static methods = [
    // your methods
  ];

  constructor(container) {
    super(container);
    // super() provides this.scene, this.camera, this.renderer
    this.init();
  }

  init() {
    // Add objects to this.scene
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    this.scene.add(cube);
  }
}
```

**Additional Inherited Properties:**

- `this.scene` - Three.js scene
- `this.camera` - Three.js camera
- `this.renderer` - Three.js renderer
- `this.controls` - Orbit controls (if enabled)

### Asset Loading Methods

#### assetUrl(path)

Get a `nw-assets://` URL for a workspace asset (scoped to the current project).

```javascript
const imageUrl = assetUrl("images/blueprint.png");
if (imageUrl) {
  this.img.src = imageUrl;
}
```

**Parameters:**

- `path` (string) - Relative path from `assets/` folder

**Returns:** `string | null` - Asset URL or null if invalid

**Path safety:** Paths are constrained to the `assets/` folder. Attempts to access files outside the project assets will return null.

#### loadJson(path)

Load and parse a JSON file from workspace assets.

```javascript
const data = await loadJson("json/meteor.json");
if (data) {
  this.processData(data);
}
```

**Parameters:**

- `path` (string) - Relative path from `assets/` folder

**Returns:** `Promise<object | null>` - Parsed JSON or null if error

**Example with fallback:**

```javascript
async loadData() {
  const data = await loadJson("json/data.json");
  if (data && Array.isArray(data)) {
    this.dataset = data;
  } else {
    // Fallback to hardcoded data
    this.dataset = [{ id: 1, value: 100 }];
  }
}
```

#### readText(path)

Read a text file from workspace assets.

```javascript
const text = await readText("data/poem.txt");
if (text) {
  this.displayText(text);
}
```

**Parameters:**

- `path` (string) - Relative path from `assets/` folder

**Returns:** `Promise<string | null>` - File contents or null if error

### SDK Method Summary

| Method           | Purpose                          | Returns                   |
| ---------------- | -------------------------------- | ------------------------- |
| `assetUrl(path)` | Get `nw-assets://` URL for asset | `string \| null`          |
| `loadJson(path)` | Load & parse JSON file           | `Promise<object \| null>` |
| `readText(path)` | Read text file                   | `Promise<string \| null>` |

---

## Working with Assets

Your project folder includes an `assets/` directory for images, JSON data, and other resources that modules can load.

### Asset Folder Structure

```
MyProject/
└── assets/
    ├── images/          # Images (PNG, JPG, GIF, etc.)
    │   └── blueprint.png
    ├── models/          # 3D models (OBJ, PLY, PCD, GLTF/GLB, STL)
    │   └── cube.obj
    └── json/            # JSON data files
        └── meteor.json
```

### Adding Assets to Your Project

1. Navigate to your project folder
2. Open the `assets/` directory
3. Add files to `images/` or `json/` subdirectories
4. Reference them in your modules using the SDK

### Loading Images

```javascript
/*
@nwWrld name: ImageModule
@nwWrld category: 2D
@nwWrld imports: ModuleBase, assetUrl
*/

class ImageModule extends ModuleBase {
  static methods = [
    {
      name: "image",
      executeOnLoad: true,
      options: [
        {
          name: "path",
          defaultVal: "images/blueprint.png",
          type: "assetFile",
          assetBaseDir: "images",
          assetExtensions: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"],
          allowCustom: true,
        },
      ],
    },
  ];

  constructor(container) {
    super(container);
    this.img = null;
    this.init();
  }

  init() {
    this.img = document.createElement("img");
    this.img.style.cssText = "width: 100%; height: 100%; object-fit: contain;";
    this.elem.appendChild(this.img);
  }

  image({ path = "images/blueprint.png" } = {}) {
    const url = assetUrl(path);
    if (this.img && url) {
      this.img.src = url;
    }
    this.show();
  }

  destroy() {
    if (this.img && this.img.parentNode === this.elem) {
      this.elem.removeChild(this.img);
    }
    this.img = null;
    super.destroy();
  }
}

export default ImageModule;
```

### Loading JSON Data

```javascript
/*
@nwWrld name: DataViz
@nwWrld category: 2D
@nwWrld imports: ModuleBase, loadJson
*/

class DataViz extends ModuleBase {
  static methods = [
    {
      name: "loadData",
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
    this.dataset = null;
    this.init();
  }

  init() {
    // Setup canvas or DOM elements
  }

  async loadData({ count = 5 } = {}) {
    // Try to load from workspace
    const data = await loadJson("json/meteor.json");

    if (data && Array.isArray(data)) {
      // Use workspace data
      this.dataset = data.slice(0, count);
    } else {
      // Fallback to generated data
      this.dataset = this.generateFallbackData(count);
    }

    this.render();
  }

  generateFallbackData(count) {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      value: Math.random() * 100,
    }));
  }

  render() {
    // Render the dataset
  }
}

export default DataViz;
```

### Loading Text Files

```javascript
async loadPoem() {
  const text = await readText("data/poem.txt");
  if (text) {
    this.displayText(text);
  } else {
    this.displayText('Default text');
  }
}
```

### Asset Path Rules

✅ **Correct:**

```javascript
assetUrl("images/photo.png");
loadJson("json/data.json");
readText("data/text.txt");
```

❌ **Incorrect:**

```javascript
assetUrl("/images/photo.png"); // Don't start with /
assetUrl("../other/file.png"); // Can't escape assets folder
assetUrl("/etc/passwd"); // Path safety: constrained to assets/
assetUrl("http://example.com/file.obj"); // No external URLs
```

### Starter Assets

New projects include two starter assets:

- `assets/images/blueprint.png` - Example image (used by Image module)
- `assets/json/meteor.json` - Example dataset (used by AsteroidGraph module)
- `assets/models/cube.obj` - Example OBJ model (used by ModelLoader)
- `assets/models/tetra.stl` - Example STL model (used by ModelLoader)
- `assets/models/triangle.ply` - Example PLY model (used by ModelLoader)
- `assets/models/points.pcd` - Example PCD point cloud (used by ModelLoader)
- `assets/models/triangle.gltf` - Example glTF model (used by ModelLoader)

Study the **Image** and **AsteroidGraph** starter modules to see asset loading patterns in action.

---

## Using Libraries

### p5.js (2D Canvas Drawing)

p5.js is available globally in workspace modules.

```javascript
/*
@nwWrld name: MyP5Module
@nwWrld category: 2D
@nwWrld imports: ModuleBase, p5
*/

class MyP5Module extends ModuleBase {
  static methods = [];

  constructor(container) {
    super(container);
    this.myp5 = null;
    this.init();
  }

  init() {
    if (!p5) return;

    const sketch = (p) => {
      p.setup = () => {
        p.createCanvas(this.elem.offsetWidth, this.elem.offsetHeight);
        p.background(0);
      };

      p.draw = () => {
        // Your drawing code
        p.fill(255);
        p.ellipse(p.mouseX, p.mouseY, 50, 50);
      };
    };

    this.myp5 = new p5(sketch, this.elem);
  }

  destroy() {
    if (this.myp5) {
      this.myp5.remove();
      this.myp5 = null;
    }
    super.destroy();
  }
}

export default MyP5Module;
```

See the **GridDots** and **AsteroidGraph** starter modules for complete p5.js examples.

### Three.js (3D Graphics)

Extend `BaseThreeJsModule` instead of `ModuleBase` for Three.js projects.

```javascript
/*
@nwWrld name: My3DModule
@nwWrld category: 3D
@nwWrld imports: BaseThreeJsModule, THREE
*/

class My3DModule extends BaseThreeJsModule {
  static methods = [];

  constructor(container) {
    super(container);
    this.cube = null;
    this.init();
  }

  init() {
    if (!THREE) return;
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    this.cube = new THREE.Mesh(geometry, material);
    this.scene.add(this.cube);

    this.camera.position.z = 5;
  }

  animate() {
    if (this.cube) {
      this.cube.rotation.x += 0.01;
      this.cube.rotation.y += 0.01;
    }
  }

  destroy() {
    if (this.cube) {
      this.scene.remove(this.cube);
      this.cube.geometry.dispose();
      this.cube.material.dispose();
      this.cube = null;
    }
    super.destroy();
  }
}

export default My3DModule;
```

See the **SpinningCube**, **CubeCube**, and **OrbitalPlane** starter modules for complete Three.js examples.

### Loading 3D Models

Use `assetUrl()` to safely reference models from your project’s `assets/` folder, then load them with the THREE.js loader classes.

```javascript
/*
@nwWrld name: MyModelLoader
@nwWrld category: 3D
@nwWrld imports: BaseThreeJsModule, THREE, assetUrl, OBJLoader, GLTFLoader
*/

class MyModelLoader extends BaseThreeJsModule {
  loadModel({ modelPath = "models/cube.obj" } = {}) {
    const url = assetUrl(modelPath);
    if (!url) return;

    const ext = String(modelPath).split(".").pop().toLowerCase();
    const loader =
      ext === "obj" ? new OBJLoader() : ext === "glb" || ext === "gltf" ? new GLTFLoader() : null;
    if (!loader) return;

    loader.load(url, (result) => {
      const root = result?.scene || result;
      this.setModel(root);
    });
  }
}

export default MyModelLoader;
```

### D3.js (Data Visualization)

D3.js is available globally in workspace modules.

```javascript
/*
@nwWrld name: MyD3Module
@nwWrld category: 2D
@nwWrld imports: ModuleBase, d3
*/

class MyD3Module extends ModuleBase {
  static methods = [];

  constructor(container) {
    super(container);
    this.svg = null;
    this.init();
  }

  init() {
    if (!d3) return;

    this.svg = d3.select(this.elem).append("svg").attr("width", "100%").attr("height", "100%");

    // Create your visualization
    const data = [10, 20, 30, 40, 50];
    this.svg
      .selectAll("circle")
      .data(data)
      .enter()
      .append("circle")
      .attr("cx", (d, i) => i * 100 + 50)
      .attr("cy", 100)
      .attr("r", (d) => d);
  }

  destroy() {
    if (this.svg) {
      this.svg.remove();
      this.svg = null;
    }
    super.destroy();
  }
}

export default MyD3Module;
```

### Available Global Libraries

The following libraries are available globally in workspace modules:

- **p5** - `globalThis.p5` - Creative coding and canvas drawing
- **THREE** - `globalThis.THREE` - 3D graphics
- **d3** - `globalThis.d3` - Data visualization

---

## Advanced Patterns

### Animation Loops

Use `requestAnimationFrame` for smooth animations. Always store the ID and cancel it in `destroy()`.

```javascript
init() {
  this.animationId = null;
  this.startAnimation();
}

startAnimation() {
  const animate = () => {
    // Update your visuals
    this.render();
    this.animationId = requestAnimationFrame(animate);
  };
  this.animationId = requestAnimationFrame(animate);
}

destroy() {
  if (this.animationId) {
    cancelAnimationFrame(this.animationId);
    this.animationId = null;
  }
  super.destroy();
}
```

### External Elements

For DOM elements created outside `this.elem`, add them to `this.externalElements` array for automatic cleanup.

```javascript
init() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position: fixed; top: 0; left: 0;';
  document.body.appendChild(overlay);

  // Track for automatic cleanup
  this.externalElements.push(overlay);
}

// ModuleBase.destroy() will remove all externalElements automatically
```

### Random Parameters

Add `allowRandomization: true` to any option to enable a randomization button in the UI (select options also support randomization in the Dashboard).

```javascript
options: [
  {
    name: "color",
    defaultVal: "#FF0000",
    type: "color",
    allowRandomization: true, // Adds random button in UI
  },
];
```

### Async Initialization

If your module needs to load assets during initialization, use an async pattern:

```javascript
constructor(container) {
  super(container);
  this.dataset = null;
  this.init();
}

init() {
  // Synchronous setup
  this.canvas = document.createElement('canvas');
  this.elem.appendChild(this.canvas);

  // Load assets asynchronously
  this.loadAssets();
}

async loadAssets() {
  try {
    this.dataset = await loadJson("json/data.json");
    if (this.dataset) {
      this.render();
    }
  } catch (error) {
    console.error('Failed to load assets:', error);
  }
}
```

### State Management

For complex modules with multiple states, create a clear state management pattern:

```javascript
constructor(container) {
  super(container);
  this.state = {
    mode: 'idle',
    speed: 1.0,
    paused: false,
  };
  this.init();
}

updateState(newState) {
  this.state = { ...this.state, ...newState };
  this.render();
}

togglePause() {
  this.updateState({ paused: !this.state.paused });
}
```

### Responsive Sizing

Handle window resize events for responsive modules:

```javascript
init() {
  this.onResize = this.onResize.bind(this);
  window.addEventListener('resize', this.onResize);
  this.resize();
}

resize() {
  const width = this.elem.offsetWidth;
  const height = this.elem.offsetHeight;
  // Update canvas, Three.js renderer, etc.
}

onResize() {
  // Debounce for performance
  if (this.resizeTimeout) {
    clearTimeout(this.resizeTimeout);
  }
  this.resizeTimeout = setTimeout(() => {
    this.resize();
  }, 250);
}

destroy() {
  window.removeEventListener('resize', this.onResize);
  if (this.resizeTimeout) {
    clearTimeout(this.resizeTimeout);
  }
  super.destroy();
}
```

## Debugging Modules

### Developer Tools

Open the Developer Console in the **Projector** window:

- **Mac:** `Cmd + Option + I`
- **Windows:** `Ctrl + Shift + I`

The console shows:

- JavaScript errors in your modules
- `console.log()` output
- Asset loading failures
- Module lifecycle events

### Using Console Logging

Add debug logging to understand your module's behavior:

```javascript
init() {
  console.log('[MyModule] Initializing...');
  // setup code
  console.log('[MyModule] Initialized successfully');
}

myMethod({ param = 'default' }) {
  console.log('[MyModule] myMethod called with:', param);
  // method code
}
```

### Hot Reload Debugging

When you save a module file, watch the Dashboard for feedback:

- ✅ **Success:** Module reloads silently
- ⚠️ **Warning:** Yellow badge shows broken module (check console)
- ❌ **Error:** Module missing entirely (check filename and export)

### Common Errors

| Error                                        | Cause                 | Fix                                                                                     |
| -------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------- |
| "Module does not have an 'elem' property"    | Forgot `super()`      | Call `super(container)` first in constructor                                            |
| "Cannot read property 'appendChild' of null" | `this.elem` not ready | Ensure `super()` is called before accessing `this.elem`                                 |
| "Method not found"                           | Name mismatch         | Method name in `static methods` must match function name exactly                        |
| "Module doesn't appear in Dashboard"         | Contract issues       | Ensure docblock has `@nwWrld name/category/imports` and file ends with `export default` |
| "ModuleBase is not defined"                  | Missing import        | Add `ModuleBase` to `@nwWrld imports`                                                   |
| "Asset failed to load"                       | Invalid path          | Verify path is relative to `assets/` folder, no leading `/`                             |
| "Module loads but nothing visible"           | Module hidden         | Call `this.show()` or set a method with `executeOnLoad: true`                           |

### Checking Module Loading

To see if your module file is being detected:

1. Open Dashboard
2. Create or select a track
3. Click **[+ MODULE]**
4. Your module should appear in the dropdown

If it doesn't appear:

- Check that the file is saved in `modules/` folder
- Verify filename ends with `.js`
- Check that `export default ClassName` exists
- Open console in Dashboard (`Cmd+Option+I`) for errors

### Testing Asset Loading

To debug asset loading issues:

```javascript
async testAssetLoading() {
  const imageUrl = assetUrl("images/test.png");
  console.log('Image URL:', imageUrl);

  const data = await loadJson("json/data.json");
  console.log('Loaded data:', data);
}
```

### Module Development Workflow

1. **Edit** module file in your text editor
2. **Save** the file
3. **Check** Dashboard - module should reload
4. **Test** by adding to a track and triggering methods
5. **Debug** using console if issues arise
6. **Iterate** - repeat steps 1-5

## Best Practices

### Module Structure

1. **Use docblock imports** and rely on the injected identifiers:

   ```javascript
   /*
   @nwWrld name: MyModule
   @nwWrld category: 2D
   @nwWrld imports: ModuleBase
   */
   ```

2. **Always call `super(container)` first** in constructor:

   ```javascript
   constructor(container) {
     super(container);  // Must be first
     this.myProperty = null;
     this.init();
   }
   ```

3. **Use descriptive names**:
   - Display name: `@nwWrld name: ...`
   - Category: `@nwWrld category: ...`
   - Method names: Clear, action-oriented (`loadData`, `color`, `animate`)

### Method Design

1. **Always use default parameters**:

   ```javascript
   myMethod({ color = "#FFFFFF", size = 50 } = {}) {
     // Now safe if called with no arguments
   }
   ```

2. **Validate input where needed**:

   ```javascript
   setCount({ count = 10 } = {}) {
     const safeCount = Math.max(1, Math.min(100, Number(count) || 10));
     this.count = safeCount;
   }
   ```

3. **Use `executeOnLoad` appropriately**:
   - `executeOnLoad: true` for setup methods (colors, text, initial state)
   - `executeOnLoad: false` for trigger methods (animations, effects)

### Asset Loading

1. **Always check for null returns**:

   ```javascript
   const data = await loadJson("json/data.json");
   if (data && Array.isArray(data)) {
     // Use data
   } else {
     // Fallback
   }
   ```

2. **Provide fallbacks for missing assets**:

   ```javascript
   async loadData() {
     const data = await loadJson("json/data.json");
     this.dataset = data || this.generateDefaultData();
   }
   ```

3. **Use relative paths** (no leading slash):
   - ✅ `'images/photo.png'`
   - ❌ `'/images/photo.png'`

### Cleanup and Memory

1. **Always clean up in `destroy()`**:

   ```javascript
   destroy() {
     // Stop animations
     if (this.animationId) {
       cancelAnimationFrame(this.animationId);
     }

     // Remove listeners
     window.removeEventListener('resize', this.onResize);

     // Dispose Three.js resources
     if (this.geometry) this.geometry.dispose();
     if (this.material) this.material.dispose();

     // Remove DOM elements
     if (this.canvas && this.elem.contains(this.canvas)) {
       this.elem.removeChild(this.canvas);
     }

     // Call parent cleanup
     super.destroy();
   }
   ```

2. **Null out references** after cleanup:

   ```javascript
   this.canvas = null;
   this.myp5 = null;
   this.geometry = null;
   ```

3. **Use `this.externalElements`** for DOM elements outside `this.elem`

### Code Organization

1. **Keep methods focused** - Each method does one thing well
2. **Extract reusable logic** into private methods
3. **Use consistent formatting** - Follow the starter module style

### Error Handling

1. **Fail gracefully**:

   ```javascript
   init() {
     try {
       this.setupComplexFeature();
     } catch (error) {
       console.error('[MyModule] Setup failed:', error);
       this.setupFallback();
     }
   }
   ```

2. **Log useful information**:

   ```javascript
   console.log("[MyModule] Loading asset:", path);
   console.error("[MyModule] Failed to load:", path, error);
   ```

3. **Check library availability**:
   ```javascript
   init() {
     if (!p5) {
       console.error('[MyModule] p5.js not available');
       return;
     }
     // Continue with p5 setup
   }
   ```

## Performance Tips

### General Performance

1. **Batch DOM updates** - Minimize reflows and repaints:

   ```javascript
   // Bad: Multiple style updates
   this.elem.style.width = "100px";
   this.elem.style.height = "100px";
   this.elem.style.opacity = "0.5";

   // Good: Single cssText update
   this.elem.style.cssText = "width: 100px; height: 100px; opacity: 0.5;";
   ```

2. **Use requestAnimationFrame** for animations (not `setInterval` or `setTimeout`):

   ```javascript
   // Bad
   setInterval(() => this.render(), 16);

   // Good
   const animate = () => {
     this.render();
     this.animationId = requestAnimationFrame(animate);
   };
   animate();
   ```

3. **Debounce expensive operations**:
   ```javascript
   onResize() {
     clearTimeout(this.resizeTimeout);
     this.resizeTimeout = setTimeout(() => {
       this.resize();
     }, 250);
   }
   ```

### Canvas Performance

1. **Clear only what you need**:

   ```javascript
   // If full clear needed
   ctx.clearRect(0, 0, canvas.width, canvas.height);

   // If partial clear possible
   ctx.clearRect(x, y, width, height);
   ```

2. **Use offscreen canvas** for complex rendering:

   ```javascript
   init() {
     this.offscreen = document.createElement('canvas');
     this.offscreenCtx = this.offscreen.getContext('2d');
     // Render to offscreen, then copy to visible canvas
   }
   ```

3. **Cache unchanging elements**:

   ```javascript
   // Draw static background once
   this.cachedBackground = this.renderBackground();

   render() {
     // Use cached background
     ctx.drawImage(this.cachedBackground, 0, 0);
     // Draw dynamic elements on top
   }
   ```

### Three.js Performance

1. **Reuse geometries and materials**:

   ```javascript
   // Bad: New geometry/material for each object
   for (let i = 0; i < 100; i++) {
     const geo = new THREE.BoxGeometry(1, 1, 1);
     const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
     const mesh = new THREE.Mesh(geo, mat);
   }

   // Good: Shared geometry/material
   const geo = new THREE.BoxGeometry(1, 1, 1);
   const mat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
   for (let i = 0; i < 100; i++) {
     const mesh = new THREE.Mesh(geo, mat);
     // Position mesh differently
   }
   ```

2. **Limit object counts**:

   ```javascript
   setCount({ count = 100 } = {}) {
     // Cap at reasonable maximum
     const safeCount = Math.min(count, 1000);
     this.createObjects(safeCount);
   }
   ```

3. **Use instanced meshes** for many identical objects:

   ```javascript
   const geometry = new THREE.BoxGeometry(1, 1, 1);
   const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
   const instancedMesh = new THREE.InstancedMesh(geometry, material, 1000);
   this.scene.add(instancedMesh);
   ```

4. **Dispose resources properly**:
   ```javascript
   destroy() {
     if (this.mesh) {
       this.scene.remove(this.mesh);
       this.mesh.geometry.dispose();
       this.mesh.material.dispose();
     }
     super.destroy();
   }
   ```

### p5.js Performance

1. **Avoid unnecessary redraws**:

   ```javascript
   p.setup = () => {
     p.createCanvas(width, height);
     p.noLoop(); // Don't redraw unless needed
   };

   myMethod() {
     // Update state, then redraw once
     this.updateState();
     this.myp5.redraw();
   }
   ```

2. **Use p5 rendering modes**:
   ```javascript
   p.setup = () => {
     p.createCanvas(width, height, p.WEBGL); // Hardware accelerated
   };
   ```

### Memory Management

1. **Avoid memory leaks**:
   - Remove event listeners in `destroy()`
   - Cancel animation frames
   - Clear intervals/timeouts
   - Dispose Three.js resources
   - Remove p5 instances

2. **Monitor memory usage**:
   - Use Chrome DevTools Memory profiler
   - Test loading/unloading modules repeatedly
   - Check for increasing memory over time

### Asset Loading Performance

1. **Load assets once, reuse**:

   ```javascript
   async init() {
     // Load once during init
     this.dataset = await loadJson("json/data.json");
   }

   myMethod() {
     // Reuse loaded dataset
     this.processData(this.dataset);
   }
   ```

2. **Consider asset size**:
   - Optimize images before adding to workspace
   - Compress JSON data where possible
   - Limit texture sizes for Three.js

---

## Testing Your Module

### Basic Testing Checklist

- [ ] Module appears in Dashboard dropdown
- [ ] All methods appear in method selector
- [ ] All method options render correctly (text, number, color, etc.)
- [ ] `executeOnLoad` behavior works as expected
- [ ] Methods trigger correctly from sequencer
- [ ] Visual output appears in Projector
- [ ] Hot reload works when file is saved
- [ ] No console errors on load or execution
- [ ] Module cleans up properly (check `destroy()`)

### Testing Methods

1. **Test each method individually**:
   - Create a track, add your module
   - Add a channel, assign one method
   - Trigger the method and verify behavior
   - Repeat for each method

2. **Test with different parameters**:
   - Try minimum and maximum values
   - Test with invalid inputs
   - Verify default values work

3. **Test hot reload**:
   - Make a small change (e.g., change a color)
   - Save the file
   - Verify the module reloads
   - Check that the change appears

### Testing Performance

1. **Check console for warnings**
2. **Monitor FPS** in Projector window
3. **Test with multiple instances** (add module to multiple tracks)
4. **Test long-running** (let it run for several minutes)

### Testing Cleanup

1. Create a track and add your module
2. Remove the module from the track
3. Check console for errors
4. Add the module again
5. Repeat several times to check for memory leaks

---

## Further Learning

### Study Starter Modules

The 16 starter modules in your project's `modules/` folder are your best learning resource:

- **HelloWorld.js** - Simplest structure
- **Text.js** - Method options and DOM
- **Image.js** - Asset loading
- **AsteroidGraph.js** - Data visualization with assets
- **SpinningCube.js** - Three.js basics
- **GridDots.js** - p5.js patterns

### Library Documentation

- [p5.js Reference](https://p5js.org/reference/) - Creative coding and canvas
- [Three.js Documentation](https://threejs.org/docs/) - 3D graphics
- [D3.js Documentation](https://d3js.org/) - Data visualization

### Community

- [GitHub Discussions](https://github.com/aagentah/nw_wrld/discussions) - Ask questions, share modules
- [GitHub Issues](https://github.com/aagentah/nw_wrld/issues) - Report bugs, request features

---
