import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

const writeQueue = new Map<string, Promise<void>>();
const writeEpoch = new Map<string, number>();
let tmpCounter = 0;

type AsyncFileHandle = Awaited<ReturnType<typeof fs.promises.open>>;

function makeTempPath(filePath: string) {
  tmpCounter = (tmpCounter + 1) >>> 0;
  const uuid =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${filePath}.tmp.${process.pid}.${Date.now()}.${tmpCounter}.${uuid}`;
}

// fsync the containing directory so a rename is durable across power loss.
// Best-effort: opening a directory for fsync is not supported on every platform
// (notably Windows), so a failure here must never fail the write itself.
async function fsyncDirectory(dirPath: string) {
  let handle: AsyncFileHandle | null = null;
  try {
    handle = await fs.promises.open(dirPath, "r");
    await handle.sync();
  } catch {
    // best-effort
  } finally {
    if (handle) {
      try {
        await handle.close();
      } catch {}
    }
  }
}

function fsyncDirectorySync(dirPath: string) {
  let fd: number | null = null;
  try {
    fd = fs.openSync(dirPath, "r");
    fs.fsyncSync(fd);
  } catch {
    // best-effort
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  }
}

// Preserve the current good primary as <file>.backup before it is replaced, so a
// later corrupt/truncated primary can be recovered (see readJsonWithBackup).
// Best-effort and must only run AFTER the new content is durably written: if the
// copy fails, the previous .backup is left intact and the write still proceeds.
async function rollBackup(filePath: string, backupPath: string) {
  try {
    await fs.promises.copyFile(filePath, backupPath);
  } catch {
    // ENOENT = no primary yet (first write); nothing to back up. Any other error
    // is non-fatal: the freshly fsynced temp file is the source of truth.
  }
}

function rollBackupSync(filePath: string, backupPath: string) {
  try {
    fs.copyFileSync(filePath, backupPath);
  } catch {
    // best-effort (see rollBackup)
  }
}

async function performAtomicWrite(filePath: string, data: string, epoch: number | null) {
  const tempPath = makeTempPath(filePath);
  const backupPath = `${filePath}.backup`;

  try {
    // 1. Write the new content to a temp file and fsync it to disk BEFORE
    //    touching the primary. This is what makes the write crash-durable:
    //    rename alone only makes the directory entry atomic, not the data.
    const handle = await fs.promises.open(tempPath, "w");
    try {
      await handle.writeFile(data, "utf-8");
      await handle.sync();
    } finally {
      await handle.close();
    }

    // 2. Abort if a newer write to the same path superseded this one.
    if (epoch != null && writeEpoch.get(filePath) !== epoch) {
      try {
        await fs.promises.unlink(tempPath);
      } catch {}
      return;
    }

    // 3. Preserve the current good primary as a backup before replacing it.
    await rollBackup(filePath, backupPath);

    // 4. Atomically replace the primary with the new content.
    try {
      await fs.promises.rename(tempPath, filePath);
    } catch (renameError) {
      const err = renameError as { code?: string };
      if (err.code === "EEXIST" || err.code === "EPERM") {
        // Windows cannot rename onto an existing file. The backup from step 3
        // is the safety net while the primary is briefly removed.
        try {
          await fs.promises.unlink(filePath);
        } catch {}
        await fs.promises.rename(tempPath, filePath);
      } else {
        throw renameError;
      }
    }

    // 5. fsync the directory so the rename itself survives power loss.
    await fsyncDirectory(path.dirname(filePath));
  } catch (error) {
    try {
      await fs.promises.unlink(tempPath);
    } catch {}
    throw error;
  }
}

export async function atomicWriteFile(filePath: string, data: string) {
  const inflight = writeQueue.get(filePath);
  if (inflight) {
    try {
      await inflight;
    } catch {}
  }

  const epoch = (writeEpoch.get(filePath) || 0) + 1;
  writeEpoch.set(filePath, epoch);

  const writePromise = performAtomicWrite(filePath, data, epoch);

  writeQueue.set(filePath, writePromise);

  try {
    await writePromise;
  } finally {
    if (writeQueue.get(filePath) === writePromise) {
      writeQueue.delete(filePath);
    }
  }
}

export function atomicWriteFileSync(filePath: string, data: string) {
  const epoch = (writeEpoch.get(filePath) || 0) + 1;
  writeEpoch.set(filePath, epoch);

  const tempPath = makeTempPath(filePath);
  const backupPath = `${filePath}.backup`;

  try {
    // 1. Write + fsync the temp file (see performAtomicWrite step 1).
    const fd = fs.openSync(tempPath, "w");
    try {
      fs.writeFileSync(fd, data, "utf-8");
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }

    // 2. Abort if superseded.
    if (epoch != null && writeEpoch.get(filePath) !== epoch) {
      try {
        fs.unlinkSync(tempPath);
      } catch {}
      return;
    }

    // 3. Roll a backup of the current good primary.
    rollBackupSync(filePath, backupPath);

    // 4. Atomic replace (with Windows fallback).
    try {
      fs.renameSync(tempPath, filePath);
    } catch (renameError) {
      const err = renameError as { code?: string };
      if (err.code === "EEXIST" || err.code === "EPERM") {
        try {
          fs.unlinkSync(filePath);
        } catch {}
        fs.renameSync(tempPath, filePath);
      } else {
        throw renameError;
      }
    }

    // 5. fsync the directory.
    fsyncDirectorySync(path.dirname(filePath));
  } catch (error) {
    try {
      fs.unlinkSync(tempPath);
    } catch {}
    throw error;
  }
}

export async function cleanupStaleTempFiles(directory: string, minAgeMs = 60_000) {
  try {
    const files = await fs.promises.readdir(directory);
    const now = Date.now();
    const tempFiles = files.filter((f: string) => f.includes(".tmp."));

    for (const file of tempFiles) {
      try {
        const fullPath = path.join(directory, file);
        const stat = await fs.promises.stat(fullPath);
        if (now - stat.mtimeMs >= minAgeMs) {
          await fs.promises.unlink(fullPath);
        }
      } catch {}
    }
  } catch {}
}
