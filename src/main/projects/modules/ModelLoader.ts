/*
@nwWrld name: ModelLoader
@nwWrld category: 3D
@nwWrld imports: BaseThreeJsModule, THREE, assetUrl, OBJLoader, PLYLoader, PCDLoader, GLTFLoader, STLLoader
*/

import { BaseThreeJsModule as BaseThreeJsModuleType } from "../../../projector/helpers/threeBase";
import * as THREE from 'three';

// Runtime-injected globals from sandbox
declare const OBJLoader: any;
declare const PLYLoader: any;
declare const PCDLoader: any;
declare const GLTFLoader: any;
declare const STLLoader: any;
declare const assetUrl: (relPath: string) => string | null;


class ModelLoader extends BaseThreeJsModuleType {
  // Module properties (extended)



  customGroup!: THREE.Group;
  loadedObject!: THREE.Object3D | null;
  modelUrl!: string;
  isLoading!: boolean;
  mesh!: THREE.Object3D | null;
  scene!: THREE.Scene;
  destroyed!: boolean;
  lights!: any[];
  loadedModel!: any;
  name!: any;
  static methods = [
    {
      name: "loadModel",
      executeOnLoad: true,
      options: [
        {
          name: "modelPath",
          defaultVal: "models/cube.obj",
          type: "text",
        },
        {
          name: "scale",
          defaultVal: 1.0,
          type: "number",
        },
      ],
    },
    {
      name: "setColor",
      executeOnLoad: true,
      options: [
        {
          name: "color",
          defaultVal: "#ffffff",
          type: "color",
        },
      ],
    },
  ];

  constructor(container) {
    super(container);
    if (!THREE) return;
    this.name = ModelLoader.name;
    this.loadedModel = null;
    this.lights = [];
    this.init();
  }

  init(): void {
    if (this.destroyed) return;
    if (!THREE) return;

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    const key = new THREE.DirectionalLight(0xffffff, 1.25);
    key.position.set(2, 2, 4);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-3, -1, 2);

    this.scene.add(ambient);
    this.scene.add(key);
    this.scene.add(fill);
    this.lights.push(ambient, key, fill);
  }

  getExtension(modelPath: string): string | null {
    const p = String(modelPath || "").trim();
    const idx = p.lastIndexOf(".");
    if (idx < 0) return null;
    return p.slice(idx + 1).toLowerCase();
  }

  getLoader(ext: string | null): any {
    switch (ext) {
      case "obj":
        return new OBJLoader();
      case "ply":
        return new PLYLoader();
      case "pcd":
        return new PCDLoader();
      case "gltf":
      case "glb":
        return new GLTFLoader();
      case "stl":
        return new STLLoader();
      default:
        return null;
    }
  }

  clearLoadedModel(): void {
    if (!this.loadedModel) return;
    try {
      this.scene.remove(this.loadedModel);
    } catch {}
    try {
      this.disposeObject3D(this.loadedModel);
    } catch {}
    this.loadedModel = null;
  }

  disposeObject3D(object: any): void {
    if (!object) return;

    const disposeMaterial = (mat: any): void => {
      if (!mat) return;
      try {
        for (const k of Object.keys(mat)) {
          const v = mat[k];
          if (v && v.isTexture && typeof v.dispose === "function") v.dispose();
        }
      } catch {}
      try {
        if (typeof mat.dispose === "function") mat.dispose();
      } catch {}
    };

    object.traverse?.((child) => {
      try {
        if (child.geometry && typeof child.geometry.dispose === "function") {
          child.geometry.dispose();
        }
      } catch {}
      const m = child.material;
      if (Array.isArray(m)) m.forEach(disposeMaterial);
      else if (m) disposeMaterial(m);
    });
  }

  onModelLoaded(object3d: any, scale: number): void {
    if (!object3d) {
      console.error("[ModelLoader] Loader returned empty model.");
      return;
    }

    const s = Number(scale);
    const safeScale = Number.isFinite(s) ? Math.max(0.0001, s) : 1.0;

    this.loadedModel = object3d.scene || object3d;
    if (this.loadedModel && this.loadedModel.scale) {
      this.loadedModel.scale.setScalar(safeScale);
    }
    this.setModel(this.loadedModel);
  }

  loadModel({ modelPath = "models/cube.obj", scale = 1.0 }: { modelPath?: string; scale?: number } = {}): void {
    const safePath = String(modelPath || "").trim();
    const url = typeof assetUrl === "function" ? assetUrl(safePath) : null;
    if (!url) {
      console.error(`[ModelLoader] Invalid model path: ${safePath}`);
      return;
    }

    const ext = this.getExtension(safePath);
    const loader = this.getLoader(ext);
    if (!ext || !loader) {
      console.error(`[ModelLoader] Unsupported format: ${safePath}`);
      return;
    }

    this.clearLoadedModel();

    const onError = (error) => {
      console.error("[ModelLoader] Failed to load model:", error);
    };

    if (ext === "gltf" || ext === "glb") {
      loader.load(
        url,
        (gltf) => this.onModelLoaded(gltf, scale),
        undefined,
        onError
      );
      return;
    }

    if (ext === "stl") {
      loader.load(
        url,
        (geometry) => {
          if (geometry?.computeVertexNormals) geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({ color: 0xffffff });
          const mesh = new THREE.Mesh(geometry, material);
          this.onModelLoaded(mesh, scale);
        },
        undefined,
        onError
      );
      return;
    }

    if (ext === "ply") {
      loader.load(
        url,
        (geometry) => {
          if (!geometry) {
            onError(new Error("PLY_LOADER_RETURNED_EMPTY_GEOMETRY"));
            return;
          }

          const hasNormals = !!geometry.attributes?.normal;
          const hasIndex = !!geometry.index;
          const hasColors =
            typeof geometry.hasAttribute === "function" &&
            geometry.hasAttribute("color");

          if (!hasNormals && geometry.computeVertexNormals)
            geometry.computeVertexNormals();

          if (!hasIndex && !hasNormals) {
            const material = new THREE.PointsMaterial({
              size: 0.02,
              vertexColors: hasColors,
              color: 0xffffff,
            });
            const points = new THREE.Points(geometry, material);
            this.onModelLoaded(points, scale);
            return;
          }

          const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            vertexColors: hasColors,
          });
          const mesh = new THREE.Mesh(geometry, material);
          this.onModelLoaded(mesh, scale);
        },
        undefined,
        onError
      );
      return;
    }

    loader.load(
      url,
      (obj) => this.onModelLoaded(obj, scale),
      undefined,
      onError
    );
  }

  setColor({ color = "#ffffff" }: { color?: string } = {}): void {
    if (!this.loadedModel || !THREE) return;
    const c = new THREE.Color(color);

    this.loadedModel.traverse?.((child) => {
      if (!child || (!child.isMesh && !child.isPoints)) return;
      const m = child.material;
      const apply = (mat) => {
        if (!mat) return;
        if (mat.color) mat.color.set(c);
        if (typeof mat.vertexColors !== "undefined") mat.vertexColors = false;
        mat.needsUpdate = true;
      };
      if (Array.isArray(m)) m.forEach(apply);
      else apply(m);
    });
  }

  setWireframe({ enabled = false }: { enabled?: boolean } = {}): void {
    if (!this.loadedModel) return;
    const isOn = !!enabled;

    this.loadedModel.traverse?.((child) => {
      if (!child || !child.isMesh) return;
      const m = child.material;
      const apply = (mat) => {
        if (!mat || typeof mat.wireframe === "undefined") return;
        mat.wireframe = isOn;
        mat.needsUpdate = true;
      };
      if (Array.isArray(m)) m.forEach(apply);
      else apply(m);
    });
  }

  destroy(): void {
    if (this.destroyed) return;
    this.clearLoadedModel();
    this.lights = [];
    super.destroy();
  }
}

export default ModelLoader;
