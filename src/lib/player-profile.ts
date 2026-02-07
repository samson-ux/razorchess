// ============================================================
// RazorChess — Player Skill Profiling System
// Tracks and updates player skill across multiple dimensions
// ============================================================

import { PlayerProfile, GameMove, StyleVector, GameState, PostGameAnalysis } from './types';
import { v4 as uuid } from 'uuid';

const STORAGE_KEY = 'razorchess_player_profile';
const ELO_HISTORY_KEY = 'razorchess_elo_history';
const GAMES_KEY = 'razorchess_games';

export function createDefaultProfile(name: string = 'Player'): PlayerProfile {
  return {
    id: uuid(),
    name,
    elo: 1200,
    openingAccuracy: 0.5,
    tacticRating: 0.5,
    endgameRating: 0.5,
    blunderRate: 0.15,
    timeManagement: 0.5,
    styleVector: { aggressive: 0.5, positional: 0.5, trappy: 0.3 },
    weaknesses: [],
    gamesPlayed: 0,
    movesAnalyzed: 0,
  };
}

export function loadProfile(): PlayerProfile {
  if (typeof window === 'undefined') return createDefaultProfile();
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return createDefaultProfile();
    }
  }
  return createDefaultProfile();
}

export function saveProfile(profile: PlayerProfile): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

// Detect weaknesses from move history
function detectWeaknesses(moves: GameMove[]): string[] {
  const weaknesses: Set<string> = new Set();

  const blunders = moves.filter(m => m.isPlayerMove && m.isBlunder);
  if (blunders.length > 0) {
    // Analyze blunder patterns
    const earlyBlunders = blunders.filter(m => m.moveNumber <= 10);
    const lateBlunders = blunders.filter(m => m.moveNumber > 30);

    if (earlyBlunders.length > blunders.length * 0.4) weaknesses.add('opening preparation');
    if (lateBlunders.length > blunders.length * 0.4) weaknesses.add('endgame technique');
  }

  // Check for tactical misses
  const tacticalMisses = moves.filter(
    m => m.isPlayerMove && m.centipawnLoss > 200 && !m.isBlunder
  );
  if (tacticalMisses.length > moves.filter(m => m.isPlayerMove).length * 0.1) {
    weaknesses.add('tactical awareness');
  }

  // Check time management via think times
  const playerMoves = moves.filter(m => m.isPlayerMove);
  if (playerMoves.length > 5) {
    const avgThinkTime = playerMoves.reduce((s, m) => s + m.thinkTime, 0) / playerMoves.length;
    const fastMoves = playerMoves.filter(m => m.thinkTime < avgThinkTime * 0.3);
    if (fastMoves.length > playerMoves.length * 0.3) {
      weaknesses.add('time management — too many rushed moves');
    }
  }

  return Array.from(weaknesses);
}

// Detect play style from move history
function detectStyle(moves: GameMove[]): StyleVector {
  const playerMoves = moves.filter(m => m.isPlayerMove);
  if (playerMoves.length === 0) return { aggressive: 0.5, positional: 0.5, trappy: 0.3 };

  // Aggressive: high centipawn swings, playing sharp lines
  const bigSwings = playerMoves.filter(m => Math.abs(m.evaluation) > 150);
  const aggressive = Math.min(1, bigSwings.length / playerMoves.length * 3);

  // Positional: low centipawn loss on average, steady play
  const avgCPL = playerMoves.reduce((s, m) => s + m.centipawnLoss, 0) / playerMoves.length;
  const positional = Math.max(0, Math.min(1, 1 - avgCPL / 100));

  // Trappy: moves that aren't the best but set problems
  const suboptimalMoves = playerMoves.filter(
    m => m.centipawnLoss > 30 && m.centipawnLoss < 150
  );
  const trappy = Math.min(1, suboptimalMoves.length / playerMoves.length * 2);

  return { aggressive, positional, trappy };
}

export function updateProfileFromGame(
  profile: PlayerProfile,
  gameState: GameState
): { profile: PlayerProfile; eloChange: number } {
  const playerMoves = gameState.moves.filter(m => m.isPlayerMove);
  if (playerMoves.length === 0) return { profile, eloChange: 0 };

  const totalCPL = playerMoves.reduce((sum, m) => sum + m.centipawnLoss, 0);
  const avgCPL = totalCPL / playerMoves.length;
  const blunders = playerMoves.filter(m => m.isBlunder).length;
  const blunderRate = blunders / playerMoves.length;

  // Accuracy score: 0-1 based on centipawn loss
  const accuracy = Math.max(0, Math.min(1, 1 - avgCPL / 200));

  // ELO estimation from accuracy
  const performanceElo = accuracyToElo(accuracy);

  // Smooth ELO update (weighted moving average)
  const k = Math.max(16, 40 - profile.gamesPlayed); // K-factor decreases over time
  const expectedScore = 1 / (1 + Math.pow(10, (profile.elo - performanceElo) / 400));

  // Determine game result score
  let gameScore = 0.5; // draw
  if (gameState.result) {
    if (gameState.result.type === 'checkmate' || gameState.result.type === 'resignation' || gameState.result.type === 'timeout') {
      gameScore = gameState.result.winner === gameState.playerColor ? 1 : 0;
    } else if (gameState.result.type === 'stalemate' || gameState.result.type === 'draw') {
      gameScore = 0.5;
    }
  }

  const eloChange = Math.round(k * (gameScore - expectedScore));

  // Detect game phases from moves
  const openingMoves = playerMoves.filter(m => m.moveNumber <= 10);
  const endgameMoves = playerMoves.filter(m => m.moveNumber > 30);

  const openingAcc = openingMoves.length > 0
    ? Math.max(0, Math.min(1, 1 - openingMoves.reduce((s, m) => s + m.centipawnLoss, 0) / openingMoves.length / 150))
    : profile.openingAccuracy;

  const endgameAcc = endgameMoves.length > 0
    ? Math.max(0, Math.min(1, 1 - endgameMoves.reduce((s, m) => s + m.centipawnLoss, 0) / endgameMoves.length / 150))
    : profile.endgameRating;

  // Blend with existing profile (exponential moving average)
  const alpha = 0.3; // learning rate

  const updatedProfile: PlayerProfile = {
    ...profile,
    elo: Math.max(100, profile.elo + eloChange),
    openingAccuracy: profile.openingAccuracy * (1 - alpha) + openingAcc * alpha,
    tacticRating: profile.tacticRating * (1 - alpha) + accuracy * alpha,
    endgameRating: profile.endgameRating * (1 - alpha) + endgameAcc * alpha,
    blunderRate: profile.blunderRate * (1 - alpha) + blunderRate * alpha,
    styleVector: blendStyles(profile.styleVector, detectStyle(gameState.moves), alpha),
    weaknesses: detectWeaknesses(gameState.moves),
    gamesPlayed: profile.gamesPlayed + 1,
    movesAnalyzed: profile.movesAnalyzed + playerMoves.length,
  };

  return { profile: updatedProfile, eloChange };
}

function blendStyles(a: StyleVector, b: StyleVector, alpha: number): StyleVector {
  return {
    aggressive: a.aggressive * (1 - alpha) + b.aggressive * alpha,
    positional: a.positional * (1 - alpha) + b.positional * alpha,
    trappy: a.trappy * (1 - alpha) + b.trappy * alpha,
  };
}

function accuracyToElo(accuracy: number): number {
  // Map accuracy (0-1) to approximate ELO
  // 0.95+ = 2500+, 0.85 = 2000, 0.70 = 1500, 0.50 = 1000, 0.30 = 500
  if (accuracy >= 0.95) return 2500 + (accuracy - 0.95) * 10000;
  if (accuracy >= 0.85) return 2000 + (accuracy - 0.85) * 5000;
  if (accuracy >= 0.70) return 1500 + (accuracy - 0.70) * 3333;
  if (accuracy >= 0.50) return 1000 + (accuracy - 0.50) * 2500;
  return 400 + accuracy * 1200;
}

// Storage helpers
export function saveGameHistory(gameState: GameState): void {
  if (typeof window === 'undefined') return;
  const games = loadGameHistory();
  games.push({
    id: gameState.id,
    date: Date.now(),
    moves: gameState.moves,
    result: gameState.result,
    personality: gameState.personality,
    playerColor: gameState.playerColor,
    tensionScore: gameState.tensionScore,
  });
  // Keep last 100 games
  if (games.length > 100) games.splice(0, games.length - 100);
  localStorage.setItem(GAMES_KEY, JSON.stringify(games));
}

export function loadGameHistory(): Array<{
  id: string;
  date: number;
  moves: GameMove[];
  result: GameState['result'];
  personality: string;
  playerColor: string;
  tensionScore: number;
}> {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(GAMES_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { return []; }
  }
  return [];
}

export function saveEloHistory(entry: { timestamp: number; elo: number; gameId: string; opponent: string; result: string }): void {
  if (typeof window === 'undefined') return;
  const history = loadEloHistory();
  history.push(entry);
  localStorage.setItem(ELO_HISTORY_KEY, JSON.stringify(history));
}

export function loadEloHistory(): Array<{ timestamp: number; elo: number; gameId: string; opponent: string; result: string }> {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(ELO_HISTORY_KEY);
  if (stored) {
    try { return JSON.parse(stored); } catch { return []; }
  }
  return [];
}
