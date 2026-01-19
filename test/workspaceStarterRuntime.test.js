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

test("ensureWorkspaceStarterAssets creates directories and copies expected starter files", () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "nw_wrld-workspace-"));

  ensureWorkspaceStarterAssets(workspaceDir);

  assert.ok(fs.existsSync(path.join(workspaceDir, "assets", "json", "meteor.json")));
  assert.ok(
    fs.existsSync(path.join(workspaceDir, "assets", "images", "blueprint.png"))
  );
});

test("ensureWorkspaceStarterModules copies starter module files into modules dir", () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "nw_wrld-workspace-"));
  const modulesDir = path.join(workspaceDir, "modules");
  fs.mkdirSync(modulesDir, { recursive: true });

  ensureWorkspaceStarterModules(modulesDir);

  assert.ok(fs.existsSync(path.join(modulesDir, "HelloWorld.js")));
});

