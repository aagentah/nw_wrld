import { useEffect, useRef } from "react";
import { updateUserData } from "../utils";
import { readDebugFlag } from "../utils/readDebugFlag";

type UseDashboardInputConfigurationArgs = {
  userData: Record<string, unknown>;
  setUserData: Parameters<typeof updateUserData>[0];
  invokeIPC: (channel: string, ...args: unknown[]) => Promise<unknown>;
  inputConfig: Record<string, unknown>;
};

export const useDashboardInputConfiguration = ({
  userData,
  setUserData,
  invokeIPC,
  inputConfig,
}: UseDashboardInputConfigurationArgs) => {
  const isInitialMountInput = useRef(true);
  const prevInputConfigRef = useRef<Record<string, unknown> | null>(null);

  const pickInputConfigSummary = (cfg: Record<string, unknown> | null) => {
    if (!cfg) return null;
    const keys = [
      "type",
      "deviceId",
      "deviceName",
      "trackSelectionChannel",
      "methodTriggerChannel",
      "velocitySensitive",
      "port",
      "noteMatchMode",
    ];
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = cfg[k];
    return out;
  };

  const diffKeys = (prev: Record<string, unknown> | null, next: Record<string, unknown>) => {
    const keys = new Set<string>();
    if (prev) Object.keys(prev).forEach((k) => keys.add(k));
    Object.keys(next).forEach((k) => keys.add(k));
    const changed: string[] = [];
    for (const k of keys) {
      const a = prev ? prev[k] : undefined;
      const b = next[k];
      if (a !== b) changed.push(k);
    }
    changed.sort();
    return changed;
  };

  useEffect(() => {
    if (inputConfig && !isInitialMountInput.current) {
      const debug = readDebugFlag("nwWrld.debug.input");
      if (debug) {
        const prev = prevInputConfigRef.current;
        const changed = diffKeys(prev, inputConfig);
        const prevSummary = pickInputConfigSummary(prev);
        const nextSummary = pickInputConfigSummary(inputConfig);
        console.log("[InputDebug] inputConfig changed", {
          changedKeys: changed,
          prev: prevSummary,
          next: nextSummary,
        });
        console.log("[InputDebug] invoking input:configure", { inputConfig: nextSummary });
      }

      updateUserData(setUserData, (draft) => {
        const d = draft as unknown as { config?: Record<string, unknown> };
        if (!d.config) d.config = {};
        d.config.input = inputConfig;
      });

      invokeIPC("input:configure", inputConfig).catch((err) => {
        console.error("[Dashboard] Failed to configure input:", err);
      });
    }
    prevInputConfigRef.current = inputConfig;
    isInitialMountInput.current = false;
  }, [inputConfig, invokeIPC, setUserData]);

  const prevSequencerModeRef = useRef<unknown>(undefined);
  useEffect(() => {
    const config = userData?.config && typeof userData.config === "object" ? userData.config : null;
    const next = config ? (config as Record<string, unknown>).sequencerMode : undefined;
    const prev = prevSequencerModeRef.current;
    prevSequencerModeRef.current = next;

    if (prev === true && next === false) {
      const debug = readDebugFlag("nwWrld.debug.input");
      if (debug) {
        console.log("[InputDebug] sequencerMode disabled -> reconfiguring input", {
          inputConfig: pickInputConfigSummary(inputConfig),
        });
      }
      invokeIPC("input:configure", inputConfig).catch((err) => {
        console.error("[Dashboard] Failed to configure input:", err);
      });
    }
  }, [userData, inputConfig, invokeIPC]);
};

