import type { Page } from "playwright";

type BufferedStatus = {
  status: string;
  message: string;
  ts: number;
  config: unknown;
};

export async function installInputStatusBuffer(page: Page): Promise<void> {
  await page.evaluate(() => {
    const bridge = globalThis.nwWrldBridge;
    const messaging = bridge?.messaging;
    if (!messaging || typeof messaging.onInputStatus !== "function") return;

    const anyGlobal = globalThis as unknown as {
      __nwWrldE2EInputStatus?: {
        statuses: BufferedStatus[];
        installed: boolean;
        cleanup?: (() => void) | undefined;
      };
    };

    if (anyGlobal.__nwWrldE2EInputStatus?.installed) return;

    anyGlobal.__nwWrldE2EInputStatus = {
      statuses: [],
      installed: true,
    };

    const cleanup = messaging.onInputStatus((_event: unknown, payload: unknown) => {
      const p = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
      const data = p && typeof p.data === "object" && p.data ? (p.data as Record<string, unknown>) : null;
      const status = data && typeof data.status === "string" ? data.status : "";
      const message = data && typeof data.message === "string" ? data.message : "";
      const config = data ? data.config : undefined;
      anyGlobal.__nwWrldE2EInputStatus?.statuses.push({ status, message, config, ts: Date.now() });
    });
    anyGlobal.__nwWrldE2EInputStatus.cleanup = typeof cleanup === "function" ? cleanup : undefined;
  });
}

export async function clearInputStatuses(page: Page): Promise<void> {
  await page.evaluate(() => {
    const anyGlobal = globalThis as unknown as {
      __nwWrldE2EInputStatus?: { statuses: unknown[] };
    };
    if (!anyGlobal.__nwWrldE2EInputStatus) return;
    anyGlobal.__nwWrldE2EInputStatus.statuses = [];
  });
}

export async function getInputStatuses(page: Page): Promise<BufferedStatus[]> {
  return await page.evaluate(() => {
    const anyGlobal = globalThis as unknown as {
      __nwWrldE2EInputStatus?: { statuses: BufferedStatus[] };
    };
    const s = anyGlobal.__nwWrldE2EInputStatus?.statuses;
    return Array.isArray(s) ? s : [];
  });
}

