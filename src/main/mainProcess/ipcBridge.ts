import { app, clipboard, ipcMain, shell } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import InputManager from "../InputManager";
import { srcDir, state } from "./state";
import {
  isExistingDirectory,
  resolveWithinDir,
  safeJsonFilename,
  safeModuleName,
} from "./pathSafety";
import {
  getJsonDirForBridge,
  getJsonStatusForProject,
  maybeMigrateLegacyJsonFileForBridge,
} from "./workspace";
import { atomicWriteFile, atomicWriteFileSync } from "../../shared/json/atomicWrite";
import { readJsonWithBackup, readJsonWithBackupSync } from "../../shared/json/readJsonWithBackup";
import { parseNwWrldDocblockMetadata } from "../../shared/nwWrldDocblock";
import { sanitizeJsonForBridge } from "../../shared/validation/jsonBridgeValidation";
import { normalizeInputConfig } from "../../shared/validation/inputConfigValidation";
import {
  escapeRegExpLiteral,
  normalizeGetMethodCodeArgs,
} from "../../shared/validation/methodCodeRequestValidation";
import { normalizeOpenExternalUrl } from "../../shared/validation/openExternalValidation";
import {
  normalizeModuleSummaries,
  normalizeModuleUrlResult,
  normalizeModuleWithMeta,
} from "../../shared/validation/workspaceValidation";
import { getOrCreateGlobalMockWebMidi } from "../testing/mockWebMidi";

type WebContentsWithId = { id?: unknown };
type SenderEvent = { sender?: WebContentsWithId };
type Jsonish = string | number | boolean | null | undefined | object;

const getProjectDirForEvent = (event: SenderEvent): string | null => {
  try {
    const senderId = event?.sender?.id;
    if (typeof senderId === "number" && state.webContentsToProjectDir.has(senderId)) {
      return state.webContentsToProjectDir.get(senderId) || null;
    }
  } catch {}
  return state.currentProjectDir || null;
};

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

const stripIsDefaultDataFlag = (v: unknown): unknown => {
  if (!isPlainObject(v)) return v;
  if (!("_isDefaultData" in v)) return v;
  const out = { ...v };
  delete (out as { _isDefaultData?: unknown })._isDefaultData;
  return out;
};

const MODULE_METADATA_MAX_BYTES = 16 * 1024;

const readFileHeadUtf8 = async (filePath: string, maxBytes: number): Promise<string> => {
  let fh: fs.promises.FileHandle | undefined;
  try {
    fh = await fs.promises.open(filePath, "r");
    const buf = Buffer.alloc(Math.max(0, Number(maxBytes) || 0));
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
    return buf.slice(0, bytesRead).toString("utf-8");
  } catch {
    return "";
  } finally {
    try {
      await fh?.close?.();
    } catch {}
  }
};

export function registerIpcBridge(): void {
  ipcMain.on("bridge:project:getDir", (event) => {
    event.returnValue = getProjectDirForEvent(event as unknown as SenderEvent);
  });
  ipcMain.on("bridge:project:isRequired", (event) => {
    event.returnValue = true;
  });
  ipcMain.on("bridge:project:isDirAvailable", (event) => {
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    event.returnValue = Boolean(projectDir && isExistingDirectory(projectDir));
  });

  ipcMain.handle("bridge:workspace:listModuleFiles", async (event) => {
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    if (!projectDir || !isExistingDirectory(projectDir)) return [];
    const modulesDir = path.join(projectDir, "modules");
    try {
      const entries = await fs.promises.readdir(modulesDir);
      return entries.filter((f) => String(f).endsWith(".js"));
    } catch {
      return [];
    }
  });

  ipcMain.handle("bridge:workspace:listModuleSummaries", async (event) => {
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    if (!projectDir || !isExistingDirectory(projectDir)) return [];
    const modulesDir = path.join(projectDir, "modules");

    let entries: string[] = [];
    try {
      entries = await fs.promises.readdir(modulesDir);
    } catch {
      entries = [];
    }

    const jsFiles = entries.filter((f) => String(f).endsWith(".js"));

    const summaries = await Promise.all(
      jsFiles.map(async (file) => {
        const filename = String(file);
        const moduleId = filename.replace(/\.js$/i, "");
        const safe = safeModuleName(moduleId);
        if (!safe) return null;
        const fullPath = resolveWithinDir(modulesDir, `${safe}.js`);
        if (!fullPath) return null;

        const head = await readFileHeadUtf8(fullPath, MODULE_METADATA_MAX_BYTES);
        const meta = parseNwWrldDocblockMetadata(head, MODULE_METADATA_MAX_BYTES);

        return {
          file: filename,
          id: safe,
          name: meta.name,
          category: meta.category,
          hasMetadata: meta.hasMetadata,
        };
      })
    );

    return normalizeModuleSummaries(summaries);
  });

  ipcMain.handle("bridge:workspace:readModuleWithMeta", async (event, moduleName) => {
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    if (!projectDir || !isExistingDirectory(projectDir)) return null;
    const safe = safeModuleName(moduleName);
    if (!safe) return null;
    const modulesDir = path.join(projectDir, "modules");
    const fullPath = resolveWithinDir(modulesDir, `${safe}.js`);
    if (!fullPath) return null;
    try {
      const [stat, text] = await Promise.all([
        fs.promises.stat(fullPath),
        fs.promises.readFile(fullPath, "utf-8"),
      ]);
      return normalizeModuleWithMeta({ text, mtimeMs: stat.mtimeMs });
    } catch {
      return null;
    }
  });

  ipcMain.handle("bridge:workspace:getModuleUrl", async (event, moduleName) => {
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    if (!projectDir || !isExistingDirectory(projectDir)) return null;
    const safe = safeModuleName(moduleName);
    if (!safe) return null;
    const modulesDir = path.join(projectDir, "modules");
    const fullPath = resolveWithinDir(modulesDir, `${safe}.js`);
    if (!fullPath) return null;
    try {
      const stat = await fs.promises.stat(fullPath);
      const url = `${pathToFileURL(fullPath).href}?t=${stat.mtimeMs}`;
      return normalizeModuleUrlResult({ url, mtimeMs: stat.mtimeMs });
    } catch {
      return null;
    }
  });

  ipcMain.handle("bridge:workspace:readModuleText", async (event, moduleName) => {
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    if (!projectDir || !isExistingDirectory(projectDir)) return null;
    const safe = safeModuleName(moduleName);
    if (!safe) return null;
    const modulesDir = path.join(projectDir, "modules");
    const fullPath = resolveWithinDir(modulesDir, `${safe}.js`);
    if (!fullPath) return null;
    try {
      return await fs.promises.readFile(fullPath, "utf-8");
    } catch {
      return null;
    }
  });

  ipcMain.on("bridge:workspace:writeModuleTextSync", (event, moduleName, text) => {
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    if (!projectDir || !isExistingDirectory(projectDir)) {
      event.returnValue = { ok: false, reason: "PROJECT_DIR_MISSING" };
      return;
    }
    const safe = safeModuleName(moduleName);
    if (!safe) {
      event.returnValue = { ok: false, reason: "INVALID_MODULE_NAME" };
      return;
    }
    const modulesDir = path.join(projectDir, "modules");
    const fullPath = resolveWithinDir(modulesDir, `${safe}.js`);
    if (!fullPath) {
      event.returnValue = { ok: false, reason: "INVALID_MODULE_PATH" };
      return;
    }
    try {
      try {
        fs.mkdirSync(modulesDir, { recursive: true });
      } catch {}
      atomicWriteFileSync(fullPath, String(text ?? ""));
      event.returnValue = { ok: true, path: fullPath };
    } catch (e) {
      event.returnValue = {
        ok: false,
        reason: e instanceof Error ? e.message : "WRITE_FAILED",
      };
    }
  });

  ipcMain.on("bridge:workspace:moduleExists", (event, moduleName) => {
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    if (!projectDir || !isExistingDirectory(projectDir)) {
      event.returnValue = false;
      return;
    }
    const safe = safeModuleName(moduleName);
    if (!safe) {
      event.returnValue = false;
      return;
    }
    const modulesDir = path.join(projectDir, "modules");
    const fullPath = resolveWithinDir(modulesDir, `${safe}.js`);
    if (!fullPath) {
      event.returnValue = false;
      return;
    }
    try {
      event.returnValue = fs.existsSync(fullPath);
    } catch {
      event.returnValue = false;
    }
  });

  ipcMain.on("bridge:workspace:showModuleInFolder", (event, moduleName) => {
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    if (!projectDir || !isExistingDirectory(projectDir)) return;
    const safe = safeModuleName(moduleName);
    if (!safe) return;
    const modulesDir = path.join(projectDir, "modules");
    const fullPath = resolveWithinDir(modulesDir, `${safe}.js`);
    if (!fullPath) return;
    try {
      shell.showItemInFolder(fullPath);
    } catch {}
  });

  ipcMain.on("bridge:workspace:assetUrl", (event, relPath) => {
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    if (!projectDir || !isExistingDirectory(projectDir)) {
      event.returnValue = null;
      return;
    }
    const assetsDir = path.join(projectDir, "assets");
    const fullPath = resolveWithinDir(assetsDir, String(relPath || ""));
    if (!fullPath) {
      event.returnValue = null;
      return;
    }
    try {
      event.returnValue = pathToFileURL(fullPath).href;
    } catch {
      event.returnValue = null;
    }
  });

  ipcMain.handle("bridge:workspace:listAssets", async (event, relDir) => {
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    if (!projectDir || !isExistingDirectory(projectDir)) {
      return { ok: false, files: [], dirs: [] };
    }
    const assetsDir = path.join(projectDir, "assets");
    const fullPath = resolveWithinDir(assetsDir, String(relDir || ""));
    if (!fullPath) return { ok: false, files: [], dirs: [] };

    try {
      const stat = await fs.promises.stat(fullPath);
      if (!stat || !stat.isDirectory()) return { ok: false, files: [], dirs: [] };
      const dirents = await fs.promises.readdir(fullPath, { withFileTypes: true });
      const files = dirents
        .filter((d) => d && d.isFile && d.isFile())
        .map((d) => String(d.name || ""))
        .filter(Boolean);
      const dirs = dirents
        .filter((d) => d && d.isDirectory && d.isDirectory())
        .map((d) => String(d.name || ""))
        .filter(Boolean);
      return { ok: true, files, dirs };
    } catch {
      return { ok: false, files: [], dirs: [] };
    }
  });

  ipcMain.handle("bridge:workspace:readAssetText", async (event, relPath) => {
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    if (!projectDir || !isExistingDirectory(projectDir)) return null;
    const assetsDir = path.join(projectDir, "assets");
    const fullPath = resolveWithinDir(assetsDir, String(relPath || ""));
    if (!fullPath) return null;
    try {
      return await fs.promises.readFile(fullPath, "utf-8");
    } catch {
      return null;
    }
  });

  ipcMain.handle("bridge:json:read", async (event, filename, defaultValue) => {
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    const safeName = safeJsonFilename(filename);
    if (!safeName) return defaultValue;
    if (projectDir && isExistingDirectory(projectDir)) {
      try {
        maybeMigrateLegacyJsonFileForBridge(projectDir, safeName);
      } catch {}
    }
    const dir = getJsonDirForBridge(projectDir);
    const filePath = path.join(dir, safeName);
    if (safeName === "userData.json") {
      let rawPrimary: string | null = null;
      try {
        rawPrimary = await fs.promises.readFile(filePath, "utf-8");
      } catch {
        rawPrimary = null;
      }

      if (rawPrimary != null) {
        try {
          const parsed = JSON.parse(rawPrimary) as unknown;
          return sanitizeJsonForBridge(
            safeName,
            parsed as unknown as Jsonish,
            defaultValue as unknown as Jsonish
          );
        } catch {
          try {
            const corruptPath = `${filePath}.corrupt.${Date.now()}`;
            await fs.promises.writeFile(corruptPath, rawPrimary, "utf-8");
          } catch {}
          console.error("[Main] userData.json is corrupted, recovering with defaults");
        }
      }

      try {
        const raw = await fs.promises.readFile(`${filePath}.backup`, "utf-8");
        const parsed = JSON.parse(raw) as unknown;
        return sanitizeJsonForBridge(
          safeName,
          parsed as unknown as Jsonish,
          defaultValue as unknown as Jsonish
        );
      } catch {}

      const safeDefault = stripIsDefaultDataFlag(defaultValue);
      return sanitizeJsonForBridge(
        safeName,
        safeDefault as unknown as Jsonish,
        defaultValue as unknown as Jsonish
      );
    }
    const value = await readJsonWithBackup(filePath, defaultValue);
    return sanitizeJsonForBridge(
      safeName,
      value as unknown as Jsonish,
      defaultValue as unknown as Jsonish
    );
  });

  ipcMain.on("bridge:json:readSync", (event, filename, defaultValue) => {
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    const safeName = safeJsonFilename(filename);
    if (!safeName) {
      event.returnValue = defaultValue;
      return;
    }
    if (projectDir && isExistingDirectory(projectDir)) {
      try {
        maybeMigrateLegacyJsonFileForBridge(projectDir, safeName);
      } catch {}
    }
    const dir = getJsonDirForBridge(projectDir);
    const filePath = path.join(dir, safeName);
    if (safeName === "userData.json") {
      let rawPrimary: string | null = null;
      try {
        rawPrimary = fs.readFileSync(filePath, "utf-8");
      } catch {
        rawPrimary = null;
      }

      if (rawPrimary != null) {
        try {
          const parsed = JSON.parse(rawPrimary) as unknown;
          event.returnValue = sanitizeJsonForBridge(
            safeName,
            parsed as unknown as Jsonish,
            defaultValue as unknown as Jsonish
          );
          return;
        } catch {
          try {
            const corruptPath = `${filePath}.corrupt.${Date.now()}`;
            fs.writeFileSync(corruptPath, rawPrimary, "utf-8");
          } catch {}
          console.error("[Main] userData.json is corrupted, recovering with defaults (sync)");
        }
      }

      try {
        const raw = fs.readFileSync(`${filePath}.backup`, "utf-8");
        const parsed = JSON.parse(raw) as unknown;
        event.returnValue = sanitizeJsonForBridge(
          safeName,
          parsed as unknown as Jsonish,
          defaultValue as unknown as Jsonish
        );
        return;
      } catch {}

      const safeDefault = stripIsDefaultDataFlag(defaultValue);
      event.returnValue = sanitizeJsonForBridge(
        safeName,
        safeDefault as unknown as Jsonish,
        defaultValue as unknown as Jsonish
      );
      return;
    }
    const value = readJsonWithBackupSync(filePath, defaultValue);
    event.returnValue = sanitizeJsonForBridge(
      safeName,
      value as unknown as Jsonish,
      defaultValue as unknown as Jsonish
    );
  });

  ipcMain.handle("bridge:json:write", async (event, filename, data) => {
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    const safeName = safeJsonFilename(filename);
    if (!safeName) return { ok: false, reason: "INVALID_FILENAME" };
    const status = getJsonStatusForProject(projectDir);
    if (!status.ok) return status;
    const dir = getJsonDirForBridge(projectDir);
    const filePath = path.join(dir, safeName);
    try {
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await atomicWriteFile(filePath, JSON.stringify(data, null, 2));
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        reason: e instanceof Error ? e.message : "WRITE_FAILED",
      };
    }
  });

  ipcMain.on("bridge:json:writeSync", (event, filename, data) => {
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    const safeName = safeJsonFilename(filename);
    if (!safeName) {
      event.returnValue = { ok: false, reason: "INVALID_FILENAME" };
      return;
    }
    const status = getJsonStatusForProject(projectDir);
    if (!status.ok) {
      event.returnValue = status;
      return;
    }
    const dir = getJsonDirForBridge(projectDir);
    const filePath = path.join(dir, safeName);
    try {
      try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
      } catch {}
      atomicWriteFileSync(filePath, JSON.stringify(data, null, 2));
      event.returnValue = { ok: true };
    } catch (e) {
      event.returnValue = {
        ok: false,
        reason: e instanceof Error ? e.message : "WRITE_FAILED",
      };
    }
  });

  ipcMain.on("bridge:app:getBaseMethodNames", (event) => {
    try {
      const moduleBasePath = path.join(srcDir, "projector", "helpers", "moduleBase.ts");
      const threeBasePath = path.join(srcDir, "projector", "helpers", "threeBase.js");
      const moduleBaseContent = fs.readFileSync(moduleBasePath, "utf-8");
      const threeBaseContent = fs.readFileSync(threeBasePath, "utf-8");
      const methodRegex = /{\s*name:\s*"([^"]+)",\s*executeOnLoad:/g;
      const moduleBaseMatches = [...moduleBaseContent.matchAll(methodRegex)];
      const threeBaseMatches = [...threeBaseContent.matchAll(methodRegex)];
      event.returnValue = {
        moduleBase: moduleBaseMatches.map((m) => m[1]),
        threeBase: threeBaseMatches.map((m) => m[1]),
      };
    } catch {
      event.returnValue = { moduleBase: [], threeBase: [] };
    }
  });

  ipcMain.on("bridge:app:isPackaged", (event) => {
    try {
      event.returnValue = Boolean(app.isPackaged);
    } catch {
      event.returnValue = true;
    }
  });

  ipcMain.on("bridge:app:getVersion", (event) => {
    try {
      const tryReadVersion = (p: string): string | null => {
        try {
          if (!p || typeof p !== "string") return null;
          if (!fs.existsSync(p)) return null;
          const raw = fs.readFileSync(p, "utf-8");
          const pkg = JSON.parse(raw) as unknown;
          const v =
            pkg && typeof pkg === "object" && "version" in pkg
              ? (pkg as { version?: unknown }).version
              : null;
          return typeof v === "string" && v.trim() ? v.trim() : null;
        } catch {
          return null;
        }
      };

      const fromAppPath = tryReadVersion(path.join(app.getAppPath(), "package.json"));
      if (fromAppPath) {
        event.returnValue = fromAppPath;
        return;
      }

      const fromProjectRoot = tryReadVersion(path.join(srcDir, "..", "package.json"));
      if (fromProjectRoot) {
        event.returnValue = fromProjectRoot;
        return;
      }

      event.returnValue = app.getVersion();
    } catch {
      event.returnValue = null;
    }
  });

  ipcMain.on("bridge:app:getRepositoryUrl", (event) => {
    try {
      const tryRead = (p: string): string | null => {
        try {
          if (!p || typeof p !== "string") return null;
          if (!fs.existsSync(p)) return null;
          const raw = fs.readFileSync(p, "utf-8");
          const pkg = JSON.parse(raw) as unknown;
          const repo =
            pkg && typeof pkg === "object" && "repository" in pkg
              ? (pkg as { repository?: unknown }).repository
              : null;
          const url =
            typeof repo === "string"
              ? repo
              : repo && typeof repo === "object" && "url" in repo
                ? (repo as { url?: unknown }).url
                : null;
          return typeof url === "string" ? url : null;
        } catch {
          return null;
        }
      };

      const fromAppPath = tryRead(path.join(app.getAppPath(), "package.json"));
      if (fromAppPath) {
        event.returnValue = fromAppPath;
        return;
      }

      const fromSrcDir = tryRead(path.join(srcDir, "..", "package.json"));
      event.returnValue = fromSrcDir || null;
    } catch {
      event.returnValue = null;
    }
  });

  ipcMain.on("bridge:app:getMethodCode", (event, moduleName, methodName) => {
    try {
      const normalized = normalizeGetMethodCodeArgs(moduleName, methodName);
      if (!normalized.methodName) {
        event.returnValue = { code: null, filePath: null };
        return;
      }
      const safeMethodName = normalized.methodName;
      const methodNameEscaped = escapeRegExpLiteral(safeMethodName);

      const moduleBasePath = path.join(srcDir, "projector", "helpers", "moduleBase.ts");
      const threeBasePath = path.join(srcDir, "projector", "helpers", "threeBase.js");

      let filePath: string | null = null;
      let fileContent: string | null = null;
      const searchOrder: string[] = [];

      const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
      const safeModule = safeModuleName(moduleName);
      if (projectDir && isExistingDirectory(projectDir) && safeModule) {
        const modulesDir = path.join(projectDir, "modules");
        const workspaceModulePath = resolveWithinDir(modulesDir, `${safeModule}.js`);
        if (workspaceModulePath && fs.existsSync(workspaceModulePath)) {
          searchOrder.push(workspaceModulePath);
        }
      }

      if (fs.existsSync(moduleBasePath)) searchOrder.push(moduleBasePath);
      if (fs.existsSync(threeBasePath)) searchOrder.push(threeBasePath);

      for (const p of searchOrder) {
        const content = fs.readFileSync(p, "utf-8");
        const classMethodRegex = new RegExp(`\\s+${methodNameEscaped}\\s*\\([^)]*\\)\\s*\\{`, "m");
        if (classMethodRegex.test(content)) {
          filePath = p;
          fileContent = content;
          break;
        }
      }

      if (!fileContent || !filePath) {
        event.returnValue = { code: null, filePath: null };
        return;
      }

      const methodNamePattern = new RegExp(`\\s+${methodNameEscaped}\\s*\\(`, "m");
      const methodNameMatch = fileContent.match(methodNamePattern);
      if (!methodNameMatch) {
        event.returnValue = { code: null, filePath };
        return;
      }

      const startIndex = fileContent.indexOf(methodNameMatch[0]);
      if (startIndex === -1) {
        event.returnValue = { code: null, filePath };
        return;
      }

      let parenCount = 0;
      let braceCount = 0;
      let inString = false;
      let stringChar: string | null = null;
      let foundMethodBody = false;
      let i = startIndex + methodNameMatch[0].indexOf("(");

      while (i < fileContent.length) {
        const char = fileContent[i];
        const prevChar = i > 0 ? fileContent[i - 1] : null;

        if (!inString && (char === '"' || char === "'" || char === "`")) {
          inString = true;
          stringChar = char;
        } else if (inString && char === stringChar && prevChar !== "\\") {
          inString = false;
          stringChar = null;
        } else if (!inString) {
          if (char === "(") parenCount++;
          if (char === ")") parenCount--;
          if (char === "{") {
            if (parenCount === 0 && !foundMethodBody) {
              foundMethodBody = true;
              braceCount = 1;
            } else {
              braceCount++;
            }
          }
          if (char === "}") {
            braceCount--;
            if (foundMethodBody && braceCount === 0) {
              const code = fileContent.substring(startIndex, i + 1);
              event.returnValue = { code: code.trim(), filePath };
              return;
            }
          }
        }
        i++;
      }

      event.returnValue = { code: null, filePath };
    } catch {
      event.returnValue = { code: null, filePath: null };
    }
  });

  ipcMain.on("bridge:app:getKickMp3ArrayBuffer", (event) => {
    try {
      const kickPath = path.join(srcDir, "dashboard", "assets", "audio", "kick.mp3");
      const buf = fs.readFileSync(kickPath);
      event.returnValue = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    } catch {
      event.returnValue = null;
    }
  });

  ipcMain.on("bridge:os:clipboardWriteText", (event, text) => {
    try {
      clipboard.writeText(String(text ?? ""));
      event.returnValue = true;
    } catch {
      event.returnValue = false;
    }
  });

  ipcMain.on("bridge:os:clipboardReadText", (event) => {
    try {
      event.returnValue = clipboard.readText();
    } catch {
      event.returnValue = "";
    }
  });

  ipcMain.on("bridge:os:openExternal", (event, url) => {
    try {
      const normalized = normalizeOpenExternalUrl(url);
      if (!normalized) {
        event.returnValue = false;
        return;
      }
      shell.openExternal(normalized).catch(() => {});
      event.returnValue = true;
    } catch {
      event.returnValue = false;
    }
  });

  ipcMain.handle("input:configure", async (event, payload) => {
    if (state.inputManager) {
      const normalized = normalizeInputConfig(payload);
      await (state.inputManager as InputManager).initialize(
        normalized as Parameters<InputManager["initialize"]>[0]
      );
    }
    return { success: true };
  });

  ipcMain.handle("input:get-midi-devices", async () => {
    return await InputManager.getAvailableMIDIDevices();
  });

  const isTest = process.env.NODE_ENV === "test";
  const isMockMidi = process.env.NW_WRLD_TEST_MIDI_MOCK === "1";
  if (isTest && isMockMidi) {
    const defaultDevices = [{ id: "e2e-midi-1", name: "E2E MIDI Device", manufacturer: "nw_wrld" }];
    const mock = getOrCreateGlobalMockWebMidi(defaultDevices);
    (globalThis as unknown as { __nwWrldWebMidiOverride?: unknown }).__nwWrldWebMidiOverride = mock;

    ipcMain.handle("test:midi:reset", async (_event, devices: unknown) => {
      const list = Array.isArray(devices)
        ? (devices as Array<{ id?: unknown; name?: unknown; manufacturer?: unknown }>)
        : [];
      const normalized = list
        .map((d) => ({
          id: typeof d?.id === "string" ? d.id : "",
          name: typeof d?.name === "string" ? d.name : "",
          manufacturer: typeof d?.manufacturer === "string" ? d.manufacturer : "",
        }))
        .filter((d) => d.id && d.name);
      mock.resetDevices(normalized);
      return { ok: true };
    });

    ipcMain.handle("test:midi:disconnect", async (_event, deviceId: unknown) => {
      const id = typeof deviceId === "string" ? deviceId : "";
      if (!id) return { ok: false };
      mock.disconnectDevice(id);
      return { ok: true };
    });

    ipcMain.handle("test:midi:reconnect", async (_event, device: unknown) => {
      const d = device && typeof device === "object" ? (device as Record<string, unknown>) : null;
      const id = d && typeof d.id === "string" ? d.id : "";
      const name = d && typeof d.name === "string" ? d.name : "";
      const manufacturer = d && typeof d.manufacturer === "string" ? d.manufacturer : "";
      if (!id || !name) return { ok: false };
      mock.reconnectDevice({ id, name, manufacturer });
      return { ok: true };
    });

    ipcMain.handle("test:midi:noteOn", async (_event, payload: unknown) => {
      const p = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
      const deviceId = p && typeof p.deviceId === "string" ? p.deviceId : "";
      const note = p && typeof p.note === "number" ? p.note : NaN;
      const channel = p && typeof p.channel === "number" ? p.channel : NaN;
      const velocity = p && typeof p.velocity === "number" ? p.velocity : undefined;
      if (!deviceId) return { ok: false };
      const ok = mock.noteOn(deviceId, { note, channel, velocity });
      return { ok };
    });
  }

  ipcMain.on("log-to-main", (event, message) => {
    console.log(message);
  });
}
