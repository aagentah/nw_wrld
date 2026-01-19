import ModuleBase from "./helpers/moduleBase";
import BaseThreeJsModule from "./helpers/threeBase.js";
import * as THREE from "three";
import p5 from "p5";
import * as d3 from "d3";
import { Noise } from "noisejs";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { PCDLoader } from "three/examples/jsm/loaders/PCDLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { parseNwWrldDocblockMetadata } from "../shared/nwWrldDocblock";
import {
  buildMethodOptions,
  parseMatrixOptions,
} from "../shared/utils/methodOptions";
import { createSdkHelpers } from "../shared/utils/sdkHelpers";
import {
  buildWorkspaceImportPreamble,
  ensureTrailingSlash,
  getTokenFromLocationHash,
  safeAssetRelPath,
} from "../shared/validation/sandboxModuleUtils";

if (!globalThis.THREE) globalThis.THREE = THREE;
if (!globalThis.p5) globalThis.p5 = p5;
if (!globalThis.d3) globalThis.d3 = d3;
if (!globalThis.Noise) globalThis.Noise = Noise;
if (!globalThis.OBJLoader) globalThis.OBJLoader = OBJLoader;
if (!globalThis.PLYLoader) globalThis.PLYLoader = PLYLoader;
if (!globalThis.PCDLoader) globalThis.PCDLoader = PCDLoader;
if (!globalThis.GLTFLoader) globalThis.GLTFLoader = GLTFLoader;
if (!globalThis.STLLoader) globalThis.STLLoader = STLLoader;

const MODULE_METADATA_MAX_BYTES = 16 * 1024;

const TOKEN =
  getTokenFromLocationHash(window?.location?.hash) ||
  (globalThis as typeof globalThis & { __NW_WRLD_SANDBOX_TOKEN__?: unknown })
    .__NW_WRLD_SANDBOX_TOKEN__ ||
  null;

const injectWorkspaceModuleImports = (moduleId, sourceText) => {
  if (typeof parseNwWrldDocblockMetadata !== "function") {
    throw new Error(`[Sandbox] Docblock parser is unavailable.`);
  }
  const meta = parseNwWrldDocblockMetadata(sourceText, MODULE_METADATA_MAX_BYTES);
  const preamble = buildWorkspaceImportPreamble(moduleId, meta?.imports);

  const text = String(sourceText || "");
  const docblockMatch = text.match(/^[\uFEFF\s]*\/\*[\s\S]*?\*\/\s*/);
  if (!docblockMatch) {
    throw new Error(
      `[Sandbox] Workspace module "${moduleId}" is missing required docblock header.`
    );
  }
  const head = docblockMatch[0];
  const rest = text.slice(head.length);
  return `${head}${preamble}\n${rest}`;
};

const _getCallableMethodNames = (instance) => {
  const names = new Set();
  let proto = instance ? Object.getPrototypeOf(instance) : null;
  while (proto && proto !== Object.prototype) {
    for (const n of Object.getOwnPropertyNames(proto)) {
      if (n === "constructor") continue;
      const desc = Object.getOwnPropertyDescriptor(proto, n);
      if (desc && typeof desc.value === "function") names.add(n);
    }
    proto = Object.getPrototypeOf(proto);
  }
  return Array.from(names);
};

const getCallableMethodNamesFromClass = (Cls) => {
  const names = new Set();
  let proto = Cls && Cls.prototype ? Cls.prototype : null;
  while (proto && proto !== Object.prototype) {
    for (const n of Object.getOwnPropertyNames(proto)) {
      if (n === "constructor") continue;
      const desc = Object.getOwnPropertyDescriptor(proto, n);
      if (desc && typeof desc.value === "function") names.add(n);
    }
    proto = Object.getPrototypeOf(proto);
  }
  return Array.from(names);
};

let assetsBaseUrl = null;
let trackRoot = null;
const moduleClassCache = new Map(); // moduleType -> Promise<ModuleClass>
const instancesById = new Map(); // instanceId -> { moduleType, instances: [] }

let rpcSeq = 0;
const pending = new Map();

const postToHost = (payload) => {
  try {
    globalThis.nwSandboxIpc?.send?.(payload);
  } catch {}
};

const rpcRequest = (type, props) =>
  new Promise((resolve, reject) => {
    const requestId = `${Date.now()}:${++rpcSeq}`;
    pending.set(requestId, { resolve, reject });
    postToHost({
      __nwWrldSandbox: true,
      token: TOKEN,
      type,
      requestId,
      props: props || {},
    });
    setTimeout(() => {
      const p = pending.get(requestId);
      if (!p) return;
      pending.delete(requestId);
      reject(new Error("RPC_TIMEOUT"));
    }, 3000);
  });

type NwWrldSdk = {
  ModuleBase: typeof ModuleBase;
  BaseThreeJsModule: typeof BaseThreeJsModule;
  assetUrl?: (relPath: unknown) => unknown;
  readText?: (relPath: unknown) => Promise<unknown>;
  loadJson?: (relPath: unknown) => Promise<unknown>;
  listAssets?: (relDir: unknown) => Promise<string[]>;
};

const createSdk = () => {
  const sdk: NwWrldSdk = { ModuleBase, BaseThreeJsModule };

  const { assetUrl, readText, loadJson } = createSdkHelpers({
    normalizeRelPath: safeAssetRelPath,
    assetUrlImpl: (safeRelPath) => {
      if (!assetsBaseUrl) return null;
      const rel = typeof safeRelPath === "string" ? safeRelPath : null;
      if (!rel) return null;
      try {
        const base = ensureTrailingSlash(assetsBaseUrl);
        return new URL(rel, base).href;
      } catch {
        return null;
      }
    },
    readTextImpl: async (safeRelPath) => {
      const res = await rpcRequest("sdk:readAssetText", {
        relPath: safeRelPath,
      });
      if (!res || typeof res !== "object") return null;
      if (!("text" in res)) return null;
      const text = (res as { text?: unknown }).text;
      return typeof text === "string" ? text : null;
    },
  });

  sdk.assetUrl = assetUrl;
  sdk.readText = readText;
  sdk.loadJson = loadJson;
  sdk.listAssets = async (relDir) => {
    const safe = safeAssetRelPath(relDir);
    if (!safe) return [];
    try {
      const res = await rpcRequest("sdk:listAssets", { relDir: safe });
      const entries =
        res && typeof res === "object" && "entries" in res
          ? (res as { entries?: unknown }).entries
          : [];
      const list = Array.isArray(entries) ? entries : [];
      return list.filter((e) => typeof e === "string" && e.trim().length > 0);
    } catch {
      return [];
    }
  };

  return sdk;
};

globalThis.nwWrldSdk = createSdk();

const mergeMethodsByName = (baseMethods, declaredMethods) => {
  const out = new Map();
  const base = Array.isArray(baseMethods) ? baseMethods : [];
  const declared = Array.isArray(declaredMethods) ? declaredMethods : [];
  for (const m of base) {
    const name = m && typeof m.name === "string" ? m.name : null;
    if (name) out.set(name, m);
  }
  for (const m of declared) {
    const name = m && typeof m.name === "string" ? m.name : null;
    if (name) out.set(name, m);
  }
  return Array.from(out.values());
};

const getBaseMethodsForClass = (Cls) => {
  try {
    if (Cls?.prototype instanceof BaseThreeJsModule)
      return BaseThreeJsModule.methods;
    if (Cls?.prototype instanceof ModuleBase) return ModuleBase.methods;
  } catch {}
  return [];
};

const ensureRoot = () => {
  if (trackRoot && trackRoot.isConnected) return trackRoot;
  document.documentElement.style.width = "100%";
  document.documentElement.style.height = "100%";
  document.body.style.margin = "0";
  document.body.style.padding = "0";
  document.body.style.width = "100%";
  document.body.style.height = "100%";
  const el = document.createElement("div");
  el.id = "nwWrldTrackRoot";
  el.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;overflow:hidden;";
  document.body.appendChild(el);
  trackRoot = el;
  return trackRoot;
};

const getInstanceIndex = (trackModules, instanceId) => {
  const list = Array.isArray(trackModules) ? trackModules : [];
  const idx = list.findIndex((m) => m && m.id === instanceId);
  return idx >= 0 ? idx : 0;
};

const loadModuleClassFromSource = async (moduleType, sourceText) => {
  const injected = injectWorkspaceModuleImports(moduleType, sourceText);
  const blob = new Blob([injected], { type: "text/javascript" });
  const blobUrl = URL.createObjectURL(blob);
  try {
    const imported = await import(/* webpackIgnore: true */ blobUrl);
    const Cls = imported?.default || null;
    if (!Cls) {
      throw new Error(`[Sandbox] Module "${moduleType}" did not export default.`);
    }
    return Cls;
  } finally {
    try {
      URL.revokeObjectURL(blobUrl);
    } catch {}
  }
};

const getModuleClass = (moduleType, moduleSources) => {
  const safeType = String(moduleType || "").trim();
  if (!safeType) throw new Error("INVALID_MODULE_TYPE");
  if (moduleClassCache.has(safeType)) return moduleClassCache.get(safeType);
  const src = moduleSources?.[safeType];
  const text = typeof src?.text === "string" ? src.text : null;
  if (!text) throw new Error(`MISSING_SOURCE:${safeType}`);
  const p = loadModuleClassFromSource(safeType, text);
  moduleClassCache.set(safeType, p);
  return p;
};

const destroyTrack = () => {
  for (const [, entry] of instancesById.entries()) {
    const arr = Array.isArray(entry?.instances) ? entry.instances : [];
    for (const inst of arr) {
      try {
        if (inst && typeof inst.destroy === "function") inst.destroy();
      } catch {}
    }
  }
  instancesById.clear();
  moduleClassCache.clear();
  try {
    if (trackRoot && trackRoot.parentNode)
      trackRoot.parentNode.removeChild(trackRoot);
  } catch {}
  trackRoot = null;
};

const destroyInstance = (instanceId) => {
  const safeId = String(instanceId || "").trim();
  if (!safeId) return;
  try {
    const entry = instancesById.get(safeId) || null;
    const arr = Array.isArray(entry?.instances) ? entry.instances : [];
    for (const inst of arr) {
      try {
        if (inst && typeof inst.destroy === "function") inst.destroy();
      } catch {}
    }
  } catch {}
  try {
    const nodes = document.querySelectorAll(`[data-instance-id="${safeId}"]`);
    nodes.forEach((n) => {
      try {
        if (n.parentNode) {
          n.parentNode.removeChild(n);
        }
      } catch {}
    });
  } catch {}
  try {
    instancesById.delete(safeId);
  } catch {}
};

globalThis.nwSandboxIpc?.on?.(async (data) => {
  if (!data || typeof data !== "object") return;

  if (data.__nwWrldSandboxResult && data.token === TOKEN) {
    const { requestId } = data;
    const p = pending.get(requestId);
    if (!p) return;
    pending.delete(requestId);
    p.resolve(data.result);
    return;
  }

  if (!data.__nwWrldSandbox || data.token !== TOKEN) return;

  const type = data.type;
  const requestId = data.requestId;
  const props = data.props || {};

  const respond = (result) => {
    postToHost({
      __nwWrldSandboxResult: true,
      token: TOKEN,
      type,
      requestId,
      result,
    });
  };

  try {
    if (type === "destroyTrack") {
      destroyTrack();
      respond({ ok: true });
      return;
    }

    if (type === "initTrack") {
      destroyTrack();
      assetsBaseUrl = props.assetsBaseUrl || null;
      globalThis.nwWrldSdk = createSdk();

      const root = ensureRoot();
      const track = props.track || {};
      const trackModules = Array.isArray(track.modules) ? track.modules : [];
      const modulesData = track.modulesData || {};
      const moduleSources = props.moduleSources || {};

      for (const m of trackModules) {
        const instanceId = String(m?.id || "").trim();
        const moduleType = String(m?.type || "").trim();
        if (!instanceId || !moduleType) continue;
        try {
          const constructorMethods = Array.isArray(modulesData?.[instanceId]?.constructor)
            ? modulesData[instanceId].constructor
            : [];
          const matrixMethod =
            constructorMethods.find((mm) => mm?.name === "matrix") || null;
          const matrix = parseMatrixOptions(matrixMethod?.options);

          const zIndex = getInstanceIndex(trackModules, instanceId) + 1;
          const width = `${100 / matrix.cols}%`;
          const height = `${100 / matrix.rows}%`;
          const border = matrix.border ? "1px solid white" : "none";

          const ModuleClass = await getModuleClass(moduleType, moduleSources);
          const instances = [];

          for (let row = 1; row <= matrix.rows; row++) {
            for (let col = 1; col <= matrix.cols; col++) {
              const cellKey = `${row}-${col}`;
              if (matrix.excludedCells.includes(cellKey)) continue;
              const el = document.createElement("div");
              el.className = `module z-index-container ${moduleType}`;
              el.dataset.instanceId = instanceId;
              const top = `${(100 / matrix.rows) * (row - 1)}%`;
              const left = `${(100 / matrix.cols) * (col - 1)}%`;
              el.style.cssText = [
                "position:absolute",
                `width:${width}`,
                `height:${height}`,
                `top:${top}`,
                `left:${left}`,
                `z-index:${zIndex}`,
                `border:${border}`,
                "overflow:hidden",
                "transform-origin:center",
              ].join(";");
              root.appendChild(el);
              const inst = new ModuleClass(el);
              instances.push(inst);
            }
          }

          instancesById.set(instanceId, { moduleType, instances });

          const nonMatrix = constructorMethods.filter(
            (mm) => mm?.name && mm.name !== "matrix"
          );
          for (const mm of nonMatrix) {
            const methodName = String(mm.name || "").trim();
            if (!methodName) continue;
            const opts = buildMethodOptions(mm.options);
            for (const inst of instances) {
              const fn = inst?.[methodName];
              if (typeof fn !== "function") continue;
              const r = fn.call(inst, opts);
              if (r && typeof r.then === "function") await r;
            }
          }
        } catch (e) {
          respond({ ok: false, error: e?.message || "SANDBOX_ERROR", moduleType });
          return;
        }
      }

      respond({ ok: true });
      return;
    }

    if (type === "invokeOnInstance") {
      const instanceId = String(props.instanceId || "").trim();
      const methodName = String(props.methodName || "").trim();
      const options = props.options || {};
      const entry = instancesById.get(instanceId);
      const arr = Array.isArray(entry?.instances) ? entry.instances : [];
      if (!arr.length) {
        respond({ ok: false, error: "INSTANCE_NOT_FOUND" });
        return;
      }
      for (const inst of arr) {
        const fn = inst?.[methodName];
        if (typeof fn !== "function") continue;
        const r = fn.call(inst, options);
        if (r && typeof r.then === "function") await r;
      }
      respond({ ok: true });
      return;
    }

    if (type === "setMatrixForInstance") {
      const instanceId = String(props.instanceId || "").trim();
      const track = props.track || {};
      const trackModules = Array.isArray(track.modules) ? track.modules : [];
      const modulesData = track.modulesData || {};
      const moduleSources = props.moduleSources || {};
      assetsBaseUrl = props.assetsBaseUrl || assetsBaseUrl || null;
      globalThis.nwWrldSdk = createSdk();

      if (!instanceId) {
        respond({ ok: false, error: "INVALID_INSTANCE_ID" });
        return;
      }
      const moduleEntry =
        trackModules.find((m) => m && m.id === instanceId) || null;
      const moduleType = String(moduleEntry?.type || "").trim();
      if (!moduleType) {
        respond({ ok: false, error: "INSTANCE_NOT_IN_TRACK" });
        return;
      }

      try {
        const matrix = parseMatrixOptions(props.matrixOptions);
        destroyInstance(instanceId);

        const root = ensureRoot();
        const zIndex = getInstanceIndex(trackModules, instanceId) + 1;
        const width = `${100 / matrix.cols}%`;
        const height = `${100 / matrix.rows}%`;
        const border = matrix.border ? "1px solid white" : "none";

        const ctor = Array.isArray(modulesData?.[instanceId]?.constructor)
          ? modulesData[instanceId].constructor
          : [];
        const nonMatrix = ctor.filter((mm) => mm?.name && mm.name !== "matrix");

        const ModuleClass = await getModuleClass(moduleType, moduleSources);
        const instances = [];
        for (let row = 1; row <= matrix.rows; row++) {
          for (let col = 1; col <= matrix.cols; col++) {
            const cellKey = `${row}-${col}`;
            if (matrix.excludedCells.includes(cellKey)) continue;
            const el = document.createElement("div");
            el.className = `module z-index-container ${moduleType}`;
            el.dataset.instanceId = instanceId;
            const top = `${(100 / matrix.rows) * (row - 1)}%`;
            const left = `${(100 / matrix.cols) * (col - 1)}%`;
            el.style.cssText = [
              "position:absolute",
              `width:${width}`,
              `height:${height}`,
              `top:${top}`,
              `left:${left}`,
              `z-index:${zIndex}`,
              `border:${border}`,
              "overflow:hidden",
              "transform-origin:center",
            ].join(";");
            root.appendChild(el);
            const inst = new ModuleClass(el);
            instances.push(inst);
          }
        }

        instancesById.set(instanceId, { moduleType, instances });

        for (const mm of nonMatrix) {
          const methodName = String(mm.name || "").trim();
          if (!methodName) continue;
          const opts = buildMethodOptions(mm.options);
          for (const inst of instances) {
            const fn = inst?.[methodName];
            if (typeof fn !== "function") continue;
            const r = fn.call(inst, opts);
            if (r && typeof r.then === "function") await r;
          }
        }
      } catch (e) {
        respond({ ok: false, error: e?.message || "SANDBOX_ERROR", moduleType });
        return;
      }

      respond({ ok: true });
      return;
    }

    if (type === "introspectModule") {
      const moduleType = String(props.moduleType || "").trim();
      const sourceText = String(props.sourceText || "");
      const ModuleClass = await loadModuleClassFromSource(moduleType, sourceText);
      const callable = getCallableMethodNamesFromClass(ModuleClass);
      const baseMethods = getBaseMethodsForClass(ModuleClass);
      const declaredMethods = Array.isArray(ModuleClass?.methods)
        ? ModuleClass.methods
        : [];
      const methods = mergeMethodsByName(baseMethods, declaredMethods);
      respond({
        ok: true,
        callableMethods: callable,
        name:
          ModuleClass?.displayName ||
          ModuleClass?.title ||
          ModuleClass?.label ||
          ModuleClass?.name ||
          moduleType,
        category: ModuleClass?.category || "Workspace",
        methods,
      });
      return;
    }

    respond({ ok: false, error: "UNKNOWN_MESSAGE_TYPE" });
  } catch (e) {
    respond({ ok: false, error: e?.message || "SANDBOX_ERROR" });
  }
});

postToHost({ __nwWrldSandboxReady: true, token: TOKEN });

const perfToken = typeof TOKEN === "string" ? TOKEN : null;
if (perfToken) {
  let lastFrameAt = performance.now();
  let reportStartedAt = lastFrameAt;
  let frames = 0;
  let sumDt = 0;
  let longFrames = 0;

  const REPORT_MS = 1000;
  const LONG_FRAME_MS = 34;

  const tick = () => {
    const now = performance.now();
    const dt = now - lastFrameAt;
    lastFrameAt = now;

    if (dt > 0 && Number.isFinite(dt)) {
      frames += 1;
      sumDt += dt;
      if (dt >= LONG_FRAME_MS) longFrames += 1;
    }

    const elapsed = now - reportStartedAt;
    if (elapsed >= REPORT_MS && frames > 0) {
      const fps = (frames * 1000) / elapsed;
      const frameMsAvg = sumDt / frames;
      const longFramePct = (longFrames / frames) * 100;
      postToHost({
        "__nwWrldSandboxPerf": true,
        token: perfToken,
        stats: {
          fps,
          frameMsAvg,
          longFramePct,
          at: Date.now(),
        },
      });
      reportStartedAt = now;
      frames = 0;
      sumDt = 0;
      longFrames = 0;
    }

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}


