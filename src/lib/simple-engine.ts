// ============================================================
// RazorChess — Simple Built-in Chess Engine
// Lightweight fallback when Stockfish WASM isn't available
// Uses alpha-beta pruning with piece-square tables
// ============================================================

import { Chess, Square, Move } from 'chess.js';
import { MoveAnalysis, PositionEval } from './types';

// Piece values in centipawns
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-square tables (from white's perspective, flip for black)
const PST: Record<string, number[]> = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
  ],
};

export class SimpleEngine {
  private maxDepth: number;

  constructor(depth: number = 4) {
    this.maxDepth = depth;
  }

  async evaluate(fen: string, depth?: number, multiPV: number = 5): Promise<PositionEval> {
    const chess = new Chess(fen);
    const searchDepth = depth || this.maxDepth;
    const isWhite = chess.turn() === 'w';

    // Get all legal moves and evaluate each
    const moves = chess.moves({ verbose: true });
    const evaluated: Array<{ move: Move; score: number }> = [];

    for (const move of moves) {
      chess.move(move);
      const score = -this.alphaBeta(chess, searchDepth - 1, -Infinity, Infinity, !isWhite);
      chess.undo();
      evaluated.push({ move, score });
    }

    // Sort by score (best first for current side)
    evaluated.sort((a, b) => b.score - a.score);

    const topMoves: MoveAnalysis[] = evaluated.slice(0, multiPV).map((e, i) => ({
      move: e.move.from + e.move.to + (e.move.promotion || ''),
      san: e.move.san,
      evaluation: isWhite ? e.score : -e.score, // normalize to white's perspective
      depth: searchDepth,
      isPV: i === 0,
    }));

    const bestEval = topMoves.length > 0 ? topMoves[0].evaluation : 0;

    return {
      fen,
      bestMoves: topMoves,
      evaluation: bestEval,
      depth: searchDepth,
      mate: null,
    };
  }

  async getTopMoves(fen: string, count: number = 10, depth?: number): Promise<MoveAnalysis[]> {
    const result = await this.evaluate(fen, depth, count);
    return result.bestMoves;
  }

  private alphaBeta(
    chess: Chess,
    depth: number,
    alpha: number,
    beta: number,
    isMaximizing: boolean
  ): number {
    if (depth === 0 || chess.isGameOver()) {
      return this.staticEval(chess);
    }

    const moves = chess.moves({ verbose: true });

    // Move ordering: captures first, then by piece value
    moves.sort((a, b) => {
      const aScore = a.captured ? PIECE_VALUES[a.captured] : 0;
      const bScore = b.captured ? PIECE_VALUES[b.captured] : 0;
      return bScore - aScore;
    });

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        chess.move(move);
        const score = this.alphaBeta(chess, depth - 1, alpha, beta, false);
        chess.undo();
        maxEval = Math.max(maxEval, score);
        alpha = Math.max(alpha, score);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        chess.move(move);
        const score = this.alphaBeta(chess, depth - 1, alpha, beta, true);
        chess.undo();
        minEval = Math.min(minEval, score);
        beta = Math.min(beta, score);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  private staticEval(chess: Chess): number {
    if (chess.isCheckmate()) {
      return chess.turn() === 'w' ? -99999 : 99999;
    }
    if (chess.isDraw() || chess.isStalemate()) {
      return 0;
    }

    let score = 0;
    const board = chess.board();

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (!piece) continue;

        const pieceValue = PIECE_VALUES[piece.type] || 0;
        const pstIndex = piece.color === 'w' ? rank * 8 + file : (7 - rank) * 8 + file;
        const pstValue = PST[piece.type]?.[pstIndex] || 0;

        if (piece.color === 'w') {
          score += pieceValue + pstValue;
        } else {
          score -= pieceValue + pstValue;
        }
      }
    }

    // Mobility bonus
    const currentMoves = chess.moves().length;
    const mobilityBonus = currentMoves * 2;
    score += chess.turn() === 'w' ? mobilityBonus : -mobilityBonus;

    return score;
  }

  destroy(): void {
    // Nothing to clean up
  }
}
