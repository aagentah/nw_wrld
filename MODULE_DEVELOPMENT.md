# Module Development Guide

This guide covers creating custom visual modules for nw_wrld, including workspace module development and the nwWrldSdk API.

## Table of Contents

1. [Workspace Modules](#workspace-modules)
2. [Module Architecture](#module-architecture)
3. [Your First Module](#your-first-module)
4. [Module Lifecycle](#module-lifecycle)
5. [Working with Methods](#working-with-methods)
6. [Option Types Reference](#option-types-reference)
7. [nwWrldSdk API Reference](#nwwrldsdk-api-reference)
8. [Working with Assets](#working-with-assets)
9. [Using Libraries](#using-libraries)
10. [Starter Modules Reference](#starter-modules-reference)
11. [Advanced Patterns](#advanced-patterns)
12. [Debugging Modules](#debugging-modules)
13. [Best Practices](#best-practices)
14. [Performance Tips](#performance-tips)

---

## Workspace Modules

Modules live in your **project's `modules/` folder**, not in the application source code. This architecture enables:

- ✅ Edit modules without touching application code
- ✅ Hot-reload: changes apply immediately when you save
- ✅ Portability: share project folders with modules intact
- ✅ Sandboxing: modules can't access files outside the workspace
- ✅ No build step: pure JavaScript, runs directly

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

All workspace modules must use `globalThis.nwWrldSdk` to access the base classes and SDK methods:

```javascript
const { ModuleBase } = globalThis.nwWrldSdk || {};

class MyModule extends ModuleBase {
  static name = "MyModule";
  static category = "2D";

  static methods = [
    ...((ModuleBase && ModuleBase.methods) || []),
    // your custom methods
  ];

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

**Important:** Always use the `globalThis.nwWrldSdk` pattern. Direct imports like `import ModuleBase from ...` won't work in workspace modules.

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
const { ModuleBase } = globalThis.nwWrldSdk || {};

class PulsingCircle extends ModuleBase {
  // Module metadata
  static name = "PulsingCircle";
  static category = "2D"; // Use "2D", "3D", or "Text"

  // Define available methods
  static methods = [
    ...ModuleBase.methods, // Inherit base methods
    {
      name: "pulse",
      autoLoad: false,
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
      name: "setColor",
      autoLoad: true,
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
        this.circleScale =
          startScale + (intensity - startScale) * (progress * 2);
      } else if (progress < 1) {
        // Shrinking phase
        this.circleScale =
          intensity - (intensity - startScale) * ((progress - 0.5) * 2);
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

  setColor({ color = "#00FF00" }) {
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

Methods with `autoLoad: true` run automatically after `init()` for initial setup. Methods with `autoLoad: false` wait for sequencer or external triggers. Always use default parameters.

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
  ...ModuleBase.methods, // Inherit base methods
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
        values: ["a", "b"],        // (optional) for selects
        allowRandomization: true,  // (optional) add randomize button
      },
    ],
  },
];
```

### executeOnLoad Explained

`executeOnLoad: true` - Runs automatically when module loads (for initial setup: colors, sizes, text, positions)

`executeOnLoad: false` - Waits for sequencer or external trigger (for animations, effects, state changes)

### Method Naming

- Use camelCase: `myMethod`, `setColor`
- Be descriptive
- Method name in `static methods` must match function name exactly

---

## Option Types Reference

### Available Types

| Type      | Description        | Example                                                                                     |
| --------- | ------------------ | ------------------------------------------------------------------------------------------- |
| `text`    | Text input         | `{ name: "message", defaultVal: "Hello", type: "text" }`                                    |
| `number`  | Numeric input      | `{ name: "size", defaultVal: 50, type: "number", min: 10, max: 200 }`                       |
| `color`   | Color picker (hex) | `{ name: "color", defaultVal: "#FF0000", type: "color" }`                                   |
| `boolean` | Toggle switch      | `{ name: "enabled", defaultVal: true, type: "boolean" }`                                    |
| `select`  | Dropdown menu      | `{ name: "mode", defaultVal: "bounce", type: "select", values: ["bounce", "slide"] }`       |
| `matrix`  | Grid position      | `{ name: "position", defaultVal: { rows: 1, cols: 1, excludedCells: [] }, type: "matrix" }` |

All options create UI controls in the Dashboard and pass values to your methods.

---

## nwWrldSdk API Reference

The `nwWrldSdk` is a global object that provides access to base classes, asset loading, and workspace utilities for modules.

### Accessing the SDK

```javascript
const { ModuleBase, BaseThreeJsModule } = globalThis.nwWrldSdk || {};
```

### Base Classes

#### ModuleBase

The foundation for all 2D and DOM-based modules.

```javascript
const { ModuleBase } = globalThis.nwWrldSdk || {};

class MyModule extends ModuleBase {
  static name = "MyModule";
  static category = "2D";

  static methods = [
    ...((ModuleBase && ModuleBase.methods) || []),
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
- `rotate({ degrees })` - Rotate module
- `randomZoom()` - Random zoom effect
- `matrix({ position })` - Position using matrix grid

#### BaseThreeJsModule

Base class for Three.js 3D modules (extends ModuleBase).

```javascript
const { BaseThreeJsModule } = globalThis.nwWrldSdk || {};

class My3DModule extends BaseThreeJsModule {
  static name = "My3DModule";
  static category = "3D";

  static methods = [
    ...((BaseThreeJsModule && BaseThreeJsModule.methods) || []),
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

Get a `file://` URL for a workspace asset.

```javascript
const imageUrl = nwWrldSdk.assetUrl("images/blueprint.png");
if (imageUrl) {
  this.img.src = imageUrl;
}
```

**Parameters:**

- `path` (string) - Relative path from `assets/` folder

**Returns:** `string | null` - File URL or null if invalid

**Security:** Paths are sandboxed to the `assets/` folder. Attempts to access files outside the workspace will return null.

#### loadJson(path)

Load and parse a JSON file from workspace assets.

```javascript
const data = await nwWrldSdk.loadJson("json/meteor.json");
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
  const data = await nwWrldSdk.loadJson('json/data.json');
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
const text = await nwWrldSdk.readText("data/poem.txt");
if (text) {
  this.displayText(text);
}
```

**Parameters:**

- `path` (string) - Relative path from `assets/` folder

**Returns:** `Promise<string | null>` - File contents or null if error

#### getWorkspaceDir()

Get the absolute path to the current workspace folder.

```javascript
const workspaceDir = nwWrldSdk.getWorkspaceDir();
console.log("Working in:", workspaceDir);
// Example: /Users/yourname/MyProject
```

**Returns:** `string | null` - Absolute path or null if no workspace

**Note:** You typically don't need this for asset loading (use `assetUrl`, `loadJson`, `readText` instead). Useful for debugging or logging.

### SDK Method Summary

| Method              | Purpose                   | Returns                   |
| ------------------- | ------------------------- | ------------------------- |
| `assetUrl(path)`    | Get file:// URL for asset | `string \| null`          |
| `loadJson(path)`    | Load & parse JSON file    | `Promise<object \| null>` |
| `readText(path)`    | Read text file            | `Promise<string \| null>` |
| `getWorkspaceDir()` | Get workspace path        | `string \| null`          |

---

## Working with Assets

Your project folder includes an `assets/` directory for images, JSON data, and other resources that modules can load.

### Asset Folder Structure

```
MyProject/
└── assets/
    ├── images/          # Images (PNG, JPG, GIF, etc.)
    │   └── blueprint.png
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
const { ModuleBase } = globalThis.nwWrldSdk || {};

class ImageModule extends ModuleBase {
  static name = "ImageModule";
  static category = "2D";

  static methods = [
    ...((ModuleBase && ModuleBase.methods) || []),
    {
      name: "setImage",
      executeOnLoad: true,
      options: [
        {
          name: "path",
          defaultVal: "images/blueprint.png",
          type: "text",
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

  setImage({ path = "images/blueprint.png" } = {}) {
    const url = nwWrldSdk.assetUrl(path);
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
const { ModuleBase } = globalThis.nwWrldSdk || {};

class DataViz extends ModuleBase {
  static name = "DataViz";
  static category = "2D";

  static methods = [
    ...((ModuleBase && ModuleBase.methods) || []),
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
    const data = await nwWrldSdk.loadJson("json/meteor.json");

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
  const text = await nwWrldSdk.readText('data/poem.txt');
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
nwWrldSdk.assetUrl("images/photo.png");
nwWrldSdk.loadJson("json/data.json");
nwWrldSdk.readText("data/text.txt");
```

❌ **Incorrect:**

```javascript
nwWrldSdk.assetUrl("/images/photo.png"); // Don't start with /
nwWrldSdk.assetUrl("../other/file.png"); // Can't escape assets folder
nwWrldSdk.assetUrl("/etc/passwd"); // Security: sandboxed to assets/
```

### Starter Assets

New projects include two starter assets:

- `assets/images/blueprint.png` - Example image (used by Image module)
- `assets/json/meteor.json` - Example dataset (used by AsteroidGraph module)

Study the **Image** and **AsteroidGraph** starter modules to see asset loading patterns in action.

---

## Using Libraries

### p5.js (2D Canvas Drawing)

p5.js is available globally in workspace modules.

```javascript
const { ModuleBase } = globalThis.nwWrldSdk || {};
const p5 = globalThis.p5;

class MyP5Module extends ModuleBase {
  static name = "MyP5Module";
  static category = "2D";

  static methods = [...((ModuleBase && ModuleBase.methods) || [])];

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
const { BaseThreeJsModule } = globalThis.nwWrldSdk || {};

class My3DModule extends BaseThreeJsModule {
  static name = "My3DModule";
  static category = "3D";

  static methods = [
    ...((BaseThreeJsModule && BaseThreeJsModule.methods) || []),
  ];

  constructor(container) {
    super(container);
    this.cube = null;
    this.init();
  }

  init() {
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

### D3.js (Data Visualization)

D3.js is available globally in workspace modules.

```javascript
const { ModuleBase } = globalThis.nwWrldSdk || {};
const d3 = globalThis.d3;

class MyD3Module extends ModuleBase {
  static name = "MyD3Module";
  static category = "2D";

  static methods = [...((ModuleBase && ModuleBase.methods) || [])];

  constructor(container) {
    super(container);
    this.svg = null;
    this.init();
  }

  init() {
    if (!d3) return;

    this.svg = d3
      .select(this.elem)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%");

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
- **Tone** - `globalThis.Tone` - Audio synthesis (optional)

---

## Starter Modules Reference

Every new project includes 16 starter modules that demonstrate different techniques and patterns. Study these modules to learn best practices.

### 2D & UI Modules

#### HelloWorld

**File:** `modules/HelloWorld.js`  
**Purpose:** Minimal working example - the simplest possible module  
**Techniques:** Basic DOM manipulation, text display  
**Good for:** Understanding the minimum module structure

#### Text

**File:** `modules/Text.js`  
**Purpose:** Configurable text display and manipulation  
**Techniques:** DOM text rendering, CSS styling, method options  
**Good for:** Learning method parameters and text handling

#### Corners

**File:** `modules/Corners.js`  
**Purpose:** DOM-based corner UI elements  
**Techniques:** Fixed positioning, UI overlays  
**Good for:** Creating persistent UI elements

#### GridOverlay

**File:** `modules/GridOverlay.js`  
**Purpose:** Canvas-based grid overlay  
**Techniques:** Canvas 2D API, responsive sizing  
**Good for:** Learning canvas drawing basics

#### GridDots

**File:** `modules/GridDots.js`  
**Purpose:** Animated dot grid patterns with p5.js  
**Techniques:** p5.js sketches, animation loops, noise  
**Good for:** Learning p5.js integration

#### Frame

**File:** `modules/Frame.js`  
**Purpose:** Border frame overlay  
**Techniques:** CSS borders, responsive containers  
**Good for:** Simple visual framing

#### Image

**File:** `modules/Image.js`  
**Purpose:** Load and display images from workspace assets  
**Techniques:** `nwWrldSdk.assetUrl()`, image loading  
**Good for:** Learning asset loading patterns

#### CodeColumns

**File:** `modules/CodeColumns.js`  
**Purpose:** Matrix-style animated text columns  
**Techniques:** DOM animation, text effects  
**Good for:** Creative text animations

### 3D Graphics Modules

#### SpinningCube

**File:** `modules/SpinningCube.js`  
**Purpose:** Basic Three.js cube with rotation  
**Techniques:** BaseThreeJsModule, basic 3D objects, animation  
**Good for:** Learning Three.js basics

#### CubeCube

**File:** `modules/CubeCube.js`  
**Purpose:** Nested cube visualization  
**Techniques:** Complex Three.js scenes, multiple objects  
**Good for:** Intermediate Three.js patterns

#### OrbitalPlane

**File:** `modules/OrbitalPlane.js`  
**Purpose:** Orbital mechanics simulation  
**Techniques:** Mathematical animation, 3D transformations  
**Good for:** Physics-based 3D visuals

#### LowEarthPoint

**File:** `modules/LowEarthPoint.js`  
**Purpose:** Low earth orbit visualization  
**Techniques:** Orbital calculations, particle systems  
**Good for:** Advanced 3D techniques

### Data Visualization Modules

#### AsteroidGraph

**File:** `modules/AsteroidGraph.js`  
**Purpose:** p5.js visualization with workspace JSON data  
**Techniques:** `nwWrldSdk.loadJson()`, data processing, p5.js graphs  
**Good for:** Learning asset loading and data visualization

#### MathOrbitalMap

**File:** `modules/MathOrbitalMap.js`  
**Purpose:** Mathematical orbit mapping  
**Techniques:** Mathematical visualization, coordinate systems  
**Good for:** Mathematical graphics

#### CloudPointIceberg

**File:** `modules/CloudPointIceberg.js`  
**Purpose:** 3D point cloud visualization  
**Techniques:** Three.js points, particle systems  
**Good for:** Point cloud rendering

#### ZKProofVisualizer

**File:** `modules/ZKProofVisualizer.js`  
**Purpose:** Zero-knowledge proof visualization  
**Techniques:** Complex animations, state visualization  
**Good for:** Advanced visualization patterns

### How to Learn from Starter Modules

1. **Start with HelloWorld** - Understand the bare minimum structure
2. **Study Text** - Learn method parameters and configuration
3. **Try Image or AsteroidGraph** - Learn asset loading
4. **Explore SpinningCube** - Get into 3D basics
5. **Copy and modify** - Duplicate a module and change it to learn

All starter modules are fully editable in your project's `modules/` folder. Experiment freely!

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

Add `allowRandomization: true` to any option to enable a randomization button in the UI.

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
    this.dataset = await nwWrldSdk.loadJson('json/data.json');
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

| Error                                        | Cause                 | Fix                                                                     |
| -------------------------------------------- | --------------------- | ----------------------------------------------------------------------- |
| "Module does not have an 'elem' property"    | Forgot `super()`      | Call `super(container)` first in constructor                            |
| "Cannot read property 'appendChild' of null" | `this.elem` not ready | Ensure `super()` is called before accessing `this.elem`                 |
| "Method not found"                           | Name mismatch         | Method name in `static methods` must match function name exactly        |
| "Module doesn't appear in Dashboard"         | Export/name issues    | Add `export default ModuleName` and verify `static name = "ModuleName"` |
| "ModuleBase is not defined"                  | Missing SDK import    | Add `const { ModuleBase } = globalThis.nwWrldSdk \|\| {};` at top       |
| "Asset failed to load"                       | Invalid path          | Verify path is relative to `assets/` folder, no leading `/`             |
| "Module loads but nothing visible"           | Module hidden         | Call `this.show()` or set a method with `executeOnLoad: true`           |

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
  console.log('Workspace dir:', nwWrldSdk.getWorkspaceDir());

  const imageUrl = nwWrldSdk.assetUrl('images/test.png');
  console.log('Image URL:', imageUrl);

  const data = await nwWrldSdk.loadJson('json/data.json');
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

1. **Always use the SDK pattern** at the top of workspace modules:

   ```javascript
   const { ModuleBase } = globalThis.nwWrldSdk || {};
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
   - Module name: `static name = "MyDescriptiveModule"`
   - Category: `"2D"`, `"3D"`, or `"Text"`
   - Method names: Clear, action-oriented (`loadData`, `setColor`, `animate`)

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
   const data = await nwWrldSdk.loadJson("json/data.json");
   if (data && Array.isArray(data)) {
     // Use data
   } else {
     // Fallback
   }
   ```

2. **Provide fallbacks for missing assets**:

   ```javascript
   async loadData() {
     const data = await nwWrldSdk.loadJson('json/data.json');
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
3. **Comment non-obvious code** - Explain "why", not "what"
4. **Use consistent formatting** - Follow the starter module style

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
     this.dataset = await nwWrldSdk.loadJson('json/data.json');
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

**Happy module development!** 🎨
