/*
@nwWrld name: LumenSpiral
@nwWrld category: 3D
@nwWrld imports: BaseThreeJsModule, THREE
*/

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const paletteDefs = {
  nebula: { base: '#0b1028', core: '#2fb1ff', accent: '#f3a74f' },
  aurora: { base: '#050d1a', core: '#4de3c7', accent: '#ff64bd' },
  ember: { base: '#120903', core: '#ff7936', accent: '#ffe29a' },
};

const DEFAULT_PALETTE = 'nebula';

const randomBetween = (min, max) => min + Math.random() * (max - min);

class LumenSpiral extends BaseThreeJsModule {
  static methods = [
    ...BaseThreeJsModule.methods,
    {
      name: "bloom",
      executeOnLoad: false,
      options: [
        {
          name: "intensity",
          defaultVal: 1.25,
          type: "number",
          min: 0.2,
          max: 5,
          allowRandomization: true,
        },
        {
          name: "duration",
          defaultVal: 650,
          type: "number",
          unit: "ms",
          min: 120,
          max: 5000,
        },
      ],
    },
    {
      name: "paletteShift",
      executeOnLoad: true,
      options: [
        {
          name: "palette",
          defaultVal: DEFAULT_PALETTE,
          type: "select",
          values: Object.keys(paletteDefs),
        },
      ],
    },
    {
      name: "nebulaFog",
      executeOnLoad: true,
      options: [
        {
          name: "density",
          defaultVal: 0.008,
          type: "number",
          min: 0,
          max: 0.05,
        },
      ],
    },
    {
      name: "reset",
      executeOnLoad: false,
      options: [],
    },
  ];

  constructor(container) {
    super(container);
    if (!THREE) return;

    this.moduleGroup = new THREE.Group();
    this.instanceCount = 180;
    this.hexMesh = null;
    this.pulseStates = new Array(this.instanceCount).fill(null);
    this.lastPulseIndex = 0;
    this.currentPaletteKey = DEFAULT_PALETTE;

    this.particleCount = 280;
    this.particleGeometry = null;
    this.particleMaterial = null;
    this.particleSystem = null;
    this.particleData = [];

    this.animateLoop = this.animateLoop.bind(this);
    this.setCustomAnimate(this.animateLoop);

    this.init();
  }

  init() {
    if (!this.scene || !this.camera || !this.renderer) return;

    this.scene.background = new THREE.Color("#03040b");
    this.scene.fog = new THREE.FogExp2("#05060f", 0.008);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x040404, 0.6);
    this.moduleGroup.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(4, 6, 8);
    this.moduleGroup.add(dir);

    this.camera.position.set(0, 7, 24);

    this.createSpiral();
    this.createParticleSystem();

    this.setModel(this.moduleGroup);
  }

  createSpiral() {
    const radiusStart = 0.8;
    const radiusStep = 0.14;
    const heightStep = 0.06;

    const geometry = new THREE.CylinderGeometry(0.35, 0.35, 1.5, 6, 1);
    const material = new THREE.MeshStandardMaterial({
      color: paletteDefs[this.currentPaletteKey].core,
      roughness: 0.45,
      metalness: 0.3,
      transparent: true,
      opacity: 0.92,
      emissive: "#000000",
      emissiveIntensity: 1.0,
    });

    this.hexMesh = new THREE.InstancedMesh(geometry, material, this.instanceCount);
    this.hexMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.hexMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(this.instanceCount * 3),
      3
    );
    this.moduleGroup.add(this.hexMesh);

    const dummy = new THREE.Object3D();
    for (let i = 0; i < this.instanceCount; i++) {
      const radius = radiusStart + i * radiusStep;
      const angle = i * GOLDEN_ANGLE;
      const y = (i - this.instanceCount / 2) * heightStep;
      const x = radius * Math.cos(angle);
      const z = radius * Math.sin(angle);

      dummy.position.set(x, y, z);
      dummy.rotation.y = angle;
      const scaleFactor = 0.9 + Math.sin(i * 0.32) * 0.25;
      dummy.scale.set(scaleFactor, 0.6 + Math.sin(i * 0.17) * 0.2, scaleFactor);
      dummy.updateMatrix();
      this.hexMesh.setMatrixAt(i, dummy.matrix);
    }

    this.applyPaletteColors();
  }

  createParticleSystem() {
    this.particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);
    const sizes = new Float32Array(this.particleCount);
    this.particleData = [];

    for (let i = 0; i < this.particleCount; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -999;
      positions[i * 3 + 2] = 0;
      const clr = paletteDefs[this.currentPaletteKey].core.clone();
      colors[i * 3] = clr.r;
      colors[i * 3 + 1] = clr.g;
      colors[i * 3 + 2] = clr.b;
      sizes[i] = 0;
      this.particleData.push({ life: 0, maxLife: 0, velocity: new THREE.Vector3() });
    }

    this.particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    this.particleGeometry.setAttribute("customColor", new THREE.BufferAttribute(colors, 3));
    this.particleGeometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const vertexShader = `
      attribute float size;
      attribute vec3 customColor;
      varying vec3 vColor;
      void main() {
        vColor = customColor;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;
    const fragmentShader = `
      varying vec3 vColor;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, dist);
        gl_FragColor = vec4(vColor, alpha);
      }
    `;

    this.particleMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.particleSystem = new THREE.Points(this.particleGeometry, this.particleMaterial);
    this.moduleGroup.add(this.particleSystem);
  }

  applyPaletteColors() {
    if (!this.hexMesh) return;
    const palette = paletteDefs[this.currentPaletteKey] || paletteDefs[DEFAULT_PALETTE];
    const baseColor = new THREE.Color(palette.base);
    const coreColor = new THREE.Color(palette.core);
    const color = new THREE.Color();

    for (let i = 0; i < this.instanceCount; i++) {
      const t = i / this.instanceCount;
      color.copy(baseColor).lerp(coreColor, t * 0.8 + 0.1);
      this.hexMesh.setColorAt(i, color);
    }
    this.hexMesh.instanceColor.needsUpdate = true;
  }

  animateLoop(delta) {
    const time = performance.now() * 0.001;
    if (this.hexMesh) {
      this.hexMesh.rotation.y += 0.005;
      const scale = 1 + Math.sin(time * 0.35) * 0.03;
      this.hexMesh.scale.set(scale, 1, scale);
    }

    this.updatePulses(delta);
    this.updateParticles(delta);
  }

  updatePulses(delta) {
    if (!this.hexMesh) return;
    const palette = paletteDefs[this.currentPaletteKey] || paletteDefs[DEFAULT_PALETTE];
    const accentColor = new THREE.Color(palette.accent);
    const baseColor = new THREE.Color(palette.base);
    const coreColor = new THREE.Color(palette.core);
    const color = new THREE.Color();

    for (let i = 0; i < this.instanceCount; i++) {
      const state = this.pulseStates[i];
      if (!state) continue;
      state.elapsed += delta;
      const progress = state.elapsed / state.duration;
      if (progress >= 1) {
        this.pulseStates[i] = null;
        color.copy(baseColor).lerp(coreColor, i / this.instanceCount);
        this.hexMesh.setColorAt(i, color);
        continue;
      }
      const strength = state.intensity * Math.exp(-3 * progress);
      color.copy(accentColor).multiplyScalar(strength).addScalar(0.05);
      this.hexMesh.setColorAt(i, color);
    }

    this.hexMesh.instanceColor.needsUpdate = true;
  }

  updateParticles(delta) {
    if (!this.particleSystem) return;
    const positions = this.particleGeometry.attributes.position.array;
    const sizes = this.particleGeometry.attributes.size.array;
    const palette = paletteDefs[this.currentPaletteKey] || paletteDefs[DEFAULT_PALETTE];
    const paletteColor = new THREE.Color(palette.core);

    for (let i = 0; i < this.particleCount; i++) {
      const data = this.particleData[i];
      if (data.life <= 0) {
        sizes[i] = 0;
        continue;
      }
      data.life -= delta * 1000;
      if (data.life <= 0) {
        sizes[i] = 0;
        continue;
      }
      const idx = i * 3;
      positions[idx] += data.velocity.x * delta;
      positions[idx + 1] += data.velocity.y * delta;
      positions[idx + 2] += data.velocity.z * delta;
      data.velocity.multiplyScalar(0.985);
      sizes[i] = Math.max(0, sizes[i] - delta * 25);
    }

    this.particleGeometry.attributes.position.needsUpdate = true;
    this.particleGeometry.attributes.size.needsUpdate = true;
    const colors = this.particleGeometry.attributes.customColor.array;
    for (let i = 0; i < this.particleCount; i++) {
      colors[i * 3] = paletteColor.r;
      colors[i * 3 + 1] = paletteColor.g;
      colors[i * 3 + 2] = paletteColor.b;
    }
    this.particleGeometry.attributes.customColor.needsUpdate = true;
  }

  paletteShift({ palette = DEFAULT_PALETTE } = {}) {
    if (!paletteDefs[palette]) return;
    this.currentPaletteKey = palette;
    this.applyPaletteColors();
  }

  nebulaFog({ density = 0.008 } = {}) {
    if (!this.scene?.fog) return;
    this.scene.fog.density = Math.max(0, Math.min(0.05, Number(density) || 0));
  }

  bloom({ intensity = 1.25, duration = 650 } = {}) {
    if (!this.hexMesh) return;
    const index = this.lastPulseIndex % this.instanceCount;
    this.lastPulseIndex += 11; // hop to keep motion interesting
    this.pulseStates[index] = {
      intensity: Math.max(0.1, intensity),
      duration: Math.max(50, duration),
      elapsed: 0,
    };
    this.emitSpores(index, intensity);
  }

  emitSpores(instanceIndex, intensity) {
    if (!this.particleSystem || !this.hexMesh) return;
    const positions = this.hexMesh.instanceMatrix.array;
    const dummy = new THREE.Object3D();
    dummy.matrix.fromArray(positions, instanceIndex * 16);
    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

    const palette = paletteDefs[this.currentPaletteKey] || paletteDefs[DEFAULT_PALETTE];
    const accentColor = new THREE.Color(palette.accent);

    for (let emitted = 0; emitted < 12; emitted++) {
      const slot = this.findInactiveParticle();
      if (slot === -1) break;
      const idx = slot * 3;
      const posAttr = this.particleGeometry.attributes.position.array;
      posAttr[idx] = dummy.position.x;
      posAttr[idx + 1] = dummy.position.y;
      posAttr[idx + 2] = dummy.position.z;

      const vel = new THREE.Vector3(
        randomBetween(-0.4, 0.4),
        randomBetween(0.2, 0.8),
        randomBetween(-0.4, 0.4)
      ).multiplyScalar(intensity * 0.6);
      this.particleData[slot] = {
        life: 800 + Math.random() * 900,
        maxLife: 800 + Math.random() * 900,
        velocity: vel,
      };

      const sizes = this.particleGeometry.attributes.size.array;
      sizes[slot] = 8 + Math.random() * 12;

      const colors = this.particleGeometry.attributes.customColor.array;
      colors[idx] = accentColor.r;
      colors[idx + 1] = accentColor.g;
      colors[idx + 2] = accentColor.b;
    }

    this.particleGeometry.attributes.position.needsUpdate = true;
    this.particleGeometry.attributes.size.needsUpdate = true;
    this.particleGeometry.attributes.customColor.needsUpdate = true;
  }

  findInactiveParticle() {
    for (let i = 0; i < this.particleCount; i++) {
      if (this.particleData[i].life <= 0) return i;
    }
    return -1;
  }

  reset() {
    this.pulseStates = new Array(this.instanceCount).fill(null);
    this.applyPaletteColors();
    if (this.particleData.length) {
      this.particleData.forEach((p) => (p.life = 0));
      const sizes = this.particleGeometry.attributes.size.array;
      sizes.fill(0);
      this.particleGeometry.attributes.size.needsUpdate = true;
    }
  }

  destroy() {
    if (this.hexMesh) {
      this.moduleGroup?.remove(this.hexMesh);
      this.hexMesh.geometry.dispose();
      this.hexMesh.material.dispose();
      this.hexMesh = null;
    }

    if (this.particleSystem) {
      this.moduleGroup?.remove(this.particleSystem);
      this.particleGeometry?.dispose();
      this.particleMaterial?.dispose();
      this.particleSystem = null;
      this.particleGeometry = null;
      this.particleMaterial = null;
    }

    if (this.moduleGroup) {
      this.moduleGroup.clear();
      this.moduleGroup = null;
    }

    super.destroy();
  }
}

export default LumenSpiral;
