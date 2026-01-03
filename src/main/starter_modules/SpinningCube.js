const { BaseThreeJsModule } = globalThis.nwWrldSdk || {};
const THREE = globalThis.THREE;

class SpinningCube extends BaseThreeJsModule {
  static name = "SpinningCube";
  static category = "3D";
  static methods = [
    ...((BaseThreeJsModule && BaseThreeJsModule.methods) || []),
  ];

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
    this.show();
  }

  destroy() {
    this.cube = null;
    super.destroy();
  }
}

export default SpinningCube;
