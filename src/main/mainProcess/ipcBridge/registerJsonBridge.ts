import { ipcMain } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";

import { atomicWriteFile, atomicWriteFileSync } from "../../../shared/json/atomicWrite";
import { readJsonWithBackup, readJsonWithBackupSync } from "../../../shared/json/readJsonWithBackup";
import { sanitizeJsonForBridge } from "../../../shared/validation/jsonBridgeValidation";
import { safeJsonFilename, isExistingDirectory } from "../pathSafety";
import {
  getJsonDirForBridge,
  getJsonStatusForProject,
  maybeMigrateLegacyJsonFileForBridge,
} from "../workspace";
import { getProjectDirForEvent, type SenderEvent } from "./projectContext";

type Jsonish = string | number | boolean | null | undefined | object;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

const stripIsDefaultDataFlag = (v: unknown): unknown => {
  if (!isPlainObject(v)) return v;
  if (!("_isDefaultData" in v)) return v;
  const out = { ...v };
  delete (out as { _isDefaultData?: unknown })._isDefaultData;
  return out;
};

export function registerJsonBridge(): void {
  ipcMain.handle("bridge:json:read", async (event, filename, defaultValue) => {
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    const safeName = safeJsonFilename(filename);
    if (!safeName) return defaultValue;
    if (projectDir && isExistingDirectory(projectDir)) {
      try {
        maybeMigrateLegacyJsonFileForBridge(projectDir, safeName);
      } catch {}
    }
    const dir = getJsonDirForBridge(projectDir);
    const filePath = path.join(dir, safeName);
    if (safeName === "userData.json") {
      let rawPrimary: string | null = null;
      try {
        rawPrimary = await fs.promises.readFile(filePath, "utf-8");
      } catch {
        rawPrimary = null;
      }

      if (rawPrimary != null) {
        try {
          const parsed = JSON.parse(rawPrimary) as unknown;
          return sanitizeJsonForBridge(
            safeName,
            parsed as unknown as Jsonish,
            defaultValue as unknown as Jsonish
          );
        } catch {
          try {
            const corruptPath = `${filePath}.corrupt.${Date.now()}`;
            await fs.promises.writeFile(corruptPath, rawPrimary, "utf-8");
          } catch {}
          console.error("[Main] userData.json is corrupted, recovering with defaults");
        }
      }

      try {
        const raw = await fs.promises.readFile(`${filePath}.backup`, "utf-8");
        const parsed = JSON.parse(raw) as unknown;
        return sanitizeJsonForBridge(
          safeName,
          parsed as unknown as Jsonish,
          defaultValue as unknown as Jsonish
        );
      } catch {}

      const safeDefault = stripIsDefaultDataFlag(defaultValue);
      return sanitizeJsonForBridge(
        safeName,
        safeDefault as unknown as Jsonish,
        defaultValue as unknown as Jsonish
      );
    }
    const value = await readJsonWithBackup(filePath, defaultValue);
    return sanitizeJsonForBridge(
      safeName,
      value as unknown as Jsonish,
      defaultValue as unknown as Jsonish
    );
  });

  ipcMain.on("bridge:json:readSync", (event, filename, defaultValue) => {
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    const safeName = safeJsonFilename(filename);
    if (!safeName) {
      event.returnValue = defaultValue;
      return;
    }
    if (projectDir && isExistingDirectory(projectDir)) {
      try {
        maybeMigrateLegacyJsonFileForBridge(projectDir, safeName);
      } catch {}
    }
    const dir = getJsonDirForBridge(projectDir);
    const filePath = path.join(dir, safeName);
    if (safeName === "userData.json") {
      let rawPrimary: string | null = null;
      try {
        rawPrimary = fs.readFileSync(filePath, "utf-8");
      } catch {
        rawPrimary = null;
      }

      if (rawPrimary != null) {
        try {
          const parsed = JSON.parse(rawPrimary) as unknown;
          event.returnValue = sanitizeJsonForBridge(
            safeName,
            parsed as unknown as Jsonish,
            defaultValue as unknown as Jsonish
          );
          return;
        } catch {
          try {
            const corruptPath = `${filePath}.corrupt.${Date.now()}`;
            fs.writeFileSync(corruptPath, rawPrimary, "utf-8");
          } catch {}
          console.error("[Main] userData.json is corrupted, recovering with defaults (sync)");
        }
      }

      try {
        const raw = fs.readFileSync(`${filePath}.backup`, "utf-8");
        const parsed = JSON.parse(raw) as unknown;
        event.returnValue = sanitizeJsonForBridge(
          safeName,
          parsed as unknown as Jsonish,
          defaultValue as unknown as Jsonish
        );
        return;
      } catch {}

      const safeDefault = stripIsDefaultDataFlag(defaultValue);
      event.returnValue = sanitizeJsonForBridge(
        safeName,
        safeDefault as unknown as Jsonish,
        defaultValue as unknown as Jsonish
      );
      return;
    }
    const value = readJsonWithBackupSync(filePath, defaultValue);
    event.returnValue = sanitizeJsonForBridge(
      safeName,
      value as unknown as Jsonish,
      defaultValue as unknown as Jsonish
    );
  });

  ipcMain.handle("bridge:json:write", async (event, filename, data) => {
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    const safeName = safeJsonFilename(filename);
    if (!safeName) return { ok: false, reason: "INVALID_FILENAME" };
    const status = getJsonStatusForProject(projectDir);
    if (!status.ok) return status;
    const dir = getJsonDirForBridge(projectDir);
    const filePath = path.join(dir, safeName);
    try {
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await atomicWriteFile(filePath, JSON.stringify(data, null, 2));
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        reason: e instanceof Error ? e.message : "WRITE_FAILED",
      };
    }
  });

  ipcMain.on("bridge:json:writeSync", (event, filename, data) => {
    const projectDir = getProjectDirForEvent(event as unknown as SenderEvent);
    const safeName = safeJsonFilename(filename);
    if (!safeName) {
      event.returnValue = { ok: false, reason: "INVALID_FILENAME" };
      return;
    }
    const status = getJsonStatusForProject(projectDir);
    if (!status.ok) {
      event.returnValue = status;
      return;
    }
    const dir = getJsonDirForBridge(projectDir);
    const filePath = path.join(dir, safeName);
    try {
      try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
      } catch {}
      atomicWriteFileSync(filePath, JSON.stringify(data, null, 2));
      event.returnValue = { ok: true };
    } catch (e) {
      event.returnValue = {
        ok: false,
        reason: e instanceof Error ? e.message : "WRITE_FAILED",
      };
    }
  });
}

