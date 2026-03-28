# nw_wrld

nw_wrld is an event-driven sequencer for triggering visuals using web technologies. It enables users to scale up audiovisual compositions for prototyping, demos, exhibitions, and live performances. Users code their own visual modules, then orchestrate them using the project's native UI composer.

Visuals can be triggered via the built-in 16-step sequencer or by configuring external MIDI, OSC, audio capture, or file-upload inputs.

![Node Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)
![Electron](https://img.shields.io/badge/electron-v39.2.7-blue)

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

```
MyProject/
├── modules/           # Visual modules (hot-reloadable JavaScript files)
│   ├── Text.js
│   ├── GridOverlay.js
│   ├── SpinningCube.js
│   └── ...16 starter modules
├── assets/            # Images, JSON, and other resources
│   ├── images/
│   │   └── blueprint.png
│   └── json/
│       └── meteor.json
└── nw_wrld_data/      # Tracks, settings, and recordings
    └── json/
```

### First Launch Experience

When you first launch nw_wrld, you'll be prompted to select or create a project folder. The app automatically scaffolds a working project with:

- **16 starter modules** - Ready-to-use examples (2D, 3D, text, data visualization)
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

Most DAW setups send notes on **MIDI Channel 1** unless you explicitly route or change it. nw_wrld supports both single-channel and split-channel workflows:

- **Option A (simplest): Single MIDI channel**
  - In nw_wrld → Settings → External (MIDI/OSC) → MIDI:
    - **Method Triggers MIDI Channel**: `1`
    - **Track Select MIDI Channel**: `1`
  - Use **Settings → Configure Mappings** to choose either:
    - **MIDI (Pitch Class)**: octave-agnostic mapping using C..B (avoids DAW octave-name differences)
    - **MIDI (Exact Note)**: octave-specific mapping using full MIDI note numbers (0–127)
  - Then map which triggers activate track selection vs method triggers.

- **Option B (clean separation): Split MIDI channels**
  - In your DAW, route method trigger notes to Channel 1 and track-selection notes to Channel 2 (commonly done with separate MIDI routing tracks/devices).
  - In nw_wrld → Settings:
    - **Method Triggers MIDI Channel**: `1`
    - **Track Select MIDI Channel**: `2`

---

## Creating Visual Modules

Modules are JavaScript files in your **project's `modules/` folder**. Edit them with any text editor and nw_wrld hot-reloads automatically.

### Quick Module Creation

Create or edit a `.js` file in your project’s `modules/` folder and save — nw_wrld hot-reloads it automatically.

### Module File Contract (Docblock + Default Export)

Workspace modules are loaded from your project folder and must follow a strict contract:

- **Filename is identity**: `modules/MyModule.js` → module id `MyModule` (must be alphanumeric and start with a letter)
- **Docblock metadata is required**: `@nwWrld name`, `@nwWrld category`, `@nwWrld imports`
- **Imports are declarative**: list what you need; nw_wrld injects safe bindings for you
- **Default export is required**: `export default MyModule`

Allowed `@nwWrld imports`:

- **SDK**: `ModuleBase`, `BaseThreeJsModule`, `assetUrl`, `readText`, `loadJson`
- **Global libs**: `THREE`, `p5`, `d3`

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

When you extend `ModuleBase`, you inherit powerful methods for free: `show`, `hide`, `offset`, `scale`, `opacity`, `rotate`, `randomZoom`, and `matrix`.

These methods can be triggered via the sequencer or external signal sources (MIDI/OSC/audio/file), giving you instant control over positioning, visibility, transformations, and effects.

See the [Module Development Guide](MODULE_DEVELOPMENT.md#option-types-reference) for complete documentation of all built-in methods and their parameters.

---

## Two Modes: Sequencer vs External

Switch between modes in **Settings → Signal Source**.

**Sequencer Mode (Default)** - Program patterns with a 16-step grid per channel. Perfect for getting started, testing modules, and creating standalone pieces without external hardware. Adjustable BPM (60-130), patterns loop continuously and save with your tracks.

**External Modes (Advanced)** - Use one of the following sources:

- **MIDI (Pitch Class)**: map C..B (octave-agnostic). This avoids “G7 vs G8” naming differences across DAWs because matching is based on pitch class.
- **MIDI (Exact Note)**: map full MIDI note numbers (0–127) for octave-specific triggers.
- **OSC**: map OSC addresses.
- **External Audio**: capture live audio from a selected input device and trigger channels from Low/Medium/High bands.
- **File Upload**: upload an MP3/WAV per track and trigger channels from Low/Medium/High bands during playback.

Configure global mappings in Settings for consistent control across all tracks.

Switch modes anytime - your tracks, modules, and methods remain the same. Only the trigger source changes.

---

## Starter Modules

Every new project includes 16 starter modules in your `modules/` folder:

**2D & UI:**

- **Text** - Configurable text display and manipulation
- **Corners** - DOM-based corner UI elements
- **GridOverlay** - Canvas-based grid overlay
- **GridDots** - Animated dot grid patterns
- **Frame** - Border frame overlay
- **Image** - Load images from workspace assets
- **CodeColumns** - Animated code/text columns

**3D Graphics:**

- **SpinningCube** - Basic Three.js example
- **CubeCube** - Nested cube visualization
- **OrbitalPlane** - Orbital mechanics simulation
- **LowEarthPoint** - Low earth orbit visualization

**Data Visualization:**

- **AsteroidGraph** - p5.js with workspace JSON data
- **MathOrbitalMap** - Mathematical orbit mapping
- **CloudPointIceberg** - 3D point cloud
- **ZKProofVisualizer** - Zero-knowledge proof visualization

**Getting Started:**

- **HelloWorld** - Minimal working example

Study these modules to learn patterns for 2D, 3D, text, and data visualization. All are fully editable in your project's `modules/` folder.

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
│   └── ...16 starter modules
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
│   │   ├── Projector.js        # Main projector logic
│   │   ├── helpers/
│   │   │   ├── moduleBase.ts   # Base class (the foundation)
│   │   │   └── threeBase.ts    # Three.js base class
│   │   └── templates/
│   │       └── ThreeTemplate.ts # 3D module template
│   │
│   ├── main/                   # Electron main process
│   │   ├── InputManager.js     # MIDI/OSC input handling
│   │   ├── starter_modules/    # Starter modules (seeded into projects)
│   │   └── workspaceStarterModules.js
│   │
│   ├── shared/
│   │   ├── json/               # JSON file management
│   │   ├── config/             # Default configuration
│   │   ├── sequencer/          # Sequencer playback engine
│   │   ├── midi/               # MIDI utilities
│   │   └── audio/              # Audio feedback
│   │
│   └── renderer.ts             # SDK initialization
│
├── package.json
└── README.md
```

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

| Issue                                 | Solution                                                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Project folder missing                | App will prompt to reselect - choose or create a new project                                                   |
| Module doesn't appear                 | Verify filename is `MyModule.js` (letters/numbers only), and docblock includes `@nwWrld name/category/imports` |
| Module won't load                     | Open Projector devtools; check for syntax errors, missing imports, or unknown imports                          |
| Module hidden                         | Trigger `show()` method or set `executeOnLoad: true`                                                           |
| Asset won't load                      | Verify path is relative to `assets/` folder                                                                    |
| Pattern not playing                   | Check that methods are assigned to channels                                                                    |
| No MIDI detected                      | Enable IAC Driver/loopMIDI and verify DAW MIDI output                                                          |
| MIDI works once, then stops (Windows) | Ensure nw_wrld fully closed (no background process). If using a virtual port, restart the port app or reboot.  |
| Method not triggering                 | Verify mapping, check method name match, check console                                                         |
| Hot reload not working                | Check file is saved in project's `modules/` folder                                                             |
| App won't start (dev mode)            | Close other dev servers (port 9000), run `npm install`                                                         |

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
