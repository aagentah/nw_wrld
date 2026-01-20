import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readDebugFlag, readLocalStorageNumber } from "../utils/readDebugFlag";

type Band = "low" | "medium" | "high";

type Levels = Record<Band, number>;
type PeaksDb = Record<Band, number>;

const DEFAULT_GAINS: Record<Band, number> = { low: 6.0, medium: 14.0, high: 18.0 };

export type FileAudioState =
  | { status: "idle"; levels: Levels; peaksDb: PeaksDb; assetRelPath: string | null }
  | { status: "loading"; levels: Levels; peaksDb: PeaksDb; assetRelPath: string | null }
  | { status: "ready"; levels: Levels; peaksDb: PeaksDb; assetRelPath: string | null; durationSec: number }
  | { status: "playing"; levels: Levels; peaksDb: PeaksDb; assetRelPath: string | null; durationSec: number }
  | { status: "error"; levels: Levels; peaksDb: PeaksDb; assetRelPath: string | null; message: string };

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

function bandForHz(hz: number): Band | null {
  if (!Number.isFinite(hz) || hz <= 0) return null;
  if (hz < 200) return "low";
  if (hz < 2000) return "medium";
  return "high";
}

const dbToLin = (db: number) => (Number.isFinite(db) ? Math.pow(10, db / 20) : 0);

const getBridgeWorkspace = () => {
  const b = (globalThis as unknown as { nwWrldBridge?: unknown }).nwWrldBridge;
  const obj = b && typeof b === "object" ? (b as Record<string, unknown>) : null;
  const w = obj && typeof obj.workspace === "object" ? (obj.workspace as Record<string, unknown>) : null;
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
  const negInf: PeaksDb = useMemo(() => ({ low: -Infinity, medium: -Infinity, high: -Infinity }), []);

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

  const armedRef = useRef<Record<Band, boolean>>({ low: true, medium: true, high: true });
  const lastEmitMsRef = useRef<Record<Band, number>>({ low: 0, medium: 0, high: 0 });
  const lastLevelsRef = useRef<Levels>({ low: 0, medium: 0, high: 0 });
  const lastPeaksDbRef = useRef<PeaksDb>({ low: -Infinity, medium: -Infinity, high: -Infinity });
  const lastBandRmsLinRef = useRef<Record<Band, number>>({ low: 0, medium: 0, high: 0 });
  const bandRmsPeakRef = useRef<Record<Band, number>>({ low: 0, medium: 0, high: 0 });
  const lastLevelsUpdateMsRef = useRef(0);
  const debugRef = useRef(false);

  useEffect(() => {
    emitBandRef.current = emitBand;
  }, [emitBand]);

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
    analyserRef.current = null;
    armedRef.current = { low: true, medium: true, high: true };
    lastEmitMsRef.current = { low: 0, medium: 0, high: 0 };
    lastLevelsRef.current = { low: 0, medium: 0, high: 0 };
    lastPeaksDbRef.current = { low: -Infinity, medium: -Infinity, high: -Infinity };
    lastBandRmsLinRef.current = { low: 0, medium: 0, high: 0 };
    bandRmsPeakRef.current = { low: 0, medium: 0, high: 0 };
    lastLevelsUpdateMsRef.current = 0;

    const nextAssetRelPath = assetRelPathRef.current;
    const buf = bufferRef.current;
    if (!buf || !nextAssetRelPath) {
      setState({ status: "idle", levels: zero, peaksDb: negInf, assetRelPath: null });
      return;
    }
    setState({ status: "ready", levels: zero, peaksDb: negInf, assetRelPath: nextAssetRelPath, durationSec: buf.duration });
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

    const Ctx = (globalThis as unknown as { AudioContext?: unknown; webkitAudioContext?: unknown })
      .AudioContext || (globalThis as unknown as { webkitAudioContext?: unknown }).webkitAudioContext;
    if (!Ctx || typeof Ctx !== "function") {
      setState({ status: "error", message: "AudioContext not available.", levels: zero, peaksDb: negInf, assetRelPath });
      return;
    }

    const ctx = audioContextRef.current || new (Ctx as unknown as new () => AudioContext)();
    audioContextRef.current = ctx;
    try {
      await ctx.resume();
    } catch {}

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.6;
    analyserRef.current = analyser;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(analyser);
    analyser.connect(ctx.destination);
    sourceRef.current = src;

    const bins = new Float32Array(analyser.frequencyBinCount);
    const resolvedThresholds: Levels = {
      low: typeof thresholds?.low === "number" && Number.isFinite(thresholds.low) ? thresholds.low : 0.18,
      medium: typeof thresholds?.medium === "number" && Number.isFinite(thresholds.medium) ? thresholds.medium : 0.18,
      high: typeof thresholds?.high === "number" && Number.isFinite(thresholds.high) ? thresholds.high : 0.01,
    };
    const releaseRatio = 0.67;
    const resolvedReleaseThresholds: Levels = {
      low: resolvedThresholds.low * releaseRatio,
      medium: resolvedThresholds.medium * releaseRatio,
      high: resolvedThresholds.high * releaseRatio,
    };
    const resolvedMinIntervalMs =
      typeof minIntervalMs === "number" && Number.isFinite(minIntervalMs) ? minIntervalMs : 90;

    const gains: Record<Band, number> = {
      low: readLocalStorageNumber("nwWrld.fileAudio.gain.low", 6.0),
      medium: readLocalStorageNumber("nwWrld.fileAudio.gain.medium", 14.0),
      high: readLocalStorageNumber("nwWrld.fileAudio.gain.high", 18.0),
    };

    if (debugRef.current) {
      console.log("[FileAudioDebug] play", {
        assetRelPath,
        fftSize: analyser.fftSize,
        frequencyBinCount: analyser.frequencyBinCount,
        smoothingTimeConstant: analyser.smoothingTimeConstant,
        thresholds: resolvedThresholds,
        releaseThresholds: resolvedReleaseThresholds,
        minIntervalMs: resolvedMinIntervalMs,
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
          console.log("[FileAudioDebug] emit", {
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

      const lastUi = lastLevelsUpdateMsRef.current;
      if (now - lastUi >= 100) {
        lastLevelsUpdateMsRef.current = now;
        setState((prev) => {
          const nextLevels = { ...lastLevelsRef.current };
          const nextPeaksDb = { ...lastPeaksDbRef.current };
          if (prev.status === "error") return prev;
          if (prev.status === "idle") return prev;
          if (prev.status === "loading") return prev;
          if (prev.status === "ready") return { status: "playing", levels: nextLevels, peaksDb: nextPeaksDb, assetRelPath, durationSec: buf.duration };
          return { status: "playing", levels: nextLevels, peaksDb: nextPeaksDb, assetRelPath, durationSec: buf.duration };
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

    setState({ status: "playing", levels: { ...zero }, peaksDb: { ...negInf }, assetRelPath, durationSec: buf.duration });
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
  }, [assetRelPath, enabled, minIntervalMs, negInf, stop, thresholds, zero]);

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
      setState({ status: "loading", levels: lastLevelsRef.current, peaksDb: lastPeaksDbRef.current, assetRelPath });
      try {
        const w = getBridgeWorkspace();
        const readFn = w && typeof w.readAssetArrayBuffer === "function" ? (w.readAssetArrayBuffer as (p: unknown) => Promise<unknown>) : null;
        if (!readFn) {
          setState({ status: "error", message: "Asset read not available.", levels: zero, peaksDb: negInf, assetRelPath });
          return;
        }
        const ab = await readFn(assetRelPath);
        if (!(ab instanceof ArrayBuffer)) {
          setState({ status: "error", message: "Failed to read audio asset.", levels: zero, peaksDb: negInf, assetRelPath });
          return;
        }
        const Ctx = (globalThis as unknown as { AudioContext?: unknown; webkitAudioContext?: unknown })
          .AudioContext || (globalThis as unknown as { webkitAudioContext?: unknown }).webkitAudioContext;
        if (!Ctx || typeof Ctx !== "function") {
          setState({ status: "error", message: "AudioContext not available.", levels: zero, peaksDb: negInf, assetRelPath });
          return;
        }
        const ctx = audioContextRef.current || new (Ctx as unknown as new () => AudioContext)();
        audioContextRef.current = ctx;
        const audioBuffer = await ctx.decodeAudioData(ab.slice(0));
        bufferRef.current = audioBuffer;
        setState({ status: "ready", levels: zero, peaksDb: negInf, assetRelPath, durationSec: audioBuffer.duration });
      } catch (e) {
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

