const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const { ensureWorkspaceStarterAssets } = require(path.join(
  __dirname,
  "..",
  "dist",
  "runtime",
  "main",
  "workspaceStarterAssets.js"
));

const { ensureWorkspaceStarterModules } = require(path.join(
  __dirname,
  "..",
  "dist",
  "runtime",
  "main",
  "workspaceStarterModules.js"
));
const {
  getBundledStarterModulePath,
  getWorkspaceStarterModuleSyncStatus,
  rewriteWorkspaceStarterModule,
} = require(path.join(__dirname, "..", "dist", "runtime", "main", "workspaceStarterModules.js"));

test("ensureWorkspaceStarterAssets creates directories and copies expected starter files", () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "nw_wrld-workspace-"));
  try {
    ensureWorkspaceStarterAssets(workspaceDir);

    assert.ok(fs.existsSync(path.join(workspaceDir, "assets", "json", "meteor.json")));
    assert.ok(
      fs.existsSync(path.join(workspaceDir, "assets", "images", "blueprint.png"))
    );
  } finally {
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  }
});

test("ensureWorkspaceStarterModules copies starter module files into modules dir", () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "nw_wrld-workspace-"));
  try {
    const modulesDir = path.join(workspaceDir, "modules");
    fs.mkdirSync(modulesDir, { recursive: true });

    ensureWorkspaceStarterModules(modulesDir);

    assert.ok(fs.existsSync(path.join(modulesDir, "HelloWorld.js")));
  } finally {
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  }
});

test("workspace starter module sync status detects drift and can rewrite from bundled copy", async () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "nw_wrld-workspace-"));
  try {
    const modulesDir = path.join(workspaceDir, "modules");
    fs.mkdirSync(modulesDir, { recursive: true });

    ensureWorkspaceStarterModules(modulesDir);

    const moduleId = "HelloWorld";
    const workspaceModulePath = path.join(modulesDir, `${moduleId}.js`);
    const starterModulePath = getBundledStarterModulePath(moduleId);
    assert.ok(starterModulePath);

    const initialStatus = await getWorkspaceStarterModuleSyncStatus(moduleId, workspaceModulePath);
    assert.equal(initialStatus, "inSync");

    fs.writeFileSync(workspaceModulePath, `${fs.readFileSync(workspaceModulePath, "utf-8")}\n// local edit\n`);
    const driftStatus = await getWorkspaceStarterModuleSyncStatus(moduleId, workspaceModulePath);
    assert.equal(driftStatus, "outOfSync");

    const rewriteResult = await rewriteWorkspaceStarterModule(moduleId, workspaceModulePath);
    assert.deepEqual(rewriteResult, { ok: true });
    assert.equal(
      fs.readFileSync(workspaceModulePath, "utf-8"),
      fs.readFileSync(starterModulePath, "utf-8")
    );
  } finally {
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  }
});
