import { useEffect, useRef, useState } from "react";
import { loadSettings } from "../../../shared/json/configUtils";
import { updateUserData } from "../utils";

type UseDashboardProjectorSettingsArgs = {
  userData: Record<string, unknown>;
  setUserData: Parameters<typeof updateUserData>[0];
  invokeIPC: (channel: string, ...args: unknown[]) => Promise<unknown>;
  sendToProjector: (type: string, props: Record<string, unknown>) => void;
};

export const useDashboardProjectorSettings = ({
  userData,
  setUserData,
  invokeIPC,
  sendToProjector,
}: UseDashboardProjectorSettingsArgs) => {
  const [aspectRatio, setAspectRatio] = useState("default");
  const [bgColor, setBgColor] = useState("grey");
  const [settings, setSettings] = useState({ aspectRatios: [], backgroundColors: [] });
  const [availableMidiDevices, setAvailableMidiDevices] = useState<Array<{ id: string; name: string }>>(
    []
  );

  useEffect(() => {
    loadSettings().then((loadedSettings) => {
      setSettings(loadedSettings as { aspectRatios: unknown[]; backgroundColors: unknown[] });
    });

    invokeIPC("input:get-midi-devices")
      .then((devices) => {
        setAvailableMidiDevices(devices as Array<{ id: string; name: string }>);
      })
      .catch(() => {});
  }, [invokeIPC]);

  useEffect(() => {
    const cfg = userData?.config && typeof userData.config === "object" ? userData.config : null;
    if (cfg) {
      const storedAspect = (cfg as Record<string, unknown>).aspectRatio;
      const nextAspectRaw = typeof storedAspect === "string" ? storedAspect : "";
      const nextAspect = !nextAspectRaw || nextAspectRaw === "landscape" ? "default" : nextAspectRaw;
      setAspectRatio((prev) => {
        if (String(nextAspect) !== prev) {
          return String(nextAspect);
        }
        return prev;
      });

      const storedBg = (cfg as Record<string, unknown>).bgColor;
      const nextBg = typeof storedBg === "string" && storedBg ? storedBg : "grey";
      setBgColor((prev) => {
        if (String(nextBg) !== prev) {
          return String(nextBg);
        }
        return prev;
      });
    }
  }, [userData]);

  useEffect(() => {
    updateUserData(setUserData, (draft) => {
      const d = draft as unknown as { config?: Record<string, unknown> };
      if (!d.config) d.config = {};
      if (d.config.aspectRatio !== aspectRatio) {
        d.config.aspectRatio = aspectRatio;
      }
    });
  }, [aspectRatio, setUserData]);

  useEffect(() => {
    sendToProjector("toggleAspectRatioStyle", { name: aspectRatio });
  }, [aspectRatio, sendToProjector]);

  const didInitAspectRefreshRef = useRef(false);
  useEffect(() => {
    if (!didInitAspectRefreshRef.current) {
      didInitAspectRefreshRef.current = true;
      return;
    }
    const t = setTimeout(() => {
      sendToProjector("refresh-projector", {});
    }, 200);
    return () => clearTimeout(t);
  }, [aspectRatio, sendToProjector]);

  useEffect(() => {
    updateUserData(setUserData, (draft) => {
      const d = draft as unknown as { config?: Record<string, unknown> };
      if (!d.config) d.config = {};
      if (d.config.bgColor !== bgColor) {
        d.config.bgColor = bgColor;
      }
    });
  }, [bgColor, setUserData]);

  useEffect(() => {
    sendToProjector("setBg", { value: bgColor });
  }, [bgColor, sendToProjector]);

  return {
    aspectRatio,
    setAspectRatio,
    bgColor,
    setBgColor,
    settings,
    availableMidiDevices,
  };
};

