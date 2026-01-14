# Getting Started with nw_wrld

This guide covers installation, setup, and basic usage of nw_wrld.

## Table of Contents

1. [Installation](#installation)
2. [Step 0: Choose Your Project Folder](#step-0-choose-your-project-folder)
3. [Step 1: Create a Track](#step-1-create-a-track)
4. [Step 2: Add a Visual Module](#step-2-add-a-visual-module)
5. [Step 3: Add Channels](#step-3-add-channels)
6. [Step 4: Program Your Pattern](#step-4-program-your-pattern)
7. [Step 5: Assign Methods to Channels](#step-5-assign-methods-to-channels)
8. [Step 6: Play Your Pattern](#step-6-play-your-pattern)
9. [Editing Modules](#editing-modules)
10. [Working with Assets](#working-with-assets)
11. [Advanced: Connect External MIDI/OSC](#advanced-connect-external-midiosc)
12. [Troubleshooting](#troubleshooting)
13. [Next Steps](#next-steps)

---

## Installation

### Developer Setup

**Requirements:** Node.js v20+ and basic terminal knowledge

```bash
# Clone the repository
git clone https://github.com/aagentah/nw_wrld.git
cd nw_wrld

# Install dependencies
npm install

# Start the app
npm start
```

Two windows will open:

- **Dashboard**: Control center for configuration and mapping
- **Projector**: Visual output window

---

**The rest of this guide assumes you're running from source.**

---

## Step 0: Choose Your Project Folder

When you first launch nw_wrld, you'll see a dialog:

**"Select a project folder"**

You have two options:

1. **Create a new folder** - For a fresh project
2. **Choose an existing folder** - To continue a previous project or use an empty folder

### What Happens Next

nw_wrld will initialize your project folder with:

- **16 starter modules** - Ready-to-use examples (Text, GridOverlay, SpinningCube, etc.)
- **Sample assets** - Images and JSON data files for experimentation
- **Data storage** - Configuration, tracks, and recordings

**Note:** Workspace modules are JavaScript code executed by nw_wrld. Only open project folders you trust.

Your project folder structure will look like this:

```
MyProject/
├── modules/           # Visual modules (16 starter modules included)
├── assets/            # Images and JSON data
│   ├── images/
│   └── json/
└── nw_wrld_data/      # App data (auto-managed)
```

### If Your Project Folder Goes Missing

If your project folder is deleted, moved, or disconnected (e.g., external drive unplugged), nw_wrld will detect the issue and prompt you to:

- **Reselect** the folder if you know where it moved
- **Choose a different project** to continue working

---

## Step 1: Create a Track

1. In the Dashboard, click **[CREATE TRACK]**
2. Name your track (e.g., "My First Track")
3. Click **[CREATE]**

Tracks are containers for visual modules and sequencer patterns.

---

## Step 2: Add a Visual Module

1. Click **[+ MODULE]**
2. Select a module from the dropdown (e.g., **Text**, **GridOverlay**, **Corners**)
3. Configure the module's initial properties if prompted

**What are modules?** Modules are visual elements displayed in the Projector window. Your project includes 16 starter modules covering 2D graphics, 3D visuals, text, and data visualization.

---

## Step 3: Add Channels

1. Click **[+ CHANNEL]** to add a channel to your track
2. Channels appear as rows with a 16-step sequencer grid
3. Add multiple channels to trigger different methods or create complex patterns

**What are channels?** Each channel controls one or more methods on your modules. Channels are your rhythmic triggers.

---

## Step 4: Program Your Pattern

1. Click cells in the sequencer grid to activate steps (cells turn red when active)
2. Each row is a channel, each column is a beat (16 beats total)
3. Create rhythmic patterns by activating different steps

**Tip:** Start simple - try activating steps 1, 5, 9, and 13 for a basic quarter-note rhythm.

---

## Step 5: Assign Methods to Channels

1. Click on a channel row to select it
2. Click **[ADD METHOD]** in the right panel
3. Select a method (e.g., `color`, `scale`, `rotate`, `show`)
4. Configure method parameters in the modal
5. Click **[SAVE]**

**What are methods?** Methods are actions you can trigger on modules. Built-in methods include `show`, `hide`, `scale`, `rotate`, `opacity`, and more. Each module can also define custom methods.

When the sequencer playhead hits an active cell, it triggers that channel's assigned methods.

---

## Step 6: Play Your Pattern

1. Click the **[PLAY]** button in the footer
2. Watch the playhead move across the 16-step grid
3. See your visuals respond to the pattern in the Projector window
4. Adjust BPM in Settings (60-130 BPM)

The pattern loops continuously until you click **[STOP]**.

**Congratulations!** You've created your first audiovisual composition with nw_wrld.

---

## Editing Modules

One of nw_wrld's most powerful features is that you can edit modules and see changes instantly.

### Finding Your Modules

1. Navigate to your project folder (the one you selected on first launch)
2. Open the `modules/` directory
3. You'll see all 16 starter modules as `.js` files

### Editing Modules

**Option 1: Use Your Favorite Text Editor**

1. Open any `.js` file in your preferred editor (VS Code, Sublime Text, Atom, etc.)
2. Make changes to the code
3. Save the file
4. nw_wrld automatically detects the change and reloads the module

**Option 2: Use the Built-in Editor (Optional)**

1. In Dashboard, go to Settings → Module Editor
2. Select a module to edit
3. Make changes in the Monaco editor
4. Save → hot reload applies automatically

### What You Can Change

- **Colors, sizes, positions** - Modify default values
- **Animations** - Add or change animation behavior
- **Methods** - Create new triggerable methods
- **Visual style** - Completely change how modules render

### Example: Changing Text Color

Open `modules/Text.js` in your project folder and find the color option:

```javascript
{
  name: "color",
  defaultVal: "#FFFFFF",  // Change this to "#00FF00" for green
  type: "color",
}
```

Save the file and the module reloads automatically.

### Learning from Examples

Study the 16 starter modules to learn different patterns:

- **HelloWorld.js** - Simplest possible module
- **Text.js** - DOM-based text rendering
- **GridOverlay.js** - Canvas drawing
- **SpinningCube.js** - Basic Three.js 3D
- **AsteroidGraph.js** - Loading workspace assets

See the [Module Development Guide](MODULE_DEVELOPMENT.md) for complete documentation.

---

## Working with Assets

Your project folder includes an `assets/` directory for images, JSON data, and other resources.

### Asset Folder Structure

```
MyProject/
└── assets/
    ├── images/
    │   └── blueprint.png    # Included starter image
    └── json/
        └── meteor.json       # Included starter dataset
```

### Adding Your Own Assets

1. Navigate to your project folder
2. Add files to `assets/images/` or `assets/json/`
3. Reference them in your modules using the SDK

### Loading Assets in Modules

Use docblock-declared imports to load project assets:

```javascript
/*
@nwWrld name: Asset Demo
@nwWrld category: 2D
@nwWrld imports: ModuleBase, assetUrl, loadJson
*/

class AssetDemo extends ModuleBase {
  async init() {
    const imageUrl = assetUrl("images/your-image.png");
    const data = await loadJson("json/your-data.json");
    // use imageUrl/data...
  }
}

export default AssetDemo;
```

### Example: Using the Image Module

The included **Image** module demonstrates asset loading:

1. Add a track and add the **Image** module
2. The module loads `images/blueprint.png` by default
3. Add your own images to `assets/images/`
4. Edit the `path` parameter to load your image

---

## Advanced: Connect External MIDI/OSC

Once you're comfortable with the sequencer, you can connect external hardware for live performance.

### Prerequisites

- A DAW that can send MIDI (Ableton Live, FL Studio, Logic Pro, etc.)
- MIDI routing software:
  - **Mac**: IAC Driver (built-in)
  - **Windows**: loopMIDI

### Setup MIDI Routing

**Mac:** Open Audio MIDI Setup → Show MIDI Studio → Enable IAC Driver

**Windows:** Download and install [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html)

**DAW:** Enable your virtual MIDI port for Track/Remote output in Preferences

### Switch to External Mode

1. Open Dashboard → **Settings**
2. **Signal Source** → Select **External (MIDI/OSC)**
3. Configure your MIDI device or OSC port
4. Go to **Settings → Configure Mappings** to customize trigger mappings (MIDI pitch classes / OSC addresses)
5. Your DAW now controls the visuals in real-time

### DAW Notes (Channel 1 Defaults + Best Practice)

Many DAWs send note events on **MIDI Channel 1** by default. nw_wrld lets you choose which MIDI channel controls track selection and which controls method/channel triggers:

- **Simplest setup (one channel)**:

  - Set both **Method Triggers MIDI Channel** and **Track Select MIDI Channel** to `1`.
  - Use **Settings → Configure Mappings** to choose which pitch classes (C..B) activate track selection vs method triggers.

- **Clean separation (two channels)**:
  - Route method trigger notes to Channel 1 and track selection notes to Channel 2 in your DAW.
  - Set **Method Triggers MIDI Channel** = `1` and **Track Select MIDI Channel** = `2` in nw_wrld.

---

## Sending MIDI from Strudel (Steps)

1. Install Strudel by following the instructions at [Strudel Codeberg](https://codeberg.org/uzu/strudel).
2. Ensure your MIDI routing is set up (per the instructions above), and confirm `nw_wrld` is configured by following the **Switch to External mode** instructions.
3. In Strudel, send notes to a specific MIDI port and channel by appending `.midi('port_name').midichan(<channel_number>)`. Make sure to use single brackets for the port_name.
4. Note that sending a pattern to MIDI will stop local (browser) sound for that pattern; to keep local audio and send MIDI with the same rhythm, reuse the same rhythmic pattern for two outputs (audio + MIDI). See code example below:
```js
// 1) Declare the rhythm once (notes + rests define the rhythm)
const r = "c4 ~ e4 g4 ~ e4 ~"   // short melody with rests

// 2) Local audio pattern (plays Strudel sound)
$: note(r).s("piano")

// 3) Use same pattern to send to nw_wrld through Midi port
$: note(r).midi('MIDI_port_name').midichan(1) // send to MIDI_port_name channel 1
```

## Troubleshooting

### Project Folder Issues

**"Project folder missing" message:**

- Your project folder was deleted, moved, or disconnected
- Click **Select Different Project** to choose or create a new project
- If you know where it moved, navigate to it and select it again

### Module Issues

**Module doesn't appear in dropdown:**

- Check that the file is saved in your project's `modules/` folder
- Verify the file has `export default ClassName` at the end
- Check the console for syntax errors
- Verify the file starts with a docblock that includes `@nwWrld name`, `@nwWrld category`, and `@nwWrld imports`

**Module appears but won't load:**

- Open Developer Console (Cmd+Option+I on Mac) in the Projector window
- Check for JavaScript errors
- Verify your `@nwWrld imports` includes everything you use (e.g. `ModuleBase`, `assetUrl`, `loadJson`, `THREE`, `p5`, `d3`)
- Check that all required methods are defined

**Changes not reloading:**

- Verify the file is saved
- Check that you're editing the file in your project's `modules/` folder (not the app's source)
- Close and reopen the file to ensure it saved

### Asset Issues

**Assets won't load:**

- Verify files are in your project's `assets/` folder
- Check that paths are relative: `images/file.png`, not `/images/file.png`
- Verify file names match exactly (case-sensitive)
- Check the console for errors

### Sequencer Issues

**Pattern not triggering visuals:**

- Verify methods are assigned to channels (click channel → Add Method)
- Check that cells are activated in the grid (should be red)
- Verify the module is visible (trigger `show` method or set `executeOnLoad: true`)
- Check the console for errors

**Module not visible after adding:**

- Add a channel and assign the `show` method
- Or edit the module to set `executeOnLoad: true` on a method that calls `this.show()`

### Development Mode Issues

**App won't start (development setup):**

- Close other dev servers using port 9000
- Run `npm install` again
- Check Node.js version: `node --version` (should be v20+)

### Linux/WSL Issues

**libasound.so cannot open shared object file (Windows 11 + WSL/Ubuntu):**

For more help, see [Troubleshooting](README.md#troubleshooting) in the README or check [GitHub Issues](https://github.com/aagentah/nw_wrld/issues).

---

## Next Steps

### Explore More Modules

Try these starter modules to see different visual styles:

- **GridDots** - Animated dot patterns
- **Frame** - Border overlays
- **CubeCube** - Nested 3D cubes
- **CodeColumns** - Matrix-style text
- **ZKProofVisualizer** - Complex data visualization

### Experiment with Method Parameters

1. Select a channel with an assigned method
2. Click **Edit Method** to change parameters
3. Try different colors, sizes, durations, and intensities
4. See how parameters affect the visuals

### Create Multi-Track Performances

1. Create multiple tracks with different modules
2. Program unique patterns for each track
3. Switch between tracks using the track selector
4. Build complex compositions layer by layer

### Learn to Code Modules

Read the [Module Development Guide](MODULE_DEVELOPMENT.md) to learn:

- Module structure and lifecycle
- Creating custom methods
- Loading project assets with `assetUrl`, `loadJson`, and `readText`
- Working with p5.js, Three.js, and D3.js
- Best practices and performance tips

### Try External MIDI/OSC Control

Once comfortable with the sequencer, connect external hardware for live performance control (see [Advanced: Connect External MIDI/OSC](#advanced-connect-external-midiosc) above).

---

## Further Reading

- [README](README.md) - Project overview and features
- [Module Development Guide](MODULE_DEVELOPMENT.md) - Complete module development documentation
- [Contributing Guide](CONTRIBUTING.md) - Contribute to the project
- [GitHub Discussions](https://github.com/aagentah/nw_wrld/discussions) - Community support and ideas
