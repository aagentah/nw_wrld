import { useCallback, type MutableRefObject } from "react";
import { produce } from "immer";

type UseDashboardUpdateConfigArgs = {
  setUserData: (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void;
  userDataConfig: Record<string, unknown> | undefined;
  isSequencerPlaying: boolean;
  sequencerEngineRef: MutableRefObject<{ setBpm?: (bpm: number) => void; stop?: () => void; getRunId?: () => number } | null>;
  sequencerRunIdRef: MutableRefObject<number>;
  setIsSequencerPlaying: (next: boolean) => void;
  setSequencerCurrentStep: (next: number) => void;
};

export const useDashboardUpdateConfig = ({
  setUserData,
  userDataConfig,
  isSequencerPlaying,
  sequencerEngineRef,
  sequencerRunIdRef,
  setIsSequencerPlaying,
  setSequencerCurrentStep,
}: UseDashboardUpdateConfigArgs) => {
  return useCallback(
    (updates: Record<string, unknown>) => {
      const wasSequencerMode = userDataConfig?.sequencerMode;
      const willBeSequencerMode = Object.prototype.hasOwnProperty.call(updates || {}, "sequencerMode")
        ? (updates as Record<string, unknown>).sequencerMode
        : wasSequencerMode;

      if (
        willBeSequencerMode &&
        Object.prototype.hasOwnProperty.call(updates || {}, "sequencerBpm") &&
        typeof (updates as Record<string, unknown>).sequencerBpm === "number" &&
        Number.isFinite((updates as Record<string, unknown>).sequencerBpm as number) &&
        sequencerEngineRef.current
      ) {
        sequencerEngineRef.current.setBpm?.((updates as Record<string, unknown>).sequencerBpm as number);
      }

      if (wasSequencerMode && !willBeSequencerMode && isSequencerPlaying) {
        if (sequencerEngineRef.current) {
          sequencerEngineRef.current.stop?.();
          if (typeof sequencerEngineRef.current.getRunId === "function") {
            sequencerRunIdRef.current = sequencerEngineRef.current.getRunId();
          }
          setIsSequencerPlaying(false);
          setSequencerCurrentStep(0);
        }
      }

      const normalizeUserColors = (list: unknown) => {
        const raw = Array.isArray(list) ? list : [];
        const out: string[] = [];
        const seen = new Set<string>();
        for (const v of raw) {
          const s = String(v || "").trim();
          if (!s) continue;
          const withHash = s.startsWith("#") ? s : `#${s}`;
          if (!/^#([0-9A-F]{3}){1,2}$/i.test(withHash)) continue;
          let hex = withHash.toLowerCase();
          if (hex.length === 4) {
            const r = hex[1];
            const g = hex[2];
            const b = hex[3];
            hex = `#${r}${r}${g}${g}${b}${b}`;
          }
          if (seen.has(hex)) continue;
          seen.add(hex);
          out.push(hex);
        }
        return out;
      };

      setUserData(
        produce((draft: Record<string, unknown>) => {
          if (!draft.config || typeof draft.config !== "object") {
            draft.config = {};
          }
          const config = draft.config as Record<string, unknown>;

          const hasUserColors = Object.prototype.hasOwnProperty.call(updates || {}, "userColors");

          if (hasUserColors) {
            const palette = normalizeUserColors((updates as Record<string, unknown>).userColors);
            config.userColors = palette;

            const syncOptions = (options: unknown) => {
              const list = Array.isArray(options) ? options : [];
              for (const opt of list) {
                if (!opt || typeof opt !== "object") continue;
                const o = opt as Record<string, unknown>;
                if (o.randomizeFromUserColors !== true) continue;
                if (palette.length > 0) {
                  o.randomValues = [...palette];
                } else {
                  delete o.randomValues;
                  delete o.randomizeFromUserColors;
                }
              }
            };

            const syncMethodList = (methods: unknown) => {
              const list = Array.isArray(methods) ? methods : [];
              for (const m of list) {
                if (!m || typeof m !== "object") continue;
                const mm = m as Record<string, unknown>;
                syncOptions(mm.options);
              }
            };

            const sets = Array.isArray(draft.sets) ? (draft.sets as unknown[]) : [];
            for (const set of sets) {
              const s = set && typeof set === "object" ? (set as Record<string, unknown>) : null;
              const tracks = Array.isArray(s?.tracks) ? (s?.tracks as unknown[]) : [];
              for (const track of tracks) {
                const t = track && typeof track === "object" ? (track as Record<string, unknown>) : null;
                const modulesData =
                  t && typeof t.modulesData === "object" && t.modulesData ? (t.modulesData as Record<string, unknown>) : null;
                if (!modulesData) continue;
                for (const instanceId of Object.keys(modulesData)) {
                  const md = modulesData[instanceId] as Record<string, unknown> | null;
                  if (!md || typeof md !== "object") continue;
                  syncMethodList(md.constructor);
                  const methodsByChannel =
                    md.methods && typeof md.methods === "object" ? (md.methods as Record<string, unknown>) : null;
                  if (!methodsByChannel) continue;
                  for (const channelKey of Object.keys(methodsByChannel)) {
                    syncMethodList(methodsByChannel[channelKey]);
                  }
                }
              }
            }
          }

          if (hasUserColors) {
            const next = { ...(updates || {}) } as Record<string, unknown>;
            delete next.userColors;
            Object.assign(config, next);
          } else {
            Object.assign(config, updates);
          }
        })
      );
    },
    [
      setUserData,
      userDataConfig,
      isSequencerPlaying,
      sequencerEngineRef,
      sequencerRunIdRef,
      setIsSequencerPlaying,
      setSequencerCurrentStep,
    ]
  );
};

