const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const { atomicWriteFile } = require("../dist/runtime/shared/json/atomicWrite.js");

test("atomicWriteFile: last write wins and leaves no temp files", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nw_wrld_atomicwrite_"));
  const filePath = path.join(dir, "data.json");

  const p1 = atomicWriteFile(filePath, JSON.stringify({ v: 1 }));
  const p2 = atomicWriteFile(filePath, JSON.stringify({ v: 2 }));
  await Promise.all([p1, p2]);

  const final = fs.readFileSync(filePath, "utf-8");
  assert.equal(final, JSON.stringify({ v: 2 }));

  const files = fs.readdirSync(dir);
  const tempFiles = files.filter((f) => f.includes(".tmp."));
  assert.deepEqual(tempFiles, []);
});
