'use client';

import { useState, useCallback } from 'react';
import Chessboard from '@/components/Chessboard';
import EvalBar from '@/components/EvalBar';
import MoveList from '@/components/MoveList';
import TensionMeter from '@/components/TensionMeter';
import PersonalitySelector from '@/components/PersonalitySelector';
import GameAnalysis from '@/components/GameAnalysis';
import EloDashboard from '@/components/EloDashboard';
import { useChessGame } from '@/hooks/useChessGame';
import { Personality } from '@/lib/types';
import { loadProfile } from '@/lib/player-profile';
import { getRandomCommentary, getPersonalityConfig } from '@/lib/personalities';

export default function Home() {
  const {
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
  } = useChessGame();

  const [selectedPersonality, setSelectedPersonality] = useState<Personality>('mentor');
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const profile = loadProfile();

  const handleStartGame = useCallback(() => {
    startGame(playerColor, selectedPersonality);
    setGameStarted(true);
    setShowAnalysis(false);
  }, [startGame, playerColor, selectedPersonality]);

  const handleNewGame = useCallback(() => {
    setGameStarted(false);
    setShowAnalysis(false);
  }, []);

  const analysis = gameOver ? getAnalysis() : null;

  // Pre-game setup screen
  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full space-y-8">
          {/* Logo */}
          <div className="text-center space-y-2">
            <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              RazorChess
            </h1>
            <p className="text-zinc-400">
              Every game comes down to the wire.
            </p>
          </div>

          {/* Player info */}
          <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">Your Rating</p>
                <p className="text-3xl font-bold text-emerald-400">{profile.elo}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-zinc-400">Games Played</p>
                <p className="text-3xl font-bold text-zinc-300">{profile.gamesPlayed}</p>
              </div>
              <button
                onClick={() => setShowDashboard(true)}
                className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Stats
              </button>
            </div>
          </div>

          {/* Color selection */}
          <div className="space-y-2">
            <h3 className="text-xs text-zinc-400 uppercase tracking-wider">Play As</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPlayerColor('white')}
                className={`p-4 rounded-lg border text-center transition-all ${
                  playerColor === 'white'
                    ? 'border-zinc-200 bg-zinc-200/10'
                    : 'border-zinc-700 hover:border-zinc-500'
                }`}
              >
                <span className="text-3xl">&#9812;</span>
                <p className="text-sm mt-1">White</p>
              </button>
              <button
                onClick={() => setPlayerColor('black')}
                className={`p-4 rounded-lg border text-center transition-all ${
                  playerColor === 'black'
                    ? 'border-zinc-400 bg-zinc-400/10'
                    : 'border-zinc-700 hover:border-zinc-500'
                }`}
              >
                <span className="text-3xl">&#9818;</span>
                <p className="text-sm mt-1">Black</p>
              </button>
            </div>
          </div>

          {/* Personality selection */}
          <PersonalitySelector
            selected={selectedPersonality}
            onSelect={setSelectedPersonality}
          />

          {/* Start button */}
          <button
            onClick={handleStartGame}
            disabled={!isEngineReady}
            className={`w-full py-4 rounded-xl text-lg font-bold transition-all ${
              isEngineReady
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 hover:shadow-emerald-500/30'
                : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
            }`}
          >
            {isEngineReady ? 'Start Game' : 'Loading Engine...'}
          </button>
        </div>

        {/* Dashboard overlay */}
        {showDashboard && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <EloDashboard profile={profile} onClose={() => setShowDashboard(false)} />
          </div>
        )}
      </div>
    );
  }

  // Game screen
  const personalityConfig = getPersonalityConfig(selectedPersonality);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 gap-4">
      {/* Top bar */}
      <div className="flex items-center justify-between w-full max-w-3xl">
        <div>
          <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            RazorChess
          </h1>
          <p className="text-xs text-zinc-500">vs {personalityConfig.displayName}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-zinc-500">Your Rating</p>
            <p className="text-lg font-bold text-emerald-400">{profile.elo}</p>
          </div>
          <button
            onClick={() => setShowDashboard(true)}
            className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 rounded text-xs transition-colors"
          >
            Stats
          </button>
        </div>
      </div>

      {/* Game area */}
      <div className="flex items-start gap-4">
        {/* Eval bar */}
        <EvalBar evaluation={evalBar} playerColor={gameState?.playerColor || 'white'} />

        {/* Board */}
        <Chessboard
          fen={fen}
          playerColor={gameState?.playerColor || 'white'}
          onMove={makePlayerMove}
          getLegalMoves={getLegalMoves}
          disabled={gameOver}
          isThinking={isThinking}
        />

        {/* Side panel */}
        <div className="w-56 space-y-4">
          {/* Engine comment */}
          {lastComment && (
            <div className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
              <p className="text-xs text-zinc-400 mb-1">{personalityConfig.displayName}</p>
              <p className="text-sm text-zinc-300 italic">
                &ldquo;{lastComment || getRandomCommentary(selectedPersonality)}&rdquo;
              </p>
            </div>
          )}

          {/* Tension meter */}
          <TensionMeter tension={gameState?.tensionScore || 5} />

          {/* Move list */}
          <MoveList moves={moveHistory} playerColor={gameState?.playerColor || 'white'} />

          {/* Game controls */}
          <div className="space-y-2">
            {!gameOver && (
              <button
                onClick={resign}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 rounded-lg text-sm transition-colors"
              >
                Resign
              </button>
            )}
            {gameOver && (
              <>
                <div className="bg-zinc-900 rounded-lg p-3 text-center border border-zinc-700">
                  <p className="text-sm font-bold text-zinc-200">
                    {gameState?.result?.type === 'checkmate'
                      ? `Checkmate! ${'winner' in (gameState?.result || {}) ? (gameState?.result as { winner: string }).winner : ''} wins!`
                      : gameState?.result?.type === 'stalemate'
                      ? 'Stalemate!'
                      : gameState?.result?.type === 'resignation'
                      ? `${'winner' in (gameState?.result || {}) ? (gameState?.result as { winner: string }).winner : ''} wins by resignation`
                      : 'Draw!'}
                  </p>
                </div>
                <button
                  onClick={() => setShowAnalysis(true)}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  View Analysis
                </button>
                <button
                  onClick={handleNewGame}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  New Game
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Analysis overlay */}
      {showAnalysis && analysis && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <GameAnalysis
            analysis={analysis}
            moves={moveHistory}
            onClose={() => setShowAnalysis(false)}
            onNewGame={handleNewGame}
          />
        </div>
      )}

      {/* Dashboard overlay */}
      {showDashboard && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <EloDashboard profile={profile} onClose={() => setShowDashboard(false)} />
        </div>
      )}
    </div>
  );
}
