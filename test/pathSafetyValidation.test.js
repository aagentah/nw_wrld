const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");

const { resolveWithinDir } = require(path.join(
  __dirname,
  "..",
  "dist",
  "runtime",
  "shared",
  "validation",
  "pathSafetyValidation.js"
));

test("resolveWithinDir allows safe relative paths inside base dir", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "nw_wrld-base-"));
  try {
    const out = resolveWithinDir(base, "assets/file.txt");
    assert.equal(typeof out, "string");
    assert.equal(out, path.resolve(base, "assets/file.txt"));
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("resolveWithinDir rejects traversal outside base dir", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "nw_wrld-base-"));
  try {
    assert.equal(resolveWithinDir(base, "../secret.txt"), null);
    assert.equal(resolveWithinDir(base, "/absolute.txt"), path.resolve(base, "absolute.txt"));
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("resolveWithinDir rejects symlink escape", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "nw_wrld-base-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "nw_wrld-outside-"));
  try {
    const target = path.join(outside, "secret.txt");
    fs.writeFileSync(target, "x", "utf-8");

    const linkPath = path.join(base, "link");
    fs.symlinkSync(outside, linkPath, "dir");

    assert.equal(resolveWithinDir(base, "link/secret.txt"), null);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

