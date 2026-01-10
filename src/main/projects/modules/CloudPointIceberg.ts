/*
@nwWrld name: CloudPointIceberg
@nwWrld category: 3D
@nwWrld imports: BaseThreeJsModule, THREE, Noise
*/

import { BaseThreeJsModule as BaseThreeJsModuleType } from "../../../projector/helpers/threeBase";
import * as THREE from 'three';

declare const Noise: any;

class CloudPointIceberg extends BaseThreeJsModuleType {
  // Module properties (extended)


  customGroup!: THREE.Group;
  particles!: THREE.Points | null;
  geometry!: THREE.BufferGeometry | null;
  material!: THREE.PointsMaterial | null;
  particleCount!: number;
  mesh!: THREE.Object3D | null;
  scene!: THREE.Scene;
  destroyed!: boolean;
  lastColorChoice!: number;
  name!: string;
  noise!: any;
  pointCloud!: any;
  wireMesh!: any;

  constructor(container) {
    super(container);
    if (!THREE || !Noise) return;

    this.name = CloudPointIceberg.name;

    this.customGroup = new THREE.Group();
    this.wireMesh = null;
    this.pointCloud = null;
    this.noise = new Noise(Math.random());
    this.lastColorChoice = -1;

    this.init();
  }

  init(): void {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;

    this.createIcebergShape();

    this.setModel(this.customGroup);

    this.render();
  }

  createIcebergShape(): void {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;

    const segments = 16;
    const baseSize = 3.5;
    const noiseSeed = Math.random() * 1000;
    this.noise.seed = noiseSeed;

    const vertexCount = (segments + 1) * (segments + 1);
    const vertices = new Float32Array(vertexCount * 3);
    const wireIndices = [];
    const pointPositions = [];
    const pointColors = [];

    const redShellDirection = new THREE.Vector3(
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    ).normalize();
    const redShellThreshold = 0.3;

    const cosCache = new Float32Array(segments + 1);
    const sinCache = new Float32Array(segments + 1);
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      cosCache[i] = Math.cos(theta);
      sinCache[i] = Math.sin(theta);
    }

    const getRadiusAtPoint = (cosTheta, sinTheta, phi, normalizedY) => {
      const baseRadius = baseSize * (0.7 + normalizedY * 0.6);

      const noise1 = this.noise.simplex3(
        cosTheta * 3 + noiseSeed,
        sinTheta * 3 + noiseSeed,
        normalizedY * 3 + noiseSeed
      );
      const noise2 = this.noise.simplex3(
        sinTheta * 4.2 + noiseSeed * 1.3,
        cosTheta * 4.2 + noiseSeed * 1.3,
        normalizedY * 4.2 + noiseSeed * 1.3
      );
      const noise3 = this.noise.simplex3(
        cosTheta * 1.8 + noiseSeed * 2.1,
        sinTheta * 1.8 + noiseSeed * 2.1,
        normalizedY * 1.8 + noiseSeed * 2.1
      );

      const combinedNoise = noise1 * 0.5 + noise2 * 0.3 + noise3 * 0.2;
      const irregularity = 0.5 + Math.abs(combinedNoise);

      const protrusionNoise = this.noise.simplex3(
        cosTheta * 2.5 + noiseSeed * 0.7,
        sinTheta * 2.5 + noiseSeed * 0.7,
        normalizedY * 2.5 + noiseSeed * 0.7
      );

      const elongationNoise = this.noise.simplex3(
        cosTheta * 1.5 + noiseSeed * 0.5,
        sinTheta * 1.5 + noiseSeed * 0.5,
        normalizedY * 1.5 + noiseSeed * 0.5
      );

      const carvedNoise = this.noise.simplex3(
        cosTheta * 3.5 + noiseSeed * 1.1,
        sinTheta * 3.5 + noiseSeed * 1.1,
        normalizedY * 3.5 + noiseSeed * 1.1
      );

      let protrusionStrength = 0;
      if (protrusionNoise > 0.4) {
        protrusionStrength = (protrusionNoise - 0.4) * 2.0;
      } else if (protrusionNoise < -0.4) {
        protrusionStrength = (protrusionNoise + 0.4) * 1.5;
      }

      let elongationFactor = 1.0;
      if (elongationNoise > 0.5) {
        elongationFactor = 1.0 + (elongationNoise - 0.5) * 1.8;
      } else if (elongationNoise < -0.5) {
        elongationFactor = 0.4 + (elongationNoise + 0.5) * 0.6;
      }

      let carvedFactor = 1.0;
      if (carvedNoise < -0.3) {
        carvedFactor = 0.3 + (carvedNoise + 0.3) * 0.7;
      }

      return (
        baseRadius *
        irregularity *
        (1 + protrusionStrength) *
        elongationFactor *
        carvedFactor
      );
    };

    let vertexIdx = 0;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const cosTheta = cosCache[i];
      const sinTheta = sinCache[i];

      for (let j = 0; j <= segments; j++) {
        const normalizedY = j / segments;
        const phi = Math.acos(1 - 2 * normalizedY);

        const radius = getRadiusAtPoint(cosTheta, sinTheta, phi, normalizedY);

        const sinPhi = Math.sin(phi);
        const x = radius * sinPhi * cosTheta;
        const z = radius * sinPhi * sinTheta;
        const y = (normalizedY - 0.5) * 7;

        const verticalVariation =
          this.noise.simplex2(
            theta * 2.5 + noiseSeed,
            normalizedY * 3.5 + noiseSeed
          ) * 0.3;
        const finalY = y + verticalVariation;

        vertices[vertexIdx++] = x;
        vertices[vertexIdx++] = finalY;
        vertices[vertexIdx++] = z;
      }
    }

    const segmentsPlus1 = segments + 1;
    for (let i = 0; i < segments; i++) {
      const iOffset = i * segmentsPlus1;
      const iNextOffset = (i + 1) * segmentsPlus1;

      for (let j = 0; j < segments; j++) {
        const a = iOffset + j;
        const b = a + 1;
        const c = iNextOffset + j;
        const d = c + 1;

        wireIndices.push(a, b, a, c);
        if (j < segments && i < segments) {
          wireIndices.push(b, d, c, d);
        }
      }
    }

    const wireGeometry = new THREE.BufferGeometry();
    wireGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(vertices, 3)
    );
    wireGeometry.setIndex(wireIndices);

    const wireMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
    });

    this.wireMesh = new THREE.LineSegments(wireGeometry, wireMaterial);
    this.customGroup.add(this.wireMesh);

    const pointCount = 10000;
    const redShellPointCount = Math.floor(pointCount * 0.3);
    const targetSurfaceThreshold = 0.92;
    const estimatedAttempts = Math.ceil(
      redShellPointCount /
        ((1 - targetSurfaceThreshold) * (1 - redShellThreshold) * 0.5)
    );
    const maxAttempts = Math.min(estimatedAttempts * 3, pointCount * 20);

    const tempVec = new THREE.Vector3();
    const tempDir = new THREE.Vector3();

    let redPointsGenerated = 0;
    let attempts = 0;

    while (redPointsGenerated < redShellPointCount && attempts < maxAttempts) {
      attempts++;

      const u = Math.random();
      const v = Math.random();
      const w = Math.random();

      const normalizedY = v;
      const theta = u * Math.PI * 2;
      const phi = Math.acos(1 - 2 * v);

      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      const radius = getRadiusAtPoint(cosTheta, sinTheta, phi, normalizedY);

      const sinPhi = Math.sin(phi);
      const x = radius * sinPhi * cosTheta;
      const z = radius * sinPhi * sinTheta;
      const y = (normalizedY - 0.5) * 7;

      const verticalVariation =
        this.noise.simplex2(
          theta * 2.5 + noiseSeed,
          normalizedY * 3.5 + noiseSeed
        ) * 0.3;
      const finalY = y + verticalVariation;

      tempVec.set(x, finalY, z);
      const length = tempVec.length();
      tempDir.set(x / length, finalY / length, z / length);
      const dotProduct = tempDir.dot(redShellDirection);

      const isRedShellRegion = dotProduct > redShellThreshold;
      const isSurfacePoint = w > targetSurfaceThreshold;

      if (isRedShellRegion && isSurfacePoint) {
        const shellOffset = 0.06;
        const shellX = x + tempDir.x * shellOffset;
        const shellY = finalY + tempDir.y * shellOffset;
        const shellZ = z + tempDir.z * shellOffset;

        pointPositions.push(shellX, shellY, shellZ);

        const redIntensity = 0.7 + Math.random() * 0.3;
        pointColors.push(
          0.8 + redIntensity * 0.2 + Math.random() * 0.2,
          0.2 + Math.random() * 0.15,
          0.2 + Math.random() * 0.15
        );

        redPointsGenerated++;
      }
    }

    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(pointPositions, 3)
    );
    pointGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(pointColors, 3)
    );

    const pointMaterial = new THREE.PointsMaterial({
      size: 0.03,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
    });

    this.pointCloud = new THREE.Points(pointGeometry, pointMaterial);
    this.customGroup.add(this.pointCloud);
  }

  randomizeColour(): void {
    if (!this.pointCloud || !this.pointCloud.geometry) return;

    const colors = this.pointCloud.geometry.attributes.color.array;
    const colorCount = colors.length / 3;

    let colorChoice;
    do {
      colorChoice = Math.floor(Math.random() * 3);
    } while (colorChoice === this.lastColorChoice);

    this.lastColorChoice = colorChoice;

    for (let i = 0; i < colorCount; i++) {
      const idx = i * 3;

      if (colorChoice === 0) {
        colors[idx] = 0.8 + Math.random() * 0.2;
        colors[idx + 1] = 0.1 + Math.random() * 0.15;
        colors[idx + 2] = 0.1 + Math.random() * 0.15;
      } else if (colorChoice === 1) {
        colors[idx] = 0.85 + Math.random() * 0.15;
        colors[idx + 1] = 0.75 + Math.random() * 0.25;
        colors[idx + 2] = 0.0 + Math.random() * 0.1;
      } else {
        colors[idx] = 0.6 + Math.random() * 0.2;
        colors[idx + 1] = 0.1 + Math.random() * 0.15;
        colors[idx + 2] = 0.7 + Math.random() * 0.3;
      }
    }

    this.pointCloud.geometry.attributes.color.needsUpdate = true;
  }

  destroy(): void {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;

    if (this.wireMesh) {
      if (this.wireMesh.geometry) this.wireMesh.geometry.dispose();
      if (this.wireMesh.material) this.wireMesh.material.dispose();
      this.customGroup.remove(this.wireMesh);
      this.wireMesh = null;
    }

    if (this.pointCloud) {
      if (this.pointCloud.geometry) this.pointCloud.geometry.dispose();
      if (this.pointCloud.material) this.pointCloud.material.dispose();
      this.customGroup.remove(this.pointCloud);
      this.pointCloud = null;
    }

    if (this.customGroup) {
      this.scene.remove(this.customGroup);
      this.customGroup = null;
    }

    super.destroy();
  }
}

export default CloudPointIceberg;
