import { useCallback, useEffect, useState } from "react";

type AudioDevice = { id: string; label: string };

export function useDashboardAudioDevices(enabled: boolean) {
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      if (!navigator.mediaDevices?.enumerateDevices) {
        setDevices([]);
        setError("Audio devices API not available.");
        return;
      }
      const all = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = all
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({
          id: d.deviceId,
          label: d.label || "Microphone",
        }))
        .filter((d) => d.id);
      setDevices(audioInputs);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setDevices([]);
      setError(message);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh().catch(() => {});
  }, [enabled, refresh]);

  return { devices, refresh, error };
}

