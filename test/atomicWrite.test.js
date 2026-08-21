const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const {
  atomicWriteFile,
  atomicWriteFileSync,
} = require("../dist/runtime/shared/json/atomicWrite.js");

test("atomicWriteFile: last write wins and leaves no temp files", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nw_wrld_atomicwrite_"));
  try {
    const filePath = path.join(dir, "data.json");

    const p1 = atomicWriteFile(filePath, JSON.stringify({ v: 1 }));
    const p2 = atomicWriteFile(filePath, JSON.stringify({ v: 2 }));
    await Promise.all([p1, p2]);

    const final = fs.readFileSync(filePath, "utf-8");
    assert.equal(final, JSON.stringify({ v: 2 }));

    const files = fs.readdirSync(dir);
    const tempFiles = files.filter((f) => f.includes(".tmp."));
    assert.deepEqual(tempFiles, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("atomicWriteFile: rolls a .backup of the previous contents on overwrite", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nw_wrld_atomicbackup_"));
  try {
    const filePath = path.join(dir, "data.json");

    await atomicWriteFile(filePath, JSON.stringify({ v: 1 }));
    assert.equal(
      fs.existsSync(filePath + ".backup"),
      false,
      "no .backup should exist after the very first write (nothing to preserve)"
    );

    await atomicWriteFile(filePath, JSON.stringify({ v: 2 }));
    assert.equal(fs.readFileSync(filePath, "utf-8"), JSON.stringify({ v: 2 }));
    assert.equal(
      fs.readFileSync(filePath + ".backup", "utf-8"),
      JSON.stringify({ v: 1 }),
      ".backup should hold the contents that were present before this write"
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("atomicWriteFileSync: rolls a .backup of the previous contents on overwrite", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nw_wrld_atomicbackupsync_"));
  try {
    const filePath = path.join(dir, "data.json");

    atomicWriteFileSync(filePath, JSON.stringify({ v: 1 }));
    assert.equal(fs.existsSync(filePath + ".backup"), false);

    atomicWriteFileSync(filePath, JSON.stringify({ v: 2 }));
    assert.equal(fs.readFileSync(filePath, "utf-8"), JSON.stringify({ v: 2 }));
    assert.equal(fs.readFileSync(filePath + ".backup", "utf-8"), JSON.stringify({ v: 1 }));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("atomicWriteFile: fsyncs the file and the directory for crash durability", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nw_wrld_atomicfsync_"));
  try {
    const filePath = path.join(dir, "data.json");

    const realOpen = fs.promises.open;
    let syncCount = 0;
    fs.promises.open = async (...args) => {
      const fh = await realOpen.apply(fs.promises, args);
      const realSync = fh.sync.bind(fh);
      fh.sync = async () => {
        syncCount += 1;
        return realSync();
      };
      return fh;
    };

    try {
      await atomicWriteFile(filePath, JSON.stringify({ v: 1 }));
    } finally {
      fs.promises.open = realOpen;
    }

    assert.equal(fs.readFileSync(filePath, "utf-8"), JSON.stringify({ v: 1 }));
    assert.ok(
      syncCount >= 2,
      `expected at least 2 fsyncs (data file + containing directory), got ${syncCount}`
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("atomicWriteFileSync: fsyncs the file and the directory for crash durability", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nw_wrld_atomicfsyncsync_"));
  try {
    const filePath = path.join(dir, "data.json");

    const realFsyncSync = fs.fsyncSync;
    let syncCount = 0;
    fs.fsyncSync = (fd) => {
      syncCount += 1;
      return realFsyncSync(fd);
    };

    try {
      atomicWriteFileSync(filePath, JSON.stringify({ v: 1 }));
    } finally {
      fs.fsyncSync = realFsyncSync;
    }

    assert.equal(fs.readFileSync(filePath, "utf-8"), JSON.stringify({ v: 1 }));
    assert.ok(
      syncCount >= 2,
      `expected at least 2 fsyncs (data file + containing directory), got ${syncCount}`
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
