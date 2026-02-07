// ============================================================
// RazorChess — Post-Game Analysis Panel
// Full game review with eval graph and critical moments
// ============================================================

'use client';

import { PostGameAnalysis, GameMove } from '@/lib/types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';

interface GameAnalysisProps {
  analysis: PostGameAnalysis;
  moves: GameMove[];
  onClose: () => void;
  onNewGame: () => void;
}

export default function GameAnalysis({ analysis, moves, onClose, onNewGame }: GameAnalysisProps) {
  // Build eval chart data
  const chartData = moves.map((m, i) => ({
    move: i + 1,
    eval: Math.max(-5, Math.min(5, m.evaluation / 100)),
    label: `${Math.ceil((i + 1) / 2)}. ${m.san}`,
    isPlayer: m.isPlayerMove,
  }));

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 space-y-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-100">Game Analysis</h2>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 text-lg">&times;</button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Your Accuracy" value={`${analysis.playerAccuracy.toFixed(1)}%`}
          color={analysis.playerAccuracy > 80 ? 'text-emerald-400' : analysis.playerAccuracy > 60 ? 'text-yellow-400' : 'text-red-400'} />
        <StatCard label="Tension Score" value={`${analysis.tensionScore.toFixed(1)}/10`}
          color={analysis.tensionScore > 7 ? 'text-red-400' : 'text-yellow-400'} />
        <StatCard label="Opening" value={analysis.openingName} color="text-blue-400" small />
      </div>

      {/* Eval graph */}
      <div>
        <h3 className="text-sm text-zinc-400 uppercase tracking-wider mb-2">Evaluation Graph</h3>
        <div className="bg-zinc-800 rounded-lg p-2" style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <defs>
                <linearGradient id="evalGradientPos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="evalGradientNeg" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="move" tick={{ fontSize: 10, fill: '#71717a' }} />
              <YAxis domain={[-5, 5]} tick={{ fontSize: 10, fill: '#71717a' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px' }}
                labelFormatter={(v) => chartData[v as number - 1]?.label || ''}
                formatter={(v) => [`${Number(v) > 0 ? '+' : ''}${Number(v).toFixed(2)}`, 'Eval']}
              />
              <ReferenceLine y={0} stroke="#71717a" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="eval"
                stroke="#10b981"
                fill="url(#evalGradientPos)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Critical moments */}
      {analysis.criticalMoments.length > 0 && (
        <div>
          <h3 className="text-sm text-zinc-400 uppercase tracking-wider mb-2">Critical Moments</h3>
          <div className="space-y-2">
            {analysis.criticalMoments.map((moment, i) => (
              <div key={i} className="bg-zinc-800 rounded-lg p-3 border-l-4 border-orange-500">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-zinc-400">Move {moment.moveNumber}</span>
                  <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">
                    {Math.abs(moment.evalSwing / 100).toFixed(1)} pawns
                  </span>
                </div>
                <p className="text-sm text-zinc-300">{moment.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-2 gap-4">
        {analysis.strengths.length > 0 && (
          <div>
            <h3 className="text-sm text-zinc-400 uppercase tracking-wider mb-2">Strengths</h3>
            <ul className="space-y-1">
              {analysis.strengths.map((s, i) => (
                <li key={i} className="text-sm text-emerald-400 flex items-start gap-1.5">
                  <span className="mt-0.5">+</span> {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.weaknessesExposed.length > 0 && (
          <div>
            <h3 className="text-sm text-zinc-400 uppercase tracking-wider mb-2">Areas to Improve</h3>
            <ul className="space-y-1">
              {analysis.weaknessesExposed.map((w, i) => (
                <li key={i} className="text-sm text-orange-400 flex items-start gap-1.5">
                  <span className="mt-0.5">!</span> {w}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {analysis.suggestions.length > 0 && (
        <div>
          <h3 className="text-sm text-zinc-400 uppercase tracking-wider mb-2">Suggestions</h3>
          <div className="space-y-1.5">
            {analysis.suggestions.map((s, i) => (
              <p key={i} className="text-sm text-zinc-300 bg-zinc-800 rounded-lg p-3">
                {s}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onNewGame}
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          New Game
        </button>
        <button
          onClick={onClose}
          className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 font-semibold py-3 rounded-lg transition-colors"
        >
          Review Board
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, small }: { label: string; value: string; color: string; small?: boolean }) {
  return (
    <div className="bg-zinc-800 rounded-lg p-3 text-center">
      <p className="text-xs text-zinc-400 mb-1">{label}</p>
      <p className={`${small ? 'text-sm' : 'text-xl'} font-bold ${color}`}>{value}</p>
    </div>
  );
}
