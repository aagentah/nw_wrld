import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

const writeQueue = new Map<string, Promise<void>>();
const writeEpoch = new Map<string, number>();
let tmpCounter = 0;

function makeTempPath(filePath: string) {
  tmpCounter = (tmpCounter + 1) >>> 0;
  const uuid =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${filePath}.tmp.${process.pid}.${Date.now()}.${tmpCounter}.${uuid}`;
}

async function performAtomicWrite(filePath: string, data: string, epoch: number | null) {
  const tempPath = makeTempPath(filePath);

  try {
    await fs.promises.writeFile(tempPath, data, "utf-8");

    if (epoch != null && writeEpoch.get(filePath) !== epoch) {
      try {
        await fs.promises.unlink(tempPath);
      } catch {}
      return;
    }

    try {
      await fs.promises.rename(tempPath, filePath);
    } catch (renameError) {
      const err = renameError as { code?: string };
      if (err.code === "EEXIST" || err.code === "EPERM") {
        if (epoch != null && writeEpoch.get(filePath) !== epoch) {
          try {
            await fs.promises.unlink(tempPath);
          } catch {}
          return;
        }

        const backupPath = `${filePath}.backup`;
        try {
          await fs.promises.unlink(backupPath);
        } catch {}
        try {
          await fs.promises.rename(filePath, backupPath);
        } catch (backupError) {
          const bErr = backupError as { code?: string };
          if (bErr.code !== "ENOENT") {
            throw backupError;
          }
        }

        if (epoch != null && writeEpoch.get(filePath) !== epoch) {
          try {
            await fs.promises.rename(backupPath, filePath);
          } catch {}
          try {
            await fs.promises.unlink(tempPath);
          } catch {}
          return;
        }

        await fs.promises.rename(tempPath, filePath);
        try {
          await fs.promises.unlink(backupPath);
        } catch {}
      } else {
        throw renameError;
      }
    }
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

  try {
    fs.writeFileSync(tempPath, data, "utf-8");

    if (epoch != null && writeEpoch.get(filePath) !== epoch) {
      try {
        fs.unlinkSync(tempPath);
      } catch {}
      return;
    }

    try {
      fs.renameSync(tempPath, filePath);
    } catch (renameError) {
      const err = renameError as { code?: string };
      if (err.code === "EEXIST" || err.code === "EPERM") {
        if (epoch != null && writeEpoch.get(filePath) !== epoch) {
          try {
            fs.unlinkSync(tempPath);
          } catch {}
          return;
        }

        const backupPath = `${filePath}.backup`;
        try {
          fs.unlinkSync(backupPath);
        } catch {}
        try {
          fs.renameSync(filePath, backupPath);
        } catch (backupError) {
          const bErr = backupError as { code?: string };
          if (bErr.code !== "ENOENT") {
            throw backupError;
          }
        }

        if (epoch != null && writeEpoch.get(filePath) !== epoch) {
          try {
            fs.renameSync(backupPath, filePath);
          } catch {}
          try {
            fs.unlinkSync(tempPath);
          } catch {}
          return;
        }

        fs.renameSync(tempPath, filePath);
        try {
          fs.unlinkSync(backupPath);
        } catch {}
      } else {
        throw renameError;
      }
    }
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
