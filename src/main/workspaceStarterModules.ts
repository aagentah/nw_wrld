import * as fs from "node:fs";
import * as path from "node:path";

import { srcDir } from "./mainProcess/state";

const STARTER_MODULES_DIR = path.join(srcDir, "main", "starter_modules");

const STARTER_SYNC_VALUES = new Set(["inSync", "outOfSync"] as const);

export type StarterModuleSyncStatus = "inSync" | "outOfSync";

const getSafeStarterModuleId = (moduleId: string): string | null => {
  const safeModuleId = String(moduleId || "").trim();
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(safeModuleId)) return null;
  return safeModuleId;
};

const copyFileAtomic = async (srcPath: string, destPath: string): Promise<void> => {
  const destDir = path.dirname(destPath);
  const base = path.basename(destPath);
  const rand = Math.random().toString(16).slice(2);
  const tmpPath = path.join(destDir, `.${base}.tmp-${process.pid}-${Date.now()}-${rand}`);
  await fs.promises.copyFile(srcPath, tmpPath);
  await fs.promises.rename(tmpPath, destPath);
};

export const getBundledStarterModulePath = (moduleId: string): string | null => {
  const safeModuleId = getSafeStarterModuleId(moduleId);
  if (!safeModuleId) return null;
  const starterModulePath = path.join(STARTER_MODULES_DIR, `${safeModuleId}.js`);
  try {
    return fs.existsSync(starterModulePath) ? starterModulePath : null;
  } catch {
    return null;
  }
};

export const getWorkspaceStarterModuleSyncStatus = async (
  moduleId: string,
  workspaceModulePath: string
): Promise<StarterModuleSyncStatus | null> => {
  if (!workspaceModulePath || typeof workspaceModulePath !== "string") return null;
  const starterModulePath = getBundledStarterModulePath(moduleId);
  if (!starterModulePath) return null;
  try {
    const [starterBytes, workspaceBytes] = await Promise.all([
      fs.promises.readFile(starterModulePath),
      fs.promises.readFile(workspaceModulePath),
    ]);
    const syncStatus = starterBytes.equals(workspaceBytes) ? "inSync" : "outOfSync";
    return STARTER_SYNC_VALUES.has(syncStatus) ? syncStatus : null;
  } catch {
    return null;
  }
};

export const rewriteWorkspaceStarterModule = async (
  moduleId: string,
  workspaceModulePath: string
): Promise<{ ok: true } | { ok: false; reason: string }> => {
  if (!workspaceModulePath || typeof workspaceModulePath !== "string") {
    return { ok: false, reason: "INVALID_WORKSPACE_MODULE_PATH" };
  }
  const starterModulePath = getBundledStarterModulePath(moduleId);
  if (!starterModulePath) {
    return { ok: false, reason: "STARTER_MODULE_MISSING" };
  }
  try {
    const workspaceStat = await fs.promises.stat(workspaceModulePath);
    if (!workspaceStat.isFile()) {
      return { ok: false, reason: "WORKSPACE_MODULE_MISSING" };
    }
  } catch {
    return { ok: false, reason: "WORKSPACE_MODULE_MISSING" };
  }
  try {
    await copyFileAtomic(starterModulePath, workspaceModulePath);
    return { ok: true };
  } catch (error) {
    console.error("[Main] Starter module rewrite failed:", error);
    return { ok: false, reason: "REWRITE_FAILED" };
  }
};

export function ensureWorkspaceStarterModules(modulesDir: string) {
  if (!modulesDir || typeof modulesDir !== "string") return;
  if (!fs.existsSync(modulesDir)) return;

  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(STARTER_MODULES_DIR, { withFileTypes: true });
  } catch {
    entries = [];
  }

  entries
    .filter((e) => e && e.isFile && e.isFile() && e.name.endsWith(".js"))
    .map((e) => e.name)
    .forEach((filename) => {
      const srcPath = path.join(STARTER_MODULES_DIR, filename);
      const destPath = path.join(modulesDir, filename);
      if (fs.existsSync(destPath)) return;
      try {
        fs.copyFileSync(srcPath, destPath);
      } catch {}
    });
}
