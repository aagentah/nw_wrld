/*
@nwWrld name: LowEarthPoint
@nwWrld category: 3D
@nwWrld imports: BaseThreeJsModule, THREE
*/

import { BaseThreeJsModule as BaseThreeJsModuleType } from "../../../projector/helpers/threeBase";
import * as THREE from "three";

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface QuadraticBezierOptions {
  THREE: typeof import("three");
  points: Vector3[];
  count: number;
  color: number;
  opacity: number;
  midZScale?: number;
}

const sampleN = <T>(arr: T[], n: number): T[] => {
  if (!arr || arr.length === 0) return [];
  const copy = arr.slice();
  const out = [];
  const count = Math.max(0, Math.min(copy.length, n));
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return out;
};

const clearThreeGroup = (group: THREE.Group): void => {
  if (!group) return;
  group.children.forEach((child: THREE.Mesh) => {
    try {
      if ('geometry' in child && child.geometry) (child.geometry as THREE.BufferGeometry).dispose();
      if ('material' in child && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m: THREE.Material) => {
            if (m && typeof m.dispose === 'function') m.dispose();
          });
        } else if (child.material && typeof (child.material as THREE.Material).dispose === 'function') {
          (child.material as THREE.Material).dispose();
        }
      }
    } catch {}
  });
  group.clear();
};

const createQuadraticBezierLineSegments = ({
  THREE: THREEGlobal,
  points,
  count,
  color,
  opacity,
  midZScale = 1,
}: QuadraticBezierOptions): THREE.LineSegments | null => {
  const n = Math.max(0, Math.min(points?.length || 0, count || 0));
  if (n < 2) return null;

  const segmentsPerCurve = 5;
  const totalPairs = (n * (n - 1)) / 2;
  const totalSegments = totalPairs * segmentsPerCurve;
  const positions = new Float32Array(totalSegments * 6);

  let idx = 0;

  for (let i = 0; i < n; i++) {
    const start = points[i];
    const sx = start.x;
    const sy = start.y;
    const sz = start.z;

    for (let j = i + 1; j < n; j++) {
      const end = points[j];
      const ex = end.x;
      const ey = end.y;
      const ez = end.z;

      const mx = (sx + ex) / 2;
      const my = (sy + ey) / 2;
      const mz = ((sz + ez) / 2) * midZScale;

      let px = sx;
      let py = sy;
      let pz = sz;

      for (let s = 1; s <= segmentsPerCurve; s++) {
        const t = s / segmentsPerCurve;
        const it = 1 - t;
        const a = it * it;
        const b = 2 * it * t;
        const c = t * t;

        const cx = a * sx + b * mx + c * ex;
        const cy = a * sy + b * my + c * ey;
        const cz = a * sz + b * mz + c * ez;

        positions[idx++] = px;
        positions[idx++] = py;
        positions[idx++] = pz;
        positions[idx++] = cx;
        positions[idx++] = cy;
        positions[idx++] = cz;

        px = cx;
        py = cy;
        pz = cz;
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREEGlobal.BufferAttribute(positions, 3));
  const material = new THREEGlobal.LineBasicMaterial({
    color,
    linewidth: 1,
    opacity,
    transparent: true,
  });
  return new THREEGlobal.LineSegments(geometry, material);
};

class LowEarthPointModule extends BaseThreeJsModuleType {
  // Module properties


  name!: string;
  customGroup!: THREE.Group;
  customObjects: THREE.Object3D[] = [];
  points!: THREE.Vector3[];
  redPoints!: THREE.Vector3[];
  linesGroup!: THREE.Group;
  redLinesGroup!: THREE.Group;
  pointCloud!: THREE.Points | null;
  redPointCloud!: THREE.Points | null;
  destroyed!: boolean;
  scene!: THREE.Scene;


  static methods = [
    {
      name: "primary",
      executeOnLoad: false,
      options: [
        {
          name: "duration",
          defaultVal: 0,
          type: "number",
          description: "Duration for primary method animations",
        },
      ],
    },
  ];

  constructor(container) {
    super(container);
    if (!THREE) return; // THREE is now imported

    this.name = LowEarthPointModule.name;
    this.customGroup = new THREE.Group();
    this.customObjects = [];
    this.points = [];
    this.redPoints = [];
    this.linesGroup = new THREE.Group();
    this.redLinesGroup = new THREE.Group();
    this.customGroup.add(this.linesGroup);
    this.customGroup.add(this.redLinesGroup);
    this.pointCloud = null;
    this.redPointCloud = null;
    this.setCustomAnimate(this.animateLoop.bind(this));
    this.init();
  }

  init(): void {
    if (this.destroyed) return;
    this.createPoints();
    this.createRedPoints();
    this.createLines();
    this.createRedLines();
    this.setModel(this.customGroup);
  }

  createPoints(): void {
    if (this.destroyed) return;

    const geometry = new THREE.BufferGeometry();
    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.05,
    });
    const positions = [];

    const count = 500;
    for (let i = 0; i < count; i++) {
      const x = Math.random() * 10 - 5;
      const y = Math.random() * 10 - 5;
      const z = Math.random() * 10 - 5;
      positions.push(x, y, z);
      this.points.push(new THREE.Vector3(x, y, z));
    }

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );

    this.pointCloud = new THREE.Points(geometry, material);
    this.customGroup.add(this.pointCloud);
    this.customObjects.push(this.pointCloud);
  }

  createRedPoints(): void {
    if (this.destroyed) return;

    const redGeometry = new THREE.BufferGeometry();
    const redMaterial = new THREE.PointsMaterial({
      color: 0xff0000,
      size: 0.045,
    });
    const redPositions = [];

    const count = 250;
    for (let i = 0; i < count; i++) {
      const x = (Math.random() * 10 - 5) * 0.5;
      const y = (Math.random() * 10 - 5) * 0.5;
      const z = (Math.random() * 10 - 5) * 0.5;
      redPositions.push(x, y, z);
      this.redPoints.push(new THREE.Vector3(x, y, z));
    }

    redGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(redPositions, 3)
    );

    this.redPointCloud = new THREE.Points(redGeometry, redMaterial);
    this.customGroup.add(this.redPointCloud);
    this.customObjects.push(this.redPointCloud);
  }

  createLines(): void {
    if (this.destroyed) return;

    clearThreeGroup(this.linesGroup);
    const halfPointIndex = Math.floor(this.points.length / 3);
    const lineSegments = createQuadraticBezierLineSegments({
      THREE: THREE,
      points: this.points,
      count: halfPointIndex,
      color: 0xffffff,
      opacity: 0.1,
      midZScale: 1,
    });
    if (lineSegments) {
      this.linesGroup.add(lineSegments);
      this.customObjects.push(lineSegments);
    }
  }

  createRedLines(): void {
    if (this.destroyed) return;

    clearThreeGroup(this.redLinesGroup);
    const halfRedPointIndex = Math.floor(this.redPoints.length / 2);
    const redLineSegments = createQuadraticBezierLineSegments({
      THREE: THREE,
      points: this.redPoints,
      count: halfRedPointIndex,
      color: 0xff0000,
      opacity: 0.15,
      midZScale: 2,
    });
    if (redLineSegments) {
      this.redLinesGroup.add(redLineSegments);
      this.customObjects.push(redLineSegments);
    }
  }

  animateLoop(): void {
    if (this.destroyed) return;

    if (this.pointCloud) {
      this.pointCloud.rotation.x += 0.0005 * this.cameraSettings.cameraSpeed;
      this.pointCloud.rotation.y += 0.0005 * this.cameraSettings.cameraSpeed;
    }

    if (this.redPointCloud) {
      this.redPointCloud.rotation.x += 0.0003 * this.cameraSettings.cameraSpeed;
      this.redPointCloud.rotation.y += 0.0003 * this.cameraSettings.cameraSpeed;
    }

    this.linesGroup.rotation.x += 0.0003 * this.cameraSettings.cameraSpeed;
    this.linesGroup.rotation.y += 0.0003 * this.cameraSettings.cameraSpeed;

    this.redLinesGroup.rotation.x += 0.0003 * this.cameraSettings.cameraSpeed;
    this.redLinesGroup.rotation.y += 0.0003 * this.cameraSettings.cameraSpeed;
  }

  primary({ duration }: { duration?: number } = {}): void {
    if (this.destroyed) return;

    const seconds = Number(duration) || 0;
    const millis = seconds > 0 ? seconds * 1000 : 500;
    const selected = sampleN(this.points, 5);
    const spheres = [];

    selected.forEach((point: THREE.Vector3) => {
      const geometry = new THREE.SphereGeometry(0.09, 8, 8);
      const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(point);
      this.scene.add(mesh);
      spheres.push(mesh);
    });

    setTimeout(() => {
      spheres.forEach((mesh: THREE.Mesh) => {
        this?.scene?.remove(mesh);
        try {
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            const material = mesh.material as THREE.Material | THREE.Material[];
            if (Array.isArray(material)) {
              material.forEach((mat: THREE.Material) => mat.dispose());
            } else {
              material.dispose();
            }
          }
        } catch {}
      });
    }, millis);
  }

  destroy(): void {
    if (this.destroyed) return;

    this.customObjects.forEach((obj: THREE.Object3D) => {
      if ('geometry' in obj && obj.geometry) (obj.geometry as THREE.BufferGeometry).dispose();
      if ('material' in obj && obj.material) {
        const material = obj.material as THREE.Material | THREE.Material[];
        if (Array.isArray(material)) {
          material.forEach((mat: THREE.Material) => {
            if (mat && typeof mat.dispose === 'function') mat.dispose();
          });
        } else if (material && typeof material.dispose === 'function') {
          material.dispose();
        }
      }
      this.scene.remove(obj);
    });
    this.customObjects = [];
    this.linesGroup.clear();
    this.redLinesGroup.clear();
    super.destroy();
  }
}

export default LowEarthPointModule;
