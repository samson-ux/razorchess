// ============================================================
// RazorChess — Interactive Chessboard Component
// Pure CSS chessboard with drag & click move support
// ============================================================

'use client';

import { useState, useCallback, useMemo } from 'react';
import { Chess, Square } from 'chess.js';

interface ChessboardProps {
  fen: string;
  playerColor: 'white' | 'black';
  onMove: (from: string, to: string, promotion?: string) => Promise<boolean>;
  getLegalMoves: (square: string) => string[];
  disabled?: boolean;
  isThinking?: boolean;
}

const PIECE_UNICODE: Record<string, string> = {
  wK: '\u2654', wQ: '\u2655', wR: '\u2656', wB: '\u2657', wN: '\u2658', wP: '\u2659',
  bK: '\u265A', bQ: '\u265B', bR: '\u265C', bB: '\u265D', bN: '\u265E', bP: '\u265F',
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

export default function Chessboard({
  fen,
  playerColor,
  onMove,
  getLegalMoves,
  disabled = false,
  isThinking = false,
}: ChessboardProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<string[]>([]);
  const [promotionPending, setPromotionPending] = useState<{ from: string; to: string } | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  // Parse FEN to board array
  const board = useMemo(() => {
    const chess = new Chess(fen);
    return chess.board();
  }, [fen]);

  const turn = useMemo(() => {
    return fen.split(' ')[1] === 'w' ? 'white' : 'black';
  }, [fen]);

  const isPlayerTurn = turn === playerColor && !disabled;

  // Flip board for black
  const displayRanks = playerColor === 'black' ? [...RANKS].reverse() : RANKS;
  const displayFiles = playerColor === 'black' ? [...FILES].reverse() : FILES;

  const handleSquareClick = useCallback(async (square: string) => {
    if (disabled || isThinking) return;

    if (selectedSquare) {
      // Trying to make a move
      if (legalTargets.includes(square)) {
        // Check for pawn promotion
        const piece = getPieceAt(board, selectedSquare);
        const targetRank = square[1];
        if (piece && piece.type === 'p' && (targetRank === '8' || targetRank === '1')) {
          setPromotionPending({ from: selectedSquare, to: square });
          setSelectedSquare(null);
          setLegalTargets([]);
          return;
        }

        const success = await onMove(selectedSquare, square);
        if (success) {
          setLastMove({ from: selectedSquare, to: square });
        }
        setSelectedSquare(null);
        setLegalTargets([]);
      } else {
        // Select a different piece
        const piece = getPieceAt(board, square);
        if (piece && ((piece.color === 'w' && playerColor === 'white') || (piece.color === 'b' && playerColor === 'black'))) {
          setSelectedSquare(square);
          setLegalTargets(getLegalMoves(square));
        } else {
          setSelectedSquare(null);
          setLegalTargets([]);
        }
      }
    } else {
      // Select a piece
      const piece = getPieceAt(board, square);
      if (piece && ((piece.color === 'w' && playerColor === 'white') || (piece.color === 'b' && playerColor === 'black')) && isPlayerTurn) {
        setSelectedSquare(square);
        setLegalTargets(getLegalMoves(square));
      }
    }
  }, [selectedSquare, legalTargets, board, playerColor, isPlayerTurn, disabled, isThinking, onMove, getLegalMoves]);

  const handlePromotion = useCallback(async (piece: string) => {
    if (!promotionPending) return;
    const success = await onMove(promotionPending.from, promotionPending.to, piece);
    if (success) {
      setLastMove({ from: promotionPending.from, to: promotionPending.to });
    }
    setPromotionPending(null);
  }, [promotionPending, onMove]);

  return (
    <div className="relative">
      <div className="grid grid-cols-8 border-2 border-zinc-700 rounded-lg overflow-hidden shadow-2xl"
           style={{ width: 'min(80vw, 560px)', height: 'min(80vw, 560px)' }}>
        {displayRanks.map((rank, ri) =>
          displayFiles.map((file, fi) => {
            const square = `${file}${rank}`;
            const isLight = (fi + ri) % 2 === 0;
            const piece = getPieceAt(board, square);
            const isSelected = selectedSquare === square;
            const isTarget = legalTargets.includes(square);
            const isLastMoveSquare = lastMove?.from === square || lastMove?.to === square;
            const hasPiece = !!piece;

            return (
              <div
                key={square}
                className={`
                  relative flex items-center justify-center cursor-pointer
                  transition-colors duration-100 select-none
                  ${isLight ? 'bg-amber-100' : 'bg-amber-800'}
                  ${isSelected ? '!bg-yellow-400/70' : ''}
                  ${isLastMoveSquare ? (isLight ? '!bg-yellow-200' : '!bg-yellow-600') : ''}
                `}
                onClick={() => handleSquareClick(square)}
              >
                {/* Coordinate labels */}
                {fi === 0 && (
                  <span className={`absolute top-0.5 left-0.5 text-[10px] font-bold ${isLight ? 'text-amber-800' : 'text-amber-100'}`}>
                    {rank}
                  </span>
                )}
                {ri === 7 && (
                  <span className={`absolute bottom-0 right-0.5 text-[10px] font-bold ${isLight ? 'text-amber-800' : 'text-amber-100'}`}>
                    {file}
                  </span>
                )}

                {/* Legal move indicator */}
                {isTarget && !hasPiece && (
                  <div className="absolute w-[30%] h-[30%] rounded-full bg-black/20" />
                )}
                {isTarget && hasPiece && (
                  <div className="absolute inset-1 rounded-full border-[3px] border-black/30" />
                )}

                {/* Piece */}
                {piece && (
                  <span
                    className={`text-[min(8vw,56px)] leading-none ${piece.color === 'w' ? 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]' : 'drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)]'}`}
                    style={{ userSelect: 'none' }}
                  >
                    {PIECE_UNICODE[`${piece.color}${piece.type.toUpperCase()}`]}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Thinking indicator */}
      {isThinking && (
        <div className="absolute -bottom-8 left-0 right-0 flex items-center justify-center gap-2 text-sm text-zinc-400">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          Thinking...
        </div>
      )}

      {/* Promotion dialog */}
      {promotionPending && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg z-10">
          <div className="bg-zinc-800 rounded-xl p-4 flex gap-2 shadow-2xl border border-zinc-600">
            {['q', 'r', 'b', 'n'].map(p => (
              <button
                key={p}
                onClick={() => handlePromotion(p)}
                className="w-16 h-16 flex items-center justify-center text-5xl bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
              >
                {PIECE_UNICODE[`${playerColor === 'white' ? 'w' : 'b'}${p.toUpperCase()}`]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getPieceAt(board: ReturnType<Chess['board']>, square: string): { type: string; color: string } | null {
  const file = square.charCodeAt(0) - 97;
  const rank = 8 - parseInt(square[1]);
  if (rank < 0 || rank > 7 || file < 0 || file > 7) return null;
  const piece = board[rank][file];
  return piece ? { type: piece.type, color: piece.color } : null;
}
