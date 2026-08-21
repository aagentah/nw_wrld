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

// Best-effort fsync of the containing dir so the rename survives power loss.
async function fsyncDirectory(dirPath: string) {
  let handle: AsyncFileHandle | null = null;
  try {
    handle = await fs.promises.open(dirPath, "r");
    await handle.sync();
  } catch {
    /* best-effort */
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
    /* best-effort */
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  }
}

async function rollBackup(filePath: string, backupPath: string) {
  try {
    await fs.promises.copyFile(filePath, backupPath);
  } catch {}
}

function rollBackupSync(filePath: string, backupPath: string) {
  try {
    fs.copyFileSync(filePath, backupPath);
  } catch {}
}

async function performAtomicWrite(filePath: string, data: string, epoch: number | null) {
  const tempPath = makeTempPath(filePath);
  const backupPath = `${filePath}.backup`;

  try {
    const handle = await fs.promises.open(tempPath, "w");
    try {
      await handle.writeFile(data, "utf-8");
      await handle.sync();
    } finally {
      await handle.close();
    }

    if (epoch != null && writeEpoch.get(filePath) !== epoch) {
      try {
        await fs.promises.unlink(tempPath);
      } catch {}
      return;
    }

    await rollBackup(filePath, backupPath);

    try {
      await fs.promises.rename(tempPath, filePath);
    } catch (renameError) {
      const err = renameError as { code?: string };
      if (err.code === "EEXIST" || err.code === "EPERM") {
        // Windows can't rename onto an existing file.
        try {
          await fs.promises.unlink(filePath);
        } catch {}
        await fs.promises.rename(tempPath, filePath);
      } else {
        throw renameError;
      }
    }

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
    const fd = fs.openSync(tempPath, "w");
    try {
      fs.writeFileSync(fd, data, "utf-8");
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }

    if (epoch != null && writeEpoch.get(filePath) !== epoch) {
      try {
        fs.unlinkSync(tempPath);
      } catch {}
      return;
    }

    rollBackupSync(filePath, backupPath);

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

    fsyncDirectorySync(path.dirname(filePath));
  } catch (error) {
    try {
      fs.unlinkSync(tempPath);
    } catch {}
    throw error;
  }
}
