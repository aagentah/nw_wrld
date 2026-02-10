import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readDebugFlag, readLocalStorageNumber } from "../utils/readDebugFlag";
import {
  AUDIO_ANALYSER_CONFIG,
  AUDIO_BAND_CUTOFF_HZ,
  AUDIO_DEFAULTS,
  AUDIO_NORMALIZATION_CONFIG,
  AUDIO_TRIGGER_CONFIG,
} from "../audio/audioTuning";

type Band = "low" | "medium" | "high";

type Levels = Record<Band, number>;
type PeaksDb = Record<Band, number>;

const DEFAULT_GAINS: Record<Band, number> = { low: 6.0, medium: 14.0, high: 18.0 };

export type FileAudioState =
  | { status: "idle"; levels: Levels; peaksDb: PeaksDb; assetRelPath: string | null }
  | { status: "loading"; levels: Levels; peaksDb: PeaksDb; assetRelPath: string | null }
  | {
      status: "ready";
      levels: Levels;
      peaksDb: PeaksDb;
      assetRelPath: string | null;
      durationSec: number;
    }
  | {
      status: "playing";
      levels: Levels;
      peaksDb: PeaksDb;
      assetRelPath: string | null;
      durationSec: number;
    }
  | {
      status: "error";
      levels: Levels;
      peaksDb: PeaksDb;
      assetRelPath: string | null;
      message: string;
    };

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

function bandForHz(hz: number): Band | null {
  if (!Number.isFinite(hz) || hz <= 0) return null;
  if (hz < AUDIO_BAND_CUTOFF_HZ.lowMaxHz) return "low";
  if (hz < AUDIO_BAND_CUTOFF_HZ.mediumMaxHz) return "medium";
  return "high";
}

const dbToLin = (db: number) => (Number.isFinite(db) ? Math.pow(10, db / 20) : 0);

const getBridgeWorkspace = () => {
  const b = (globalThis as unknown as { nwWrldBridge?: unknown }).nwWrldBridge;
  const obj = b && typeof b === "object" ? (b as Record<string, unknown>) : null;
  const w =
    obj && typeof obj.workspace === "object" ? (obj.workspace as Record<string, unknown>) : null;
  return w;
};

export function useDashboardFileAudio({
  enabled,
  assetRelPath,
  emitBand,
  thresholds,
  minIntervalMs,
}: {
  enabled: boolean;
  assetRelPath: string | null;
  emitBand: (payload: { channelName: Band; velocity: number }) => Promise<unknown>;
  thresholds?: Partial<Levels> | null;
  minIntervalMs?: number | null;
}) {
  const zero: Levels = useMemo(() => ({ low: 0, medium: 0, high: 0 }), []);
  const negInf: PeaksDb = useMemo(
    () => ({ low: -Infinity, medium: -Infinity, high: -Infinity }),
    []
  );

  const [state, setState] = useState<FileAudioState>({
    status: "idle",
    levels: zero,
    peaksDb: negInf,
    assetRelPath: null,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const emitBandRef = useRef(emitBand);
  const assetRelPathRef = useRef<string | null>(assetRelPath);
  const runIdRef = useRef(0);
  const thresholdsRef = useRef<Partial<Levels> | null | undefined>(thresholds);
  const minIntervalMsRef = useRef<number | null | undefined>(minIntervalMs);

  const armedRef = useRef<Record<Band, boolean>>({ low: true, medium: true, high: true });
  const peakWhileDisarmedRef = useRef<Record<Band, number>>({ low: 0, medium: 0, high: 0 });
  const lastEmitMsRef = useRef<Record<Band, number>>({ low: 0, medium: 0, high: 0 });
  const lastLevelsRef = useRef<Levels>({ low: 0, medium: 0, high: 0 });
  const lastPeaksDbRef = useRef<PeaksDb>({ low: -Infinity, medium: -Infinity, high: -Infinity });
  const lastBandRmsLinRef = useRef<Record<Band, number>>({ low: 0, medium: 0, high: 0 });
  const bandRmsPeakRef = useRef<Record<Band, number>>({ low: 0, medium: 0, high: 0 });
  const bandRmsLongPeakRef = useRef<Record<Band, number>>({ low: 0, medium: 0, high: 0 });
  const lastLevelsUpdateMsRef = useRef(0);
  const debugRef = useRef(false);

  useEffect(() => {
    emitBandRef.current = emitBand;
  }, [emitBand]);

  useEffect(() => {
    thresholdsRef.current = thresholds;
  }, [thresholds]);

  useEffect(() => {
    minIntervalMsRef.current = minIntervalMs;
  }, [minIntervalMs]);

  useEffect(() => {
    assetRelPathRef.current = assetRelPath;
  }, [assetRelPath]);

  const stop = useCallback(async () => {
    runIdRef.current += 1;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const src = sourceRef.current;
    sourceRef.current = null;
    if (src) {
      try {
        src.onended = null;
      } catch {}
      try {
        src.stop();
      } catch {}
      try {
        src.disconnect();
      } catch {}
    }
    const analyser = analyserRef.current;
    analyserRef.current = null;
    if (analyser) {
      try {
        analyser.disconnect();
      } catch {}
    }

    const ctx = audioContextRef.current;
    audioContextRef.current = null;
    if (ctx) {
      try {
        await ctx.close();
      } catch {}
    }
    armedRef.current = { low: true, medium: true, high: true };
    peakWhileDisarmedRef.current = { low: 0, medium: 0, high: 0 };
    lastEmitMsRef.current = { low: 0, medium: 0, high: 0 };
    lastLevelsRef.current = { low: 0, medium: 0, high: 0 };
    lastPeaksDbRef.current = { low: -Infinity, medium: -Infinity, high: -Infinity };
    lastBandRmsLinRef.current = { low: 0, medium: 0, high: 0 };
    bandRmsPeakRef.current = { low: 0, medium: 0, high: 0 };
    bandRmsLongPeakRef.current = { low: 0, medium: 0, high: 0 };
    lastLevelsUpdateMsRef.current = 0;

    const nextAssetRelPath = assetRelPathRef.current;
    const buf = bufferRef.current;
    if (!buf || !nextAssetRelPath) {
      setState({ status: "idle", levels: zero, peaksDb: negInf, assetRelPath: null });
      return;
    }
    setState({
      status: "ready",
      levels: zero,
      peaksDb: negInf,
      assetRelPath: nextAssetRelPath,
      durationSec: buf.duration,
    });
  }, [negInf, zero]);

  const play = useCallback(async () => {
    if (!enabled) return;
    if (!assetRelPath) return;
    const buf = bufferRef.current;
    if (!buf) return;
    await stop();
    runIdRef.current += 1;
    const runId = runIdRef.current;

    debugRef.current = readDebugFlag("nwWrld.debug.fileAudio");

    const Ctx =
      (globalThis as unknown as { AudioContext?: unknown; webkitAudioContext?: unknown })
        .AudioContext ||
      (globalThis as unknown as { webkitAudioContext?: unknown }).webkitAudioContext;
    if (!Ctx || typeof Ctx !== "function") {
      setState({
        status: "error",
        message: "AudioContext not available.",
        levels: zero,
        peaksDb: negInf,
        assetRelPath,
      });
      return;
    }

    const ctx = audioContextRef.current || new (Ctx as unknown as new () => AudioContext)();
    audioContextRef.current = ctx;
    try {
      await ctx.resume();
    } catch {}

    const analyser = ctx.createAnalyser();
    analyser.fftSize = AUDIO_ANALYSER_CONFIG.fftSize;
    analyser.smoothingTimeConstant = AUDIO_ANALYSER_CONFIG.smoothingTimeConstant;
    analyserRef.current = analyser;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(analyser);
    analyser.connect(ctx.destination);
    sourceRef.current = src;

    const bins = new Float32Array(analyser.frequencyBinCount);
    const getThreshold = (band: Band) => {
      const t =
        thresholdsRef.current && typeof thresholdsRef.current === "object"
          ? thresholdsRef.current[band]
          : undefined;
      return typeof t === "number" && Number.isFinite(t)
        ? Math.max(0, Math.min(1, t))
        : AUDIO_DEFAULTS.threshold;
    };
    const getMinIntervalMs = () => {
      const v = minIntervalMsRef.current;
      return typeof v === "number" && Number.isFinite(v)
        ? Math.max(0, Math.min(10_000, v))
        : AUDIO_DEFAULTS.minIntervalMs;
    };

    const gains: Record<Band, number> = {
      low: readLocalStorageNumber("nwWrld.fileAudio.gain.low", 6.0),
      medium: readLocalStorageNumber("nwWrld.fileAudio.gain.medium", 14.0),
      high: readLocalStorageNumber("nwWrld.fileAudio.gain.high", 18.0),
    };

    if (debugRef.current) {
      const debugThresholds = {
        low: getThreshold("low"),
        medium: getThreshold("medium"),
        high: getThreshold("high"),
      };
      const releaseRatio = AUDIO_TRIGGER_CONFIG.releaseRatio;
      const debugReleaseThresholds = {
        low: debugThresholds.low * releaseRatio,
        medium: debugThresholds.medium * releaseRatio,
        high: debugThresholds.high * releaseRatio,
      };
      const debugMinIntervalMs = getMinIntervalMs();
      console.log("[FileAudioDebug] play", {
        assetRelPath,
        fftSize: analyser.fftSize,
        frequencyBinCount: analyser.frequencyBinCount,
        smoothingTimeConstant: analyser.smoothingTimeConstant,
        thresholds: debugThresholds,
        releaseThresholds: debugReleaseThresholds,
        minIntervalMs: debugMinIntervalMs,
        gains,
        sampleRate: ctx.sampleRate,
        durationSec: buf.duration,
      });
    }

    const tick = async () => {
      if (!enabled) return;
      if (runId !== runIdRef.current) return;
      const a = analyserRef.current;
      const c = audioContextRef.current;
      if (!a || !c) return;
      a.getFloatFrequencyData(bins);

      const peaksDb: PeaksDb = { low: -Infinity, medium: -Infinity, high: -Infinity };
      const sampleRate = c.sampleRate;
      const fftSize = a.fftSize;
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
        const nextLongPeak = Math.max(
          rawRms,
          prevLongPeak * AUDIO_NORMALIZATION_CONFIG.longPeakDecay
        );
        bandRmsLongPeakRef.current[band] = nextLongPeak;
        const absFloor = dbToLin(AUDIO_NORMALIZATION_CONFIG.absoluteDenomFloorDb);
        const denom = Math.max(
          nextPeak,
          nextLongPeak * AUDIO_NORMALIZATION_CONFIG.longPeakFloorRatio,
          absFloor
        );
        const normalized = denom > AUDIO_TRIGGER_CONFIG.minVelocityDenom ? rawRms / denom : 0;
        const gainRatio = DEFAULT_GAINS[band] > 0 ? gains[band] / DEFAULT_GAINS[band] : 1;
        const afterGain = normalized * gainRatio;
        const vel = clamp01(afterGain);
        lastLevelsRef.current[band] = vel;
        const threshold = getThreshold(band);
        const releaseThreshold = threshold * releaseRatio;
        if (!armedRef.current[band]) {
          peakWhileDisarmedRef.current[band] = Math.max(
            peakWhileDisarmedRef.current[band] || 0,
            vel
          );
          const peakWhileDisarmed = peakWhileDisarmedRef.current[band] || 0;
          if (
            vel < releaseThreshold ||
            (peakWhileDisarmed > 0 &&
              vel < peakWhileDisarmed * AUDIO_TRIGGER_CONFIG.rearmOnDropRatio)
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
          console.log("[FileAudioDebug] emit", {
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

      const lastUi = lastLevelsUpdateMsRef.current;
      if (now - lastUi >= 100) {
        lastLevelsUpdateMsRef.current = now;
        setState((prev) => {
          const nextLevels = { ...lastLevelsRef.current };
          const nextPeaksDb = { ...lastPeaksDbRef.current };
          if (prev.status === "error") return prev;
          if (prev.status === "idle") return prev;
          if (prev.status === "loading") return prev;
          if (prev.status === "ready")
            return {
              status: "playing",
              levels: nextLevels,
              peaksDb: nextPeaksDb,
              assetRelPath,
              durationSec: buf.duration,
            };
          return {
            status: "playing",
            levels: nextLevels,
            peaksDb: nextPeaksDb,
            assetRelPath,
            durationSec: buf.duration,
          };
        });
      }

      rafRef.current = requestAnimationFrame(() => {
        tick().catch(() => {});
      });
    };

    src.onended = () => {
      stop().catch(() => {});
      setState((prev) => {
        if (prev.status === "error") return prev;
        if (!bufferRef.current || !assetRelPath) {
          return { status: "idle", levels: zero, peaksDb: negInf, assetRelPath: null };
        }
        return {
          status: "ready",
          levels: { ...zero },
          peaksDb: { ...negInf },
          assetRelPath,
          durationSec: bufferRef.current.duration,
        };
      });
    };

    setState({
      status: "playing",
      levels: { ...zero },
      peaksDb: { ...negInf },
      assetRelPath,
      durationSec: buf.duration,
    });
    try {
      src.start();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setState({ status: "error", message, levels: zero, peaksDb: negInf, assetRelPath });
      return;
    }
    rafRef.current = requestAnimationFrame(() => {
      tick().catch(() => {});
    });
  }, [assetRelPath, enabled, negInf, stop, zero]);

  useEffect(() => {
    if (!enabled) {
      stop().catch(() => {});
      bufferRef.current = null;
      setState({ status: "idle", levels: zero, peaksDb: negInf, assetRelPath: null });
      return;
    }
    if (!assetRelPath) {
      stop().catch(() => {});
      bufferRef.current = null;
      setState({ status: "idle", levels: zero, peaksDb: negInf, assetRelPath: null });
      return;
    }

    const load = async () => {
      await stop();
      const runId = runIdRef.current;
      setState({
        status: "loading",
        levels: lastLevelsRef.current,
        peaksDb: lastPeaksDbRef.current,
        assetRelPath,
      });
      try {
        const w = getBridgeWorkspace();
        const readFn =
          w && typeof w.readAssetArrayBuffer === "function"
            ? (w.readAssetArrayBuffer as (p: unknown) => Promise<unknown>)
            : null;
        if (!readFn) {
          setState({
            status: "error",
            message: "Asset read not available.",
            levels: zero,
            peaksDb: negInf,
            assetRelPath,
          });
          return;
        }
        const ab = await readFn(assetRelPath);
        if (runId !== runIdRef.current) return;
        if (!(ab instanceof ArrayBuffer)) {
          setState({
            status: "error",
            message: "Failed to read audio asset.",
            levels: zero,
            peaksDb: negInf,
            assetRelPath,
          });
          return;
        }
        const Ctx =
          (globalThis as unknown as { AudioContext?: unknown; webkitAudioContext?: unknown })
            .AudioContext ||
          (globalThis as unknown as { webkitAudioContext?: unknown }).webkitAudioContext;
        if (!Ctx || typeof Ctx !== "function") {
          setState({
            status: "error",
            message: "AudioContext not available.",
            levels: zero,
            peaksDb: negInf,
            assetRelPath,
          });
          return;
        }
        const ctx = audioContextRef.current || new (Ctx as unknown as new () => AudioContext)();
        audioContextRef.current = ctx;
        const audioBuffer = await ctx.decodeAudioData(ab.slice(0));
        if (runId !== runIdRef.current) return;
        bufferRef.current = audioBuffer;
        setState({
          status: "ready",
          levels: zero,
          peaksDb: negInf,
          assetRelPath,
          durationSec: audioBuffer.duration,
        });
      } catch (e) {
        if (runId !== runIdRef.current) return;
        const message = e instanceof Error ? e.message : String(e);
        setState({ status: "error", message, levels: zero, peaksDb: negInf, assetRelPath });
      }
    };

    load().catch(() => {});
    return () => {
      stop().catch(() => {});
    };
  }, [assetRelPath, enabled, negInf, stop, zero]);

  const isPlaying = state.status === "playing";

  return { state, play, stop, isPlaying };
}
