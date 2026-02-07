// ============================================================
// RazorChess — Interactive Chessboard Component
// Green/white chess.com theme with SVG pieces
// Drag-and-drop + click-to-move, works on desktop & mobile
// ============================================================

'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
  wK: `${PIECE_BASE}/wK.svg`, wQ: `${PIECE_BASE}/wQ.svg`,
  wR: `${PIECE_BASE}/wR.svg`, wB: `${PIECE_BASE}/wB.svg`,
  wN: `${PIECE_BASE}/wN.svg`, wP: `${PIECE_BASE}/wP.svg`,
  bK: `${PIECE_BASE}/bK.svg`, bQ: `${PIECE_BASE}/bQ.svg`,
  bR: `${PIECE_BASE}/bR.svg`, bB: `${PIECE_BASE}/bB.svg`,
  bN: `${PIECE_BASE}/bN.svg`, bP: `${PIECE_BASE}/bP.svg`,
};

// Chess.com-style green board colors
const LIGHT_SQ = '#EEEED2';
const DARK_SQ = '#769656';
const SELECTED_LIGHT = '#F6F669';
const SELECTED_DARK = '#BACA2B';
const LAST_MOVE_LIGHT = '#F2F587';
const LAST_MOVE_DARK = '#AAC34E';
const COORD_LIGHT = '#769656';
const COORD_DARK = '#EEEED2';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

interface DragState {
  square: string;
  pieceKey: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  originRect: DOMRect | null;
}

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
  const [dragState, setDragState] = useState<DragState | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const squareRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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

  // ── Helpers ──────────────────────────────────────────────
  const isOwnPiece = useCallback((square: string): boolean => {
    const piece = getPieceAt(board, square);
    if (!piece) return false;
    return (piece.color === 'w' && playerColor === 'white') ||
           (piece.color === 'b' && playerColor === 'black');
  }, [board, playerColor]);

  const squareFromPoint = useCallback((clientX: number, clientY: number): string | null => {
    const boardEl = boardRef.current;
    if (!boardEl) return null;
    const rect = boardEl.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const sqSize = rect.width / 8;
    let col = Math.floor(x / sqSize);
    let row = Math.floor(y / sqSize);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    const file = displayFiles[col];
    const rank = displayRanks[row];
    return `${file}${rank}`;
  }, [displayFiles, displayRanks]);

  // ── Attempt a move (shared by click & drag) ─────────────
  const tryMove = useCallback(async (from: string, to: string) => {
    const piece = getPieceAt(board, from);
    const targetRank = to[1];
    if (piece && piece.type === 'p' && (targetRank === '8' || targetRank === '1')) {
      setPromotionPending({ from, to });
      setSelectedSquare(null);
      setLegalTargets([]);
      return;
    }
    const success = await onMove(from, to);
    if (success) {
      setLastMove({ from, to });
    }
    setSelectedSquare(null);
    setLegalTargets([]);
  }, [board, onMove]);

  // ── Click-to-move ───────────────────────────────────────
  const handleSquareClick = useCallback(async (square: string) => {
    if (disabled || isThinking || dragState) return;

    if (selectedSquare) {
      if (legalTargets.includes(square)) {
        await tryMove(selectedSquare, square);
      } else if (isOwnPiece(square) && isPlayerTurn) {
        setSelectedSquare(square);
        setLegalTargets(getLegalMoves(square));
      } else {
        setSelectedSquare(null);
        setLegalTargets([]);
      }
    } else {
      if (isOwnPiece(square) && isPlayerTurn) {
        setSelectedSquare(square);
        setLegalTargets(getLegalMoves(square));
      }
    }
  }, [selectedSquare, legalTargets, disabled, isThinking, isPlayerTurn, isOwnPiece, getLegalMoves, tryMove, dragState]);

  // ── Drag start (mouse) ─────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent, square: string) => {
    if (disabled || isThinking || !isPlayerTurn) return;
    if (!isOwnPiece(square)) return;
    e.preventDefault();

    const piece = getPieceAt(board, square);
    if (!piece) return;
    const pieceKey = `${piece.color}${piece.type.toUpperCase()}`;
    const sqEl = squareRefs.current.get(square);
    const originRect = sqEl ? sqEl.getBoundingClientRect() : null;

    setDragState({
      square,
      pieceKey,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      originRect,
    });
    setSelectedSquare(square);
    setLegalTargets(getLegalMoves(square));
  }, [board, disabled, isThinking, isPlayerTurn, isOwnPiece, getLegalMoves]);

  // ── Drag start (touch) ─────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent, square: string) => {
    if (disabled || isThinking || !isPlayerTurn) return;
    if (!isOwnPiece(square)) return;

    const touch = e.touches[0];
    const piece = getPieceAt(board, square);
    if (!piece) return;
    const pieceKey = `${piece.color}${piece.type.toUpperCase()}`;
    const sqEl = squareRefs.current.get(square);
    const originRect = sqEl ? sqEl.getBoundingClientRect() : null;

    setDragState({
      square,
      pieceKey,
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      originRect,
    });
    setSelectedSquare(square);
    setLegalTargets(getLegalMoves(square));
  }, [board, disabled, isThinking, isPlayerTurn, isOwnPiece, getLegalMoves]);

  // ── Global mouse/touch move & up ───────────────────────
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      setDragState(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
    };
    const handleTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      setDragState(prev => prev ? { ...prev, currentX: t.clientX, currentY: t.clientY } : null);
    };
    const handleEnd = async (clientX: number, clientY: number) => {
      const targetSquare = squareFromPoint(clientX, clientY);
      const from = dragState.square;

      setDragState(null);

      if (targetSquare && targetSquare !== from && legalTargets.includes(targetSquare)) {
        await tryMove(from, targetSquare);
      } else {
        // Dropped on invalid square — piece snaps back (state reset is enough)
        // Keep selection so player can click-to-move instead
      }
    };
    const handleMouseUp = (e: MouseEvent) => handleEnd(e.clientX, e.clientY);
    const handleTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      handleEnd(t.clientX, t.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [dragState, legalTargets, squareFromPoint, tryMove]);

  // ── Promotion handler ──────────────────────────────────
  const handlePromotion = useCallback(async (piece: string) => {
    if (!promotionPending) return;
    const success = await onMove(promotionPending.from, promotionPending.to, piece);
    if (success) {
      setLastMove({ from: promotionPending.from, to: promotionPending.to });
    }
    setPromotionPending(null);
  }, [promotionPending, onMove]);

  // ── Square background color ────────────────────────────
  const getSquareBg = (isLight: boolean, isSelected: boolean, isLastMoveSquare: boolean): string => {
    if (isSelected) return isLight ? SELECTED_LIGHT : SELECTED_DARK;
    if (isLastMoveSquare) return isLight ? LAST_MOVE_LIGHT : LAST_MOVE_DARK;
    return isLight ? LIGHT_SQ : DARK_SQ;
  };

  // ── Hover square (what square is the dragged piece over?) ──
  const hoverSquare = useMemo(() => {
    if (!dragState) return null;
    return squareFromPoint(dragState.currentX, dragState.currentY);
  }, [dragState, squareFromPoint]);

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="relative">
      <div
        ref={boardRef}
        className="grid grid-cols-8 rounded-md overflow-hidden shadow-2xl"
        style={{
          width: 'min(80vw, 560px)',
          aspectRatio: '1 / 1',
          touchAction: 'none', // prevent scroll while dragging on mobile
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
            const isDragOrigin = dragState?.square === square;
            const isHover = hoverSquare === square && dragState && square !== dragState.square;
            const bg = getSquareBg(isLight, isSelected, isLastMoveSquare);

            return (
              <div
                key={square}
                ref={(el) => { if (el) squareRefs.current.set(square, el); }}
                className="relative flex items-center justify-center cursor-pointer select-none"
                style={{
                  backgroundColor: bg,
                  aspectRatio: '1 / 1',
                  transition: 'background-color 0.1s',
                }}
                onClick={() => handleSquareClick(square)}
                onMouseDown={(e) => handleMouseDown(e, square)}
                onTouchStart={(e) => handleTouchStart(e, square)}
              >
                {/* Coordinate labels */}
                {fi === 0 && (
                  <span
                    className="absolute top-[2px] left-[3px] text-[10px] font-bold leading-none pointer-events-none z-[1]"
                    style={{ color: isLight ? COORD_LIGHT : COORD_DARK }}
                  >
                    {rank}
                  </span>
                )}
                {ri === 7 && (
                  <span
                    className="absolute bottom-[1px] right-[3px] text-[10px] font-bold leading-none pointer-events-none z-[1]"
                    style={{ color: isLight ? COORD_LIGHT : COORD_DARK }}
                  >
                    {file}
                  </span>
                )}

                {/* Legal move dot (empty square) */}
                {isTarget && !hasPiece && (
                  <div className="absolute w-[32%] h-[32%] rounded-full pointer-events-none z-[2]"
                    style={{ backgroundColor: 'rgba(0,0,0,0.18)' }}
                  />
                )}
                {/* Legal move capture ring */}
                {isTarget && hasPiece && (
                  <div className="absolute inset-[4%] rounded-full pointer-events-none z-[2]"
                    style={{
                      background: 'radial-gradient(transparent 58%, rgba(0,0,0,0.22) 58%)',
                    }}
                  />
                )}

                {/* Hover highlight when dragging over a valid target */}
                {isHover && isTarget && (
                  <div className="absolute inset-0 pointer-events-none z-[1]"
                    style={{ backgroundColor: 'rgba(255,255,255,0.25)' }}
                  />
                )}

                {/* Chess piece SVG (hidden if being dragged) */}
                {piece && !isDragOrigin && (
                  <img
                    src={PIECE_SRC[`${piece.color}${piece.type.toUpperCase()}`]}
                    alt={`${piece.color}${piece.type}`}
                    className="w-[85%] h-[85%] pointer-events-none z-[3]"
                    draggable={false}
                    style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
                  />
                )}

                {/* Ghost piece on origin square while dragging */}
                {isDragOrigin && piece && (
                  <img
                    src={PIECE_SRC[`${piece.color}${piece.type.toUpperCase()}`]}
                    alt=""
                    className="w-[85%] h-[85%] pointer-events-none z-[3]"
                    draggable={false}
                    style={{ opacity: 0.35, filter: 'grayscale(0.3)' }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Floating dragged piece (follows cursor) */}
      {dragState && (
        <img
          src={PIECE_SRC[dragState.pieceKey]}
          alt=""
          draggable={false}
          className="pointer-events-none"
          style={{
            position: 'fixed',
            left: dragState.currentX,
            top: dragState.currentY,
            width: boardRef.current ? boardRef.current.getBoundingClientRect().width / 8 * 1.1 : 70,
            height: boardRef.current ? boardRef.current.getBoundingClientRect().width / 8 * 1.1 : 70,
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.45))',
            transition: 'none',
          }}
        />
      )}

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
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md z-[100]">
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
