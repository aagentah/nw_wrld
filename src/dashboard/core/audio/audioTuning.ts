export const AUDIO_BAND_CUTOFF_HZ = {
  lowMaxHz: 200,
  mediumMaxHz: 2000,
} as const;

export const AUDIO_ANALYSER_CONFIG = {
  fftSize: 2048,
  smoothingTimeConstant: 0.6,
} as const;

export const AUDIO_TRIGGER_CONFIG = {
  releaseRatio: 0.67,
  rearmOnDropRatio: 0.85,
  minVelocityDenom: 1e-12,
} as const;

export const AUDIO_DEFAULTS = {
  threshold: 0.5,
  minIntervalMs: 120,
} as const;

export const AUDIO_NORMALIZATION_CONFIG = {
  shortPeakDecay: 0.995,
  longPeakDecay: 0.99995,
  longPeakFloorRatio: 0.5,
  absoluteDenomFloorDb: -50,
} as const;


export type Band = "low" | "medium" | "high";
export type Levels = Record<Band, number>;
export type PeaksDb = Record<Band, number>;

export const DEFAULT_GAINS: Record<Band, number> = { low: 6.0, medium: 14.0, high: 18.0 };

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

export function bandForHz(hz: number): Band | null {
  if (!Number.isFinite(hz) || hz <= 0) return null;
  if (hz < AUDIO_BAND_CUTOFF_HZ.lowMaxHz) return "low";
  if (hz < AUDIO_BAND_CUTOFF_HZ.mediumMaxHz) return "medium";
  return "high";
}

export const dbToLin = (db: number) => (Number.isFinite(db) ? Math.pow(10, db / 20) : 0);
