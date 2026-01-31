/*
@nwWrld name: CubeCube
@nwWrld category: 3D
@nwWrld imports: BaseThreeJsModule, THREE
*/

const sample = (arr) => {
  if (!arr || !Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
};

class CubeCube extends BaseThreeJsModule {
  static methods = [
    {
      name: "appendCube",
      executeOnLoad: false,
      options: [
        {
          name: "duration",
          defaultVal: 0,
          type: "number",
          unit: "ms",
          min: 0,
        },
      ],
    },
    {
      name: "resetCubes",
      executeOnLoad: false,
      options: [],
    },
  ];

  constructor(container) {
    super(container);

    this.name = CubeCube.name;
    this.cubeGroup = new THREE.Group();
    this.cubeSize = 1;
    this.cubeGrid = [];
    this.hexagons = [];
    this.init();
  }

  init() {
    if (this.destroyed) return;
    this.createCubeGrid();
    this.createQuadrants();
    this.createRing();
    this.createHexagons();
    this.setModel(this.cubeGroup);
    this.setCustomAnimate(this.animateLoop.bind(this));
  }

  createCubeGrid() {
    const offset = (8 * this.cubeSize) / 2;
    for (let x = 0; x < 8; x++) {
      for (let y = 0; y < 8; y++) {
        for (let z = 0; z < 8; z++) {
          const geometry = new THREE.BoxGeometry(
            this.cubeSize,
            this.cubeSize,
            this.cubeSize
          );

          const opacity = Math.random() > 0.8 ? 0.1 : 0;
          const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: opacity,
            wireframe: false,
          });
          const cube = new THREE.Mesh(geometry, material);
          cube.position.set(
            x * this.cubeSize - offset,
            y * this.cubeSize - offset,
            z * this.cubeSize - offset
          );

          this.cubeGroup.add(cube);
          this.cubeGrid.push(cube);
        }
      }
    }
  }

  createQuadrants() {
    const quadrantSize = 4 * this.cubeSize;
    const offset = (8 * this.cubeSize) / 2;
    const geometry = new THREE.BoxGeometry(
      quadrantSize,
      quadrantSize,
      quadrantSize
    );
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 });

    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 2; z++) {
          const line = new THREE.LineSegments(edges, lineMaterial);
          line.position.set(
            x * quadrantSize - offset + quadrantSize / 2,
            y * quadrantSize - offset + quadrantSize / 2,
            z * quadrantSize - offset + quadrantSize / 2
          );
          this.cubeGroup.add(line);
        }
      }
    }
  }

  createRing() {
    const ringGeometry = new THREE.RingGeometry(8, 8.05, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);

    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0, 0);

    const ring2 = new THREE.Mesh(ringGeometry, ringMaterial);

    ring2.rotation.x = Math.PI / 2;
    ring2.position.set(0.5, 0, 0);

    this.cubeGroup.add(ring);
    this.cubeGroup.add(ring2);
  }

  createHexagons() {
    const hexagonGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 6);
    const hexagonMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.5,
    });

    for (let i = 0; i < 10; i++) {
      const hexagon = new THREE.Mesh(hexagonGeometry, hexagonMaterial);

      const angle = Math.random() * 2 * Math.PI;
      const radius = 8;
      hexagon.userData = {
        angle: angle,
        speed: (Math.random() - 0.5) * 0.001,
      };
      hexagon.position.set(
        radius * Math.cos(angle),
        0,
        radius * Math.sin(angle)
      );

      hexagon.lookAt(0, 0, 0);

      this.cubeGroup.add(hexagon);
      this.hexagons.push(hexagon);
    }
  }

  animateLoop() {
    if (this.destroyed) return;
    this.cubeGroup.rotation.x += 0.001;
    this.cubeGroup.rotation.y += 0.001;

    this.hexagons.forEach((hexagon) => {
      hexagon.rotation.z += 0.05;

      hexagon.userData.angle += hexagon.userData.speed;
      const radius = 8;
      hexagon.position.set(
        radius * Math.cos(hexagon.userData.angle),
        0,
        radius * Math.sin(hexagon.userData.angle)
      );

      hexagon.lookAt(0, 0, 0);
    });

    this.cubeGrid.forEach((cube) => {
      if (cube.children.length > 0) {
        cube.children.forEach((particleGroup) => {
          particleGroup.children.forEach((particle) => {
            particle.position.x += (Math.random() - 0.5) * 0.05;
            particle.position.y += (Math.random() - 0.5) * 0.05;
            particle.position.z += (Math.random() - 0.5) * 0.05;
          });
        });
      }
    });
  }

  appendCube({ duration } = {}) {
    if (this.destroyed) return;

    const randomCube = sample(this.cubeGrid);
    if (randomCube) {
      randomCube.material.color.set(0xff0000);
      randomCube.material.opacity = 0.3;

      const particleGroup = new THREE.Group();
      const particleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const particleGeometry = new THREE.SphereGeometry(0.035, 8, 8);

      for (let i = 0; i < 50; i++) {
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        particle.position.set(
          (Math.random() - 0.5) * this.cubeSize,
          (Math.random() - 0.5) * this.cubeSize,
          (Math.random() - 0.5) * this.cubeSize
        );
        particleGroup.add(particle);
      }

      randomCube.add(particleGroup);

      if (duration > 0) {
        setTimeout(() => {
          randomCube.remove(particleGroup);
          particleGroup.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          });
        }, duration);
      }
    }
  }

  resetCubes() {
    if (this.destroyed) return;

    this.cubeGrid.forEach((cube) => {
      cube.material.color.set(0xffffff);
      cube.material.opacity = Math.random() > 0.8 ? 0.1 : 0;

      while (cube.children.length > 0) {
        const particleGroup = cube.children[0];
        cube.remove(particleGroup);
        particleGroup.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      }
    });
  }

  destroy() {
    if (this.destroyed) return;

    if (this.cubeGroup) {
      this.cubeGroup.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      this.scene.remove(this.cubeGroup);
      this.cubeGroup = null;
    }

    this.cubeGrid = [];
    this.hexagons = [];
    super.destroy();
  }
}

export default CubeCube;
