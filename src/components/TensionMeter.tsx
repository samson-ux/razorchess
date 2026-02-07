// ============================================================
// RazorChess — Tension Meter
// Shows how razor-tight the current game is (0-10)
// ============================================================

'use client';

interface TensionMeterProps {
  tension: number; // 0-10
}

export default function TensionMeter({ tension }: TensionMeterProps) {
  const clampedTension = Math.max(0, Math.min(10, tension));
  const percent = clampedTension * 10;

  const getColor = (t: number) => {
    if (t >= 8) return 'from-red-500 to-red-600';
    if (t >= 6) return 'from-orange-500 to-red-500';
    if (t >= 4) return 'from-yellow-500 to-orange-500';
    return 'from-green-500 to-yellow-500';
  };

  const getLabel = (t: number) => {
    if (t >= 9) return 'RAZOR TIGHT';
    if (t >= 7) return 'High Tension';
    if (t >= 5) return 'Balanced';
    if (t >= 3) return 'One-Sided';
    return 'Decisive';
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400 uppercase tracking-wider">Game Tension</span>
        <span className="text-xs font-bold text-zinc-300">{clampedTension.toFixed(1)}/10</span>
      </div>
      <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${getColor(clampedTension)} transition-all duration-700 ease-out`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className={`text-xs font-semibold text-center ${clampedTension >= 8 ? 'text-red-400 animate-pulse' : 'text-zinc-400'}`}>
        {getLabel(clampedTension)}
      </p>
    </div>
  );
}
