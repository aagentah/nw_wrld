/**
 * Manual mock for webmidi package
 * This ensures tests use the mock instead of the real webmidi package
 */

console.log("[MANUAL WEBMIDI MOCK] Loading webmidi manual mock");

// Track state
let webMidiState = {
  enabled: false,
  inputs: [],
  outputs: [],
  sysexEnabled: false,
  support: false,
  time: 0,
};

// Create function that will be replaced by vi.fn() in tests
const enableFn = function(callback) {
  console.log("[MANUAL WEBMIDI MOCK] enable() called");
  // Mimic async behavior - will be replaced by vi.fn() in tests
  if (callback) {
    setTimeout(() => callback(null), 0);
  }
  webMidiState.enabled = true;
  webMidiState.support = true;
};

const disableFn = function() {
  console.log("[MANUAL WEBMIDI MOCK] disable() called");
  webMidiState.enabled = false;
  webMidiState.inputs = [];
  webMidiState.outputs = [];
};

const getInputByIdFn = function(id) {
  console.log("[MANUAL WEBMIDI MOCK] getInputById() called with id:", id, "inputs:", webMidiState.inputs);
  return webMidiState.inputs.find((input) => input.id === id) || null;
};

const getInputByNameFn = function(name) {
  console.log("[MANUAL WEBMIDI MOCK] getInputByName() called with name:", name, "inputs:", webMidiState.inputs);
  return webMidiState.inputs.find((input) => input.name === name) || null;
};

// Create WebMidi object
const WebMidi = {
  enable: enableFn,
  disable: disableFn,
  getInputById: getInputByIdFn,
  getInputByName: getInputByNameFn,
  getOutputById: () => null,
  getOutputByName: () => null,
  _state: webMidiState,
};

// Define properties with getters/setters
Object.defineProperty(WebMidi, 'enabled', {
  get: () => webMidiState.enabled,
  set: (value) => { webMidiState.enabled = value; },
  enumerable: true,
  configurable: true,
});

Object.defineProperty(WebMidi, 'inputs', {
  get: () => webMidiState.inputs,
  set: (value) => { webMidiState.inputs = value; },
  enumerable: true,
  configurable: true,
});

Object.defineProperty(WebMidi, 'outputs', {
  get: () => webMidiState.outputs,
  set: (value) => { webMidiState.outputs = value; },
  enumerable: true,
  configurable: true,
});

Object.defineProperty(WebMidi, 'sysexEnabled', {
  get: () => webMidiState.sysexEnabled,
  enumerable: true,
  configurable: true,
});

Object.defineProperty(WebMidi, 'support', {
  get: () => webMidiState.support,
  set: (value) => { webMidiState.support = value; },
  enumerable: true,
  configurable: true,
});

Object.defineProperty(WebMidi, 'time', {
  get: () => webMidiState.time,
  enumerable: true,
  configurable: true,
});

// Export both as default and named export
module.exports = { WebMidi };
module.exports.WebMidi = WebMidi;
module.exports.default = { WebMidi };
