import type { Page } from "playwright";

type BufferedInputEvent = {
  type: string;
  data: unknown;
  ts: number;
};

export async function installInputEventBuffer(page: Page): Promise<void> {
  await page.evaluate(() => {
    const bridge = globalThis.nwWrldBridge;
    const messaging = bridge?.messaging;
    if (!messaging || typeof messaging.onInputEvent !== "function") return;

    const anyGlobal = globalThis as unknown as {
      __nwWrldE2EInputEvents?: {
        events: BufferedInputEvent[];
        installed: boolean;
        cleanup?: (() => void) | undefined;
      };
    };

    if (anyGlobal.__nwWrldE2EInputEvents?.installed) return;

    anyGlobal.__nwWrldE2EInputEvents = {
      events: [],
      installed: true,
    };

    const cleanup = messaging.onInputEvent((_event: unknown, payload: unknown) => {
      const p = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
      const type = p && typeof p.type === "string" ? p.type : "";
      const data = p ? (p as Record<string, unknown>).data : undefined;
      anyGlobal.__nwWrldE2EInputEvents?.events.push({ type, data, ts: Date.now() });
    });
    anyGlobal.__nwWrldE2EInputEvents.cleanup = typeof cleanup === "function" ? cleanup : undefined;
  });
}

export async function clearInputEvents(page: Page): Promise<void> {
  await page.evaluate(() => {
    const anyGlobal = globalThis as unknown as {
      __nwWrldE2EInputEvents?: { events: unknown[] };
    };
    if (!anyGlobal.__nwWrldE2EInputEvents) return;
    anyGlobal.__nwWrldE2EInputEvents.events = [];
  });
}

export async function getInputEvents(page: Page): Promise<BufferedInputEvent[]> {
  return await page.evaluate(() => {
    const anyGlobal = globalThis as unknown as {
      __nwWrldE2EInputEvents?: { events: BufferedInputEvent[] };
    };
    const e = anyGlobal.__nwWrldE2EInputEvents?.events;
    return Array.isArray(e) ? e : [];
  });
}

