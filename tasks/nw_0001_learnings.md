# Claudio's NW_wrld onboarding notes (2026-03-28)

## Docs digested
- **README** → Platform overview, sequencer vs external signal pipeline, project folder model, starter modules list, dev/test/build scripts.
- **GETTING_STARTED** → Step-by-step workflow (pick project folder → tracks → modules → channels → patterns → methods → play), asset handling, external MIDI/OSC routing (single vs split channels), troubleshooting tips.
- **MODULE_DEVELOPMENT** → Workspace module contract (docblock metadata + default export), method schema/options, SDK surface (`ModuleBase`, `BaseThreeJsModule`, asset helpers), library usage patterns (p5, Three.js, D3), lifecycle + cleanup expectations, performance guidelines.
- **Starter modules** in `src/main/starter_modules/` reviewed for patterns across categories:
  - 2D/Text/UI: `HelloWorld`, `Text`, `CodeColumns`, `GridOverlay`, `GridDots`, `Corners`, `Frame`, `Image`, `ImageGallery`, `ScanLines`, `PerlinBlob`, `MathOrbitalMap`, `ZKProofVisualizer`.
  - 3D/Three: `SpinningCube`, `CubeCube`, `BasicGeometry`, `CloudPointIceberg`, `LowEarthPoint`, `OrbitalPlane`, `ModelLoader`, `AsteroidGraph` hybrid.
  - Utility/data-driven: JSON loaders (`AsteroidGraph`, `PerlinBlob`), asset browsers (`Image/ImageGallery`), point clouds (`CloudPointIceberg`).

## Key concepts captured
- Modules are hot-reloaded JS files residing in the project `modules/` directory and must declare `@nwWrld name/category/imports` docblocks.
- Built-in methods (show/hide/offset/scale/opacity/rotate/randomZoom/matrix/background/invert) inherited from `ModuleBase` keep modules interoperable.
- Channel methods defined via `static methods` control UI forms (text/number/color/select/assetFile/matrix/etc.); defaults + min/max + randomization enable expressive sequencing.
- Assets are sandboxed to `assets/` folder and accessed with `assetUrl`, `loadJson`, `readText`; fallback logic is recommended for resilience.
- Three.js modules extend `BaseThreeJsModule`, use `setModel` & `setCustomAnimate`, and must dispose geometries/materials in `destroy()`.
- p5.js modules instantiate via `new p5(sketch, this.elem)` and should call `remove()` in `destroy()` to prevent leaks.
- Performance best practices: batch DOM writes, use `requestAnimationFrame`, debounce resize handlers, reuse Three geometries/materials, instanced meshes for heavy scenes.
- External routing expects MIDI channel planning (method triggers + track select) and supports pitch-class or exact-note mapping; audio/file modes split into Low/Medium/High bands.

## Next actions
- Decide instrument + theme + inspiration for NW_0001 module.
- Sketch concept (shapes, colors, behavior), identify needed assets/data.
- Plan implementation (methods/options) before coding.
