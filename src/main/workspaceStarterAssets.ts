/**
 * Workspace starter assets utilities
 * Copies starter asset templates to newly created workspaces
 */

import fs from "fs";
import path from "path";

function ensureDir(dirPath: string): void {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch {
    // Ignore errors
  }
}

function safeCopyIfMissing(srcPath: string, destPath: string): void {
  try {
    if (fs.existsSync(destPath)) return;
    if (!fs.existsSync(srcPath)) return;
    fs.copyFileSync(srcPath, destPath);
  } catch {
    // Ignore errors
  }
}

export function ensureWorkspaceStarterAssets(workspacePath: string | undefined): void {
  if (!workspacePath || typeof workspacePath !== "string") return;

  const assetsDir = path.join(workspacePath, "assets");
  const jsonDir = path.join(assetsDir, "json");
  const imagesDir = path.join(assetsDir, "images");
  const modelsDir = path.join(assetsDir, "models");
  const fontsDir = path.join(assetsDir, "fonts");

  ensureDir(jsonDir);
  ensureDir(imagesDir);
  ensureDir(modelsDir);
  ensureDir(fontsDir);

  const srcAssetsDir = path.join(__dirname, "..", "assets");

  safeCopyIfMissing(
    path.join(srcAssetsDir, "json", "meteor.json"),
    path.join(jsonDir, "meteor.json")
  );
  safeCopyIfMissing(
    path.join(srcAssetsDir, "json", "radiation.json"),
    path.join(jsonDir, "radiation.json")
  );
  safeCopyIfMissing(
    path.join(srcAssetsDir, "images", "blueprint.png"),
    path.join(imagesDir, "blueprint.png")
  );
  safeCopyIfMissing(
    path.join(srcAssetsDir, "models", "cube.obj"),
    path.join(modelsDir, "cube.obj")
  );
  safeCopyIfMissing(
    path.join(srcAssetsDir, "models", "tetra.stl"),
    path.join(modelsDir, "tetra.stl")
  );
  safeCopyIfMissing(
    path.join(srcAssetsDir, "models", "triangle.ply"),
    path.join(modelsDir, "triangle.ply")
  );
  safeCopyIfMissing(
    path.join(srcAssetsDir, "models", "points.pcd"),
    path.join(modelsDir, "points.pcd")
  );
  safeCopyIfMissing(
    path.join(srcAssetsDir, "models", "triangle.gltf"),
    path.join(modelsDir, "triangle.gltf")
  );

  safeCopyIfMissing(
    path.join(srcAssetsDir, "fonts", "RobotoMono-VariableFont_wght.ttf"),
    path.join(fontsDir, "RobotoMono-VariableFont_wght.ttf")
  );
  safeCopyIfMissing(
    path.join(srcAssetsDir, "fonts", "RobotoMono-Italic-VariableFont_wght.ttf"),
    path.join(fontsDir, "RobotoMono-Italic-VariableFont_wght.ttf")
  );
}
