import { ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";

import { emitScriptedSourceRun } from "../../../shared/observatory/testEmitter";
import type { ObservatoryRefusalCode } from "../../../shared/observatory/types";
import { ensureObservatoryStore } from "../observatory";
import { state } from "../state";

type StartCapturePayload = {
  initiator: string;
  destination: string;
};

type SourceRunPayload = {
  sourceRunId: string;
};

type DeclareOutcomePayload = SourceRunPayload & {
  outcome: string;
};

type EmitterStartResult = { ok: true } | { ok: false; code: ObservatoryRefusalCode };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.prototype.toString.call(value) === "[object Object]";

const asNonEmptyTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
};

const isAtlasWindowSender = (event: IpcMainInvokeEvent): boolean =>
  state.observatoryWindowWebContentsId !== null &&
  event.sender.id === state.observatoryWindowWebContentsId;

const normalizeStartCapturePayload = (value: unknown): StartCapturePayload | null => {
  if (!isPlainObject(value) || typeof value.initiator !== "string") return null;
  if (value.destination !== undefined && typeof value.destination !== "string") return null;

  return {
    initiator: value.initiator,
    destination: typeof value.destination === "string" ? value.destination.trim() : "",
  };
};

const normalizeSourceRunPayload = (value: unknown): SourceRunPayload | null => {
  if (!isPlainObject(value)) return null;
  const sourceRunId = asNonEmptyTrimmedString(value.sourceRunId);
  return sourceRunId ? { sourceRunId } : null;
};

const normalizeDeclareOutcomePayload = (value: unknown): DeclareOutcomePayload | null => {
  if (!isPlainObject(value)) return null;

  const sourceRunId = asNonEmptyTrimmedString(value.sourceRunId);
  const outcome = asNonEmptyTrimmedString(value.outcome);
  if (!sourceRunId || !outcome || outcome.length > 500) return null;

  return { sourceRunId, outcome };
};

export function registerObservatoryBridge(): void {
  ipcMain.handle("bridge:observatory:getState", async (event) => {
    if (!isAtlasWindowSender(event)) {
      return { ok: false, code: "OPERATOR_CONSENT_REQUIRED" };
    }

    return { ok: true, state: ensureObservatoryStore().getState() };
  });

  ipcMain.handle("bridge:observatory:startCapture", async (event, payload: unknown) => {
    if (!isAtlasWindowSender(event)) {
      return { ok: false, code: "OPERATOR_CONSENT_REQUIRED" };
    }

    const input = normalizeStartCapturePayload(payload);
    if (!input) return { ok: false, code: "INVALID_INPUT" };

    return ensureObservatoryStore().startCapture({
      ...input,
      at: new Date().toISOString(),
    });
  });

  ipcMain.handle("bridge:observatory:runTestEmitter", async (event, payload: unknown) => {
    if (!isAtlasWindowSender(event)) {
      return { ok: false, code: "OPERATOR_CONSENT_REQUIRED" } satisfies EmitterStartResult;
    }

    const input = normalizeSourceRunPayload(payload);
    if (!input) return { ok: false, code: "INVALID_INPUT" } satisfies EmitterStartResult;

    const store = ensureObservatoryStore();
    const run = store
      .getState()
      .runs.find((candidate) => candidate.identity.sourceRunId === input.sourceRunId);
    if (!run) return { ok: false, code: "NOT_INSTRUMENTED" } satisfies EmitterStartResult;
    if (run.environment?.endedAt) {
      return { ok: false, code: "RUN_ENDED" } satisfies EmitterStartResult;
    }

    await emitScriptedSourceRun((eventInput) => store.recordEvent(input.sourceRunId, eventInput), {
      delayMs: 0,
    });
    return { ok: true } satisfies EmitterStartResult;
  });

  ipcMain.handle("bridge:observatory:declareOutcome", async (event, payload: unknown) => {
    if (!isAtlasWindowSender(event)) {
      return { ok: false, code: "OPERATOR_CONSENT_REQUIRED" };
    }

    const input = normalizeDeclareOutcomePayload(payload);
    if (!input) return { ok: false, code: "INVALID_INPUT" };

    return ensureObservatoryStore().recordEvent(input.sourceRunId, {
      kind: "outcome",
      actor: "operator",
      summary: input.outcome,
      at: new Date().toISOString(),
    });
  });

  ipcMain.handle("bridge:observatory:endRun", async (event, payload: unknown) => {
    if (!isAtlasWindowSender(event)) {
      return { ok: false, code: "OPERATOR_CONSENT_REQUIRED" };
    }

    const input = normalizeSourceRunPayload(payload);
    if (!input) return { ok: false, code: "INVALID_INPUT" };

    return ensureObservatoryStore().recordEvent(input.sourceRunId, {
      kind: "run_end",
      actor: "source",
      summary: "Instrumented source run ended",
      at: new Date().toISOString(),
    });
  });
}
