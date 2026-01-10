/**
 * Manual mock for osc package
 */

console.log("[MANUAL OSC MOCK] Loading osc manual mock");

const EventEmitter = require("events");

// Track the last created port for testing
let lastCreatedPort = null;
let callCount = 0;

// Create UDPPort mock
const UDPPortSpy = function UDPPort(options) {
  console.log("[MANUAL OSC MOCK] UDPPort constructor called! Call #", ++callCount);
  console.log("[MANUAL OSC MOCK] Options:", JSON.stringify(options));
  const mockPort = new EventEmitter();
  const port = {
    ...mockPort,
    open: function() {
      console.log("[MANUAL OSC MOCK] UDP port open() called");
      // Emit 'ready' event after open
      process.nextTick(() => {
        mockPort.emit("ready");
      });
    },
    close: function() {
      console.log("[MANUAL OSC MOCK] UDP port close() called");
    },
  };
  // Store reference to this port
  lastCreatedPort = port;
  console.log("[MANUAL OSC MOCK] Created port");
  return port;
};

// Add tracking properties
Object.defineProperty(UDPPortSpy, "lastCreatedPort", {
  get: () => lastCreatedPort,
  enumerable: false,
});

Object.defineProperty(UDPPortSpy, "callCount", {
  get: () => callCount,
  enumerable: false,
});

// Helper to reset state
function resetState() {
  lastCreatedPort = null;
  callCount = 0;
}

// Export both as default and named export
module.exports = { UDPPort: UDPPort };
module.exports.UDPPort = UDPPort;
module.exports.default = { UDPPort };
