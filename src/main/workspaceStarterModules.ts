/**
 * Workspace starter modules utilities
 * Copies starter module templates to newly created workspaces
 */

import fs from "fs";
import path from "path";

const STARTER_MODULES_DIR = path.join(__dirname, "starter_modules");

export function ensureWorkspaceStarterModules(modulesDir: string | undefined): void {
  if (!modulesDir || typeof modulesDir !== "string") return;
  if (!fs.existsSync(modulesDir)) return;

  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(STARTER_MODULES_DIR, { withFileTypes: true });
  } catch {
    entries = [];
  }

  entries
    .filter((e) => e && e.isFile() && e.name.endsWith(".js") || e.name.endsWith(".ts"))
    .map((e) => e.name)
    .forEach((filename) => {
      const srcPath = path.join(STARTER_MODULES_DIR, filename);
      const destPath = path.join(modulesDir, filename);
      if (fs.existsSync(destPath)) return;
      try {
        fs.copyFileSync(srcPath, destPath);
      } catch {
        // Ignore copy errors
      }
    });
}
