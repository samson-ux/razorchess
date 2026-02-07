// ============================================================
// RazorChess — Personality Selector
// Choose your opponent's play style
// ============================================================

'use client';

import { Personality } from '@/lib/types';
import { getAllPersonalities } from '@/lib/personalities';

interface PersonalitySelectorProps {
  selected: Personality;
  onSelect: (p: Personality) => void;
  disabled?: boolean;
}

const PERSONALITY_ICONS: Record<Personality, string> = {
  grinder: '\u{1F9F1}',    // brick
  attacker: '\u{1F525}',   // fire
  trickster: '\u{1F3AD}',  // masks
  mentor: '\u{1F393}',     // graduation
};

export default function PersonalitySelector({ selected, onSelect, disabled }: PersonalitySelectorProps) {
  const personalities = getAllPersonalities();

  return (
    <div className="space-y-2">
      <h3 className="text-xs text-zinc-400 uppercase tracking-wider">Opponent Personality</h3>
      <div className="grid grid-cols-2 gap-2">
        {personalities.map(p => (
          <button
            key={p.name}
            onClick={() => !disabled && onSelect(p.name)}
            disabled={disabled}
            className={`
              p-3 rounded-lg border text-left transition-all
              ${selected === p.name
                ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-500'}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{PERSONALITY_ICONS[p.name]}</span>
              <span className="font-semibold text-sm text-zinc-200">{p.displayName}</span>
            </div>
            <p className="text-xs text-zinc-400 leading-tight line-clamp-2">
              {p.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
