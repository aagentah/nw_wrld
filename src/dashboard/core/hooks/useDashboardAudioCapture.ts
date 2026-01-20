import { useEffect, useMemo, useRef, useState } from "react";
import { readDebugFlag, readLocalStorageNumber } from "../utils/readDebugFlag";

type Band = "low" | "medium" | "high";

type Levels = Record<Band, number>;
type PeaksDb = Record<Band, number>;

const DEFAULT_GAINS: Record<Band, number> = { low: 6.0, medium: 14.0, high: 18.0 };

type AudioCaptureState =
  | { status: "idle"; levels: Levels; peaksDb: PeaksDb }
  | { status: "starting"; levels: Levels; peaksDb: PeaksDb }
  | { status: "running"; levels: Levels; peaksDb: PeaksDb }
  | { status: "error"; message: string; levels: Levels; peaksDb: PeaksDb }
  | { status: "mock"; levels: Levels; peaksDb: PeaksDb };

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

function bandForHz(hz: number): Band | null {
  if (!Number.isFinite(hz) || hz <= 0) return null;
  if (hz < 200) return "low";
  if (hz < 2000) return "medium";
  return "high";
}

const dbToLin = (db: number) => (Number.isFinite(db) ? Math.pow(10, db / 20) : 0);

export function useDashboardAudioCapture({
  enabled,
  deviceId,
  emitBand,
  thresholds,
  minIntervalMs,
}: {
  enabled: boolean;
  deviceId: string | null;
  emitBand: (payload: { channelName: Band; velocity: number }) => Promise<unknown>;
  thresholds?: Partial<Levels> | null;
  minIntervalMs?: number | null;
}) {
  const zero: Levels = { low: 0, medium: 0, high: 0 };
  const negInf: PeaksDb = { low: -Infinity, medium: -Infinity, high: -Infinity };
  const [state, setState] = useState<AudioCaptureState>({ status: "idle", levels: zero, peaksDb: negInf });
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastEmitMsRef = useRef<Record<Band, number>>({ low: 0, medium: 0, high: 0 });
  const armedRef = useRef<Record<Band, boolean>>({ low: true, medium: true, high: true });
  const lastLevelsRef = useRef<Levels>({ low: 0, medium: 0, high: 0 });
  const lastPeaksDbRef = useRef<PeaksDb>({ low: -Infinity, medium: -Infinity, high: -Infinity });
  const lastBandRmsLinRef = useRef<Record<Band, number>>({ low: 0, medium: 0, high: 0 });
  const bandRmsPeakRef = useRef<Record<Band, number>>({ low: 0, medium: 0, high: 0 });
  const lastLevelsUpdateMsRef = useRef(0);
  const emitBandRef = useRef(emitBand);
  const debugRef = useRef(false);
  const lastDebugLevelsLogMsRef = useRef(0);
  const runIdRef = useRef(0);
  useEffect(() => {
    emitBandRef.current = emitBand;
  }, [emitBand]);

  const isMockMode = useMemo(() => {
    const testing = (globalThis as unknown as { nwWrldBridge?: unknown }).nwWrldBridge;
    const t = testing && typeof testing === "object" ? (testing as Record<string, unknown>).testing : null;
    const audio = t && typeof t === "object" ? (t as Record<string, unknown>).audio : null;
    return Boolean(audio);
  }, []);

  useEffect(() => {
    const stop = async () => {
      runIdRef.current += 1;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const stream = streamRef.current;
      streamRef.current = null;
      if (stream) {
        try {
          stream.getTracks().forEach((tr) => tr.stop());
        } catch {}
      }
      analyserRef.current = null;
      lastBandRmsLinRef.current = { low: 0, medium: 0, high: 0 };
      bandRmsPeakRef.current = { low: 0, medium: 0, high: 0 };
      const ctx = audioContextRef.current;
      audioContextRef.current = null;
      if (ctx) {
        try {
          await ctx.close();
        } catch {}
      }
    };

    const start = async () => {
      runIdRef.current += 1;
      const runId = runIdRef.current;
      debugRef.current = readDebugFlag("nwWrld.debug.audio");
      if (isMockMode) {
        setState({ status: "mock", levels: zero, peaksDb: negInf });
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setState({ status: "error", message: "Microphone capture not available.", levels: zero, peaksDb: negInf });
        return;
      }
      setState({ status: "starting", levels: lastLevelsRef.current, peaksDb: lastPeaksDbRef.current });
      try {
        const baseConstraints = {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } as const;
        const constraints: MediaStreamConstraints = {
          audio: deviceId
            ? {
                ...baseConstraints,
                deviceId: { ideal: deviceId },
              }
            : {
                ...baseConstraints,
              },
          video: false,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        const Ctx = (globalThis as unknown as { AudioContext?: unknown; webkitAudioContext?: unknown })
          .AudioContext || (globalThis as unknown as { webkitAudioContext?: unknown }).webkitAudioContext;
        if (!Ctx || typeof Ctx !== "function") {
          setState({ status: "error", message: "AudioContext not available.", levels: zero, peaksDb: negInf });
          return;
        }
        const ctx = new (Ctx as unknown as new () => AudioContext)();
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);
        analyserRef.current = analyser;

        const bins = new Float32Array(analyser.frequencyBinCount);
        const resolvedThresholds: Levels = {
          low: typeof thresholds?.low === "number" && Number.isFinite(thresholds.low) ? thresholds.low : 0.18,
          medium:
            typeof thresholds?.medium === "number" && Number.isFinite(thresholds.medium) ? thresholds.medium : 0.18,
          high: typeof thresholds?.high === "number" && Number.isFinite(thresholds.high) ? thresholds.high : 0.01,
        };
        const lsThreshold = readLocalStorageNumber("nwWrld.audio.threshold", NaN);
        if (Number.isFinite(lsThreshold)) {
          resolvedThresholds.low = lsThreshold;
          resolvedThresholds.medium = lsThreshold;
          resolvedThresholds.high = lsThreshold;
        }

        const releaseRatio = 0.67;
        const resolvedReleaseThresholds: Levels = {
          low: resolvedThresholds.low * releaseRatio,
          medium: resolvedThresholds.medium * releaseRatio,
          high: resolvedThresholds.high * releaseRatio,
        };

        const resolvedMinIntervalMs =
          Number.isFinite(readLocalStorageNumber("nwWrld.audio.minIntervalMs", NaN))
            ? readLocalStorageNumber("nwWrld.audio.minIntervalMs", 90)
            : typeof minIntervalMs === "number" && Number.isFinite(minIntervalMs)
              ? minIntervalMs
              : 90;

        const gains: Record<Band, number> = {
          low: readLocalStorageNumber("nwWrld.audio.gain.low", 6.0),
          medium: readLocalStorageNumber("nwWrld.audio.gain.medium", 14.0),
          high: readLocalStorageNumber("nwWrld.audio.gain.high", 18.0),
        };

        if (debugRef.current) {
          console.log("[AudioDebug] start", {
            deviceId,
            fftSize: analyser.fftSize,
            frequencyBinCount: analyser.frequencyBinCount,
            smoothingTimeConstant: analyser.smoothingTimeConstant,
            thresholds: resolvedThresholds,
            releaseThresholds: resolvedReleaseThresholds,
            minIntervalMs: resolvedMinIntervalMs,
            gains,
            sampleRate: ctx.sampleRate,
          });
        }

        const tick = async () => {
          if (!enabled) return;
          if (document.hidden) return;
          if (runId !== runIdRef.current) return;
          const a = analyserRef.current;
          const c = audioContextRef.current;
          if (!a || !c) return;
          a.getFloatFrequencyData(bins);
          const sampleRate = c.sampleRate;
          const fftSize = a.fftSize;

          const peaksDb: PeaksDb = { low: -Infinity, medium: -Infinity, high: -Infinity };
          const sumSqLin: Record<Band, number> = { low: 0, medium: 0, high: 0 };
          const countLin: Record<Band, number> = { low: 0, medium: 0, high: 0 };
          for (let i = 0; i < bins.length; i++) {
            const hz = (i * sampleRate) / fftSize;
            const band = bandForHz(hz);
            if (!band) continue;
            const db = bins[i];
            if (!Number.isFinite(db)) continue;
            if (db > peaksDb[band]) peaksDb[band] = db;
            const lin = dbToLin(db);
            sumSqLin[band] += lin * lin;
            countLin[band] += 1;
          }
          lastPeaksDbRef.current = peaksDb;
          const rmsLin: Record<Band, number> = {
            low: countLin.low ? Math.sqrt(sumSqLin.low / countLin.low) : 0,
            medium: countLin.medium ? Math.sqrt(sumSqLin.medium / countLin.medium) : 0,
            high: countLin.high ? Math.sqrt(sumSqLin.high / countLin.high) : 0,
          };
          lastBandRmsLinRef.current = rmsLin;

          const now = Date.now();
          const maybeEmit = async (band: Band) => {
            const rawRms = lastBandRmsLinRef.current[band];
            const prevPeak = bandRmsPeakRef.current[band];
            const nextPeak = Math.max(rawRms, prevPeak * 0.995);
            bandRmsPeakRef.current[band] = nextPeak;
            const normalized = nextPeak > 1e-12 ? rawRms / nextPeak : 0;
            const gainRatio = DEFAULT_GAINS[band] > 0 ? gains[band] / DEFAULT_GAINS[band] : 1;
            const afterGain = normalized * gainRatio;
            const vel = clamp01(afterGain);
            lastLevelsRef.current[band] = vel;
            const threshold = resolvedThresholds[band];
            const releaseThreshold = resolvedReleaseThresholds[band];
            if (vel < releaseThreshold) {
              armedRef.current[band] = true;
              return;
            }
            if (vel < threshold) return;
            if (!armedRef.current[band]) return;
            if (now - lastEmitMsRef.current[band] < resolvedMinIntervalMs) return;
            armedRef.current[band] = false;
            lastEmitMsRef.current[band] = now;
            if (debugRef.current) {
              console.log("[AudioDebug] emit", {
                band,
                velocity: vel,
                threshold,
                releaseThreshold,
                minIntervalMs: resolvedMinIntervalMs,
                gain: gains[band],
                peaksDb: peaksDb[band],
              });
            }
            try {
              await emitBandRef.current({ channelName: band, velocity: vel });
            } catch {}
          };

          await maybeEmit("low");
          await maybeEmit("medium");
          await maybeEmit("high");
          if (runId !== runIdRef.current) return;

          if (debugRef.current && now - lastDebugLevelsLogMsRef.current >= 1000) {
            lastDebugLevelsLogMsRef.current = now;
            console.log("[AudioDebug] levels", { ...lastLevelsRef.current, peaksDb: { ...peaksDb } });
          }

          const lastUi = lastLevelsUpdateMsRef.current;
          if (now - lastUi >= 100) {
            lastLevelsUpdateMsRef.current = now;
            setState((prev) => {
              const nextLevels = { ...lastLevelsRef.current };
              const nextPeaksDb = { ...lastPeaksDbRef.current };
              if (prev.status === "error") return prev;
              if (prev.status === "mock") return prev;
              if (prev.status === "idle") return prev;
              if (prev.status === "starting") return { status: "starting", levels: nextLevels, peaksDb: nextPeaksDb };
              return { status: "running", levels: nextLevels, peaksDb: nextPeaksDb };
            });
          }

          rafRef.current = requestAnimationFrame(() => {
            tick().catch(() => {});
          });
        };

        setState({ status: "running", levels: lastLevelsRef.current, peaksDb: lastPeaksDbRef.current });
        rafRef.current = requestAnimationFrame(() => {
          tick().catch(() => {});
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (debugRef.current) console.log("[AudioDebug] error", { message });
        setState({ status: "error", message, levels: zero, peaksDb: negInf });
      }
    };

    if (!enabled) {
      stop().catch(() => {});
      lastLevelsRef.current = { low: 0, medium: 0, high: 0 };
      lastPeaksDbRef.current = { low: -Infinity, medium: -Infinity, high: -Infinity };
      lastLevelsUpdateMsRef.current = 0;
      setState({ status: "idle", levels: zero, peaksDb: negInf });
      return;
    }

    start().catch(() => {});
    return () => {
      stop().catch(() => {});
    };
  }, [enabled, deviceId, isMockMode, thresholds, minIntervalMs]);

  return state;
}

