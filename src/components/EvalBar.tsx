// ============================================================
// RazorChess — Evaluation Bar
// Visual representation of the game balance
// ============================================================

'use client';

interface EvalBarProps {
  evaluation: number; // centipawns, positive = white advantage
  playerColor: 'white' | 'black';
}

export default function EvalBar({ evaluation, playerColor }: EvalBarProps) {
  // Convert centipawn eval to percentage (0-100, where 50 is equal)
  // Using sigmoid-like function for smooth clamping
  const clampedEval = Math.max(-1000, Math.min(1000, evaluation));
  const whitePercent = 50 + (50 * (2 / (1 + Math.exp(-clampedEval / 200)) - 1));

  const displayEval = Math.abs(evaluation) >= 99990
    ? `M${Math.abs(99999 - Math.abs(evaluation))}`
    : `${evaluation > 0 ? '+' : ''}${(evaluation / 100).toFixed(1)}`;

  const isFlipped = playerColor === 'black';

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-7 rounded-full overflow-hidden border border-zinc-600 relative"
        style={{ height: 'min(80vw, 560px)' }}
      >
        {/* White portion (from bottom if playing white, top if playing black) */}
        <div
          className="absolute left-0 right-0 bg-zinc-200 transition-all duration-500 ease-out"
          style={
            isFlipped
              ? { top: 0, height: `${whitePercent}%` }
              : { bottom: 0, height: `${whitePercent}%` }
          }
        />
        {/* Black portion */}
        <div
          className="absolute left-0 right-0 bg-zinc-800 transition-all duration-500 ease-out"
          style={
            isFlipped
              ? { bottom: 0, height: `${100 - whitePercent}%` }
              : { top: 0, height: `${100 - whitePercent}%` }
          }
        />
        {/* Center line */}
        <div className="absolute left-0 right-0 h-px bg-red-500/50" style={{ top: '50%' }} />
      </div>
      <span className="text-xs text-zinc-400 font-mono tabular-nums">
        {displayEval}
      </span>
    </div>
  );
}
