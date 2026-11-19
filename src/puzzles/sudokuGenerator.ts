import { Difficulty, createSeededRng, shuffleSeeded } from '@/src/lib/dailyUtils';

export interface DailySudoku {
  dateKey: string;
  difficulty: Difficulty;
  puzzleNumber: number;
  givens: number[][]; // 0 = empty, 1..9 = given
  solution: number[][]; // 1..9
}

const BASE_SOLUTION: number[][] = [
  [1, 2, 3, 4, 5, 6, 7, 8, 9],
  [4, 5, 6, 7, 8, 9, 1, 2, 3],
  [7, 8, 9, 1, 2, 3, 4, 5, 6],
  [2, 3, 4, 5, 6, 7, 8, 9, 1],
  [5, 6, 7, 8, 9, 1, 2, 3, 4],
  [8, 9, 1, 2, 3, 4, 5, 6, 7],
  [3, 4, 5, 6, 7, 8, 9, 1, 2],
  [6, 7, 8, 9, 1, 2, 3, 4, 5],
  [9, 1, 2, 3, 4, 5, 6, 7, 8],
];

function createSolvedBoard(rng: () => number): number[][] {
  const digits = shuffleSeeded([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
  const rowBands = shuffleSeeded([0, 1, 2], rng);
  const colBands = shuffleSeeded([0, 1, 2], rng);

  const rowOrder: number[] = [];
  for (const band of rowBands) {
    const offsets = shuffleSeeded([0, 1, 2], rng);
    for (const off of offsets) {
      rowOrder.push(band * 3 + off);
    }
  }

  const colOrder: number[] = [];
  for (const band of colBands) {
    const offsets = shuffleSeeded([0, 1, 2], rng);
    for (const off of offsets) {
      colOrder.push(band * 3 + off);
    }
  }

  const transpose = rng() > 0.5;
  const grid: number[][] = Array.from({ length: 9 }, () => Array(9).fill(0));

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const val = digits[BASE_SOLUTION[rowOrder[r]][colOrder[c]] - 1];
      if (transpose) {
        grid[c][r] = val;
      } else {
        grid[r][c] = val;
      }
    }
  }

  return grid;
}

function getCandidates(board: number[][], row: number, col: number): number[] {
  const used = new Uint8Array(10);
  for (let i = 0; i < 9; i++) {
    used[board[row][i]] = 1;
    used[board[i][col]] = 1;
  }
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      used[board[br + r][bc + c]] = 1;
    }
  }
  const res: number[] = [];
  for (let d = 1; d <= 9; d++) {
    if (!used[d]) res.push(d);
  }
  return res;
}

function countSolutions(board: number[][], limit: number): number {
  let bestR = -1;
  let bestC = -1;
  let bestCands: number[] | null = null;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) {
        const cands = getCandidates(board, r, c);
        if (cands.length === 0) return 0;
        if (!bestCands || cands.length < bestCands.length) {
          bestR = r;
          bestC = c;
          bestCands = cands;
          if (cands.length === 1) break;
        }
      }
    }
    if (bestCands && bestCands.length === 1) break;
  }

  if (bestR === -1 || !bestCands) return 1;

  let count = 0;
  for (const d of bestCands) {
    board[bestR][bestC] = d;
    count += countSolutions(board, limit - count);
    board[bestR][bestC] = 0;
    if (count >= limit) return count;
  }
  return count;
}

function computePuzzleNumber(dateKey: string): number {
  const epoch = new Date(2026, 0, 1).getTime();
  const [y, m, d] = dateKey.split('-').map(Number);
  const target = new Date(y, m - 1, d).getTime();
  return Math.max(1, Math.floor((target - epoch) / 86400000) + 1);
}

const TARGET_REMOVALS: Record<Difficulty, number> = {
  easy: 30,
  medium: 45,
  hard: 54,
};

export function generateDailySudoku(
  dateKey: string,
  difficulty: Difficulty = 'medium'
): DailySudoku {
  const rng = createSeededRng(`sudoku_${dateKey}_${difficulty}`);
  const solution = createSolvedBoard(rng);
  const givens = solution.map((row) => [...row]);

  const coords: Array<[number, number]> = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      coords.push([r, c]);
    }
  }
  const order = shuffleSeeded(coords, rng);

  let removed = 0;
  const targetRemovals = TARGET_REMOVALS[difficulty];

  for (const [r, c] of order) {
    if (removed >= targetRemovals) break;
    const backup = givens[r][c];
    givens[r][c] = 0;

    const testBoard = givens.map((row) => [...row]);
    if (countSolutions(testBoard, 2) === 1) {
      removed++;
    } else {
      givens[r][c] = backup;
    }
  }

  return {
    dateKey,
    difficulty,
    puzzleNumber: computePuzzleNumber(dateKey),
    givens,
    solution,
  };
}

export function generateCustomSudoku(
  seedKey: string,
  difficulty: Difficulty = 'medium',
  puzzleNumber = 1
): DailySudoku {
  const rng = createSeededRng(`custom_sudoku_${seedKey}_${difficulty}`);
  const solution = createSolvedBoard(rng);
  const givens = solution.map((row) => [...row]);

  const coords: Array<[number, number]> = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      coords.push([r, c]);
    }
  }
  const order = shuffleSeeded(coords, rng);

  let removed = 0;
  const targetRemovals = TARGET_REMOVALS[difficulty];

  for (const [r, c] of order) {
    if (removed >= targetRemovals) break;
    const backup = givens[r][c];
    givens[r][c] = 0;

    const testBoard = givens.map((row) => [...row]);
    if (countSolutions(testBoard, 2) === 1) {
      removed++;
    } else {
      givens[r][c] = backup;
    }
  }

  return {
    dateKey: seedKey,
    difficulty,
    puzzleNumber,
    givens,
    solution,
  };
}
