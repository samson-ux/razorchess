// ============================================================
// RazorChess — ELO Progression Dashboard
// Track rating history and player stats over time
// ============================================================

'use client';

import { PlayerProfile } from '@/lib/types';
import { loadEloHistory, loadGameHistory } from '@/lib/player-profile';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useMemo } from 'react';

interface EloDashboardProps {
  profile: PlayerProfile;
  onClose: () => void;
}

export default function EloDashboard({ profile, onClose }: EloDashboardProps) {
  const eloHistory = useMemo(() => loadEloHistory(), []);
  const gameHistory = useMemo(() => loadGameHistory(), []);

  const wins = gameHistory.filter(g => {
    if (!g.result) return false;
    if ('winner' in g.result) return g.result.winner === g.playerColor;
    return false;
  }).length;
  const losses = gameHistory.filter(g => {
    if (!g.result) return false;
    if ('winner' in g.result) return g.result.winner !== g.playerColor;
    return false;
  }).length;
  const draws = gameHistory.length - wins - losses;

  const chartData = eloHistory.map((e, i) => ({
    game: i + 1,
    elo: e.elo,
    result: e.result,
  }));

  const avgTension = gameHistory.length > 0
    ? gameHistory.reduce((s, g) => s + (g.tensionScore || 0), 0) / gameHistory.length
    : 0;

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-700 p-6 space-y-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-100">Player Dashboard</h2>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 text-lg">&times;</button>
      </div>

      {/* ELO rating */}
      <div className="text-center bg-zinc-800 rounded-xl p-6">
        <p className="text-sm text-zinc-400 mb-1">Current Rating</p>
        <p className="text-5xl font-black text-emerald-400">{profile.elo}</p>
        <p className="text-sm text-zinc-500 mt-1">{profile.gamesPlayed} games played</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-3">
        <MiniStat label="Wins" value={`${wins}`} color="text-emerald-400" />
        <MiniStat label="Losses" value={`${losses}`} color="text-red-400" />
        <MiniStat label="Draws" value={`${draws}`} color="text-yellow-400" />
        <MiniStat label="Win Rate" value={gameHistory.length > 0 ? `${Math.round(wins / gameHistory.length * 100)}%` : '-'} color="text-blue-400" />
      </div>

      {/* Skill radar (simplified as bars) */}
      <div>
        <h3 className="text-sm text-zinc-400 uppercase tracking-wider mb-3">Skill Breakdown</h3>
        <div className="space-y-2">
          <SkillBar label="Opening" value={profile.openingAccuracy} />
          <SkillBar label="Tactics" value={profile.tacticRating} />
          <SkillBar label="Endgame" value={profile.endgameRating} />
          <SkillBar label="Consistency" value={1 - profile.blunderRate} />
        </div>
      </div>

      {/* Play style */}
      <div>
        <h3 className="text-sm text-zinc-400 uppercase tracking-wider mb-3">Play Style</h3>
        <div className="grid grid-cols-3 gap-3">
          <StyleStat label="Aggressive" value={profile.styleVector.aggressive} color="bg-red-500" />
          <StyleStat label="Positional" value={profile.styleVector.positional} color="bg-blue-500" />
          <StyleStat label="Trappy" value={profile.styleVector.trappy} color="bg-purple-500" />
        </div>
      </div>

      {/* ELO chart */}
      {chartData.length > 1 && (
        <div>
          <h3 className="text-sm text-zinc-400 uppercase tracking-wider mb-2">Rating History</h3>
          <div className="bg-zinc-800 rounded-lg p-2" style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                <XAxis dataKey="game" tick={{ fontSize: 10, fill: '#71717a' }} />
                <YAxis tick={{ fontSize: 10, fill: '#71717a' }} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: '8px' }}
                  formatter={(v) => [String(v), 'ELO']}
                />
                <Line type="monotone" dataKey="elo" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Average tension */}
      <div className="bg-zinc-800 rounded-lg p-4 text-center">
        <p className="text-sm text-zinc-400 mb-1">Average Game Tension</p>
        <p className="text-2xl font-bold text-orange-400">{avgTension.toFixed(1)}/10</p>
        <p className="text-xs text-zinc-500 mt-1">Higher = more razor-tight games</p>
      </div>

      {/* Weaknesses */}
      {profile.weaknesses.length > 0 && (
        <div>
          <h3 className="text-sm text-zinc-400 uppercase tracking-wider mb-2">Known Weaknesses</h3>
          <div className="flex flex-wrap gap-2">
            {profile.weaknesses.map((w, i) => (
              <span key={i} className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">
                {w}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-zinc-800 rounded-lg p-3 text-center">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function SkillBar({ label, value }: { label: string; value: number }) {
  const percent = Math.max(0, Math.min(100, value * 100));
  const color = percent > 70 ? 'bg-emerald-500' : percent > 40 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-400 w-20 text-right">{label}</span>
      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs text-zinc-500 w-10">{Math.round(percent)}%</span>
    </div>
  );
}

function StyleStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-zinc-800 rounded-lg p-2 text-center">
      <div className={`w-8 h-8 rounded-full ${color} mx-auto mb-1 flex items-center justify-center text-xs font-bold text-white`}>
        {Math.round(value * 100)}
      </div>
      <p className="text-xs text-zinc-400">{label}</p>
    </div>
  );
}
