type SignalThresholdMeterProps = {
  level: number;
  threshold: number;
  testId?: string;
};

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

export const SignalThresholdMeter = ({ level, threshold, testId }: SignalThresholdMeterProps) => {
  const levelPct = clamp01(level) * 100;
  const thresholdPct = clamp01(threshold) * 100;

  return (
    <div
      className="relative h-2 rounded bg-neutral-800 overflow-hidden border border-neutral-700"
      data-testid={testId}
    >
      <div className="absolute inset-y-0 left-0 bg-neutral-400/25" style={{ width: `${levelPct}%` }} />
      <div
        className="absolute inset-y-0 w-[2px] bg-green-500"
        style={{ left: `${levelPct}%`, transform: "translateX(-1px)" }}
      />
      <div
        className="absolute inset-y-0 w-[2px] bg-neutral-200/80"
        style={{ left: `${thresholdPct}%`, transform: "translateX(-1px)" }}
      />
    </div>
  );
};
