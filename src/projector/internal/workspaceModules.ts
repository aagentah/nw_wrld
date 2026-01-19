import { getBridge } from "./bridge";

type ReadModuleWithMetaResult = {
  text?: unknown;
  mtimeMs?: unknown;
};

type WorkspaceModulesContext = {
  workspacePath: unknown;
  workspaceModuleSourceCache: Map<
    string,
    Promise<{ moduleId: string; text: string; mtimeMs: number }>
  >;
};

export async function loadWorkspaceModuleSource(
  this: WorkspaceModulesContext,
  moduleType: unknown
): Promise<{ moduleId: string; text: string; mtimeMs: number } | null> {
  if (!moduleType) return null;

  const safeModuleType = String(moduleType).trim();
  if (!safeModuleType) return null;
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(safeModuleType)) {
    throw new Error(
      `[Projector] Invalid module type "${safeModuleType}" (expected alphanumeric class/file name, no paths).`
    );
  }

  if (!this.workspacePath) {
    throw new Error(
      `[Projector] Project directory is not set; cannot load module "${safeModuleType}".`
    );
  }

  const bridge = getBridge();
  if (
    !bridge ||
    !bridge.workspace ||
    typeof bridge.workspace.readModuleWithMeta !== "function"
  ) {
    throw new Error(`[Projector] Workspace module bridge is unavailable.`);
  }

  const info = (await bridge.workspace.readModuleWithMeta(
    safeModuleType
  )) as ReadModuleWithMetaResult | null;
  if (!info || typeof info.text !== "string") {
    throw new Error(`[Projector] Workspace module not found: "${safeModuleType}".`);
  }

  const mtimeMs = typeof info.mtimeMs === "number" ? info.mtimeMs : 0;
  const cacheKey = `${safeModuleType}:${mtimeMs}`;
  if (this.workspaceModuleSourceCache.has(cacheKey)) {
    return this.workspaceModuleSourceCache.get(cacheKey) || null;
  }

  const promise = Promise.resolve({
    moduleId: safeModuleType,
    text: info.text,
    mtimeMs,
  });

  for (const key of this.workspaceModuleSourceCache.keys()) {
    if (key.startsWith(`${safeModuleType}:`) && key !== cacheKey) {
      this.workspaceModuleSourceCache.delete(key);
    }
  }
  this.workspaceModuleSourceCache.set(cacheKey, promise);
  return promise;
}

