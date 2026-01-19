import { ipcMain, shell } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import { atomicWriteFileSync } from "../../../shared/json/atomicWrite";
import { parseNwWrldDocblockMetadata } from "../../../shared/nwWrldDocblock";
import {
  normalizeModuleSummaries,
  normalizeWorkspaceModuleScanResult,
  normalizeModuleUrlResult,
  normalizeModuleWithMeta,
} from "../../../shared/validation/workspaceValidation";
import {
  isExistingDirectory,
  resolveWithinDir,
  safeModuleName,
} from "../pathSafety";
import { getProjectDirForEvent, type SenderEvent } from "./projectContext";

const MODULE_METADATA_MAX_BYTES = 16 * 1024;
const MODULE_ID_RULE = "^[A-Za-z][A-Za-z0-9]*$";

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

const scanWorkspaceModuleSummaries = async (modulesDir: string) => {
  let entries: string[] = [];
  try {
    entries = await fs.promises.readdir(modulesDir);
  } catch {
    entries = [];
  }

  const jsFiles = entries.filter((f) => String(f).endsWith(".js"));
  const skipped: Array<{ file: string; reason: string }> = [];

  const summaries = await Promise.all(
    jsFiles.map(async (file) => {
      const filename = String(file);
      const moduleId = filename.replace(/\.js$/i, "");
      const safe = safeModuleName(moduleId);
      if (!safe) {
        skipped.push({
          file: filename,
          reason: `Invalid filename: must match ${MODULE_ID_RULE}`,
        });
        return null;
      }
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

  return normalizeWorkspaceModuleScanResult({ summaries, skipped });
};

export function registerWorkspaceBridge(): void {
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
    const res = await scanWorkspaceModuleSummaries(modulesDir);
    return normalizeModuleSummaries(res.summaries);
  });

  ipcMain.handle("bridge:workspace:listModuleSummariesWithSkipped", async (event) => {
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    if (!projectDir || !isExistingDirectory(projectDir)) {
      return normalizeWorkspaceModuleScanResult(null);
    }
    const modulesDir = path.join(projectDir, "modules");
    return await scanWorkspaceModuleSummaries(modulesDir);
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
}

