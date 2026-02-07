// ============================================================
// RazorChess — Interactive Chessboard Component
// Green/white chess.com theme with SVG piece images
// ============================================================

'use client';

import { useState, useCallback, useMemo } from 'react';
import { Chess } from 'chess.js';

interface ChessboardProps {
  fen: string;
  playerColor: 'white' | 'black';
  onMove: (from: string, to: string, promotion?: string) => Promise<boolean>;
  getLegalMoves: (square: string) => string[];
  disabled?: boolean;
  isThinking?: boolean;
}

// Lichess cburnett SVG piece set (public domain)
const PIECE_BASE = 'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/cburnett';
const PIECE_SRC: Record<string, string> = {
  wK: `${PIECE_BASE}/wK.svg`,
  wQ: `${PIECE_BASE}/wQ.svg`,
  wR: `${PIECE_BASE}/wR.svg`,
  wB: `${PIECE_BASE}/wB.svg`,
  wN: `${PIECE_BASE}/wN.svg`,
  wP: `${PIECE_BASE}/wP.svg`,
  bK: `${PIECE_BASE}/bK.svg`,
  bQ: `${PIECE_BASE}/bQ.svg`,
  bR: `${PIECE_BASE}/bR.svg`,
  bB: `${PIECE_BASE}/bB.svg`,
  bN: `${PIECE_BASE}/bN.svg`,
  bP: `${PIECE_BASE}/bP.svg`,
};

// Chess.com-style green board colors
const LIGHT_SQ = '#EEEED2';
const DARK_SQ = '#769656';
const SELECTED_LIGHT = '#F6F669';
const SELECTED_DARK = '#BACA2B';
const LAST_MOVE_LIGHT = '#F2F587';
const LAST_MOVE_DARK = '#AAC34E';
const COORD_LIGHT = '#769656'; // dark green on light square
const COORD_DARK = '#EEEED2';  // cream on dark square

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

  const board = useMemo(() => {
    const chess = new Chess(fen);
    return chess.board();
  }, [fen]);

  const turn = useMemo(() => {
    return fen.split(' ')[1] === 'w' ? 'white' : 'black';
  }, [fen]);

  const isPlayerTurn = turn === playerColor && !disabled;

  const displayRanks = playerColor === 'black' ? [...RANKS].reverse() : RANKS;
  const displayFiles = playerColor === 'black' ? [...FILES].reverse() : FILES;

  const handleSquareClick = useCallback(async (square: string) => {
    if (disabled || isThinking) return;

    if (selectedSquare) {
      if (legalTargets.includes(square)) {
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

  // Calculate square background color
  const getSquareBg = (isLight: boolean, isSelected: boolean, isLastMoveSquare: boolean): string => {
    if (isSelected) return isLight ? SELECTED_LIGHT : SELECTED_DARK;
    if (isLastMoveSquare) return isLight ? LAST_MOVE_LIGHT : LAST_MOVE_DARK;
    return isLight ? LIGHT_SQ : DARK_SQ;
  };

  return (
    <div className="relative">
      {/* Use aspect-ratio to guarantee a perfect square */}
      <div
        className="grid grid-cols-8 rounded-md overflow-hidden shadow-2xl"
        style={{
          width: 'min(80vw, 560px)',
          aspectRatio: '1 / 1',
        }}
      >
        {displayRanks.map((rank, ri) =>
          displayFiles.map((file, fi) => {
            const square = `${file}${rank}`;
            const isLight = (fi + ri) % 2 === 0;
            const piece = getPieceAt(board, square);
            const isSelected = selectedSquare === square;
            const isTarget = legalTargets.includes(square);
            const isLastMoveSquare = lastMove?.from === square || lastMove?.to === square;
            const hasPiece = !!piece;
            const bg = getSquareBg(isLight, isSelected, isLastMoveSquare);

            return (
              <div
                key={square}
                className="relative flex items-center justify-center cursor-pointer select-none"
                style={{
                  backgroundColor: bg,
                  aspectRatio: '1 / 1',
                  transition: 'background-color 0.1s',
                }}
                onClick={() => handleSquareClick(square)}
              >
                {/* Coordinate labels */}
                {fi === 0 && (
                  <span
                    className="absolute top-[2px] left-[3px] text-[10px] font-bold leading-none pointer-events-none"
                    style={{ color: isLight ? COORD_LIGHT : COORD_DARK }}
                  >
                    {rank}
                  </span>
                )}
                {ri === 7 && (
                  <span
                    className="absolute bottom-[1px] right-[3px] text-[10px] font-bold leading-none pointer-events-none"
                    style={{ color: isLight ? COORD_LIGHT : COORD_DARK }}
                  >
                    {file}
                  </span>
                )}

                {/* Legal move dot (empty square) */}
                {isTarget && !hasPiece && (
                  <div className="absolute w-[32%] h-[32%] rounded-full bg-black/20 pointer-events-none" />
                )}
                {/* Legal move ring (capture) */}
                {isTarget && hasPiece && (
                  <div className="absolute inset-[6%] rounded-full border-[4px] border-black/25 pointer-events-none" />
                )}

                {/* Chess piece SVG */}
                {piece && (
                  <img
                    src={PIECE_SRC[`${piece.color}${piece.type.toUpperCase()}`]}
                    alt={`${piece.color}${piece.type}`}
                    className="w-[85%] h-[85%] pointer-events-none"
                    draggable={false}
                    style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
                  />
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
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md z-10">
          <div className="bg-zinc-800 rounded-xl p-3 flex gap-2 shadow-2xl border border-zinc-600">
            {['q', 'r', 'b', 'n'].map(p => (
              <button
                key={p}
                onClick={() => handlePromotion(p)}
                className="w-16 h-16 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
              >
                <img
                  src={PIECE_SRC[`${playerColor === 'white' ? 'w' : 'b'}${p.toUpperCase()}`]}
                  alt={p}
                  className="w-12 h-12"
                  draggable={false}
                />
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
