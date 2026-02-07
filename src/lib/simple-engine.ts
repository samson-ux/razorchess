// ============================================================
// RazorChess — Simple Engine (Web Worker wrapper)
// All heavy computation runs off the main thread
// ============================================================

import { MoveAnalysis, PositionEval } from './types';
import { ChessEngineInterface } from './engine-interface';

export class SimpleEngine implements ChessEngineInterface {
  private worker: Worker | null = null;
  private requestId = 0;
  private pending = new Map<number, {
    resolve: (v: PositionEval) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private maxDepth: number;

  constructor(depth: number = 4) {
    this.maxDepth = depth;
  }

  private ensureWorker(): Worker {
    if (!this.worker) {
      // Create worker from a blob URL so we don't need a separate file at build time
      const workerUrl = new URL('./engine-worker.ts', import.meta.url);
      this.worker = new Worker(workerUrl, { type: 'module' });

      this.worker.onmessage = (e: MessageEvent) => {
        const { id, result, error } = e.data;
        const entry = this.pending.get(id);
        if (!entry) return;
        this.pending.delete(id);
        clearTimeout(entry.timer);

        if (error) {
          entry.reject(new Error(error));
        } else {
          entry.resolve(result as PositionEval);
        }
      };

      this.worker.onerror = (e) => {
        console.error('[SimpleEngine Worker Error]', e);
      };
    }
    return this.worker;
  }

  async evaluate(fen: string, depth?: number, multiPV: number = 5): Promise<PositionEval> {
    const searchDepth = Math.min(depth || this.maxDepth, this.maxDepth);
    const id = ++this.requestId;

    const TIMEOUT_MS = 5000;

    return new Promise<PositionEval>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        console.warn(`[SimpleEngine] evaluate() timed out after ${TIMEOUT_MS}ms for ${fen}`);
        // Return a neutral fallback evaluation
        resolve({
          fen,
          bestMoves: [],
          evaluation: 0,
          depth: 0,
          mate: null,
        });
      }, TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, timer });

      try {
        const w = this.ensureWorker();
        w.postMessage({ id, type: 'evaluate', fen, depth: searchDepth, multiPV });
      } catch (err) {
        this.pending.delete(id);
        clearTimeout(timer);
        console.error('[SimpleEngine] Failed to post to worker:', err);
        resolve({
          fen,
          bestMoves: [],
          evaluation: 0,
          depth: 0,
          mate: null,
        });
      }
    });
  }

  async getTopMoves(fen: string, count: number = 10, depth?: number): Promise<MoveAnalysis[]> {
    const result = await this.evaluate(fen, depth, count);
    return result.bestMoves;
  }

  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error('Engine destroyed'));
    }
    this.pending.clear();
  }
}
