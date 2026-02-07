// ============================================================
// RazorChess — Move List Component
// Shows move history with color-coded accuracy
// ============================================================

'use client';

import { useEffect, useRef } from 'react';
import { GameMove } from '@/lib/types';

interface MoveListProps {
  moves: GameMove[];
  playerColor: 'white' | 'black';
}

export default function MoveList({ moves, playerColor }: MoveListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moves]);

  if (moves.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-lg p-4 h-64 flex items-center justify-center">
        <p className="text-zinc-500 text-sm">No moves yet. Make your first move!</p>
      </div>
    );
  }

  // Group moves into pairs (white, black)
  const pairs: Array<{ number: number; white?: GameMove; black?: GameMove }> = [];
  for (const move of moves) {
    const pairIdx = move.moveNumber - 1;
    if (!pairs[pairIdx]) {
      pairs[pairIdx] = { number: move.moveNumber };
    }
    if (move.isPlayerMove) {
      if (playerColor === 'white') pairs[pairIdx].white = move;
      else pairs[pairIdx].black = move;
    } else {
      if (playerColor === 'white') pairs[pairIdx].black = move;
      else pairs[pairIdx].white = move;
    }
  }

  return (
    <div ref={scrollRef} className="bg-zinc-900 rounded-lg p-3 h-64 overflow-y-auto scrollbar-thin">
      <div className="space-y-0.5">
        {pairs.filter(Boolean).map((pair) => (
          <div key={pair.number} className="flex items-center text-sm font-mono">
            <span className="w-8 text-zinc-500 text-right mr-2 shrink-0">
              {pair.number}.
            </span>
            <MoveCell move={pair.white} />
            <MoveCell move={pair.black} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MoveCell({ move }: { move?: GameMove }) {
  if (!move) return <span className="w-24 shrink-0" />;

  let colorClass = 'text-zinc-300';
  let icon = '';

  if (move.isBlunder) { colorClass = 'text-red-400'; icon = '??'; }
  else if (move.isMistake) { colorClass = 'text-orange-400'; icon = '?'; }
  else if (move.isInaccuracy) { colorClass = 'text-yellow-400'; icon = '?!'; }
  else if (move.isBrilliant) { colorClass = 'text-cyan-400'; icon = '!!'; }

  return (
    <span
      className={`w-24 shrink-0 px-1 py-0.5 rounded ${colorClass} hover:bg-zinc-800 cursor-default transition-colors`}
      title={`CPL: ${Math.round(move.centipawnLoss)} | Eval: ${(move.evaluation / 100).toFixed(2)} | Think: ${(move.thinkTime / 1000).toFixed(1)}s`}
    >
      {move.san}
      {icon && <span className="ml-0.5 text-xs">{icon}</span>}
    </span>
  );
}
