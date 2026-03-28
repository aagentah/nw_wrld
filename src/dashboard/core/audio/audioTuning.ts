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

