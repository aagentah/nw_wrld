/**
 * Global type declarations for nw_wrld module sandbox runtime
 *
 * These declarations are available in user workspace modules (src/main/projects/modules/)
 * that run in the projector sandbox environment.
 */

import type p5 from "p5";
import * as THREE from "three";
import { Noise } from "noisejs";

// Base class types
import type { ModuleBase } from "../projector/helpers/moduleBase";
import type { BaseThreeJsModule } from "../projector/helpers/threeBase";

export {};

/**
 * SDK helpers available in sandbox modules
 */
interface NwWrldSdk {
  ModuleBase: typeof ModuleBase;
  BaseThreeJsModule: typeof BaseThreeJsModule;
  assetUrl: (relPath: string) => string | null;
  readText: (relPath: string) => Promise<string | null>;
  loadJson: <T = unknown>(relPath: string) => Promise<T | null>;
  listAssets: (relDir: string) => Promise<string[]>;
}

declare global {
  /**
   * SDK object providing utilities for workspace modules
   * Available via @nwWrld imports: ModuleBase, BaseThreeJsModule, assetUrl, readText, loadJson, listAssets
   */
  const nwWrldSdk: NwWrldSdk;

  /**
   * p5.js instance mode library
   * Available via @nwWrld imports: p5
   */
  const p5: typeof p5;

  /**
   * Three.js library
   * Available via @nwWrld imports: THREE
   */
  const THREE: typeof THREE;

  /**
   * D3.js library
   * Available via @nwWrld imports: d3
   */
  const d3: typeof import("d3");

  /**
   * Noise.js library
   * Available via @nwWrld imports: Noise
   */
  const Noise: typeof Noise;

  /**
   * Three.js OBJ loader
   * Available via @nwWrld imports: OBJLoader
   */
  const OBJLoader: typeof import("three/examples/jsm/loaders/OBJLoader").OBJLoader;

  /**
   * Three.js PLY loader
   * Available via @nwWrld imports: PLYLoader
   */
  const PLYLoader: typeof import("three/examples/jsm/loaders/PLYLoader").PLYLoader;

  /**
   * Three.js PCD loader
   * Available via @nwWrld imports: PCDLoader
   */
  const PCDLoader: typeof import("three/examples/jsm/loaders/PCDLoader").PCDLoader;

  /**
   * Three.js GLTF loader
   * Available via @nwWrld imports: GLTFLoader
   */
  const GLTFLoader: typeof import("three/examples/jsm/loaders/GLTFLoader").GLTFLoader;

  /**
   * Three.js STL loader
   * Available via @nwWrld imports: STLLoader
   */
  const STLLoader: typeof import("three/examples/jsm/loaders/STLLLoader").STLLoader;
}
