// ============================================================
// RazorChess — Core Game Hook
// Manages game state, move handling, and engine interaction
// ============================================================

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Chess, Square } from 'chess.js';
import { v4 as uuid } from 'uuid';
import { AdaptiveEngine } from '@/lib/adaptive-engine';
import { SimpleEngine } from '@/lib/simple-engine';
import { ChessEngineInterface } from '@/lib/engine-interface';
import {
  GameMove,
  GameResult,
  GameState,
  Personality,
} from '@/lib/types';
import {
  loadProfile,
  saveProfile,
  updateProfileFromGame,
  saveGameHistory,
  saveEloHistory,
} from '@/lib/player-profile';
import { generatePostGameAnalysis } from '@/lib/analysis';

export function useChessGame() {
  const [chess] = useState(() => new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [lastComment, setLastComment] = useState('');
  const [moveHistory, setMoveHistory] = useState<GameMove[]>([]);
  const [evalBar, setEvalBar] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const engineRef = useRef<ChessEngineInterface | null>(null);
  const adaptiveRef = useRef<AdaptiveEngine | null>(null);
  const moveStartTime = useRef<number>(Date.now());

  // Initialize engine (SimpleEngine works immediately, no WASM needed)
  useEffect(() => {
    const engine = new SimpleEngine(4);
    engineRef.current = engine;
    setIsEngineReady(true);
    return () => {
      engineRef.current?.destroy();
    };
  }, []);

  // Start a new game
  const startGame = useCallback((
    playerColor: 'white' | 'black' = 'white',
    personality: Personality = 'mentor'
  ) => {
    chess.reset();
    setFen(chess.fen());
    setMoveHistory([]);
    setEvalBar(0);
    setGameOver(false);
    setLastComment('');
    moveStartTime.current = Date.now();

    const profile = loadProfile();

    const newGameState: GameState = {
      id: uuid(),
      playerColor,
      currentFen: chess.fen(),
      moves: [],
      playerProfile: profile,
      personality,
      adaptiveConfig: {
        targetEval: 0,
        adaptiveStrength: 0.6,
        humanPlausibility: 0.7,
        complexityBias: 0.4,
        mistakeRate: 0.05,
      },
      gamePhase: 'opening',
      tensionScore: 5,
      rollingAccuracy: 0.5,
      momentumStreak: 0,
      result: null,
      startTime: Date.now(),
      isThinking: false,
    };

    setGameState(newGameState);

    if (engineRef.current) {
      adaptiveRef.current = new AdaptiveEngine(engineRef.current, personality);
    }

    // If player is black, engine makes the first move
    if (playerColor === 'black') {
      setTimeout(() => makeEngineMove(newGameState), 500);
    }
  }, [chess]);

  // Handle player move
  const makePlayerMove = useCallback(async (from: string, to: string, promotion?: string) => {
    if (!gameState || gameOver || isThinking) return false;

    const turn = chess.turn();
    const isPlayerTurn = (turn === 'w' && gameState.playerColor === 'white') ||
                         (turn === 'b' && gameState.playerColor === 'black');
    if (!isPlayerTurn) return false;

    const thinkTime = Date.now() - moveStartTime.current;

    try {
      const fenBefore = chess.fen();
      const result = chess.move({ from: from as Square, to: to as Square, promotion });
      if (!result) return false;

      const fenAfter = chess.fen();
      setFen(fenAfter);

      const moveNum = Math.ceil(chess.moveNumber());
      const gameMove: GameMove = {
        moveNumber: moveNum,
        san: result.san,
        uci: from + to + (promotion || ''),
        fen: fenAfter,
        evaluation: 0,
        bestEval: 0,
        centipawnLoss: 0,
        isBlunder: false,
        isMistake: false,
        isInaccuracy: false,
        isBrilliant: false,
        timestamp: Date.now(),
        thinkTime,
        isPlayerMove: true,
      };

      if (adaptiveRef.current) {
        try {
          const analysis = await adaptiveRef.current.analyzePlayerMove(
            fenBefore, fenAfter, gameMove.uci, result.san, moveNum, thinkTime
          );
          Object.assign(gameMove, analysis);
        } catch (e) {
          console.error('Move analysis failed:', e);
        }
      }

      const newMoves = [...(gameState.moves || []), gameMove];
      const newGamePhase = adaptiveRef.current?.detectGamePhase(fenAfter) || 'middlegame';
      const tensionScore = adaptiveRef.current?.calculateTension(newMoves) || 5;

      const updatedState: GameState = {
        ...gameState,
        currentFen: fenAfter,
        moves: newMoves,
        gamePhase: newGamePhase,
        tensionScore,
      };

      setGameState(updatedState);
      setMoveHistory(newMoves);
      setEvalBar(gameMove.evaluation);

      if (chess.isGameOver()) {
        handleGameEnd(updatedState);
        return true;
      }

      moveStartTime.current = Date.now();
      setTimeout(() => makeEngineMove(updatedState), 300);
      return true;
    } catch (e) {
      console.error('Invalid move:', e);
      return false;
    }
  }, [chess, gameState, gameOver, isThinking]);

  // Engine makes a move
  const makeEngineMove = useCallback(async (currentState: GameState) => {
    if (!adaptiveRef.current) {
      const moves = chess.moves();
      if (moves.length === 0) return;
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      chess.move(randomMove);
      setFen(chess.fen());
      return;
    }

    setIsThinking(true);

    try {
      const result = await adaptiveRef.current.selectMove(
        chess.fen(),
        currentState,
        currentState.playerProfile
      );

      const from = result.move.slice(0, 2) as Square;
      const to = result.move.slice(2, 4) as Square;
      const promotion = result.move.length > 4 ? result.move[4] : undefined;

      const moveResult = chess.move({ from, to, promotion });
      if (!moveResult) {
        console.error('Engine produced invalid move:', result.move);
        const legalMoves = chess.moves({ verbose: true });
        if (legalMoves.length > 0) {
          chess.move(legalMoves[0]);
        }
      }

      const fenAfter = chess.fen();
      setFen(fenAfter);

      const engineGameMove: GameMove = {
        moveNumber: Math.ceil(chess.moveNumber()),
        san: moveResult?.san || result.san,
        uci: result.move,
        fen: fenAfter,
        evaluation: result.evaluation,
        bestEval: result.evaluation,
        centipawnLoss: 0,
        isBlunder: false,
        isMistake: false,
        isInaccuracy: false,
        isBrilliant: false,
        timestamp: Date.now(),
        thinkTime: 0,
        isPlayerMove: false,
      };

      const newMoves = [...currentState.moves, engineGameMove];
      const tensionScore = adaptiveRef.current.calculateTension(newMoves);

      const updatedState: GameState = {
        ...currentState,
        currentFen: fenAfter,
        moves: newMoves,
        tensionScore,
        gamePhase: adaptiveRef.current.detectGamePhase(fenAfter),
      };

      setGameState(updatedState);
      setMoveHistory(newMoves);
      setEvalBar(result.evaluation);
      setLastComment(result.thinking);

      if (chess.isGameOver()) {
        handleGameEnd(updatedState);
      }

      moveStartTime.current = Date.now();
    } catch (err) {
      console.error('Engine move failed:', err);
      const legalMoves = chess.moves({ verbose: true });
      if (legalMoves.length > 0) {
        const pick = legalMoves[Math.floor(Math.random() * legalMoves.length)];
        chess.move(pick);
        setFen(chess.fen());
      }
    } finally {
      setIsThinking(false);
    }
  }, [chess]);

  // Handle game ending
  const handleGameEnd = useCallback((finalState: GameState) => {
    let result: GameResult;

    if (chess.isCheckmate()) {
      const winner = chess.turn() === 'w' ? 'black' : 'white';
      result = { type: 'checkmate', winner: winner as 'white' | 'black' };
    } else if (chess.isStalemate()) {
      result = { type: 'stalemate' };
    } else if (chess.isDraw()) {
      result = { type: 'draw', reason: 'repetition' };
    } else {
      result = { type: 'draw', reason: 'agreement' };
    }

    const endState: GameState = { ...finalState, result };
    setGameState(endState);
    setGameOver(true);

    const profile = loadProfile();
    const { profile: updatedProfile } = updateProfileFromGame(profile, endState);
    saveProfile(updatedProfile);

    saveGameHistory(endState);
    let resultStr = 'draw';
    if ('winner' in result) {
      resultStr = result.winner === endState.playerColor ? 'win' : 'loss';
    }

    saveEloHistory({
      timestamp: Date.now(),
      elo: updatedProfile.elo,
      gameId: endState.id,
      opponent: endState.personality,
      result: resultStr,
    });
  }, [chess]);

  // Resign
  const resign = useCallback(() => {
    if (!gameState || gameOver) return;
    const winner = gameState.playerColor === 'white' ? 'black' : 'white';
    const endState: GameState = {
      ...gameState,
      result: { type: 'resignation', winner: winner as 'white' | 'black' },
    };
    setGameState(endState);
    setGameOver(true);

    const profile = loadProfile();
    const { profile: updatedProfile } = updateProfileFromGame(profile, endState);
    saveProfile(updatedProfile);
    saveGameHistory(endState);
  }, [gameState, gameOver]);

  // Get legal moves for a square
  const getLegalMoves = useCallback((square: string): string[] => {
    try {
      const moves = chess.moves({ square: square as Square, verbose: true });
      return moves.map(m => m.to);
    } catch {
      return [];
    }
  }, [chess]);

  // Get post-game analysis
  const getAnalysis = useCallback(() => {
    if (!gameState) return null;
    return generatePostGameAnalysis(gameState);
  }, [gameState]);

  return {
    fen,
    gameState,
    isEngineReady,
    isThinking,
    lastComment,
    moveHistory,
    evalBar,
    gameOver,
    startGame,
    makePlayerMove,
    resign,
    getLegalMoves,
    getAnalysis,
  };
}
