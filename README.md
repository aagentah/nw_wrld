# nw_wrld

nw_wrld is an event-driven sequencer for triggering visuals using web technologies. It enables users to scale up audiovisual compositions for prototyping, demos, exhibitions, and live performances. Users code their own visual modules, then orchestrate them using the project's native UI composer.

Visuals can be triggered via the built-in 16-step sequencer or by configuring external MIDI/OSC inputs.

![Node Version](https://img.shields.io/badge/node-%5E18.0.0-brightgreen)
![Electron](https://img.shields.io/badge/electron-v28.0.0-blue)

---

## Features

- **Built-in 16-step pattern sequencer** - Create rhythmic audiovisual compositions without external hardware
- **External MIDI/OSC support** - Connect Ableton Live, TouchOSC, or any MIDI/OSC source for live performance
- **Visual module system** - Build custom visuals with p5.js, Three.js, D3.js, or vanilla JavaScript
- **Hot module reloading** - Edit modules and see changes instantly
- **Project folder workflow** - Self-contained, portable projects with modules, assets, and data
- **Flexible method mapping** - Trigger any visual method with sequencer patterns or external signals

---

## Installation

### For Users (Recommended)

Download and install the DMG from [Releases](https://github.com/aagentah/nw_wrld/releases)

1. Open the DMG and drag nw_wrld to Applications
2. Launch nw_wrld
3. Select a folder for your project (or create a new one)
4. Start creating immediately with 16 included starter modules

**No Node.js, terminal, or coding experience required to get started.**

### For Developers

Build from source to contribute or customize:

**Prerequisites:** Node.js v18+ and basic terminal knowledge

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

## Project Folders

nw_wrld uses a **project folder** model. Each project is a self-contained folder containing your modules, assets, and data.

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

If your project folder is deleted, moved, or disconnected (e.g., external drive unplugged), nw_wrld will detect the issue and prompt you to reselect or choose a different project.

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
│ MIDI/OSC     │
└──────────────┘
```

### Dashboard Window

- Create tracks and add visual modules
- Program patterns with the 16-step sequencer
- Configure module methods and parameters
- (Optional) Connect external MIDI/OSC sources

### Projector Window

- Displays active visual modules
- Responds to sequencer or external triggers in real-time
- Can be full-screened on external displays

---

## Your First Workflow (Sequencer Mode)

Follow the [Getting Started Guide](GETTING_STARTED.md) for detailed step-by-step instructions.

**Quick overview:**

1. Create a track and add visual modules
2. Add channels and program patterns in the 16-step grid
3. Assign methods to channels (color, scale, rotate, etc.)
4. Click PLAY to see your patterns trigger visuals in real-time

The built-in sequencer is perfect for testing modules and creating standalone audiovisual pieces without external hardware.

---

## Advanced: External MIDI/OSC Control

For live performance with external hardware, you can connect MIDI controllers or DAWs.

### Optional Prerequisites

- **A DAW** that outputs MIDI (Ableton Live, FL Studio, Logic Pro, etc.)
- **MIDI routing** setup:
  - **Mac**: IAC Driver (built-in) - [Setup Guide](https://help.ableton.com/hc/en-us/articles/209774225-Using-virtual-MIDI-buses)
  - **Windows**: loopMIDI or similar virtual MIDI port

### Step 1: Configure MIDI Routing

**Mac:**

1. Open **Audio MIDI Setup** → Show MIDI Studio
2. Enable **IAC Driver**

**Windows:**

1. Install [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html)

**In Ableton:**

1. Preferences → MIDI
2. Enable your virtual port for Track/Remote output

### Step 2: Switch Mode

1. Dashboard → **Settings** → **Signal Source**
2. Select **External (MIDI/OSC)**
3. Configure MIDI device or OSC port
4. Go to **Settings → Configure Mappings** to customize trigger notes

### Step 3: Perform Live

1. Play your DAW
2. Track activation note loads modules
3. MIDI notes trigger mapped methods
4. Real-time audiovisual performance

---

## Creating Visual Modules

Modules are JavaScript files in your **project's `modules/` folder**. Edit them with any text editor and nw_wrld hot-reloads automatically.

### Quick Module Creation

1. Navigate to your project folder
2. Open the `modules/` directory
3. Create or edit a `.js` file
4. Save → nw_wrld detects changes and reloads

### Using the nwWrldSdk

Workspace modules use the global SDK to access functionality and assets:

```javascript
const { ModuleBase } = globalThis.nwWrldSdk || {};

class MyModule extends ModuleBase {
  static name = "MyModule";
  static category = "2D";

  async init() {
    // Load images from workspace assets
    const imgUrl = nwWrldSdk.assetUrl("images/blueprint.png");

    // Load JSON data from workspace assets
    const data = await nwWrldSdk.loadJson("json/data.json");
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

These methods can be triggered via the sequencer or external MIDI/OSC, giving you instant control over positioning, visibility, transformations, and effects.

See the [Module Development Guide](MODULE_DEVELOPMENT.md#option-types-reference) for complete documentation of all built-in methods and their parameters.

---

## Two Modes: Sequencer vs External

Switch between modes in **Settings → Signal Source**.

**Sequencer Mode (Default)** - Program patterns with a 16-step grid per channel. Perfect for getting started, testing modules, and creating standalone pieces without external hardware. Adjustable BPM (60-130), patterns loop continuously and save with your tracks.

**External Mode (Advanced)** - Connect MIDI/OSC hardware for live performance. Map MIDI notes or OSC addresses to visual methods for real-time control from Ableton, hardware controllers, TouchOSC, etc. Configure global mappings in Settings for consistent control across all tracks.

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
│   │   │   ├── moduleBase.js   # Base class (the foundation)
│   │   │   └── threeBase.js    # Three.js base class
│   │   └── templates/
│   │       └── ThreeTemplate.js # 3D module template
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
│   └── renderer.js             # SDK initialization
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

| Issue                      | Solution                                                     |
| -------------------------- | ------------------------------------------------------------ |
| Project folder missing     | App will prompt to reselect - choose or create a new project |
| Module doesn't appear      | Check `export default`, verify `static name`, save file      |
| Module won't load          | Check console for syntax errors, verify SDK usage            |
| Module hidden              | Trigger `show()` method or set `executeOnLoad: true`         |
| Asset won't load           | Verify path is relative to `assets/` folder                  |
| Pattern not playing        | Check that methods are assigned to channels                  |
| No MIDI detected           | Enable IAC Driver/loopMIDI and verify DAW MIDI output        |
| Method not triggering      | Verify mapping, check method name match, check console       |
| Hot reload not working     | Check file is saved in project's `modules/` folder           |
| App won't start (dev mode) | Close other dev servers (port 9000), run `npm install`       |

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

### Automated Releases

The project uses GitHub Actions to automatically build and release DMGs:

1. Tag a new version: `git tag v1.0.0`
2. Push the tag: `git push origin v1.0.0`
3. GitHub Actions builds the DMG and creates a release automatically

See `.github/workflows/release-mac.yml` for the CI configuration.

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
- [Contributing Guide](CONTRIBUTING.md)

---

## Technologies

Electron, React, Three.js, p5.js, D3.js, WebMIDI

## Support

- [GitHub Issues](https://github.com/aagentah/nw_wrld/issues)
- [GitHub Discussions](https://github.com/aagentah/nw_wrld/discussions)
