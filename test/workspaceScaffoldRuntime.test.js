const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

test("ensureWorkspaceScaffold creates required on-disk structure", async () => {
  const electronPath = require.resolve("electron");
  const prevElectron = require.cache[electronPath];

  require.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: {
      ipcMain: { handle: () => {} },
      dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) },
    },
  };

  const workspaceModulePath = path.join(
    __dirname,
    "..",
    "dist",
    "runtime",
    "main",
    "mainProcess",
    "workspace.js"
  );

  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "nw_wrld-workspace-"));
  try {
    delete require.cache[workspaceModulePath];
    const { ensureWorkspaceScaffold } = require(workspaceModulePath);
    await ensureWorkspaceScaffold(workspaceDir);

    assert.equal(
      fs.statSync(path.join(workspaceDir, "modules")).isDirectory(),
      true
    );
    assert.equal(
      fs.statSync(path.join(workspaceDir, "nw_wrld_data", "json")).isDirectory(),
      true
    );
    assert.equal(fs.existsSync(path.join(workspaceDir, "README.md")), true);
    assert.equal(fs.existsSync(path.join(workspaceDir, "modules", "HelloWorld.js")), true);
    assert.equal(
      fs.existsSync(path.join(workspaceDir, "assets", "json", "meteor.json")),
      true
    );
  } finally {
    try {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    } catch {}
    if (prevElectron) {
      require.cache[electronPath] = prevElectron;
    } else {
      delete require.cache[electronPath];
    }
  }
});

