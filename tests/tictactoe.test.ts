import { describe, expect, it } from 'vitest';
import { choose, emptyBoard, legalMoves, other, outcome, search, winner, type Cell, type Player } from '../src/lib/tictactoe';

const X = 'X';
const O = 'O';
const _ = null;
const first = () => 0;

describe('winner', () => {
  it('detects rows, columns and diagonals with their line', () => {
    expect(winner([X, X, X, _, O, O, _, _, _])).toEqual({ player: X, line: [0, 1, 2] });
    expect(winner([O, X, _, O, X, _, O, _, X])).toEqual({ player: O, line: [0, 3, 6] });
    expect(winner([X, O, O, _, X, _, _, _, X])).toEqual({ player: X, line: [0, 4, 8] });
  });

  it('returns null for an open board and for a full drawn board', () => {
    expect(winner(emptyBoard())).toBeNull();
    expect(winner([X, O, X, X, O, O, O, X, X])).toBeNull();
  });
});

describe('search', () => {
  it('scores every legal move and reports the work', () => {
    const evals = search(emptyBoard(), X, 3);
    expect(evals.map((e) => e.move)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    // Tic-tac-toe is a draw with best play from any opening move.
    expect(evals.every((e) => e.value === 0)).toBe(true);
    expect(evals.every((e) => e.nodes > 1 && e.pruned > 0)).toBe(true);
    expect(evals[0].kids).toHaveLength(8);
    expect(evals[0].kids[0].kids[0].kids).toHaveLength(0);
  });

  it('takes an immediate win over everything else', () => {
    const board: Cell[] = [O, O, _, X, X, _, _, _, _];
    expect(choose(search(board, O), 'perfect').move).toBe(2);
  });

  it('blocks an immediate loss', () => {
    const board: Cell[] = [X, X, _, _, O, _, _, _, _];
    const evals = search(board, O);
    expect(choose(evals, 'perfect').move).toBe(2);
    expect(evals.filter((e) => e.move !== 2).every((e) => outcome(e.value) === 'loss')).toBe(true);
  });

  it('never loses with perfect play, whoever starts, against every human line', () => {
    let games = 0;
    const walk = (board: Cell[], turn: Player, ai: Player) => {
      const won = winner(board);
      const moves = legalMoves(board);
      if (won || moves.length === 0) {
        games++;
        if (won) expect(won.player).toBe(ai);
        return;
      }
      const tries = turn === ai ? [choose(search(board, ai), 'perfect', first).move] : moves;
      for (const move of tries) {
        board[move] = turn;
        walk(board, other(turn), ai);
        board[move] = null;
      }
    };
    walk(emptyBoard(), X, O);
    walk(emptyBoard(), O, O);
    expect(games).toBeGreaterThan(100);
  });

  it('lets the fallible level pick a losing move when it slips', () => {
    const board: Cell[] = [X, X, _, _, O, _, _, _, _];
    expect(choose(search(board, O), 'fallible', first).move).not.toBe(2);
    expect(choose(search(board, O), 'fallible', () => 0.99).move).toBe(2);
  });
});
