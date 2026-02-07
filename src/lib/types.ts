// ============================================================
// RazorChess — Core Type Definitions
// ============================================================

export interface StyleVector {
  aggressive: number;   // 0-1: tendency to attack
  positional: number;   // 0-1: tendency to play solid/strategic
  trappy: number;       // 0-1: tendency to set tactical traps
}

export interface PlayerProfile {
  id: string;
  name: string;
  elo: number;
  openingAccuracy: number;
  tacticRating: number;
  endgameRating: number;
  blunderRate: number;        // 0-1: frequency of major mistakes
  timeManagement: number;     // 0-1: how well they use the clock
  styleVector: StyleVector;
  weaknesses: string[];
  gamesPlayed: number;
  movesAnalyzed: number;
}

export interface MoveAnalysis {
  move: string;               // UCI format: e2e4
  san: string;                // Standard algebraic: e4
  evaluation: number;         // centipawns from engine's perspective
  depth: number;
  isPV: boolean;              // is principal variation
}

export interface PositionEval {
  fen: string;
  bestMoves: MoveAnalysis[];
  evaluation: number;         // centipawns, positive = white advantage
  depth: number;
  mate: number | null;        // moves to mate, null if none
}

export interface AdaptiveConfig {
  targetEval: number;         // where we want the eval to hover (near 0)
  adaptiveStrength: number;   // 0-1: how aggressively we balance
  humanPlausibility: number;  // 0-1: weight for human-like moves
  complexityBias: number;     // 0-1: preference for complex positions
  mistakeRate: number;        // 0-1: controlled error injection
}

export type Personality = 'grinder' | 'attacker' | 'trickster' | 'mentor';

export interface PersonalityConfig {
  name: Personality;
  displayName: string;
  description: string;
  styleWeights: StyleVector;
  adaptiveOverrides: Partial<AdaptiveConfig>;
  commentary: string[];       // flavor text snippets
}

export interface GameMove {
  moveNumber: number;
  san: string;
  uci: string;
  fen: string;
  evaluation: number;
  bestEval: number;           // what Stockfish thought was best
  centipawnLoss: number;
  isBlunder: boolean;
  isMistake: boolean;
  isInaccuracy: boolean;
  isBrilliant: boolean;
  timestamp: number;
  thinkTime: number;          // ms the player/engine spent
  isPlayerMove: boolean;
}

export interface GameState {
  id: string;
  playerColor: 'white' | 'black';
  currentFen: string;
  moves: GameMove[];
  playerProfile: PlayerProfile;
  personality: Personality;
  adaptiveConfig: AdaptiveConfig;
  gamePhase: 'opening' | 'middlegame' | 'endgame';
  tensionScore: number;       // 0-10: how razor-tight the game is
  rollingAccuracy: number;    // player's accuracy this game (rolling window)
  momentumStreak: number;     // consecutive good/bad moves
  result: GameResult | null;
  startTime: number;
  isThinking: boolean;
}

export type GameResult =
  | { type: 'checkmate'; winner: 'white' | 'black' }
  | { type: 'stalemate' }
  | { type: 'draw'; reason: 'agreement' | 'repetition' | 'fifty-move' | 'insufficient' }
  | { type: 'resignation'; winner: 'white' | 'black' }
  | { type: 'timeout'; winner: 'white' | 'black' };

export interface PostGameAnalysis {
  gameId: string;
  playerAccuracy: number;
  engineAccuracy: number;
  tensionScore: number;
  criticalMoments: CriticalMoment[];
  openingName: string;
  eloChange: number;
  weaknessesExposed: string[];
  strengths: string[];
  suggestions: string[];
}

export interface CriticalMoment {
  moveNumber: number;
  fen: string;
  played: string;
  best: string;
  evalSwing: number;
  description: string;
}

export interface EloHistory {
  timestamp: number;
  elo: number;
  gameId: string;
  opponent: Personality;
  result: string;
}
