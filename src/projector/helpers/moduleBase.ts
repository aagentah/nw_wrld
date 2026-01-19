// src/ModuleBase.js

export class ModuleBase {
  elem: HTMLElement | null;
  name: string;
  currentX: number;
  currentY: number;
  currentScale: number;
  currentOpacity: number;
  viewportLineElem: SVGSVGElement | null;
  rotateTimeout: ReturnType<typeof setTimeout> | null;
  rotationInterval: number | null;
  rotationTimeout: ReturnType<typeof setTimeout> | null;
  currentRotation: number;
  externalElements: Array<HTMLElement | SVGElement>;

  static methods = [
    {
      name: "matrix",
      executeOnLoad: true,
      options: [
        { name: "matrix", defaultVal: { rows: 1, cols: 1, excludedCells: [] }, type: "matrix" },
        { name: "border", defaultVal: false, type: "boolean" },
      ],
    },
    {
      name: "show",
      executeOnLoad: true,
      options: [{ name: "duration", defaultVal: 0, type: "number", min: 0 }],
    },
    {
      name: "hide",
      executeOnLoad: false,
      options: [{ name: "duration", defaultVal: 0, type: "number", min: 0 }],
    },
    {
      name: "offset",
      executeOnLoad: false,
      options: [
        { name: "x", defaultVal: 0, type: "number", allowRandomization: true },
        { name: "y", defaultVal: 0, type: "number", allowRandomization: true },
      ],
    },
    {
      name: "scale",
      executeOnLoad: false,
      options: [{ name: "scale", defaultVal: 1, type: "number", allowRandomization: true }],
    },
    {
      name: "randomZoom",
      executeOnLoad: false,
      options: [
        { name: "scaleFrom", defaultVal: 1, type: "number", min: 0.1 },
        { name: "scaleTo", defaultVal: 2, type: "number", min: 0.1 },
        {
          name: "position",
          defaultVal: "random",
          type: "select",
          values: ["random", "topLeft", "topRight", "bottomLeft", "bottomRight"],
        },
      ],
    },
    {
      name: "opacity",
      executeOnLoad: false,
      options: [{ name: "opacity", defaultVal: 1, type: "number", min: 0, max: 1 }],
    },
    {
      name: "rotate",
      executeOnLoad: false,
      options: [
        {
          name: "direction",
          defaultVal: "clockwise",
          type: "select",
          values: ["clockwise", "counter-clockwise"],
        },
        {
          name: "speed",
          defaultVal: 1,
          type: "number",
          min: 0.1,
          max: 100,
        },
        {
          name: "duration",
          defaultVal: 0,
          type: "number",
          min: 0,
        },
      ],
    },
    {
      name: "viewportLine",
      executeOnLoad: false,
      options: [
        {
          name: "x",
          defaultVal: 50,
          type: "number",
          min: 0,
          max: 100,
        },
        {
          name: "y",
          defaultVal: 50,
          type: "number",
          min: 0,
          max: 100,
        },
        {
          name: "length",
          defaultVal: 100,
          type: "number",
          min: 0,
          max: 100,
        },
        {
          name: "opacity",
          defaultVal: 1,
          type: "number",
          min: 0,
          max: 1,
        },
      ],
    },
    {
      name: "background",
      executeOnLoad: false,
      options: [
        {
          name: "color",
          defaultVal: "#000000",
          type: "color",
        },
      ],
    },
    {
      name: "invert",
      executeOnLoad: false,
      options: [{ name: "duration", defaultVal: 0, type: "number", min: 0 }],
    },
  ];

  constructor(container: HTMLElement | null) {
    this.elem = container;
    this.name = this.constructor.name;

    // Initialize transformation state
    this.currentX = 0;
    this.currentY = 0;
    this.currentScale = 1;
    this.currentOpacity = 1;
    this.viewportLineElem = null;
    this.rotateTimeout = null;
    this.rotationInterval = null;
    this.rotationTimeout = null;
    this.currentRotation = 0;
    this.externalElements = [];

    if (this.elem) {
      this.elem.style.visibility = "hidden";
      this.elem.style.opacity = String(this.currentOpacity);
      this.updateTransform();
    }
  }

  show(options: { duration?: number } = {}) {
    const { duration = 0 } = options;
    const moduleElem = this.elem;

    if (moduleElem) {
      moduleElem.style.visibility = "visible";
      if (this.externalElements && Array.isArray(this.externalElements)) {
        this.externalElements.forEach((elem) => {
          if (elem && elem.style) {
            elem.style.visibility = "visible";
          }
        });
      }

      if (duration > 0) {
        setTimeout(() => {
          moduleElem.style.visibility = "hidden";
          if (this.externalElements && Array.isArray(this.externalElements)) {
            this.externalElements.forEach((elem) => {
              if (elem && elem.style) {
                elem.style.visibility = "hidden";
              }
            });
          }
        }, duration);
      }
    } else {
      console.warn(`Module instance does not have an 'elem' property.`);
    }
  }

  hide(options: { duration?: number } = {}) {
    const { duration = 0 } = options;
    const moduleElem = this.elem;

    if (moduleElem) {
      moduleElem.style.visibility = "hidden";
      if (this.externalElements && Array.isArray(this.externalElements)) {
        this.externalElements.forEach((elem) => {
          if (elem && elem.style) {
            elem.style.visibility = "hidden";
          }
        });
      }

      if (duration > 0) {
        setTimeout(() => {
          moduleElem.style.visibility = "visible";
          if (this.externalElements && Array.isArray(this.externalElements)) {
            this.externalElements.forEach((elem) => {
              if (elem && elem.style) {
                elem.style.visibility = "visible";
              }
            });
          }
        }, duration);
      }
    } else {
      console.warn(`Module instance does not have an 'elem' property.`);
    }
  }

  /**
   * Applies translation to the element.
   * @param {Object} options
   * @param {number} options.x - The X offset in percentage (default: 0).
   * @param {number} options.y - The Y offset in percentage (default: 0).
   */
  offset(options: { x?: number; y?: number } = {}) {
    const { x = 0, y = 0 } = options;
    this.currentX = x;
    this.currentY = y;
    this.updateTransform();
  }

  /**
   * Applies scaling to the element.
   * @param {Object} options
   * @param {number} options.scale - The scale factor (default: 1).
   */
  scale(options: { scale?: number } = {}) {
    const { scale = 1 } = options;
    this.currentScale = scale;
    this.updateTransform();
  }

  /**
   * Adjusts the opacity of the element.
   * @param {Object} options
   * @param {number} options.value - The opacity value between 0 and 1 (default: 1).
   */
  opacity(options: { opacity?: number } = {}) {
    const { opacity = 1 } = options;
    const moduleElem = this.elem;

    if (moduleElem) {
      // Clamp the opacity value between 0 and 1
      const clampedValue = Math.min(Math.max(opacity, 0), 1);
      this.currentOpacity = clampedValue;
      moduleElem.style.opacity = String(this.currentOpacity);
    } else {
      console.warn(`Module instance does not have an 'elem' property.`);
    }
  }

  /**
   * Rotates the element either infinitely or for a specified duration.
   * After the duration, the rotation stops, and the element remains in its final rotated position.
   * @param {Object} options
   * @param {string} options.direction - "clockwise" or "counter-clockwise" (default: "clockwise").
   * @param {number} options.speed - The rotation speed in degrees per second (default: 60).
   * @param {number} options.duration - Duration in milliseconds to rotate before stopping (default: 0, which means infinite rotation).
   */
  rotate(options: { direction?: string; speed?: number; duration?: number } = {}) {
    const { direction = "clockwise", speed = 1, duration = 0 } = options;

    if (this.rotationInterval) {
      return;
    }

    // Determine rotation direction multiplier
    const directionMultiplier = direction === "clockwise" ? 1 : -1;

    // Define the rotation step based on speed (degrees per second)
    const rotationStep = directionMultiplier * (speed * 12);

    let lastTimestamp: number | null = null;

    // Define the rotation function using requestAnimationFrame
    const rotateAnimation = (timestamp: number) => {
      if (!lastTimestamp) lastTimestamp = timestamp;
      const delta = (timestamp - lastTimestamp) / 1000; // Convert to seconds
      lastTimestamp = timestamp;

      // Update the current rotation angle
      this.currentRotation += rotationStep * delta;

      // Keep the rotation angle within 0-360 degrees
      this.currentRotation %= 360;

      // Apply the rotation
      this.updateTransform();

      // Continue the animation
      this.rotationInterval = requestAnimationFrame(rotateAnimation);
    };

    // Start the rotation animation
    this.rotationInterval = requestAnimationFrame(rotateAnimation);

    // If duration is specified, set a timeout to stop the rotation
    if (duration > 0) {
      this.rotationTimeout = setTimeout(() => {
        this.stopRotate();
      }, duration);
    }
  }

  /**
   * Stops the rotation animation.
   * The element remains in its final rotated position.
   */
  stopRotate() {
    if (this.rotationInterval) {
      cancelAnimationFrame(this.rotationInterval);
      this.rotationInterval = null;
    }

    if (this.rotationTimeout) {
      clearTimeout(this.rotationTimeout);
      this.rotationTimeout = null;
    }
  }

  /**
   * Updates the CSS transform property based on current transformation states, including rotation.
   */
  updateTransform() {
    if (this.elem) {
      const transformParts = [];

      // Apply translation if needed
      if (this.currentX !== 0 || this.currentY !== 0) {
        transformParts.push(`translate(${this.currentX}%, ${this.currentY}%)`);
      }

      // Apply scaling if needed
      if (this.currentScale !== 1) {
        transformParts.push(`scale(${this.currentScale})`);
      }

      // Apply rotation if needed
      if (this.currentRotation !== 0) {
        transformParts.push(`rotate(${this.currentRotation}deg)`);
      }

      // Combine all transform parts or reset to none
      this.elem.style.transform = transformParts.length > 0 ? transformParts.join(" ") : "none";
    }
  }

  /**
   * Applies a random zoom effect with a random position within specified scale bounds
   * @param {Object} options
   * @param {number} options.scaleFrom - The minimum scale value (default: 1)
   * @param {number} options.scaleTo - The maximum scale value (default: 2)
   * @param {string} options.position - Optional fixed position ('topLeft', 'topRight', 'bottomLeft', 'bottomRight', 'random')
   * @returns {Object} The applied transformation values
   */
  randomZoom(options: { scaleFrom?: number; scaleTo?: number; position?: string } = {}) {
    const { scaleFrom = 1, scaleTo = 2, position = "random" } = options;

    // Ensure numeric values and generate random scale
    const numScaleFrom = Number(scaleFrom);
    const numScaleTo = Number(scaleTo);

    if (isNaN(numScaleFrom) || isNaN(numScaleTo)) {
      console.error("Invalid scale values provided");
      return;
    }

    const randomScale = Number(
      (Math.random() * (numScaleTo - numScaleFrom) + numScaleFrom).toFixed(2)
    );

    // Predefined position mappings
    const positions = {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 100, y: 0 },
      bottomLeft: { x: 0, y: 100 },
      bottomRight: { x: 100, y: 100 },
    };

    let xOffset, yOffset;

    if (position === "random") {
      // Generate random percentage positions between 0-100
      xOffset = +(Math.random() * 100).toFixed(2);
      yOffset = +(Math.random() * 100).toFixed(2);
    } else {
      // Use predefined position if specified
      const selectedPosition = positions[position] || positions.topLeft;
      xOffset = selectedPosition.x;
      yOffset = selectedPosition.y;
    }

    // Apply the transformations
    this.scale({ scale: randomScale });
    this.offset({ x: xOffset, y: yOffset });

    // Return the applied values for reference
    return {
      scale: randomScale,
      x: xOffset,
      y: yOffset,
    };
  }

  /**
   * Draws a two-segment line from the module container to a viewport position.
   * The line extends outward from the closest side of the container, then toward the target.
   * @param {Object} options
   * @param {number} options.x - X position as percentage of viewport width (0-100)
   * @param {number} options.y - Y position as percentage of viewport height (0-100)
   * @param {number} options.length - Length of line as percentage of total distance (0-100, default: 100)
   * @param {number} options.opacity - Opacity of the line (0-1, default: 1)
   */
  viewportLine(options: { x?: number; y?: number; length?: number; opacity?: number } = {}) {
    const { x = 50, y = 50, length = 100, opacity = 1 } = options;
    const moduleElem = this.elem;

    if (!moduleElem) {
      console.warn(`Module instance does not have an 'elem' property.`);
      return;
    }

    // Remove existing line if present
    if (this.viewportLineElem) {
      if (this.viewportLineElem.parentNode) {
        this.viewportLineElem.parentNode.removeChild(this.viewportLineElem);
      }
      if (this.externalElements && Array.isArray(this.externalElements)) {
        const index = this.externalElements.indexOf(this.viewportLineElem);
        if (index > -1) {
          this.externalElements.splice(index, 1);
        }
      }
      this.viewportLineElem = null;
    }

    // Get container's bounding box (accounts for all transforms)
    const containerRect = moduleElem.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Convert target percentages to viewport coordinates
    const targetX = (x / 100) * viewportWidth;
    const targetY = (y / 100) * viewportHeight;

    // Calculate container center and dimensions
    const containerCenterX = containerRect.left + containerRect.width / 2;
    const containerCenterY = containerRect.top + containerRect.height / 2;
    const containerLeft = containerRect.left;
    const containerRight = containerRect.right;
    const containerTop = containerRect.top;
    const containerBottom = containerRect.bottom;

    // Calculate distances from target to each side center
    const topCenter = { x: containerCenterX, y: containerTop };
    const rightCenter = { x: containerRight, y: containerCenterY };
    const bottomCenter = { x: containerCenterX, y: containerBottom };
    const leftCenter = { x: containerLeft, y: containerCenterY };

    const distances = {
      top: Math.sqrt(Math.pow(targetX - topCenter.x, 2) + Math.pow(targetY - topCenter.y, 2)),
      right: Math.sqrt(Math.pow(targetX - rightCenter.x, 2) + Math.pow(targetY - rightCenter.y, 2)),
      bottom: Math.sqrt(
        Math.pow(targetX - bottomCenter.x, 2) + Math.pow(targetY - bottomCenter.y, 2)
      ),
      left: Math.sqrt(Math.pow(targetX - leftCenter.x, 2) + Math.pow(targetY - leftCenter.y, 2)),
    };

    // Find closest side
    const closestSide = Object.keys(distances).reduce((a, b) =>
      distances[a] < distances[b] ? a : b
    );

    // Get starting point (center of closest side)
    let startX, startY;
    let outwardDirX, outwardDirY;

    switch (closestSide) {
      case "top":
        startX = topCenter.x;
        startY = topCenter.y;
        outwardDirX = 0;
        outwardDirY = -1;
        break;
      case "right":
        startX = rightCenter.x;
        startY = rightCenter.y;
        outwardDirX = 1;
        outwardDirY = 0;
        break;
      case "bottom":
        startX = bottomCenter.x;
        startY = bottomCenter.y;
        outwardDirX = 0;
        outwardDirY = 1;
        break;
      case "left":
        startX = leftCenter.x;
        startY = leftCenter.y;
        outwardDirX = -1;
        outwardDirY = 0;
        break;
    }

    // Calculate direction vector from start to target
    const dx = targetX - startX;
    const dy = targetY - startY;
    const totalLength = Math.sqrt(dx * dx + dy * dy);

    if (totalLength === 0) {
      console.warn("Target point is at the container edge. No line drawn.");
      return;
    }

    // Clamp length to valid range
    const clampedLength = Math.max(0, Math.min(100, length));
    const lengthMultiplier = clampedLength / 100;

    // Clamp opacity to valid range
    const clampedOpacity = Math.max(0, Math.min(1, opacity));

    // Calculate first segment: perpendicular outward (15% of total distance)
    const outwardLength = totalLength * 0.15;
    const midX = startX + outwardDirX * outwardLength;
    const midY = startY + outwardDirY * outwardLength;

    // Calculate actual end point based on length percentage
    // The end point is at length% of the way from start to target
    const endX = startX + dx * lengthMultiplier;
    const endY = startY + dy * lengthMultiplier;

    // Get z-index from container
    const computedStyle = window.getComputedStyle(moduleElem);
    const zIndex = computedStyle.zIndex || "1";

    // Create SVG overlay
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", String(viewportWidth));
    svg.setAttribute("height", String(viewportHeight));
    svg.style.position = "fixed";
    svg.style.top = "0";
    svg.style.left = "0";
    svg.style.width = "100vw";
    svg.style.height = "100vh";
    svg.style.pointerEvents = "none";
    svg.style.zIndex = zIndex;

    // Create path for two-segment line
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const pathData = `M ${startX} ${startY} L ${midX} ${midY} L ${endX} ${endY}`;
    path.setAttribute("d", pathData);
    path.setAttribute("stroke", "#ffffff");
    path.setAttribute("stroke-width", "1");
    path.setAttribute("stroke-opacity", String(clampedOpacity));
    path.setAttribute("fill", "none");

    svg.appendChild(path);

    // Match module's current visibility state
    const moduleVisibility = window.getComputedStyle(moduleElem).visibility;
    svg.style.visibility = moduleVisibility;

    // Append to body (or projector container if available)
    const projectorContainer = document.querySelector(".projector") || document.body;
    projectorContainer.appendChild(svg);

    this.viewportLineElem = svg;
    this.externalElements.push(svg);

    console.log(
      `Module "${
        this.constructor.name
      }" viewport line drawn from (${startX.toFixed(1)}, ${startY.toFixed(
        1
      )}) to (${endX.toFixed(1)}, ${endY.toFixed(
        1
      )}) via closest side: ${closestSide}, length: ${clampedLength}%.`
    );
  }

  /**
   * Sets the background color of the module container.
   * @param {Object} options
   * @param {string} options.color - The color value (hex, rgb, rgba, or named color, default: "#000000").
   */
  background(options: { color?: string } = {}) {
    const { color = "#000000" } = options;
    const moduleElem = this.elem;

    if (moduleElem) {
      moduleElem.style.backgroundColor = color;
    } else {
      console.warn(`Module instance does not have an 'elem' property.`);
    }
  }

  /**
   * Inverts all colors in the module container using CSS filter.
   * @param {Object} options
   * @param {number} options.duration - Duration to apply inversion in milliseconds (default: 0 for permanent).
   */
  invert(options: { duration?: number } = {}) {
    const { duration = 0 } = options;
    const moduleElem = this.elem;

    if (moduleElem) {
      moduleElem.style.filter = "invert(1)";

      if (duration > 0) {
        setTimeout(() => {
          moduleElem.style.filter = "none";
        }, duration);
      }
    } else {
      console.warn(`Module instance does not have an 'elem' property.`);
    }
  }

  destroy() {
    // Stop rotation animation if running
    this.stopRotate();

    if (this.externalElements && Array.isArray(this.externalElements)) {
      this.externalElements.forEach((elem) => {
        if (elem && elem.parentNode) {
          elem.parentNode.removeChild(elem);
        }
      });
      this.externalElements = [];
    }
    this.viewportLineElem = null;
    if (this.elem && this.elem.parentNode) {
      this.elem.parentNode.removeChild(this.elem);
    }
    this.elem = null;
  }
}

export default ModuleBase;
