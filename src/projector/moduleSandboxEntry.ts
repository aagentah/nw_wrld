import ModuleBase from "./helpers/moduleBase";
import BaseThreeJsModule from "./helpers/threeBase";
import * as THREE from "three";
import p5 from "p5";
import * as d3 from "d3";
import { Noise } from "noisejs";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import { PCDLoader } from "three/addons/loaders/PCDLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import docblock from "../shared/nwWrldDocblock";
import {
  buildMethodOptions,
  parseMatrixOptions,
  type MethodOptionEntry,
} from "../shared/utils/methodOptions";
import { createSdkHelpers } from "../shared/utils/sdkHelpers";

const { parseNwWrldDocblockMetadata } = docblock || {};

if (!globalThis.THREE) globalThis.THREE = THREE;
if (!globalThis.p5) globalThis.p5 = p5;
if (!globalThis.d3) globalThis.d3 = d3;
if (!globalThis.Noise) globalThis.Noise = Noise;
if (!globalThis.OBJLoader) globalThis.OBJLoader = OBJLoader;
if (!globalThis.PLYLoader) globalThis.PLYLoader = PLYLoader;
if (!globalThis.PCDLoader) globalThis.PCDLoader = PCDLoader;
if (!globalThis.GLTFLoader) globalThis.GLTFLoader = GLTFLoader;
if (!globalThis.STLLoader) globalThis.STLLoader = STLLoader;

const getTokenFromLocation = (): string | null => {
  try {
    const hash = String(window.location.hash || "");
    const raw = hash.startsWith("#") ? hash.slice(1) : hash;
    const params = new URLSearchParams(raw);
    const token = params.get("token");
    return token ? String(token) : null;
  } catch {
    return null;
  }
};

const TOKEN =
  getTokenFromLocation() || globalThis.__NW_WRLD_SANDBOX_TOKEN__ || null;

const WORKSPACE_MODULE_ALLOWED_IMPORTS = new Set([
  "ModuleBase",
  "BaseThreeJsModule",
  "assetUrl",
  "readText",
  "loadJson",
  "listAssets",
  "THREE",
  "p5",
  "d3",
  "Noise",
  "OBJLoader",
  "PLYLoader",
  "PCDLoader",
  "GLTFLoader",
  "STLLoader",
]);

const safeAssetRelPath = (relPath: string): string | null => {
  const raw = String(relPath ?? "").trim();
  if (!raw) return null;
  if (raw.includes(":")) return null;
  if (raw.startsWith("/") || raw.startsWith("\\")) return null;
  if (/^[A-Za-z]:[\\/]/.test(raw)) return null;
  if (raw.includes("\\")) return null;
  const parts = raw.split("/").filter(Boolean);
  if (!parts.length) return null;
  for (const p of parts) {
    if (p === "." || p === "") continue;
    if (p === "..") return null;
  }
  return parts.join("/");
};

const ensureTrailingSlash = (url: string): string => {
  const s = String(url || "");
  return s.endsWith("/") ? s : `${s}/`;
};

const buildWorkspaceImportPreamble = (moduleId: string, importsList: string[]): string => {
  const requested = Array.isArray(importsList) ? importsList : [];
  if (!requested.length) {
    throw new Error(
      `[Sandbox] Workspace module "${moduleId}" missing required @nwWrld imports.`
    );
  }
  for (const token of requested) {
    if (!WORKSPACE_MODULE_ALLOWED_IMPORTS.has(token)) {
      throw new Error(
        `[Sandbox] Workspace module "${moduleId}" requested unknown import "${token}".`
      );
    }
  }

  const sdkImports = requested.filter(
    (t): t is "ModuleBase" | "BaseThreeJsModule" | "assetUrl" | "readText" | "loadJson" | "listAssets" =>
      t === "ModuleBase" ||
      t === "BaseThreeJsModule" ||
      t === "assetUrl" ||
      t === "readText" ||
      t === "loadJson" ||
      t === "listAssets"
  );
  const globalImports = requested.filter((t) => !sdkImports.includes(t as any));

  const lines: string[] = [];
  if (sdkImports.length) {
    lines.push(
      `const { ${sdkImports.join(", ")} } = globalThis.nwWrldSdk || {};`
    );
  }
  for (const g of globalImports) {
    lines.push(`const ${g} = globalThis.${g};`);
  }
  for (const token of requested) {
    lines.push(
      `if (!${token}) { throw new Error("Missing required import: ${token}"); }`
    );
  }
  return `${lines.join("\n")}\n`;
};

const injectWorkspaceModuleImports = (moduleId: string, sourceText: string): string => {
  if (typeof parseNwWrldDocblockMetadata !== "function") {
    throw new Error(`[Sandbox] Docblock parser is unavailable.`);
  }
  const meta = parseNwWrldDocblockMetadata(sourceText);
  const preamble = buildWorkspaceImportPreamble(moduleId, meta?.imports || []);

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

const getCallableMethodNames = (instance: unknown): string[] => {
  const names = new Set<string>();
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

const getCallableMethodNamesFromClass = (Cls: unknown): string[] => {
  const names = new Set<string>();
  let proto = Cls && (Cls as { prototype?: unknown }).prototype ? (Cls as { prototype: unknown }).prototype : null;
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

let assetsBaseUrl: string | null = null;
let trackRoot: HTMLDivElement | null = null;
const moduleClassCache = new Map<string, Promise<unknown>>();
const instancesById = new Map<string, { moduleType: string; instances: unknown[] }>();

let rpcSeq = 0;
const pending = new Map<string, { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }>();

interface SandboxPayload {
  __nwWrldSandbox?: boolean;
  __nwWrldSandboxResult?: boolean;
  __nwWrldSandboxReady?: boolean;
  token: string | null;
  type?: string;
  requestId?: string;
  props?: Record<string, unknown>;
  result?: unknown;
}

const postToHost = (payload: SandboxPayload): void => {
  try {
    globalThis.nwSandboxIpc?.send?.(payload);
  } catch {}
};

const rpcRequest = (type: string, props: Record<string, unknown> = {}): Promise<unknown> =>
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

const createSdk = () => {
  const sdk: Record<string, unknown> = { ModuleBase, BaseThreeJsModule };

  const { assetUrl, readText, loadJson } = createSdkHelpers({
    normalizeRelPath: safeAssetRelPath,
    assetUrlImpl: (safeRelPath: string) => {
      if (!assetsBaseUrl) return null;
      try {
        const base = ensureTrailingSlash(assetsBaseUrl);
        return new URL(safeRelPath, base).href;
      } catch {
        return null;
      }
    },
    readTextImpl: async (safeRelPath: string) => {
      const res = await rpcRequest("sdk:readAssetText", {
        relPath: safeRelPath,
      }) as { text?: string } | undefined;
      return typeof res?.text === "string" ? res.text : null;
    },
  });

  sdk.assetUrl = assetUrl;
  sdk.readText = readText;
  sdk.loadJson = loadJson;
  sdk.listAssets = async (relDir: string) => {
    const safe = safeAssetRelPath(relDir);
    if (!safe) return [];
    try {
      const res = await rpcRequest("sdk:listAssets", { relDir: safe }) as { entries?: string[] } | undefined;
      const entries = Array.isArray(res?.entries) ? res.entries : [];
      return entries.filter(
        (e) => typeof e === "string" && e.trim().length > 0
      );
    } catch {
      return [];
    }
  };

  return sdk;
};

globalThis.nwWrldSdk = createSdk();

const mergeMethodsByName = (
  baseMethods: unknown[],
  declaredMethods: unknown[]
): unknown[] => {
  const out = new Map<string, unknown>();
  const base = Array.isArray(baseMethods) ? baseMethods : [];
  const declared = Array.isArray(declaredMethods) ? declaredMethods : [];
  for (const m of base) {
    const name = m && typeof m === "object" && typeof (m as { name?: unknown }).name === "string" ? (m as { name: string }).name : null;
    if (name) out.set(name, m);
  }
  for (const m of declared) {
    const name = m && typeof m === "object" && typeof (m as { name?: unknown }).name === "string" ? (m as { name: string }).name : null;
    if (name) out.set(name, m);
  }
  return Array.from(out.values());
};

const getBaseMethodsForClass = (Cls: unknown): unknown[] => {
  try {
    if (Cls && (Cls as { prototype?: unknown }).prototype) {
      const proto = (Cls as { prototype: unknown }).prototype;
      if (proto instanceof BaseThreeJsModule)
        return BaseThreeJsModule.methods;
      if (proto instanceof ModuleBase) return ModuleBase.methods;
    }
  } catch {}
  return [];
};

const ensureRoot = (): HTMLDivElement => {
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

const getInstanceIndex = (trackModules: unknown[], instanceId: string): number => {
  const list = Array.isArray(trackModules) ? trackModules : [];
  const idx = list.findIndex((m) => m && typeof m === "object" && (m as { id?: unknown }).id === instanceId);
  return idx >= 0 ? idx : 0;
};

const loadModuleClassFromSource = async (moduleType: string, sourceText: string): Promise<unknown> => {
  const injected = injectWorkspaceModuleImports(moduleType, sourceText);
  const blob = new Blob([injected], { type: "text/javascript" });
  const blobUrl = URL.createObjectURL(blob);
  try {
    const imported = await import(/* webpackIgnore: true */ blobUrl);
    const Cls = imported?.default || null;
    if (!Cls) {
      throw new Error(
        `[Sandbox] Module "${moduleType}" did not export default.`
      );
    }
    return Cls;
  } finally {
    try {
      URL.revokeObjectURL(blobUrl);
    } catch {}
  }
};

const getModuleClass = (moduleType: string, moduleSources: Record<string, { text?: string }>): Promise<unknown> => {
  const safeType = String(moduleType || "").trim();
  if (!safeType) throw new Error("INVALID_MODULE_TYPE");
  if (moduleClassCache.has(safeType)) return moduleClassCache.get(safeType) as Promise<unknown>;
  const src = moduleSources?.[safeType];
  const text = typeof src?.text === "string" ? src.text : null;
  if (!text) throw new Error(`MISSING_SOURCE:${safeType}`);
  const p = loadModuleClassFromSource(safeType, text);
  moduleClassCache.set(safeType, p);
  return p;
};

const destroyTrack = (): void => {
  for (const [, entry] of instancesById.entries()) {
    const arr = Array.isArray(entry?.instances) ? entry.instances : [];
    for (const inst of arr) {
      try {
        if (inst && typeof inst === "object" && typeof (inst as { destroy?: unknown }).destroy === "function") (inst as { destroy: () => void }).destroy();
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

const destroyInstance = (instanceId: string): void => {
  const safeId = String(instanceId || "").trim();
  if (!safeId) return;
  try {
    const entry = instancesById.get(safeId) || null;
    const arr = Array.isArray(entry?.instances) ? entry.instances : [];
    for (const inst of arr) {
      try {
        if (inst && typeof inst === "object" && typeof (inst as { destroy?: unknown }).destroy === "function") (inst as { destroy: () => void }).destroy();
      } catch {}
    }
  } catch {}
  try {
    const nodes = document.querySelectorAll(`[data-instance-id="${safeId}"]`);
    nodes.forEach((n) => {
      try {
        n.parentNode && n.parentNode.removeChild(n);
      } catch {}
    });
  } catch {}
  try {
    instancesById.delete(safeId);
  } catch {}
};

globalThis.nwSandboxIpc?.on?.(async (data: SandboxPayload) => {
  if (!data || typeof data !== "object") return;

  if (data.__nwWrldSandboxResult && data.token === TOKEN) {
    const { requestId } = data;
    const p = pending.get(requestId || "");
    if (!p) return;
    pending.delete(requestId || "");
    p.resolve(data.result);
    return;
  }

  if (!data.__nwWrldSandbox || data.token !== TOKEN) return;

  const type = data.type;
  const requestId = data.requestId;
  const props = (data.props || {}) as Record<string, unknown>;

  const respond = (result: unknown): void => {
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
      assetsBaseUrl = (props.assetsBaseUrl as string | null) || null;
      globalThis.nwWrldSdk = createSdk();

      const root = ensureRoot();
      const track = props.track as Record<string, unknown> | undefined;
      const trackModules = Array.isArray(track?.modules) ? track.modules : [];
      const modulesData = (track?.modulesData as Record<string, unknown>) || {};
      const moduleSources = (props.moduleSources as Record<string, { text?: string }>) || {};

      for (const m of trackModules) {
        if (!m || typeof m !== "object") continue;
        const instanceId = String((m as { id?: unknown }).id || "").trim();
        const moduleType = String((m as { type?: unknown }).type || "").trim();
        if (!instanceId || !moduleType) continue;

        const instanceData = modulesData[instanceId] as { constructor?: unknown[] } | undefined;
        const constructorMethods = Array.isArray(instanceData?.constructor)
          ? instanceData.constructor
          : [];
        const matrixMethod =
          constructorMethods.find((mm) => mm && typeof mm === "object" && (mm as { name?: unknown }).name === "matrix") || null;
        const matrix = parseMatrixOptions(matrixMethod && typeof matrixMethod === "object" ? (matrixMethod as { options?: MethodOptionEntry<unknown>[] }).options : undefined);

        const zIndex = getInstanceIndex(trackModules, instanceId) + 1;
        const width = `${100 / (matrix?.cols || 1)}%`;
        const height = `${100 / (matrix?.rows || 1)}%`;
        const border = matrix?.border ? "1px solid white" : "none";

        const ModuleClass = await getModuleClass(moduleType, moduleSources) as (new (el: HTMLElement) => unknown) | undefined;
        const instances: unknown[] = [];

        const rows = matrix?.rows || 1;
        const cols = matrix?.cols || 1;
        const excludedCells = (matrix?.excludedCells || []).map(String);

        for (let row = 1; row <= rows; row++) {
          for (let col = 1; col <= cols; col++) {
            const cellKey = `${row}-${col}`;
            if (excludedCells.includes(cellKey)) continue;
            const el = document.createElement("div");
            el.className = `module z-index-container ${moduleType}`;
            el.dataset.instanceId = instanceId;
            const top = `${(100 / rows) * (row - 1)}%`;
            const left = `${(100 / cols) * (col - 1)}%`;
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
            const inst = ModuleClass ? new ModuleClass(el) : null;
            if (inst) instances.push(inst);
          }
        }

        instancesById.set(instanceId, { moduleType, instances });

        const nonMatrix = constructorMethods.filter(
          (mm) => mm && typeof mm === "object" && (mm as { name?: unknown }).name && (mm as { name: string }).name !== "matrix"
        );
        for (const mm of nonMatrix) {
          if (!mm || typeof mm !== "object") continue;
          const methodName = String((mm as { name?: unknown }).name || "").trim();
          if (!methodName) continue;
          const opts = buildMethodOptions((mm as { options?: MethodOptionEntry<unknown>[] }).options);
          for (const inst of instances) {
            const fn = inst && typeof inst === "object" ? (inst as Record<string, unknown>)[methodName] : undefined;
            if (typeof fn !== "function") continue;
            const r = fn.call(inst, opts);
            if (r && typeof r === "object" && typeof (r as { then?: unknown }).then === "function") await (r as Promise<unknown>);
          }
        }
      }

      respond({ ok: true });
      return;
    }

    if (type === "invokeOnInstance") {
      const instanceId = String(props.instanceId || "").trim();
      const methodName = String(props.methodName || "").trim();
      const options = (props.options || {}) as Record<string, unknown>;
      const entry = instancesById.get(instanceId);
      const arr = Array.isArray(entry?.instances) ? entry.instances : [];
      if (!arr.length) {
        respond({ ok: false, error: "INSTANCE_NOT_FOUND" });
        return;
      }
      for (const inst of arr) {
        const fn = inst && typeof inst === "object" ? (inst as Record<string, unknown>)[methodName] : undefined;
        if (typeof fn !== "function") continue;
        const r = fn.call(inst, options);
        if (r && typeof r === "object" && typeof (r as { then?: unknown }).then === "function") await (r as Promise<unknown>);
      }
      respond({ ok: true });
      return;
    }

    if (type === "setMatrixForInstance") {
      const instanceId = String(props.instanceId || "").trim();
      const track = (props.track as Record<string, unknown> | undefined) || {};
      const trackModules = Array.isArray(track.modules) ? track.modules : [];
      const modulesData = (track.modulesData as Record<string, unknown>) || {};
      const moduleSources = (props.moduleSources as Record<string, { text?: string }>) || {};
      assetsBaseUrl = (props.assetsBaseUrl as string | null) || assetsBaseUrl || null;
      globalThis.nwWrldSdk = createSdk();

      if (!instanceId) {
        respond({ ok: false, error: "INVALID_INSTANCE_ID" });
        return;
      }
      const moduleEntry =
        trackModules.find((m) => m && typeof m === "object" && (m as { id?: unknown }).id === instanceId) || null;
      const moduleType = String(moduleEntry?.type || "").trim();
      if (!moduleType) {
        respond({ ok: false, error: "INSTANCE_NOT_IN_TRACK" });
        return;
      }

      const matrix = parseMatrixOptions(props.matrixOptions as MethodOptionEntry<unknown>[]);
      destroyInstance(instanceId);

      const root = ensureRoot();
      const zIndex = getInstanceIndex(trackModules, instanceId) + 1;
      const width = `${100 / (matrix?.cols || 1)}%`;
      const height = `${100 / (matrix?.rows || 1)}%`;
      const border = matrix?.border ? "1px solid white" : "none";

      const instanceData = modulesData[instanceId] as { constructor?: unknown[] } | undefined;
      const ctor = Array.isArray(instanceData?.constructor)
        ? instanceData.constructor
        : [];
      const nonMatrix = ctor.filter((mm) => mm && typeof mm === "object" && (mm as { name?: unknown }).name && (mm as { name: string }).name !== "matrix");

      const ModuleClass = await getModuleClass(moduleType, moduleSources) as (new (el: HTMLElement) => unknown) | undefined;
      const instances: unknown[] = [];
      const rows = matrix?.rows || 1;
      const cols = matrix?.cols || 1;
      const excludedCells = (matrix?.excludedCells || []).map(String);

      for (let row = 1; row <= rows; row++) {
        for (let col = 1; col <= cols; col++) {
          const cellKey = `${row}-${col}`;
          if (excludedCells.includes(cellKey)) continue;
          const el = document.createElement("div");
          el.className = `module z-index-container ${moduleType}`;
          el.dataset.instanceId = instanceId;
          const top = `${(100 / rows) * (row - 1)}%`;
          const left = `${(100 / cols) * (col - 1)}%`;
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
          const inst = ModuleClass ? new ModuleClass(el) : null;
          if (inst) instances.push(inst);
        }
      }

      instancesById.set(instanceId, { moduleType, instances });

      for (const mm of nonMatrix) {
        if (!mm || typeof mm !== "object") continue;
        const methodName = String((mm as { name?: unknown }).name || "").trim();
        if (!methodName) continue;
        const opts = buildMethodOptions((mm as { options?: MethodOptionEntry<unknown>[] }).options);
        for (const inst of instances) {
          const fn = inst && typeof inst === "object" ? (inst as Record<string, unknown>)[methodName] : undefined;
          if (typeof fn !== "function") continue;
          const r = fn.call(inst, opts);
          if (r && typeof r === "object" && typeof (r as { then?: unknown }).then === "function") await (r as Promise<unknown>);
        }
      }

      respond({ ok: true });
      return;
    }

    if (type === "introspectModule") {
      const moduleType = String(props.moduleType || "").trim();
      const sourceText = String(props.sourceText || "");
      const ModuleClass = await loadModuleClassFromSource(
        moduleType,
        sourceText
      );
      const callable = getCallableMethodNamesFromClass(ModuleClass);
      const baseMethods = getBaseMethodsForClass(ModuleClass);
      const declaredMethods = Array.isArray((ModuleClass as { methods?: unknown[] }).methods)
        ? (ModuleClass as { methods: unknown[] }).methods
        : [];
      const methods = mergeMethodsByName(baseMethods, declaredMethods);
      respond({
        ok: true,
        callableMethods: callable,
        name:
          (ModuleClass as { displayName?: string; title?: string; label?: string; name?: string }).displayName ||
          (ModuleClass as { displayName?: string; title?: string; label?: string; name?: string }).title ||
          (ModuleClass as { displayName?: string; title?: string; label?: string; name?: string }).label ||
          (ModuleClass as { displayName?: string; title?: string; label?: string; name?: string }).name ||
          moduleType,
        category: (ModuleClass as { category?: string }).category || "Workspace",
        methods,
      });
      return;
    }

    respond({ ok: false, error: "UNKNOWN_MESSAGE_TYPE" });
  } catch (e) {
    respond({ ok: false, error: (e as { message?: string })?.message || "SANDBOX_ERROR" });
  }
});

postToHost({ __nwWrldSandboxReady: true, token: TOKEN });
