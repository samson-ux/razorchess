// ============================================================
// RazorChess — Post-Game Analysis System
// Full game review with critical moment detection
// ============================================================

import { CriticalMoment, GameMove, GameState, PostGameAnalysis } from './types';

export function generatePostGameAnalysis(gameState: GameState): PostGameAnalysis {
  const playerMoves = gameState.moves.filter(m => m.isPlayerMove);
  const engineMoves = gameState.moves.filter(m => !m.isPlayerMove);

  // Player accuracy
  const playerAccuracy = playerMoves.length > 0
    ? Math.max(0, Math.min(100, 100 - (playerMoves.reduce((s, m) => s + m.centipawnLoss, 0) / playerMoves.length)))
    : 50;

  // Engine accuracy (should be near player's level)
  const engineAccuracy = engineMoves.length > 0
    ? Math.max(0, Math.min(100, 100 - (engineMoves.reduce((s, m) => s + m.centipawnLoss, 0) / engineMoves.length)))
    : 50;

  // Detect critical moments
  const criticalMoments = detectCriticalMoments(gameState.moves);

  // Detect weaknesses exposed
  const weaknessesExposed = detectWeaknessesFromGame(playerMoves);

  // Detect strengths
  const strengths = detectStrengths(playerMoves);

  // Generate suggestions
  const suggestions = generateSuggestions(playerMoves, weaknessesExposed);

  // Determine result string for ELO
  let resultStr = 'draw';
  if (gameState.result) {
    if (gameState.result.type === 'checkmate' || gameState.result.type === 'resignation' || gameState.result.type === 'timeout') {
      resultStr = gameState.result.winner === gameState.playerColor ? 'win' : 'loss';
    }
  }

  return {
    gameId: gameState.id,
    playerAccuracy,
    engineAccuracy,
    tensionScore: gameState.tensionScore,
    criticalMoments,
    openingName: detectOpening(gameState.moves),
    eloChange: 0, // calculated separately
    weaknessesExposed,
    strengths,
    suggestions,
  };
}

function detectCriticalMoments(moves: GameMove[]): CriticalMoment[] {
  const moments: CriticalMoment[] = [];

  for (let i = 1; i < moves.length; i++) {
    const move = moves[i];
    const prevMove = moves[i - 1];
    const evalSwing = Math.abs(move.evaluation - prevMove.evaluation);

    // A critical moment is any move with a big eval swing
    if (evalSwing > 100 && move.isPlayerMove) {
      let description: string;
      if (move.isBlunder) {
        description = `Blunder! ${move.san} lost ${Math.round(evalSwing / 100 * 10) / 10} pawns worth of advantage.`;
      } else if (move.isBrilliant) {
        description = `Brilliant move! ${move.san} — finding the only winning continuation.`;
      } else if (evalSwing > 200) {
        description = `Critical mistake with ${move.san}. This significantly shifted the balance.`;
      } else {
        description = `Important moment: ${move.san} changed the character of the position.`;
      }

      moments.push({
        moveNumber: move.moveNumber,
        fen: move.fen,
        played: move.san,
        best: move.san, // would need engine analysis for the actual best move
        evalSwing,
        description,
      });
    }
  }

  // Keep top 5 most critical moments
  return moments
    .sort((a, b) => b.evalSwing - a.evalSwing)
    .slice(0, 5);
}

function detectWeaknessesFromGame(playerMoves: GameMove[]): string[] {
  const weaknesses: string[] = [];

  // Opening blunders
  const openingBlunders = playerMoves.filter(m => m.moveNumber <= 10 && (m.isBlunder || m.isMistake));
  if (openingBlunders.length >= 2) weaknesses.push('Opening preparation needs work');

  // Tactical oversights
  const bigMisses = playerMoves.filter(m => m.centipawnLoss > 200);
  if (bigMisses.length >= 2) weaknesses.push('Missing tactical shots');

  // Endgame technique
  const endgameMoves = playerMoves.filter(m => m.moveNumber > 30);
  if (endgameMoves.length > 3) {
    const endgameAvgCPL = endgameMoves.reduce((s, m) => s + m.centipawnLoss, 0) / endgameMoves.length;
    if (endgameAvgCPL > 60) weaknesses.push('Endgame technique could improve');
  }

  // Time pressure errors (fast moves late in game)
  const lateFastMoves = playerMoves.filter(m => m.moveNumber > 25 && m.thinkTime < 2000 && m.centipawnLoss > 50);
  if (lateFastMoves.length >= 3) weaknesses.push('Rushing in critical moments');

  return weaknesses;
}

function detectStrengths(playerMoves: GameMove[]): string[] {
  const strengths: string[] = [];

  // Good opening play
  const openingMoves = playerMoves.filter(m => m.moveNumber <= 10);
  if (openingMoves.length > 3) {
    const openingAvgCPL = openingMoves.reduce((s, m) => s + m.centipawnLoss, 0) / openingMoves.length;
    if (openingAvgCPL < 20) strengths.push('Excellent opening preparation');
  }

  // Brilliant moves
  const brilliantMoves = playerMoves.filter(m => m.isBrilliant);
  if (brilliantMoves.length > 0) strengths.push(`Found ${brilliantMoves.length} brilliant move(s)`);

  // Consistent accuracy
  const avgCPL = playerMoves.reduce((s, m) => s + m.centipawnLoss, 0) / playerMoves.length;
  if (avgCPL < 30) strengths.push('Very consistent play throughout');
  if (avgCPL < 15) strengths.push('Near-perfect accuracy');

  // No blunders
  if (!playerMoves.some(m => m.isBlunder)) strengths.push('Clean game — no blunders');

  return strengths;
}

function generateSuggestions(playerMoves: GameMove[], weaknesses: string[]): string[] {
  const suggestions: string[] = [];

  if (weaknesses.includes('Opening preparation needs work')) {
    suggestions.push('Study the opening you played. Review the first 10 moves and compare to theory.');
  }
  if (weaknesses.includes('Missing tactical shots')) {
    suggestions.push('Practice puzzles daily — focus on pattern recognition for forks, pins, and skewers.');
  }
  if (weaknesses.includes('Endgame technique could improve')) {
    suggestions.push('Study basic endgames: King + Pawn, Rook endgames, and opposition concepts.');
  }
  if (weaknesses.includes('Rushing in critical moments')) {
    suggestions.push('Slow down in critical positions. When the eval is close, take extra time to calculate.');
  }

  if (suggestions.length === 0) {
    const avgCPL = playerMoves.reduce((s, m) => s + m.centipawnLoss, 0) / playerMoves.length;
    if (avgCPL < 20) {
      suggestions.push('Excellent game! Try the Attacker personality for a bigger challenge.');
    } else {
      suggestions.push('Good game! Focus on reducing inaccuracies in the middlegame.');
    }
  }

  return suggestions;
}

function detectOpening(moves: GameMove[]): string {
  if (moves.length < 2) return 'Unknown Opening';

  const first4 = moves.slice(0, 4).map(m => m.san);
  const moveStr = first4.join(' ');

  // Simple opening detection (could be expanded with a proper ECO database)
  if (moveStr.startsWith('e4 e5 Nf3 Nc6')) return 'Italian Game / Four Knights';
  if (moveStr.startsWith('e4 e5 Nf3 Nf6')) return "Petrov's Defense";
  if (moveStr.startsWith('e4 e5 Nf3')) return 'King\'s Pawn Game';
  if (moveStr.startsWith('e4 c5')) return 'Sicilian Defense';
  if (moveStr.startsWith('e4 e6')) return 'French Defense';
  if (moveStr.startsWith('e4 c6')) return 'Caro-Kann Defense';
  if (moveStr.startsWith('e4 d5')) return 'Scandinavian Defense';
  if (moveStr.startsWith('d4 d5 c4')) return "Queen's Gambit";
  if (moveStr.startsWith('d4 Nf6 c4 g6')) return "King's Indian Defense";
  if (moveStr.startsWith('d4 Nf6 c4 e6')) return 'Nimzo/Queen\'s Indian';
  if (moveStr.startsWith('d4 d5')) return "Queen's Pawn Game";
  if (moveStr.startsWith('d4 Nf6')) return 'Indian Defense';
  if (moveStr.startsWith('c4')) return 'English Opening';
  if (moveStr.startsWith('Nf3')) return 'Reti Opening';

  return 'Unorthodox Opening';
}

// Calculate accuracy percentage from centipawn loss
export function cplToAccuracy(avgCPL: number): number {
  // Formula: accuracy = 103.1668 * exp(-0.04354 * avgCPL) - 3.1668
  // (inspired by Lichess/chess.com accuracy formulas)
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * avgCPL) - 3.1668));
}
