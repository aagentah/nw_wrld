const fs = require("fs");
const path = require("path");

const ensureDir = (dirPath) => {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch {}
};

const safeCopyIfMissing = (srcPath, destPath) => {
  try {
    if (fs.existsSync(destPath)) return;
    if (!fs.existsSync(srcPath)) return;
    fs.copyFileSync(srcPath, destPath);
  } catch {}
};

function ensureWorkspaceStarterAssets(workspacePath) {
  if (!workspacePath || typeof workspacePath !== "string") return;

  const assetsDir = path.join(workspacePath, "assets");
  const jsonDir = path.join(assetsDir, "json");
  const imagesDir = path.join(assetsDir, "images");
  const modelsDir = path.join(assetsDir, "models");

  ensureDir(jsonDir);
  ensureDir(imagesDir);
  ensureDir(modelsDir);

  const srcAssetsDir = path.join(__dirname, "..", "assets");
  safeCopyIfMissing(
    path.join(srcAssetsDir, "json", "meteor.json"),
    path.join(jsonDir, "meteor.json")
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
}

module.exports = { ensureWorkspaceStarterAssets };
