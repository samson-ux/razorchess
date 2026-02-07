// ============================================================
// RazorChess — Stockfish WASM Engine Wrapper
// Communicates with Stockfish via Web Worker + UCI protocol
// ============================================================

import { MoveAnalysis, PositionEval } from './types';

export class StockfishEngine {
  private worker: Worker | null = null;
  private ready = false;
  private resolveQueue: Array<(value: string[]) => void> = [];
  private outputBuffer: string[] = [];
  private isCollecting = false;

  async init(): Promise<void> {
    if (this.ready) return;

    return new Promise((resolve, reject) => {
      try {
        // Use stockfish.js WASM build via CDN worker
        this.worker = new Worker('/stockfish/stockfish-nnue-16-single.js');

        this.worker.onmessage = (e: MessageEvent) => {
          const line = typeof e.data === 'string' ? e.data : String(e.data);

          if (this.isCollecting) {
            this.outputBuffer.push(line);
          }

          if (line === 'uciok') {
            this.ready = true;
            resolve();
          }

          if (line.startsWith('bestmove') && this.resolveQueue.length > 0) {
            this.outputBuffer.push(line);
            this.isCollecting = false;
            const resolver = this.resolveQueue.shift();
            if (resolver) {
              resolver([...this.outputBuffer]);
              this.outputBuffer = [];
            }
          }
        };

        this.worker.onerror = (e) => {
          console.error('Stockfish worker error:', e);
          reject(e);
        };

        this.send('uci');
      } catch (err) {
        reject(err);
      }
    });
  }

  private send(command: string): void {
    if (!this.worker) throw new Error('Stockfish not initialized');
    this.worker.postMessage(command);
  }

  private async collectOutput(command: string): Promise<string[]> {
    return new Promise((resolve) => {
      this.isCollecting = true;
      this.outputBuffer = [];
      this.resolveQueue.push(resolve);
      this.send(command);
    });
  }

  async evaluate(fen: string, depth: number = 18, multiPV: number = 5): Promise<PositionEval> {
    if (!this.ready) await this.init();

    this.send('ucinewgame');
    this.send(`setoption name MultiPV value ${multiPV}`);
    this.send(`position fen ${fen}`);

    const output = await this.collectOutput(`go depth ${depth}`);
    return this.parseOutput(output, fen, multiPV);
  }

  async getTopMoves(fen: string, count: number = 10, depth: number = 16): Promise<MoveAnalysis[]> {
    const result = await this.evaluate(fen, depth, Math.min(count, 10));
    return result.bestMoves;
  }

  private parseOutput(lines: string[], fen: string, multiPV: number): PositionEval {
    const moves: Map<number, MoveAnalysis> = new Map();
    let bestEval = 0;
    let bestDepth = 0;
    let mate: number | null = null;

    for (const line of lines) {
      if (!line.startsWith('info depth')) continue;

      const depthMatch = line.match(/depth (\d+)/);
      const pvMatch = line.match(/multipv (\d+)/);
      const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
      const moveMatch = line.match(/ pv (\S+)/);

      if (!depthMatch || !scoreMatch || !moveMatch) continue;

      const depth = parseInt(depthMatch[1]);
      const pvNum = pvMatch ? parseInt(pvMatch[1]) : 1;
      const scoreType = scoreMatch[1];
      const scoreValue = parseInt(scoreMatch[2]);
      const move = moveMatch[1];

      let evaluation: number;
      if (scoreType === 'mate') {
        evaluation = scoreValue > 0 ? 99999 - scoreValue : -99999 - scoreValue;
        if (pvNum === 1) mate = scoreValue;
      } else {
        evaluation = scoreValue;
      }

      // Flip eval if black to move
      const isBlackToMove = fen.includes(' b ');
      if (isBlackToMove) evaluation = -evaluation;

      const existing = moves.get(pvNum);
      if (!existing || depth >= (existing.depth || 0)) {
        moves.set(pvNum, {
          move,
          san: move, // Will be converted by chess.js in the caller
          evaluation,
          depth,
          isPV: pvNum === 1,
        });

        if (pvNum === 1) {
          bestEval = evaluation;
          bestDepth = depth;
        }
      }
    }

    const bestMoves = Array.from(moves.values())
      .sort((a, b) => b.evaluation - a.evaluation);

    return {
      fen,
      bestMoves,
      evaluation: bestEval,
      depth: bestDepth,
      mate,
    };
  }

  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.ready = false;
    }
  }
}

// Singleton for the app
let engineInstance: StockfishEngine | null = null;

export function getEngine(): StockfishEngine {
  if (!engineInstance) {
    engineInstance = new StockfishEngine();
  }
  return engineInstance;
}
