import * as fs from "node:fs";
import * as path from "node:path";

import { srcDir } from "./mainProcess/state";

const STARTER_MODULES_DIR = path.join(srcDir, "main", "starter_modules");

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
