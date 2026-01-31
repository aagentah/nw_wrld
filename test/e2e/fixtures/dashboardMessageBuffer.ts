import type { Page } from "playwright";

type BufferedMessage = {
  type: string;
  props: Record<string, unknown>;
  ts: number;
};

export async function installDashboardMessageBuffer(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const bridge = globalThis.nwWrldBridge as unknown as {
        messaging?: { onFromProjector?: unknown };
      } | null;
      return Boolean(bridge?.messaging && typeof bridge.messaging.onFromProjector === "function");
    },
    undefined,
    { timeout: 15_000 }
  );
  await page.evaluate(() => {
    const bridge = globalThis.nwWrldBridge;
    const messaging = bridge?.messaging;
    if (!messaging || typeof messaging.onFromProjector !== "function") return;

    const anyGlobal = globalThis as unknown as {
      __nwWrldE2EDashboard?: {
        messages: BufferedMessage[];
        installed: boolean;
        cleanup?: (() => void) | undefined;
      };
    };

    if (anyGlobal.__nwWrldE2EDashboard?.installed) return;

    anyGlobal.__nwWrldE2EDashboard = {
      messages: [],
      installed: true,
    };

    const cleanup = messaging.onFromProjector((_event: unknown, data: unknown) => {
      if (!data || typeof data !== "object") return;
      const rawType = (data as { type?: unknown }).type;
      const rawProps = (data as { props?: unknown }).props;
      const type = typeof rawType === "string" ? rawType : String(rawType ?? "");
      const props =
        rawProps && typeof rawProps === "object" && !Array.isArray(rawProps)
          ? (rawProps as Record<string, unknown>)
          : {};
      anyGlobal.__nwWrldE2EDashboard?.messages.push({ type, props, ts: Date.now() });
    });
    anyGlobal.__nwWrldE2EDashboard.cleanup = typeof cleanup === "function" ? cleanup : undefined;
  });
}

export async function clearDashboardMessages(page: Page): Promise<void> {
  await page.evaluate(() => {
    const anyGlobal = globalThis as unknown as {
      __nwWrldE2EDashboard?: { messages: unknown[] };
    };
    if (!anyGlobal.__nwWrldE2EDashboard) return;
    anyGlobal.__nwWrldE2EDashboard.messages = [];
  });
}

export async function getDashboardMessages(page: Page): Promise<BufferedMessage[]> {
  return await page.evaluate(() => {
    const anyGlobal = globalThis as unknown as {
      __nwWrldE2EDashboard?: { messages: BufferedMessage[] };
    };
    const msgs = anyGlobal.__nwWrldE2EDashboard?.messages;
    return Array.isArray(msgs) ? msgs : [];
  });
}
