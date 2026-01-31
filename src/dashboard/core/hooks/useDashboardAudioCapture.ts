import { useEffect, useMemo, useRef, useState } from "react";
import { readDebugFlag, readLocalStorageNumber } from "../utils/readDebugFlag";
import { AUDIO_ANALYSER_CONFIG, AUDIO_BAND_CUTOFF_HZ, AUDIO_DEFAULTS, AUDIO_NORMALIZATION_CONFIG, AUDIO_TRIGGER_CONFIG } from "../audio/audioTuning";

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
  if (hz < AUDIO_BAND_CUTOFF_HZ.lowMaxHz) return "low";
  if (hz < AUDIO_BAND_CUTOFF_HZ.mediumMaxHz) return "medium";
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
  const peakWhileDisarmedRef = useRef<Record<Band, number>>({ low: 0, medium: 0, high: 0 });
  const lastLevelsRef = useRef<Levels>({ low: 0, medium: 0, high: 0 });
  const lastPeaksDbRef = useRef<PeaksDb>({ low: -Infinity, medium: -Infinity, high: -Infinity });
  const lastBandRmsLinRef = useRef<Record<Band, number>>({ low: 0, medium: 0, high: 0 });
  const bandRmsPeakRef = useRef<Record<Band, number>>({ low: 0, medium: 0, high: 0 });
  const bandRmsLongPeakRef = useRef<Record<Band, number>>({ low: 0, medium: 0, high: 0 });
  const lastLevelsUpdateMsRef = useRef(0);
  const emitBandRef = useRef(emitBand);
  const debugRef = useRef(false);
  const lastDebugLevelsLogMsRef = useRef(0);
  const runIdRef = useRef(0);
  const thresholdsRef = useRef<Partial<Levels> | null | undefined>(thresholds);
  const minIntervalMsRef = useRef<number | null | undefined>(minIntervalMs);
  useEffect(() => {
    emitBandRef.current = emitBand;
  }, [emitBand]);

  useEffect(() => {
    thresholdsRef.current = thresholds;
  }, [thresholds]);

  useEffect(() => {
    minIntervalMsRef.current = minIntervalMs;
  }, [minIntervalMs]);

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
      peakWhileDisarmedRef.current = { low: 0, medium: 0, high: 0 };
      lastBandRmsLinRef.current = { low: 0, medium: 0, high: 0 };
      bandRmsPeakRef.current = { low: 0, medium: 0, high: 0 };
      bandRmsLongPeakRef.current = { low: 0, medium: 0, high: 0 };
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
        try {
          await ctx.resume();
        } catch {}
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = AUDIO_ANALYSER_CONFIG.fftSize;
        analyser.smoothingTimeConstant = AUDIO_ANALYSER_CONFIG.smoothingTimeConstant;
        source.connect(analyser);
        analyserRef.current = analyser;

        const bins = new Float32Array(analyser.frequencyBinCount);
        const getThreshold = (band: Band) => {
          const thrObj = thresholdsRef.current && typeof thresholdsRef.current === "object" ? thresholdsRef.current : null;
          const direct = thrObj ? thrObj[band] : undefined;
          const hasAnyDirect =
            thrObj &&
            (typeof thrObj.low === "number" ||
              typeof thrObj.medium === "number" ||
              typeof thrObj.high === "number");
          const lsThreshold = readLocalStorageNumber("nwWrld.audio.threshold", NaN);
          if (!hasAnyDirect && Number.isFinite(lsThreshold)) {
            return Math.max(0, Math.min(1, lsThreshold));
          }
          return typeof direct === "number" && Number.isFinite(direct)
            ? Math.max(0, Math.min(1, direct))
            : AUDIO_DEFAULTS.threshold;
        };
        const getMinIntervalMs = () => {
          const direct = minIntervalMsRef.current;
          if (typeof direct === "number" && Number.isFinite(direct)) return Math.max(0, Math.min(10_000, direct));
          const ls = readLocalStorageNumber("nwWrld.audio.minIntervalMs", NaN);
          if (Number.isFinite(ls)) return Math.max(0, Math.min(10_000, ls));
          return AUDIO_DEFAULTS.minIntervalMs;
        };

        const gains: Record<Band, number> = {
          low: readLocalStorageNumber("nwWrld.audio.gain.low", 6.0),
          medium: readLocalStorageNumber("nwWrld.audio.gain.medium", 14.0),
          high: readLocalStorageNumber("nwWrld.audio.gain.high", 18.0),
        };

        if (debugRef.current) {
          const debugThresholds = { low: getThreshold("low"), medium: getThreshold("medium"), high: getThreshold("high") };
          const releaseRatio = AUDIO_TRIGGER_CONFIG.releaseRatio;
          const debugReleaseThresholds = {
            low: debugThresholds.low * releaseRatio,
            medium: debugThresholds.medium * releaseRatio,
            high: debugThresholds.high * releaseRatio,
          };
          const debugMinIntervalMs = getMinIntervalMs();
          console.log("[AudioDebug] start", {
            deviceId,
            fftSize: analyser.fftSize,
            frequencyBinCount: analyser.frequencyBinCount,
            smoothingTimeConstant: analyser.smoothingTimeConstant,
            thresholds: debugThresholds,
            releaseThresholds: debugReleaseThresholds,
            minIntervalMs: debugMinIntervalMs,
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
          const minInterval = getMinIntervalMs();
          const releaseRatio = AUDIO_TRIGGER_CONFIG.releaseRatio;
          const maybeEmit = async (band: Band) => {
            const rawRms = lastBandRmsLinRef.current[band];
            const prevPeak = bandRmsPeakRef.current[band];
            const nextPeak = Math.max(rawRms, prevPeak * AUDIO_NORMALIZATION_CONFIG.shortPeakDecay);
            bandRmsPeakRef.current[band] = nextPeak;
            const prevLongPeak = bandRmsLongPeakRef.current[band];
            const nextLongPeak = Math.max(rawRms, prevLongPeak * AUDIO_NORMALIZATION_CONFIG.longPeakDecay);
            bandRmsLongPeakRef.current[band] = nextLongPeak;
            const absFloor = dbToLin(AUDIO_NORMALIZATION_CONFIG.absoluteDenomFloorDb);
            const denom = Math.max(nextPeak, nextLongPeak * AUDIO_NORMALIZATION_CONFIG.longPeakFloorRatio, absFloor);
            const normalized = denom > AUDIO_TRIGGER_CONFIG.minVelocityDenom ? rawRms / denom : 0;
            const gainRatio = DEFAULT_GAINS[band] > 0 ? gains[band] / DEFAULT_GAINS[band] : 1;
            const afterGain = normalized * gainRatio;
            const vel = clamp01(afterGain);
            lastLevelsRef.current[band] = vel;
            const threshold = getThreshold(band);
            const releaseThreshold = threshold * releaseRatio;
            if (!armedRef.current[band]) {
              peakWhileDisarmedRef.current[band] = Math.max(peakWhileDisarmedRef.current[band] || 0, vel);
              const peakWhileDisarmed = peakWhileDisarmedRef.current[band] || 0;
              if (
                vel < releaseThreshold ||
                (peakWhileDisarmed > 0 && vel < peakWhileDisarmed * AUDIO_TRIGGER_CONFIG.rearmOnDropRatio)
              ) {
                armedRef.current[band] = true;
                peakWhileDisarmedRef.current[band] = 0;
              }
              return;
            }
            if (vel < threshold) return;
            if (now - lastEmitMsRef.current[band] < minInterval) return;
            armedRef.current[band] = false;
            peakWhileDisarmedRef.current[band] = vel;
            lastEmitMsRef.current[band] = now;
            if (debugRef.current) {
              console.log("[AudioDebug] emit", {
                band,
                velocity: vel,
                threshold,
                releaseThreshold,
                minIntervalMs: minInterval,
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
  }, [enabled, deviceId, isMockMode]);

  return state;
}

