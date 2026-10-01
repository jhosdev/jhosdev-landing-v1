// Tic-tac-toe rules plus an alpha-beta minimax that reports what it did:
// every legal move comes back with its exact value, the positions it cost to
// prove, the branches it pruned, and (optionally) the top of its search tree.

export type Player = 'X' | 'O';
export type Cell = Player | null;
export type Level = 'perfect' | 'fallible';
export type Outcome = 'win' | 'draw' | 'loss';

export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/** How often the fallible opponent plays a move with a worse outcome, when one exists. */
export const BLUNDER_RATE = 0.4;

export const emptyBoard = (): Cell[] => Array<Cell>(9).fill(null);
export const other = (p: Player): Player => (p === 'X' ? 'O' : 'X');
export const legalMoves = (board: readonly Cell[]): number[] =>
  board.flatMap((cell, i) => (cell === null ? [i] : []));

export function winner(board: readonly Cell[]): { player: Player; line: readonly [number, number, number] } | null {
  for (const line of LINES) {
    const player = board[line[0]];
    if (player && player === board[line[1]] && player === board[line[2]]) return { player, line };
  }
  return null;
}

export interface SearchNode {
  /** Cell index 0..8, row-major. */
  move: number;
  /**
   * From the point of view of whoever played `move`: `10 - ply` for a forced
   * win (sooner is higher), the negative for a forced loss, 0 for a draw.
   * Exact for root moves; below a cutoff it is only a bound.
   */
  value: number;
  /** Positions visited in this subtree, this one included. */
  nodes: number;
  /** Branches alpha-beta skipped in this subtree. */
  pruned: number;
  /** Never searched: an earlier sibling had already refuted the parent. */
  cut: boolean;
  /** Children, recorded only down to the requested trace depth. */
  kids: SearchNode[];
}

/** Plays `move` for `mover` and returns its negamax value inside the (alpha, beta) window. */
function visit(board: Cell[], mover: Player, move: number, ply: number, alpha: number, beta: number, trace: number): SearchNode {
  board[move] = mover;
  const node: SearchNode = { move, value: 0, nodes: 1, pruned: 0, cut: false, kids: [] };
  if (winner(board)) {
    node.value = 10 - ply;
  } else {
    const replies = legalMoves(board);
    // The opponent maximises its own value inside the mirrored window (-beta, -alpha).
    let best = -Infinity;
    let floor = -beta;
    for (let i = 0; i < replies.length; i++) {
      const kid = visit(board, other(mover), replies[i], ply + 1, floor, -alpha, trace - 1);
      node.nodes += kid.nodes;
      node.pruned += kid.pruned;
      if (trace > 0) node.kids.push(kid);
      best = Math.max(best, kid.value);
      floor = Math.max(floor, best);
      if (floor >= -alpha) {
        const rest = replies.slice(i + 1);
        node.pruned += rest.length;
        if (trace > 0) for (const m of rest) node.kids.push({ move: m, value: NaN, nodes: 0, pruned: 0, cut: true, kids: [] });
        break;
      }
    }
    if (replies.length) node.value = -best;
  }
  board[move] = null;
  return node;
}

/**
 * Evaluates every legal move for `player`. Each root move is searched with a
 * full window so its value is exact (the fallible level and the on-board
 * scores need more than "not better than the best"); pruning happens below.
 * `traceDepth` keeps that many plies of the tree for visualisation.
 */
export function search(board: readonly Cell[], player: Player, traceDepth = 0): SearchNode[] {
  const scratch = [...board];
  return legalMoves(scratch).map((move) => visit(scratch, player, move, 1, -Infinity, Infinity, traceDepth - 1));
}

export const outcome = (value: number): Outcome => (value > 0 ? 'win' : value < 0 ? 'loss' : 'draw');

/** Picks the move to play. Perfect takes a best move; fallible sometimes takes one with a worse outcome. */
export function choose(evals: readonly SearchNode[], level: Level, rnd: () => number = Math.random): SearchNode {
  const best = Math.max(...evals.map((e) => e.value));
  const pick = (from: readonly SearchNode[]) => from[Math.floor(rnd() * from.length)];
  if (level === 'fallible' && rnd() < BLUNDER_RATE) {
    const worse = evals.filter((e) => outcome(e.value) !== outcome(best));
    if (worse.length) return pick(worse);
  }
  return pick(evals.filter((e) => e.value === best));
}
