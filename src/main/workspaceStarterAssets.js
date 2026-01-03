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

  ensureDir(jsonDir);
  ensureDir(imagesDir);

  const srcAssetsDir = path.join(__dirname, "..", "assets");
  safeCopyIfMissing(
    path.join(srcAssetsDir, "json", "meteor.json"),
    path.join(jsonDir, "meteor.json")
  );
  safeCopyIfMissing(
    path.join(srcAssetsDir, "images", "blueprint.png"),
    path.join(imagesDir, "blueprint.png")
  );
}

module.exports = { ensureWorkspaceStarterAssets };
