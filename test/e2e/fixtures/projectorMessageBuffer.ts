import type { Page } from "playwright";

type BufferedMessage = {
  type: string;
  props: Record<string, unknown>;
  ts: number;
};

export async function installProjectorMessageBuffer(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const bridge = globalThis.nwWrldBridge as unknown as {
        messaging?: { onFromDashboard?: unknown };
      } | null;
      return Boolean(bridge?.messaging && typeof bridge.messaging.onFromDashboard === "function");
    },
    undefined,
    { timeout: 15_000 }
  );
  await page.evaluate(() => {
    const bridge = globalThis.nwWrldBridge;
    const messaging = bridge?.messaging;
    if (!messaging || typeof messaging.onFromDashboard !== "function") return;

    const anyGlobal = globalThis as unknown as {
      __nwWrldE2EProjector?: {
        messages: BufferedMessage[];
        installed: boolean;
        cleanup?: (() => void) | undefined;
      };
    };

    if (anyGlobal.__nwWrldE2EProjector?.installed) return;

    const storageKey = "__nwWrldE2EProjectorMessages";
    let existing: BufferedMessage[] = [];
    try {
      const raw = globalThis.sessionStorage?.getItem?.(storageKey) || null;
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          existing = parsed.filter((x) => x && typeof x === "object") as BufferedMessage[];
        }
      }
    } catch {}

    anyGlobal.__nwWrldE2EProjector = {
      messages: existing,
      installed: true,
    };

    const cleanup = messaging.onFromDashboard((_event: unknown, data: unknown) => {
      if (!data || typeof data !== "object") return;
      const rawType = (data as { type?: unknown }).type;
      const rawProps = (data as { props?: unknown }).props;
      const type = typeof rawType === "string" ? rawType : String(rawType ?? "");
      const props =
        rawProps && typeof rawProps === "object" && !Array.isArray(rawProps)
          ? (rawProps as Record<string, unknown>)
          : {};
      const next = { type, props, ts: Date.now() };
      anyGlobal.__nwWrldE2EProjector?.messages.push(next);
      try {
        globalThis.sessionStorage?.setItem?.(
          storageKey,
          JSON.stringify(anyGlobal.__nwWrldE2EProjector?.messages || [])
        );
      } catch {}
    });
    anyGlobal.__nwWrldE2EProjector.cleanup = typeof cleanup === "function" ? cleanup : undefined;
  });
}

export async function clearProjectorMessages(page: Page): Promise<void> {
  await page.evaluate(() => {
    const anyGlobal = globalThis as unknown as {
      __nwWrldE2EProjector?: { messages: unknown[] };
    };
    try {
      globalThis.sessionStorage?.removeItem?.("__nwWrldE2EProjectorMessages");
    } catch {}
    if (!anyGlobal.__nwWrldE2EProjector) return;
    anyGlobal.__nwWrldE2EProjector.messages = [];
  });
}

export async function getProjectorMessages(page: Page): Promise<BufferedMessage[]> {
  return await page.evaluate(() => {
    const anyGlobal = globalThis as unknown as {
      __nwWrldE2EProjector?: { messages: BufferedMessage[] };
    };
    const msgs = anyGlobal.__nwWrldE2EProjector?.messages;
    if (Array.isArray(msgs)) return msgs;
    try {
      const raw = globalThis.sessionStorage?.getItem?.("__nwWrldE2EProjectorMessages") || null;
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as BufferedMessage[]) : [];
    } catch {
      return [];
    }
  });
}
