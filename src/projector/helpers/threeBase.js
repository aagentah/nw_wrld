// src/helpers/threeBase.js

/**
 * Important info: The `BaseThreeJsModule` class extends from `ModuleBase`.
 *
 * - `ModuleBase` provides essential lifecycle management for containers (HTML elements).
 *   It handles the initialization of the container, sets up transformation states (like position, scale, and opacity),
 *   and applies the necessary styles to prepare the element for manipulation.
 *
 * - In the constructor, it stores the reference to the container (`this.elem`) and initializes core properties such as
 *   `currentX`, `currentY`, `currentScale`, and `currentOpacity`. It also ensures that the element is hidden and has
 *   the correct opacity and transformation applied from the start. If an overlay image is required, this can be added
 *   later through the overlay method.
 *
 * - The `destroy` method ensures proper cleanup of the element by removing it from the DOM and any associated overlays.
 *   It also clears any references to the DOM element (`this.elem`), avoiding memory leaks and ensuring that the module
 *   is completely destroyed when no longer needed.
 */

import ModuleBase from "./moduleBase"; // Ensure correct casing
import * as THREE from "three"; // "three": "^0.159.0"
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { animationManager } from "./animationManager";

export class BaseThreeJsModule extends ModuleBase {
  static methods = [
    ...ModuleBase.methods,
    {
      name: "zoomLevel",
      executeOnLoad: true,
      options: [
        {
          name: "zoomLevel",
          defaultVal: 75,
          type: "number",
          allowRandomization: true,
        },
      ],
    },
    {
      name: "viewDirection",
      executeOnLoad: true,
      options: [
        {
          name: "viewDirection",
          defaultVal: "front",
          type: "select",
          values: ["front", "top", "right", "back", "bottom", "left"],
        },
      ],
    },
    {
      name: "cameraAnimation",
      executeOnLoad: false,
      options: [
        {
          name: "cameraAnimation",
          defaultVal: "none",
          type: "select",
          values: [
            "none",
            "pan-forward",
            "pan-backward",
            "pan-left",
            "pan-right",
            "pan-up",
            "pan-down",
            "rotate-left",
            "rotate-right",
            "rotate-up",
            "rotate-down",
            "rotate-clockwise",
            "rotate-anticlockwise",
            "rotate-random",
          ],
        },
      ],
    },
    {
      name: "cameraSpeed",
      executeOnLoad: true,
      options: [
        {
          name: "cameraSpeed",
          defaultVal: 1.0,
          type: "number",
          min: 0.01,
          max: 10,
        },
      ],
    },
  ];

  constructor(container) {
    super(container);

    // Bind methods early to ensure 'this' context is correct
    this.render = this.render.bind(this);
    this.animate = this.animate.bind(this);
    this.onWindowResize = this.onWindowResize.bind(this);

    // Initialize Three.js scene
    this.scene = new THREE.Scene();

    // Initialize Camera Settings
    this.cameraSettings = {
      zoomLevel: 50,
      viewDirection: "front",
      cameraAnimation: null,
      cameraSpeed: 1.0,
    };

    // Initialize Animation State
    this.currentAnimation = null;
    this.animationSpeed = this.cameraSettings.cameraSpeed;
    this.animationDirection = 1;

    // Set up renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(this.elem.offsetWidth, this.elem.offsetHeight);
    this.elem.appendChild(this.renderer.domElement);

    // Initialize Camera
    this.camera = new THREE.PerspectiveCamera(
      80,
      this.elem.offsetWidth / this.elem.offsetHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 10);
    this.scene.add(this.camera);

    // Initialize Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enablePan = true;
    this.controls.enableRotate = true;
    this.controls.enableZoom = true;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 2.0;

    // Add event listener for controls
    this.controls.addEventListener("change", this.render);

    // Bind resize event
    window.addEventListener("resize", this.onWindowResize);

    // Initialize flag for animation loop
    this.isInitialized = false;

    // Placeholder for custom animation
    this.customAnimate = null;

    this.randomRotateDirection = new THREE.Vector2(1, 1); // Default directions
  }

  /**
   * Sets up the model within the scene and configures the camera accordingly.
   * @param {THREE.Object3D} model - The 3D model to add to the scene.
   */
  setModel(model) {
    if (!model) {
      console.warn("No model provided to setModel.");
      return;
    }

    // Add the model to the scene
    this.scene.add(model);

    // Compute bounding box, center, and size
    this.modelBoundingBox = new THREE.Box3().setFromObject(model);
    this.modelCenter = this.modelBoundingBox.getCenter(new THREE.Vector3());
    const size = this.modelBoundingBox.getSize(new THREE.Vector3());
    this.modelSize = Math.max(size.x, size.y, size.z);

    // Configure camera based on the model
    this.configureCamera();

    // Update controls to look at the center
    this.controls.target.copy(this.modelCenter);
    this.controls.minDistance = this.modelSize * 0.001;
    this.controls.maxDistance = this.modelSize * 2.5;
    this.controls.update();

    // Start the animation loop if not already started
    if (!this.isInitialized) {
      this.isInitialized = true;
      animationManager.subscribe(this.animate);
    }

    this.render();
  }

  /**
   * Configures the camera's position and projection based on the model's size and center.
   */
  configureCamera() {
    if (!this.modelBoundingBox) {
      console.warn("Model bounding box not set. Call setModel first.");
      return;
    }

    // Use zoom level and view direction to position the camera
    this.updateCameraViewDirection(this.cameraSettings.viewDirection);
    this.updateCameraZoom(this.cameraSettings.zoomLevel);

    // Adjust camera's near and far planes based on model size
    this.camera.near = Math.max(0.1, this.modelSize / 1000);
    this.camera.far = this.modelSize * 20;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Renders the current state of the scene.
   */
  render() {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * The main animation loop.
   * Note: RAF scheduling is handled by AnimationManager, not directly here.
   */
  animate() {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;

    // Update camera animation if any
    this.updateCameraAnimation();

    // Update controls (for damping and autoRotate)
    this.controls.update();

    // Execute custom animation if set
    if (this.customAnimate) {
      this.customAnimate();
    }

    // TWEEN.update() now handled by AnimationManager

    this.render();
  }

  /**
   * Handles window resize events.
   */
  onWindowResize() {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;

    this.camera.aspect = this.elem.offsetWidth / this.elem.offsetHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.elem.offsetWidth, this.elem.offsetHeight);

    this.render();
  }

  /**
   * Allows derived classes to inject custom animation logic.
   * @param {Function} callback - The custom animation function.
   */
  setCustomAnimate(callback) {
    this.customAnimate = callback;
  }

  /**
   * Updates the camera animation based on current settings.
   */
  updateCameraAnimation() {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;

    if (!this.currentAnimation) return;

    // Define separate delta multipliers for panning and rotating
    const panDeltaMultiplier = 0.35; // Adjust as needed for panning speed
    const rotateDeltaMultiplier = 0.0005; // Adjust as needed for rotation speed
    const rollDeltaMultiplier = 0.0005; // Adjust as needed for roll speed

    switch (this.currentAnimation) {
      case "pan-forward":
        this.panCameraForward(this.animationSpeed * panDeltaMultiplier);
        break;
      case "pan-backward":
        this.panCameraForward(-this.animationSpeed * panDeltaMultiplier);
        break;
      case "pan-right":
        this.panCameraLeft(-this.animationSpeed * panDeltaMultiplier);
        break;
      case "pan-left":
        this.panCameraLeft(this.animationSpeed * panDeltaMultiplier);
        break;
      case "pan-up":
        this.panCameraUp(this.animationSpeed * panDeltaMultiplier);
        break;
      case "pan-down":
        this.panCameraUp(-this.animationSpeed * panDeltaMultiplier);
        break;
      case "rotate-left":
        this.orbitCamera(this.animationSpeed * rotateDeltaMultiplier, 0);
        break;
      case "rotate-right":
        this.orbitCamera(-this.animationSpeed * rotateDeltaMultiplier, 0);
        break;
      case "rotate-up":
        this.orbitCamera(0, this.animationSpeed * rotateDeltaMultiplier);
        break;
      case "rotate-down":
        this.orbitCamera(0, -this.animationSpeed * rotateDeltaMultiplier);
        break;
      case "rotate-clockwise":
        this.rollCamera(this.animationSpeed * rollDeltaMultiplier);
        break;
      case "rotate-anticlockwise":
        this.rollCamera(-this.animationSpeed * rollDeltaMultiplier);
        break;
      case "rotate-random":
        // Apply rotation based on random directions
        this.orbitCamera(
          this.randomRotateDirection.x *
            this.animationSpeed *
            rotateDeltaMultiplier,
          this.randomRotateDirection.y *
            this.animationSpeed *
            rotateDeltaMultiplier
        );
        break;
      default:
        console.warn(`Unknown camera animation: ${this.currentAnimation}`);
        this.stopCameraAnimation();
        break;
    }

    this.controls.update();
    this.render();
  }

  /**
   * Snaps the camera to a random angle around the target.
   */
  snapCameraToRandomAngle() {
    if (!this.modelCenter || !this.camera) {
      console.warn("Cannot snap camera: Model center or camera not defined.");
      return;
    }

    const spherical = new THREE.Spherical();

    // Calculate current distance from the target
    const offset = new THREE.Vector3().subVectors(
      this.camera.position,
      this.controls.target
    );
    spherical.setFromVector3(offset);

    // Generate random theta (azimuthal angle) and phi (polar angle)
    spherical.theta = THREE.MathUtils.randFloat(0, 2 * Math.PI);
    spherical.phi = THREE.MathUtils.randFloat(0.1, Math.PI - 0.1); // Avoid poles for better view

    // Convert spherical coordinates back to Cartesian coordinates
    const newPosition = new THREE.Vector3()
      .setFromSpherical(spherical)
      .add(this.controls.target);

    // Update camera position and look at the target
    this.camera.position.copy(newPosition);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  /**
   * Rolls the camera around its viewing axis.
   * @param {number} delta - The angle in radians to roll the camera.
   */
  rollCamera(delta) {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;

    // Calculate the direction the camera is looking at
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);

    // Define the axis to roll around (the viewing direction)
    const rollAxis = direction.clone().normalize();

    // Create a quaternion for the roll rotation
    const quaternion = new THREE.Quaternion();
    quaternion.setFromAxisAngle(rollAxis, delta);

    // Apply the roll to the camera's up vector
    this.camera.up.applyQuaternion(quaternion);
  }

  /**
   * Pans the camera forward/backward.
   * @param {number} delta - The amount to pan.
   */
  panCameraForward(delta) {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;

    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    direction.multiplyScalar(delta);

    this.camera.position.add(direction);
    this.controls.target.add(direction);
  }

  /**
   * Pans the camera left/right.
   * @param {number} delta - The amount to pan.
   */
  panCameraLeft(delta) {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;

    const offset = new THREE.Vector3();

    this.camera.getWorldDirection(offset);
    offset.cross(this.camera.up).normalize().multiplyScalar(delta);

    this.camera.position.add(offset);
    this.controls.target.add(offset);
  }

  /**
   * Pans the camera up/down.
   * @param {number} delta - The amount to pan.
   */
  panCameraUp(delta) {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;

    const offset = new THREE.Vector3();

    offset.copy(this.camera.up).normalize().multiplyScalar(delta);

    this.camera.position.add(offset);
    this.controls.target.add(offset);
  }

  /**
   * Implements the 'zoomLevel' method.
   * @param {Object} options - Configuration options.
   */
  zoomLevel(options) {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;

    const { zoomLevel = this.cameraSettings.zoomLevel } = options;

    this.cameraSettings.zoomLevel = THREE.MathUtils.clamp(zoomLevel, 0, 100);

    this.updateCameraZoom(this.cameraSettings.zoomLevel);
  }

  /**
   * Implements the 'viewDirection' method.
   * @param {Object} options - Configuration options.
   */
  viewDirection(options) {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;

    const { viewDirection = this.cameraSettings.viewDirection } = options;

    const validDirections = ["front", "top", "right", "back", "bottom", "left"];
    if (!validDirections.includes(viewDirection)) {
      console.warn(
        `Invalid view direction: ${viewDirection}. Using default 'front'.`
      );
      this.cameraSettings.viewDirection = "front";
    } else {
      this.cameraSettings.viewDirection = viewDirection;
    }

    this.updateCameraViewDirection(this.cameraSettings.viewDirection);
  }

  /**
   * Implements the 'cameraAnimation' method.
   * @param {Object} options - Configuration options.
   */
  cameraAnimation(options) {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;

    const { cameraAnimation = this.cameraSettings.cameraAnimation } = options;

    this.cameraSettings.cameraAnimation = cameraAnimation;

    this.startCameraAnimation(
      this.cameraSettings.cameraAnimation,
      this.cameraSettings.cameraSpeed
    );
  }

  /**
   * Implements the 'cameraSpeed' method.
   * @param {Object} options - Configuration options.
   */
  cameraSpeed(options) {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;

    const { cameraSpeed = this.cameraSettings.cameraSpeed } = options;

    this.cameraSettings.cameraSpeed = THREE.MathUtils.clamp(
      cameraSpeed,
      0.01,
      10
    );
    this.animationSpeed = this.cameraSettings.cameraSpeed;

    if (this.currentAnimation) {
      this.startCameraAnimation(
        this.currentAnimation,
        this.cameraSettings.cameraSpeed
      );
    }
  }

  /**
   * Updates the camera's zoom based on the provided percentage.
   * @param {number} percentage - The zoom level percentage.
   */
  updateCameraZoom(percentage) {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;

    if (!this.modelBoundingBox) {
      console.warn("Model bounding box not loaded yet.");
      return;
    }

    const maxDim = this.modelSize;
    if (!maxDim || isNaN(maxDim)) {
      console.warn("Invalid modelSize:", this.modelSize);
      return;
    }

    const minDistance = maxDim * 0.001;
    const maxDistance = maxDim * 2.5;

    const clampedPercentage = THREE.MathUtils.clamp(percentage, 0, 100);

    const targetDistance = THREE.MathUtils.lerp(
      minDistance,
      maxDistance,
      clampedPercentage / 100
    );

    const direction = new THREE.Vector3()
      .subVectors(this.camera.position, this.controls.target)
      .normalize();

    const newPosition = this.controls.target
      .clone()
      .add(direction.multiplyScalar(targetDistance));

    this.camera.position.copy(newPosition);

    this.camera.lookAt(this.controls.target);

    this.controls.update();

    this.render();
  }

  /**
   * Updates the camera's view direction.
   * @param {string} direction - The desired view direction.
   */
  updateCameraViewDirection(direction) {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;

    if (!this.modelBoundingBox) {
      console.warn("Model bounding box not loaded yet.");
      return;
    }

    const center = this.modelCenter;

    // Use zoom level to calculate distance from the model
    const zoomLevelPercentage = this.cameraSettings.zoomLevel / 100;
    const minDistance = this.modelSize * 0.001; // Minimum distance when zoomLevel is 0
    const maxDistance = this.modelSize * 2.5; // Maximum distance when zoomLevel is 100
    const distance = THREE.MathUtils.lerp(
      minDistance,
      maxDistance,
      zoomLevelPercentage
    );

    switch (direction) {
      case "front":
        this.camera.position.set(center.x, center.y, center.z + distance);
        this.camera.up.set(0, 1, 0);
        break;
      case "back":
        this.camera.position.set(center.x, center.y, center.z - distance);
        this.camera.up.set(0, 1, 0);
        break;
      case "top":
        this.camera.position.set(center.x, center.y + distance, center.z);
        this.camera.up.set(0, 0, -1);
        break;
      case "bottom":
        this.camera.position.set(center.x, center.y - distance, center.z);
        this.camera.up.set(0, 0, 1);
        break;
      case "right":
        this.camera.position.set(center.x + distance, center.y, center.z);
        this.camera.up.set(0, 1, 0);
        break;
      case "left":
        this.camera.position.set(center.x - distance, center.y, center.z);
        this.camera.up.set(0, 1, 0);
        break;
      default:
        console.warn(`Unknown view direction: ${direction}`);
        this.camera.up.set(0, 1, 0);
        break;
    }

    this.camera.lookAt(center);
    this.controls.target.copy(center);
    this.controls.update();
    this.render();
  }

  /**
   * Starts the specified camera animation.
   * @param {string} animation - The type of camera animation.
   * @param {number} speed - The speed of the animation.
   */
  startCameraAnimation(animation, speed) {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;

    this.stopCameraAnimation();

    if (!animation || animation === "none") return;

    this.currentAnimation = animation;
    this.animationSpeed = speed;

    switch (animation) {
      case "pan-forward":
      case "pan-backward":
      case "pan-left":
      case "pan-right":
      case "pan-up":
      case "pan-down":
      case "rotate-left":
      case "rotate-right":
      case "rotate-up":
      case "rotate-down":
      case "rotate-clockwise":
      case "rotate-anticlockwise":
        break;
      case "rotate-random":
        this.snapCameraToRandomAngle();
        this.randomRotateDirection.x = Math.random() < 0.5 ? 1 : -1;
        this.randomRotateDirection.y = Math.random() < 0.5 ? 1 : -1;
        break;
      default:
        console.warn(`Unknown camera animation: ${animation}`);
        this.currentAnimation = null;
        break;
    }
  }

  /**
   * Stops any ongoing camera animation.
   */
  stopCameraAnimation() {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;

    this.currentAnimation = null;
    this.controls.autoRotate = false;
    this.animationSpeed = this.cameraSettings.cameraSpeed;
    this.animationDirection = 1;
  }

  /**
   * Orbits the camera around the target based on delta angles.
   * @param {number} deltaAzimuth - The change in azimuthal angle.
   * @param {number} deltaPolar - The change in polar angle.
   */
  orbitCamera(deltaAzimuth, deltaPolar) {
    const spherical = new THREE.Spherical();
    const offset = new THREE.Vector3();
    offset.copy(this.camera.position).sub(this.controls.target);
    spherical.setFromVector3(offset);

    spherical.theta += deltaAzimuth;
    spherical.phi += deltaPolar;

    // Restrict phi to avoid the camera flipping
    const EPS = 0.000001;
    spherical.phi = Math.max(EPS, Math.min(Math.PI - EPS, spherical.phi));

    const newPosition = new THREE.Vector3()
      .setFromSpherical(spherical)
      .add(this.controls.target);
    this.camera.position.copy(newPosition);
    this.camera.lookAt(this.controls.target);
  }

  /**
   * Implements the 'destroy' method for cleanup.
   */
  destroy() {
    const disposeObject = (object) => {
      try {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
        if (object.texture) {
          object.texture.dispose();
        }

        // Recursive disposal of children
        if (object.children) {
          object.children.forEach((child) => disposeObject(child));
        }

        // Dispose properties related to animations, cameras, lights, etc.
        if (object.animations) {
          object.animations.forEach((clip) => clip.dispose());
        }

        ["camera", "light", "helper", "controls"].forEach((prop) => {
          if (object[prop]) {
            if (typeof object[prop].dispose === "function") {
              object[prop].dispose();
            }
          }
        });

        // Remove from parent if attached
        if (object.parent) {
          object.parent.remove(object);
        }

        // Nullify properties to help with garbage collection
        for (let propName in object) {
          if (
            typeof object[propName] === "object" &&
            object[propName] !== null
          ) {
            object[propName] = null;
          }
        }
      } catch (e) {
        return;
      }
    };

    // Unsubscribe from the animation manager
    animationManager.unsubscribe(this.animate);

    // Cancel the animation frame request if it's active
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Clear interval if it has been set
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Dispose of controls
    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }

    // Remove and dispose all children from the scene
    if (this.scene) {
      while (this.scene.children.length > 0) {
        const object = this.scene.children[0];
        disposeObject(object);
        this.scene.remove(object);
      }
      this.scene = null;
    }

    // Dispose of the renderer and its DOM element
    if (this.renderer) {
      if (this.renderer.domElement) {
        this.renderer.domElement.parentNode.removeChild(
          this.renderer.domElement
        );
      }
      this.renderer.dispose();
      this.renderer = null;
    }

    // Set camera to null if it exists
    if (this.camera) {
      this.camera = null;
    }

    // Call parent destroy BEFORE nullifying everything
    // This ensures external DOM elements are cleaned up properly
    super.destroy();

    // Special case for properties not covered by standard removal
    for (let propName in this) {
      if (this[propName] && typeof this[propName] === "object") {
        disposeObject(this[propName]);
        this[propName] = null;
      }
    }

    this.destroyed = true;
  }
}

export default BaseThreeJsModule;
