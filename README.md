# nw_wrld

nw_wrld is an event-driven sequencer for triggering visuals using web technologies. It enables users to scale up audiovisual compositions for prototyping, demos, exhibitions, and live performances. Users code their own visual modules, then orchestrate them using the project's native UI composer.

Visuals can be triggered via the built-in 16-step sequencer or by configuring external MIDI, OSC, audio capture, or file-upload inputs.

![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)
![Electron](https://img.shields.io/badge/electron-v39.8.10-blue)

<img width="1512" height="901" alt="Screenshot 2026-01-09 at 14 17 49" src="https://github.com/user-attachments/assets/9d59fe7d-cc3b-48ec-af11-007a9379cac5" />

## Beta Notice

This project is currently in beta. Downloadable installers are provided via GitHub Releases for macOS, Windows, and Linux, and `nw_wrld` can also be run from source using this repository. Please note that whilst the project is in beta, there may be frequent breaking changes between releases.

## Roadmap

- [x] Isolated sandbox and module-workspace bundling
- [x] Docblock-declared module dependencies with automated runtime injection
- [x] TypeScript migration
- [x] Unit tests, E2E Playwright tests, runtime validations
- [ ] Use-case specific User Guides (Ableton, strudel, TouchDesigner, etc.)
- [x] Signed and notarized macOS app builds
- [x] Signed Windows app builds
- [x] Robust Linux & WSL support
- [ ] Userdata, Module, and JSON versioning (+ migration scripts)
- [x] Multi-band audio threshold analysis (local processing) for channel triggers
- [ ] Advanced default sequencer (Working sampler with audio FX)
- [ ] Remote API input source with HTTP/WebSocket client for cloud-based services (audio analysis APIs, ML models, etc.)
- [ ] Serial port input support for hardware sensor integration

## Features

- **Built-in 16-step pattern sequencer** - Create rhythmic audiovisual compositions without external hardware
- **External MIDI/OSC/audio/file support** - Use MIDI, OSC, microphone/loopback audio capture, or uploaded audio files as trigger sources
- **Visual module system** - Build custom visuals with p5.js, Three.js, D3.js, or vanilla JavaScript
- **Hot module reloading** - Edit modules and see changes instantly
- **Project folder workflow** - Self-contained, portable projects with modules, assets, and data
- **Flexible method mapping** - Trigger any visual method with sequencer patterns or external signals
- **Per-track signal settings** - Configure per-track thresholds and trigger cooldown for audio and file modes
- **Module enable/disable toggle** - Disable modules per track without removing configuration

---

## Installation

### For Developers

Build from source to contribute or customize:

**Prerequisites:** Node.js v20+ and basic terminal knowledge

```bash
# 1. Clone the repository
git clone https://github.com/aagentah/nw_wrld.git
cd nw_wrld

# 2. Install dependencies
npm install

# 3. Start the app
npm start
```

Two windows will open:

- **Dashboard**: Control center for creating tracks, programming patterns, and configuring visuals
- **Projector**: Visual output window

---

## E2E Testing (Playwright)

```bash
npm run test:e2e
```

- E2E tests launch the real Electron app and control the windows via Playwright.
- Test artifacts (screenshots/traces on failure) are written to `test-results/` (gitignored).
- Tests can boot into an isolated project folder by setting `NW_WRLD_TEST_PROJECT_DIR`.

---

## Project Folders

nw_wrld uses a **project folder** model. Each project is a self-contained folder containing your modules, assets, and data.

**Note:** Workspace modules are JavaScript code executed by nw_wrld. Only open project folders you trust.

### What's Inside a Project Folder

A project folder holds three things: `modules/` (your hot-reloadable visual modules), `assets/` (images, JSON, and other resources), and `nw_wrld_data/` (tracks, settings, and recordings). For the full annotated layout, see [Project Structure](#project-structure) below.

### First Launch Experience

When you first launch nw_wrld, you'll be prompted to select or create a project folder. The app automatically scaffolds a working project with:

- **22 starter modules** - Ready-to-use examples (2D, 3D, text, data visualization)
- **Sample assets** - Images and JSON data files
- **Data storage** - Configuration, tracks, and recordings

### Portability

Projects are completely portable - copy the folder to share with others, work across machines, or back up your work. Everything needed to run your audiovisual compositions is contained in one folder.

### Lost Project?

If your project folder is deleted, moved, or disconnected, nw_wrld will prompt you to reselect it (see [Getting Started](GETTING_STARTED.md#if-your-project-folder-goes-missing)).

---

## Quick Start

### 60-Second Test

1. Click **[CREATE TRACK]** → Name it → Create
2. Click **[+ MODULE]** → Select **Text** or **Corners**
3. Click **[+ CHANNEL]** to add a sequencer row
4. Click some cells in the 16-step grid (they turn red)
5. Assign a method to the channel (e.g., `color` or `rotate`)
6. Click **[PLAY]** in the footer

You'll see the playhead move across the grid and trigger your visuals. No external setup required!

---

## How It Works: The Big Picture

```
Signal Sources:
┌──────────────┐
│  Sequencer   │──┐
│  (Built-in)  │  │
└──────────────┘  │
                  ├──▶ Dashboard ──▶ Projector
┌──────────────┐  │    (Control)     (Visuals)
│ External     │──┘
│ MIDI/OSC/    │
│ Audio/File   │
└──────────────┘
```

Dashboard is where you compose and map triggers; Projector is where visuals render and respond.

---

## Your First Workflow (Sequencer Mode)

Follow the [Getting Started Guide](GETTING_STARTED.md) for detailed step-by-step instructions.

The built-in sequencer is perfect for testing modules and creating standalone audiovisual pieces without external hardware.

---

## Advanced: External Input Control

For live performance and reactive workflows, you can use MIDI controllers/DAWs, OSC senders, audio input devices, or uploaded audio files.

To set up input routing and switch modes, see [Getting Started](GETTING_STARTED.md#advanced-connect-external-midiosc).

### DAW Quickstart (Ableton / FL Studio / Logic / etc.)

Most DAW setups send notes on **MIDI Channel 1** unless you explicitly route or change it. nw_wrld supports both a single-channel workflow and a split-channel workflow (method triggers on one channel, track selection on another). For the full channel-defaults walkthrough and best practice, see [Getting Started](GETTING_STARTED.md#advanced-connect-external-midiosc).

---

## Creating Visual Modules

Modules are JavaScript files in your **project's `modules/` folder**. Edit them with any text editor and nw_wrld hot-reloads automatically.

### Quick Module Creation

Create or edit a `.js` file in your project’s `modules/` folder and save, and nw_wrld hot-reloads it automatically.

### Module File Contract (Docblock + Default Export)

Workspace modules are loaded from your project folder and must follow a strict contract:

- **Filename is identity**: `modules/MyModule.js` → module id `MyModule` (must be alphanumeric and start with a letter)
- **Docblock metadata is required**: `@nwWrld name`, `@nwWrld category`, `@nwWrld imports`
- **Imports are declarative**: list what you need; nw_wrld injects safe bindings for you
- **Default export is required**: `export default MyModule`

Allowed `@nwWrld imports`:

- **SDK**: `ModuleBase`, `BaseThreeJsModule`, `assetUrl`, `readText`, `loadJson`, `listAssets`
- **Global libs**: `THREE`, `p5`, `d3`, `Noise`
- **Three.js loaders**: `OBJLoader`, `PLYLoader`, `PCDLoader`, `GLTFLoader`, `STLLoader`

```javascript
/*
@nwWrld name: My Module (Display Name)
@nwWrld category: 2D
@nwWrld imports: ModuleBase, assetUrl, loadJson
*/

class MyModule extends ModuleBase {
  async init() {
    const imgUrl = assetUrl("images/blueprint.png");
    const data = await loadJson("json/meteor.json");
  }
}

export default MyModule;
```

See the [Module Development Guide](MODULE_DEVELOPMENT.md) for complete documentation including:

- Full module structure and lifecycle
- Method definitions and option types
- SDK API reference and asset loading
- Library usage (p5.js, Three.js, D3.js)
- Advanced patterns and best practices

---

## Built-in ModuleBase Methods

When you extend `ModuleBase`, you inherit powerful methods for free: `show`, `hide`, `offset`, `scale`, `opacity`, `rotate`, `randomZoom`, `matrix`, `viewportLine`, `background`, and `invert`.

These methods can be triggered via the sequencer or external signal sources (MIDI/OSC/audio/file), giving you instant control over positioning, visibility, transformations, and effects.

See the [Module Development Guide](MODULE_DEVELOPMENT.md#sdk-api-reference) for complete documentation of all built-in methods and their parameters.

---

## Two Modes: Sequencer vs External

Switch between modes in **Settings → Signal Source**.

**Sequencer Mode (Default)** - Program patterns with a 16-step grid per channel. Perfect for getting started, testing modules, and creating standalone pieces without external hardware. Adjustable BPM (default 120), patterns loop continuously and save with your tracks.

**External Modes (Advanced)** - Drive channels from MIDI, OSC, live audio input, or an uploaded audio file. For the per-source breakdown and routing details, see [Advanced: External Input Control](#advanced-external-input-control) above. Configure global mappings in Settings for consistent control across all tracks.

Switch modes anytime - your tracks, modules, and methods remain the same. Only the trigger source changes.

---

## Starter Modules

Every new project includes 22 starter modules in your `modules/` folder, grouped by category:

**2D:**

- **AsteroidGraph** - p5.js with workspace JSON data
- **Corners** - DOM-based corner UI elements
- **Frame** - Border frame overlay
- **GridDots** - Animated dot grid patterns
- **GridOverlay** - Canvas-based grid overlay
- **Image** - Load images from workspace assets
- **ImageGallery** - Cycle through multiple workspace images
- **MathOrbitalMap** - Mathematical orbit mapping
- **OrbitalPlane** - Orbital mechanics simulation
- **PerlinBlob** - Noise-driven animated blob
- **ScanLines** - Animated scan-line overlay

**3D:**

- **BasicGeometry** - Three.js primitive geometry example
- **CloudPointIceberg** - 3D point cloud
- **CubeCube** - Nested cube visualization
- **CubeGrowth** - Growing cube animation
- **LowEarthPoint** - Low earth orbit visualization
- **ModelLoader** - Load external 3D models
- **SpinningCube** - Basic Three.js example

**Text:**

- **CodeColumns** - Animated code/text columns
- **HelloWorld** - Minimal working example
- **Text** - Configurable text display and manipulation
- **ZKProofVisualizer** - Zero-knowledge proof visualization

Study these modules to learn patterns for 2D, 3D, and text. All are fully editable in your project's `modules/` folder.

---

## Project Structure

### Your Project Folder (Where You Work)

```
MyProject/
├── modules/                    # ← YOUR MODULES GO HERE
│   ├── Text.js
│   ├── GridOverlay.js
│   ├── SpinningCube.js
│   ├── YourCustomModule.js    # Create your own modules here
│   └── ...22 starter modules
│
├── assets/                     # ← YOUR ASSETS GO HERE
│   ├── images/
│   │   ├── blueprint.png      # Included starter asset
│   │   └── your-image.png     # Add your own images
│   └── json/
│       ├── meteor.json         # Included starter dataset
│       └── your-data.json      # Add your own data
│
└── nw_wrld_data/               # App data (auto-managed)
    └── json/
        ├── userData.json       # Tracks, settings, mappings
        ├── appState.json       # Current app state
        ├── config.json         # App configuration
        └── recordingData.json  # Recording data
```

### Application Source (For Developers)

```
nw_wrld/
├── src/
│   ├── dashboard/              # React UI for control
│   │   ├── Dashboard.js        # Main dashboard logic
│   │   ├── modals/             # UI modals
│   │   ├── components/         # Reusable components
│   │   └── styles/             # Dashboard styles
│   │
│   ├── projector/              # Visual output window
│   │   ├── Projector.ts        # Main projector logic
│   │   ├── moduleSandboxEntry.ts # SDK initialization (sandbox entry)
│   │   └── helpers/
│   │       ├── moduleBase.ts   # Base class (the foundation)
│   │       └── threeBase.ts    # Three.js base class
│   │
│   ├── main/                   # Electron main process
│   │   ├── InputManager.ts     # MIDI/OSC input handling
│   │   ├── starter_modules/    # Starter modules (seeded into projects)
│   │   └── workspaceStarterModules.ts
│   │
│   └── shared/
│       ├── json/               # JSON file management
│       ├── config/             # Default configuration
│       ├── sequencer/          # Sequencer playback engine
│       ├── midi/               # MIDI utilities
│       └── audio/              # Audio feedback
│
├── index.js                    # Thin bootstrap into the compiled main process
├── package.json
└── README.md
```

`src/index.js` is a thin bootstrap that loads the compiled main process. The Electron main process lives under `src/main/mainProcess/` (`entry.ts`, `windows.ts`, `sandbox.ts`, `workspace.ts`, `protocols.ts`, `lifecycle.ts`, and `ipcBridge/`).

---

## Configuration

Configuration files are stored in your project's `nw_wrld_data/json/` directory:

- **`userData.json`** - Tracks, mappings, and settings (automatically managed)
- **`appState.json`** - Current app state and workspace path (automatically managed)
- **`config.json`** - App configuration, aspect ratios, background colors (automatically managed)
- **`recordingData.json`** - Recording data (automatically managed)

These files are managed by the Dashboard and typically don't require manual editing.

---

## Troubleshooting

Common quick fixes are below. For the full troubleshooting reference (module, asset, sequencer, MIDI, dev-mode, and Linux/WSL issues), see [Getting Started](GETTING_STARTED.md#troubleshooting).

| Issue                  | Solution                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| Project folder missing | App will prompt to reselect - choose or create a new project                                                   |
| Module doesn't appear  | Verify filename is `MyModule.js` (letters/numbers only), and docblock includes `@nwWrld name/category/imports` |
| Module hidden          | Trigger `show()` method or set `executeOnLoad: true`                                                           |
| No MIDI detected       | Enable IAC Driver/loopMIDI and verify DAW MIDI output                                                          |

---

## Performance

- Limit particle/object counts
- Use `requestAnimationFrame` for animations
- Clean up properly in `destroy()`
- Test on target hardware

---

## Building for Distribution

### Build the Renderer (Production Bundle)

```bash
npm run build
```

### Build macOS DMG

```bash
npm run dist:mac
```

This creates a distributable DMG in the `release/` directory.

### Build macOS DMGs (Split by Architecture - Recommended)

Universal mac builds bundle both Intel (x64) and Apple Silicon (arm64) into a single app, which significantly increases the download size.

To build two smaller DMGs (one per architecture):

```bash
npm run dist:mac:split
```

Or build a specific architecture:

```bash
npm run dist:mac:arm64
npm run dist:mac:x64
```

### Build Windows (portable .exe)

```bash
npm run dist:win
```

This creates a portable Windows `.exe` in the `release/` directory.

### Build Linux (AppImage + .deb)

```bash
npm run dist:linux
```

This creates Linux artifacts (typically `.AppImage` and `.deb`) in the `release/` directory.

### Automated Releases

The project uses GitHub Actions to automatically build and attach release artifacts (macOS DMGs for arm64 + x64, Windows portable `.exe`, and Linux `.AppImage` + `.deb`). A `SHA256SUMS` file is also attached for verifying downloads:

1. Tag a new version: `git tag v1.0.0`
2. Push the tag: `git push origin v1.0.0`
3. GitHub Actions builds the artifacts and creates a release automatically

See `.github/workflows/release.yml` for the CI configuration.

---

## Contributing

- Report bugs via issues
- Submit pull requests for improvements
- Share modules via discussions

---

## License

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.

---

## Documentation

- [Getting Started Guide](GETTING_STARTED.md)
- [Module Development Guide](MODULE_DEVELOPMENT.md)
- [E2E Testing Guidelines](E2E_TESTING_GUIDELINES.md)
- [Contributing Guide](CONTRIBUTING.md)

---

## Technologies

Electron, React, Three.js, p5.js, D3.js, WebMIDI

## Support

- [GitHub Issues](https://github.com/aagentah/nw_wrld/issues)
- [GitHub Discussions](https://github.com/aagentah/nw_wrld/discussions)
