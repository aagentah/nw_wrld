/*
@nwWrld name: SpinningCube
@nwWrld category: 3D
@nwWrld imports: BaseThreeJsModule, THREE
*/

import { BaseThreeJsModule as BaseThreeJsModuleType } from "../../../projector/helpers/threeBase";
import * as THREE from 'three';


class SpinningCube extends BaseThreeJsModuleType {
  // Module properties (extended)

  customGroup!: THREE.Group;
  mesh!: THREE.Mesh | null;
  rotationSpeed!: number;
  scene!: THREE.Scene;
  destroyed!: boolean;
  cube!: THREE.Mesh;
  
  static methods = [];

  constructor(container) {
    super(container);
    if (!THREE) return;
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff99 });
    this.cube = new THREE.Mesh(geometry, material);
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(2, 2, 4);
    this.scene.add(light);
    this.setModel(this.cube);
    this.setCustomAnimate(() => {
      if (!this.cube) return;
      this.cube.rotation.x += 0.01;
      this.cube.rotation.y += 0.015;
    });
  }

  destroy(): void {
    this.cube = null;
    super.destroy();
  }
}

export default SpinningCube;
