import * as THREE from "three";
import { BaseThreeJsModule } from "../helpers/threeBase.js";
import type { ModuleBaseOptions } from "../helpers/moduleBase.js";

export class ThreeTemplate extends BaseThreeJsModule {
  static readonly moduleName = "ThreeTemplate";
  static readonly category = "primary";

  customGroup: THREE.Group;
  customObjects: THREE.Mesh[];

  constructor(container: HTMLElement | null) {
    super(container);

    this.name = ThreeTemplate.moduleName;
    this.customGroup = new THREE.Group();
    this.customObjects = [];
    this.primary = this.primary.bind(this);
    this.init();
  }

  init(): void {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;
    this.createCustomObjects();
    this.setModel(this.customGroup);
  }

  createCustomObjects(): void {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);

    this.customGroup.add(cube);
    this.customObjects.push(cube);

    const sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

    sphere.position.set(2, 0, 0);
    this.customGroup.add(sphere);
    this.customObjects.push(sphere);
  }

  animateLoop(): void {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;

    this.customObjects.forEach((obj) => {
      obj.rotation.x += 0.01;
      obj.rotation.y += 0.01;
    });
  }

  primary({ duration = 0 }: ModuleBaseOptions = {}): void {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;

    const targetColor = new THREE.Color(
      Math.random(),
      Math.random(),
      Math.random()
    );

    this.customObjects.forEach((obj) => {
      if (duration > 0) {
        const initialColor = (obj.material as THREE.MeshBasicMaterial).color.clone();
        const startTime = performance.now();

        const animate = () => {
          const currentTime = performance.now();
          const elapsed = (currentTime - startTime) / 1000;
          const t = Math.min(elapsed / duration, 1);

          (obj.material as THREE.MeshBasicMaterial).color.copy(initialColor).lerp(targetColor, t);
          (obj.material as THREE.MeshBasicMaterial).needsUpdate = true;

          if (t < 1) {
            requestAnimationFrame(animate);
          }
        };

        animate();
      } else {
        (obj.material as THREE.MeshBasicMaterial).color.copy(targetColor);
        (obj.material as THREE.MeshBasicMaterial).needsUpdate = true;
      }
    });

    this.render();
  }

  destroy(): void {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;

    this.customObjects.forEach((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((mat) => mat.dispose());
        } else {
          obj.material.dispose();
        }
      }
      this.customGroup.remove(obj);
    });
    this.customObjects = [];

    if (this.customGroup) {
      this.scene?.remove(this.customGroup);
      this.customGroup = null as any;
    }

    super.destroy();
  }
}

export default ThreeTemplate;
