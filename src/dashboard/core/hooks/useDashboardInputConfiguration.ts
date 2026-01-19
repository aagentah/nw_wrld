import { useEffect, useRef } from "react";
import { updateUserData } from "../utils";

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

  useEffect(() => {
    if (inputConfig && !isInitialMountInput.current) {
      updateUserData(setUserData, (draft) => {
        const d = draft as unknown as { config?: Record<string, unknown> };
        if (!d.config) d.config = {};
        d.config.input = inputConfig;
      });

      invokeIPC("input:configure", inputConfig).catch((err) => {
        console.error("[Dashboard] Failed to configure input:", err);
      });
    }
    isInitialMountInput.current = false;
  }, [inputConfig, invokeIPC, setUserData]);

  const prevSequencerModeRef = useRef<unknown>(undefined);
  useEffect(() => {
    const config = userData?.config && typeof userData.config === "object" ? userData.config : null;
    const next = config ? (config as Record<string, unknown>).sequencerMode : undefined;
    const prev = prevSequencerModeRef.current;
    prevSequencerModeRef.current = next;

    if (prev === true && next === false) {
      invokeIPC("input:configure", inputConfig).catch((err) => {
        console.error("[Dashboard] Failed to configure input:", err);
      });
    }
  }, [userData, inputConfig, invokeIPC]);
};

