// ============================================================
// RazorChess — Engine Interface
// Common interface for Stockfish WASM and SimpleEngine
// ============================================================

import { MoveAnalysis, PositionEval } from './types';

export interface ChessEngineInterface {
  evaluate(fen: string, depth?: number, multiPV?: number): Promise<PositionEval>;
  getTopMoves(fen: string, count?: number, depth?: number): Promise<MoveAnalysis[]>;
  destroy(): void;
}
