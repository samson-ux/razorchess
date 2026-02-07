// ============================================================
// RazorChess — Adaptive Move Selection Engine
// The "secret sauce" — picks moves that keep games razor-tight
// ============================================================

import { Chess, Square } from 'chess.js';
import { ChessEngineInterface } from './engine-interface';
import {
  AdaptiveConfig,
  GameMove,
  GameState,
  MoveAnalysis,
  Personality,
  PlayerProfile,
  PositionEval,
} from './types';
import { getPersonalityConfig } from './personalities';

const BLUNDER_THRESHOLD = 300;
const MISTAKE_THRESHOLD = 100;
const INACCURACY_THRESHOLD = 50;

export class AdaptiveEngine {
  private engine: ChessEngineInterface;
  private config: AdaptiveConfig;
  private personality: Personality;
  private rollingAccuracy: number[] = [];
  private momentumStreak = 0;

  constructor(engine: ChessEngineInterface, personality: Personality = 'mentor') {
    this.engine = engine;
    this.personality = personality;
    this.config = this.buildConfig(personality);
  }

  private buildConfig(personality: Personality): AdaptiveConfig {
    const personConfig = getPersonalityConfig(personality);
    const base: AdaptiveConfig = {
      targetEval: 0,
      adaptiveStrength: 0.6,
      humanPlausibility: 0.7,
      complexityBias: 0.4,
      mistakeRate: 0.05,
    };
    return { ...base, ...personConfig.adaptiveOverrides };
  }

  setPersonality(personality: Personality): void {
    this.personality = personality;
    this.config = this.buildConfig(personality);
  }

  async selectMove(
    fen: string,
    gameState: GameState,
    profile: PlayerProfile
  ): Promise<{ move: string; san: string; evaluation: number; thinking: string }> {
    const posEval = await this.engine.evaluate(fen, 16, 8);
    const topMoves = posEval.bestMoves;

    if (topMoves.length === 0) {
      throw new Error('No legal moves available');
    }

    if (topMoves.length === 1) {
      return {
        move: topMoves[0].move,
        san: this.uciToSan(fen, topMoves[0].move),
        evaluation: topMoves[0].evaluation,
        thinking: 'Only one legal move.',
      };
    }

    const currentEval = posEval.evaluation;
    const isEngineSideWhite = gameState.playerColor === 'black';
    const enginePerspectiveEval = isEngineSideWhite ? currentEval : -currentEval;

    const correctionFactor = -enginePerspectiveEval * this.config.adaptiveStrength;
    const targetEval = enginePerspectiveEval + correctionFactor;

    const playerStrength = this.estimatePlayerStrength(gameState, profile);
    const adjustedTarget = this.adjustTargetForPlayer(targetEval, playerStrength);

    const scoredMoves = topMoves.map(move => {
      const moveEvalForEngine = isEngineSideWhite ? move.evaluation : -move.evaluation;
      const score = this.scoreMove(move, moveEvalForEngine, adjustedTarget, profile, gameState);
      return { ...move, score };
    });

    const personalityFiltered = this.applyPersonalityFilter(scoredMoves, gameState);
    const selected = this.weightedRandomSelect(personalityFiltered, profile.elo);
    const finalMove = this.maybeInjectMistake(selected, topMoves, profile, gameState);
    const san = this.uciToSan(fen, finalMove.move);

    return {
      move: finalMove.move,
      san,
      evaluation: finalMove.evaluation,
      thinking: this.generateThinking(finalMove, topMoves[0], enginePerspectiveEval, adjustedTarget),
    };
  }

  private scoreMove(
    move: MoveAnalysis,
    moveEvalForEngine: number,
    targetEval: number,
    profile: PlayerProfile,
    gameState: GameState
  ): number {
    const w1 = 1.0;
    const w2 = this.config.humanPlausibility;
    const w3 = this.config.complexityBias;

    const evalDistance = Math.abs(moveEvalForEngine - targetEval);
    const evalScore = Math.max(0, 1 - evalDistance / 500);
    const humanScore = this.humanPlausibilityScore(move, profile.elo);
    const complexityScore = this.estimateComplexity(move, gameState);

    return w1 * evalScore + w2 * humanScore + w3 * complexityScore;
  }

  private humanPlausibilityScore(move: MoveAnalysis, elo: number): number {
    const eloFactor = elo / 2500;
    if (move.isPV) return 0.4 + eloFactor * 0.6;
    const evalDiff = Math.abs(move.evaluation);
    if (evalDiff < 50) return 0.7;
    if (evalDiff < 150) return 0.5 + (1 - eloFactor) * 0.3;
    if (evalDiff < 300) return 0.2 + (1 - eloFactor) * 0.5;
    return (1 - eloFactor) * 0.3;
  }

  private estimateComplexity(move: MoveAnalysis, gameState: GameState): number {
    const evalTension = Math.max(0, 1 - Math.abs(move.evaluation) / 300);
    const phaseBonus = gameState.gamePhase === 'middlegame' ? 0.3 : 0;
    return Math.min(1, evalTension + phaseBonus);
  }

  private estimatePlayerStrength(gameState: GameState, profile: PlayerProfile): number {
    if (this.rollingAccuracy.length < 3) return profile.elo / 2500;
    const recentAccuracy = this.rollingAccuracy.slice(-5);
    const avgAccuracy = recentAccuracy.reduce((a, b) => a + b, 0) / recentAccuracy.length;
    const momentumBonus = this.momentumStreak > 2 ? 0.1 : 0;
    return Math.min(1, avgAccuracy + momentumBonus);
  }

  private adjustTargetForPlayer(baseTarget: number, playerStrength: number): number {
    const strengthAdjust = (playerStrength - 0.5) * 100;
    return baseTarget + strengthAdjust;
  }

  private applyPersonalityFilter(
    moves: Array<MoveAnalysis & { score: number }>,
    _gameState: GameState
  ): Array<MoveAnalysis & { score: number }> {
    return moves.map(move => {
      let bonus = 0;
      switch (this.personality) {
        case 'attacker':
          if (move.evaluation > 50) bonus += 0.2;
          break;
        case 'grinder':
          if (Math.abs(move.evaluation) < 50) bonus += 0.2;
          break;
        case 'trickster':
          if (!move.isPV && move.evaluation > -100) bonus += 0.25;
          break;
        case 'mentor':
          if (Math.abs(move.evaluation) < 100) bonus += 0.1;
          break;
      }
      return { ...move, score: move.score + bonus };
    });
  }

  private weightedRandomSelect(
    moves: Array<MoveAnalysis & { score: number }>,
    elo: number
  ): MoveAnalysis & { score: number } {
    const sorted = [...moves].sort((a, b) => b.score - a.score);
    const temperature = Math.max(0.1, 1 - elo / 3000);
    const maxScore = sorted[0].score;
    const weights = sorted.map(m => Math.exp((m.score - maxScore) / temperature));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;
    for (let i = 0; i < sorted.length; i++) {
      random -= weights[i];
      if (random <= 0) return sorted[i];
    }
    return sorted[0];
  }

  private maybeInjectMistake(
    selected: MoveAnalysis & { score: number },
    allMoves: MoveAnalysis[],
    profile: PlayerProfile,
    _gameState: GameState
  ): MoveAnalysis & { score: number } {
    const baseRate = this.config.mistakeRate;
    const eloAdjust = Math.max(0, (1500 - profile.elo) / 5000);
    const effectiveRate = baseRate + eloAdjust;
    if (Math.random() > effectiveRate) return selected;
    if (Math.abs(selected.evaluation) > 300) return selected;
    const worseOptions = allMoves.filter(
      m => m.move !== selected.move &&
      Math.abs(m.evaluation - selected.evaluation) < 150 &&
      Math.abs(m.evaluation - selected.evaluation) > 20
    );
    if (worseOptions.length === 0) return selected;
    const mistake = worseOptions[Math.floor(Math.random() * worseOptions.length)];
    return { ...mistake, score: selected.score * 0.8 };
  }

  updatePlayerAccuracy(playerMove: GameMove): void {
    const accuracy = Math.max(0, Math.min(1, 1 - playerMove.centipawnLoss / 200));
    this.rollingAccuracy.push(accuracy);
    if (this.rollingAccuracy.length > 10) this.rollingAccuracy.shift();
    if (playerMove.centipawnLoss < 30) {
      this.momentumStreak = Math.max(0, this.momentumStreak) + 1;
    } else if (playerMove.centipawnLoss > 100) {
      this.momentumStreak = Math.min(0, this.momentumStreak) - 1;
    } else {
      this.momentumStreak = 0;
    }
  }

  async analyzePlayerMove(
    fenBefore: string,
    fenAfter: string,
    uciMove: string,
    sanMove: string,
    moveNumber: number,
    thinkTime: number
  ): Promise<GameMove> {
    const evalBefore = await this.engine.evaluate(fenBefore, 16, 1);
    const evalAfter = await this.engine.evaluate(fenAfter, 16, 1);
    const bestEval = evalBefore.evaluation;
    const actualEval = evalAfter.evaluation;
    const evalDrop = bestEval - actualEval;
    const absoluteCPL = Math.abs(evalDrop);
    const isBlunder = absoluteCPL >= BLUNDER_THRESHOLD;
    const isMistake = !isBlunder && absoluteCPL >= MISTAKE_THRESHOLD;
    const isInaccuracy = !isBlunder && !isMistake && absoluteCPL >= INACCURACY_THRESHOLD;
    const isBrilliant = absoluteCPL <= 5 && evalBefore.bestMoves.length > 3 &&
      evalBefore.bestMoves[0].move === uciMove;

    const gameMove: GameMove = {
      moveNumber,
      san: sanMove,
      uci: uciMove,
      fen: fenAfter,
      evaluation: actualEval,
      bestEval,
      centipawnLoss: absoluteCPL,
      isBlunder,
      isMistake,
      isInaccuracy,
      isBrilliant,
      timestamp: Date.now(),
      thinkTime,
      isPlayerMove: true,
    };

    this.updatePlayerAccuracy(gameMove);
    return gameMove;
  }

  calculateTension(moves: GameMove[]): number {
    if (moves.length < 4) return 5;
    const evals = moves.map(m => m.evaluation);
    const avgAbsEval = evals.reduce((s, e) => s + Math.abs(e), 0) / evals.length;
    const evalTension = Math.max(0, 10 - avgAbsEval / 50);
    let leadChanges = 0;
    for (let i = 1; i < evals.length; i++) {
      if ((evals[i] > 0) !== (evals[i - 1] > 0)) leadChanges++;
    }
    const changeTension = Math.min(3, leadChanges * 0.5);
    const lastFewEvals = evals.slice(-6);
    const endgameTension = lastFewEvals.length > 0
      ? Math.max(0, 3 - lastFewEvals.reduce((s, e) => s + Math.abs(e), 0) / lastFewEvals.length / 30)
      : 0;
    return Math.min(10, Math.max(0, evalTension * 0.5 + changeTension + endgameTension));
  }

  detectGamePhase(fen: string): 'opening' | 'middlegame' | 'endgame' {
    const chess = new Chess(fen);
    const board = chess.board();
    let pieceCount = 0;
    let majorPieces = 0;
    for (const row of board) {
      for (const sq of row) {
        if (sq) {
          pieceCount++;
          if (sq.type === 'q' || sq.type === 'r') majorPieces++;
        }
      }
    }
    const moveNum = parseInt(fen.split(' ')[5] || '1');
    if (moveNum <= 10 && pieceCount >= 28) return 'opening';
    if (pieceCount <= 12 || majorPieces <= 2) return 'endgame';
    return 'middlegame';
  }

  private uciToSan(fen: string, uci: string): string {
    try {
      const chess = new Chess(fen);
      const from = uci.slice(0, 2) as Square;
      const to = uci.slice(2, 4) as Square;
      const promotion = uci.length > 4 ? uci[4] : undefined;
      const result = chess.move({ from, to, promotion });
      return result ? result.san : uci;
    } catch {
      return uci;
    }
  }

  private generateThinking(
    selected: MoveAnalysis & { score: number },
    best: MoveAnalysis,
    _currentEval: number,
    _targetEval: number
  ): string {
    const evalDiff = Math.abs(selected.evaluation - best.evaluation);
    if (evalDiff < 10) return 'Playing the strongest move in this position.';
    if (selected.score > 0.8) return 'A strong move that keeps the game balanced.';
    if (evalDiff < 50) return 'A solid move - not the absolute best, but very reasonable.';
    return 'An interesting choice that maintains tension in the position.';
  }

  reset(): void {
    this.rollingAccuracy = [];
    this.momentumStreak = 0;
  }
}
