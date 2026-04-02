# LumenSpiral Module Notes

- **Instrument focus:** Melodic plucks (nimble, eye-catching lead/arpeggio work)
- **Theme:** "Deep Space Bloom" – crystalline flora drifting through a dark nebula that flashes when struck.
- **Inspiration:**
  - NONOTAK's layered light installations for stacked translucent planes.
  - Bioluminescent jellyfish and hydrothermal fauna for glowing pulses + drifting spores.
  - Golden-ratio/Fibonacci spirals for organic placement of geometry.

## What it is
`LumenSpiral` extends `BaseThreeJsModule` and builds ~180 shallow hexagonal prisms arranged on a polar Fibonacci spiral. Each prism glows with a cyan/purple gradient while the whole structure slowly rotates and “breathes.” Triggering the `bloom` method spikes emissive intensity on a rotating subset of prisms and emits particle “spores” that drift outward, giving a bioluminescent afterglow. Palette and fog density are adjustable to let it coexist with other modules.

## How to use it (API overview)
| Method | Options | Description |
| --- | --- | --- |
| `bloom` | `intensity` (0.2–5), `duration` (ms) | Pulses a section of the spiral and emits particles. Map this to sequencer steps or pluck MIDI. |
| `paletteShift` | `palette` = `nebula` \| `aurora` \| `ember` | Changes the core gradient + accent colour. Suitable for scene changes. |
| `nebulaFog` | `density` (0–0.05) | Adjusts the exponential fog density so the module can blend/back off when layered. |
| `reset` | – | Clears all pulses/particles and returns to idle. |
| `BaseThreeJsModule` methods | (inherited) | Standard transform helpers (`show`, `hide`, `offset`, `matrix`, etc.). |

Modules live in `modules/` inside a project folder. Drop `LumenSpiral.js` in there (or update your starter set), add it to a track, assign channels:
1. Channel A → `bloom` mapped to your melodic pluck sequencer row.
2. Optional Channel B → `paletteShift` to swap colourways at section boundaries.
3. Optional Channel C → `nebulaFog` for long automation curves.

## Victories & lessons
- ✅ Instanced mesh keeps the geometry cheap even with 180 prisms.
- ✅ Particle shader uses additive blending so spores can layer nicely over other modules.
- ⚠️ Shader currently trivial; a texture-backed sprite sheet could add more organic variation.

## Did I have fun?
Absolutely—felt like designing a little zero‑g coral reef.

## Continuous improvements / future ideas
- Add optional JSON preset loader for spiral layouts (denser clusters, twin arms, etc.).
- Parameterize particle color decay (map to velocity for comet trails).
- Tie bloom target selection directly to MIDI note values so pitch selects which segment pulses.
- Future modules: complementary “Sunday” pad-focused watercolor fog field and a percussive “Friday” glitch wireframe that plays nicely with this module’s palette.
