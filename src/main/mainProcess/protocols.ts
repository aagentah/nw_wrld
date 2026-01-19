import * as path from "node:path";

import { state, srcDir } from "./state";
import { isExistingDirectory, resolveWithinDir } from "./pathSafety";

type ElectronApp = { isPackaged: boolean; dock: { setIcon(icon: unknown): void } };
type ElectronProtocol = {
  registerFileProtocol(
    scheme: string,
    handler: (
      request: { url: string },
      callback: (response: { path?: string; error?: number }) => void
    ) => void
  ): void;
};
type ElectronNativeImage = { createFromPath(p: string): { isEmpty(): boolean } };

const { app, protocol, nativeImage } = require("electron") as {
  app: ElectronApp;
  protocol: ElectronProtocol;
  nativeImage: ElectronNativeImage;
};

export function registerProtocols() {
  try {
    protocol.registerFileProtocol("nw-sandbox", (request, callback) => {
      try {
        const u = new URL(request.url);
        const pathname = u.pathname || "/";
        const allowed = new Map<string, string>([
          [
            "/moduleSandbox.html",
            app.isPackaged
              ? path.join(srcDir, "projector", "views", "moduleSandbox.prod.html")
              : path.join(srcDir, "projector", "views", "moduleSandbox.html"),
          ],
          ["/moduleSandbox.js", path.join(srcDir, "..", "dist", "moduleSandbox.js")],
          ["/moduleSandbox.js.map", path.join(srcDir, "..", "dist", "moduleSandbox.js.map")],
        ]);

        const filePath = allowed.get(pathname);
        if (!filePath) return callback({ error: -6 });
        return callback({ path: filePath });
      } catch {
        return callback({ error: -2 });
      }
    });
  } catch {}

  try {
    protocol.registerFileProtocol("nw-assets", (request, callback) => {
      try {
        const u = new URL(request.url);
        const pathname = u.pathname || "/";
        const raw = pathname.startsWith("/") ? pathname.slice(1) : pathname;
        const parts = raw.split("/").filter(Boolean);
        const token = parts.length ? decodeURIComponent(parts[0]) : null;
        const relPath =
          parts.length > 1
            ? parts
                .slice(1)
                .map((p) => decodeURIComponent(p))
                .join("/")
            : "";

        if (!token || !state.sandboxTokenToProjectDir.has(token)) {
          return callback({ error: -6 });
        }

        if (!relPath) {
          return callback({ error: -6 });
        }

        const entry = state.sandboxTokenToProjectDir.get(token) || null;
        const projectDir = entry && typeof entry.projectDir === "string" ? entry.projectDir : null;
        if (!projectDir || !isExistingDirectory(projectDir)) {
          return callback({ error: -6 });
        }

        const assetsDir = path.join(projectDir, "assets");
        const fullPath = resolveWithinDir(assetsDir, relPath);
        if (!fullPath) {
          return callback({ error: -6 });
        }
        return callback({ path: fullPath });
      } catch {
        return callback({ error: -2 });
      }
    });
  } catch {}

  if (process.platform === "darwin" && !app.isPackaged) {
    try {
      const iconPath = path.join(srcDir, "assets", "images", "blueprint.png");
      const icon = nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) {
        app.dock.setIcon(icon);
      }
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? (err as { message?: unknown }).message
          : err;
      console.error("[Main] Failed to set dock icon:", message || err);
    }
  }
}
