const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.join(__dirname, "..");

const readText = (p) => fs.readFileSync(p, "utf8");

const assertFileExists = (p) => {
  assert.equal(fs.existsSync(p), true, `Expected file to exist: ${p}`);
};

test("packaging config references build resources that exist", () => {
  const pkgPath = path.join(repoRoot, "package.json");
  const pkg = JSON.parse(readText(pkgPath));
  const build = pkg && pkg.build ? pkg.build : null;
  assert.equal(typeof build, "object");

  const buildResourcesDir =
    build && build.directories && typeof build.directories.buildResources === "string"
      ? build.directories.buildResources
      : "build";

  const mac = build && build.mac ? build.mac : null;
  assert.equal(typeof mac, "object");
  assert.equal(typeof mac.entitlements, "string");
  assert.equal(typeof mac.entitlementsInherit, "string");
  assert.equal(typeof mac.icon, "string");

  const win = build && build.win ? build.win : null;
  assert.equal(typeof win, "object");
  assert.equal(typeof win.icon, "string");

  assertFileExists(path.join(repoRoot, buildResourcesDir, "logo.icns"));
  assertFileExists(path.join(repoRoot, buildResourcesDir, "logo.png"));
  assertFileExists(path.join(repoRoot, buildResourcesDir, "logo.ico"));

  assertFileExists(path.join(repoRoot, mac.entitlements));
  assertFileExists(path.join(repoRoot, mac.entitlementsInherit));

  assertFileExists(path.join(repoRoot, win.icon));
});

test("macOS entitlements files look like valid plists (text sanity check)", () => {
  const pkg = JSON.parse(readText(path.join(repoRoot, "package.json")));
  const mac = pkg.build.mac;
  const entitlements = readText(path.join(repoRoot, mac.entitlements));
  const inherit = readText(path.join(repoRoot, mac.entitlementsInherit));

  for (const [name, content] of [
    ["entitlements", entitlements],
    ["entitlementsInherit", inherit],
  ]) {
    const trimmed = String(content || "").trim();
    assert.equal(trimmed.startsWith("<?xml"), true, `${name} should start with XML header`);
    assert.equal(trimmed.includes("<plist"), true, `${name} should include <plist> root`);
    assert.equal(trimmed.includes("</plist>"), true, `${name} should close </plist> root`);
  }
});

test("gitignore does not accidentally drop required build resources", () => {
  const gitignore = readText(path.join(repoRoot, ".gitignore"));
  assert.equal(gitignore.includes("build/*"), true);
  assert.equal(gitignore.includes("!build/entitlements.mac.plist"), true);
  assert.equal(gitignore.includes("!build/entitlements.mac.inherit.plist"), true);
  assert.equal(gitignore.includes("!build/logo.icns"), true);
  assert.equal(gitignore.includes("!build/logo.png"), true);
  assert.equal(gitignore.includes("!build/logo.ico"), true);
});

