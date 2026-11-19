import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eraser,
  Pencil,
  ShieldCheck,
} from 'lucide-react';
import { DailySudoku } from '@/src/puzzles/sudokuGenerator';
import { CompletionRecord } from '@/src/lib/gameStore';
import {
  DIFFICULTY_LABELS,
  formatCountdown,
  formatTimer,
  playTone,
} from '@/src/lib/dailyUtils';

interface SudokuGameProps {
  puzzle: DailySudoku;
  completion: CompletionRecord | null;
  secondsUntilMidnight: number;
  muted: boolean;
  onComplete: (timeSeconds: number, mistakes: number) => void;
  onBack: () => void;
  customMode?: {
    title: string;
    subtitle: string;
    backLabel?: string;
    onReplay?: () => void;
  };
}

interface SavedSudokuProgress {
  board: number[][];
  notes: number[][][];
  elapsed: number;
  mistakes: number;
}

export function SudokuGame({
  puzzle,
  completion,
  secondsUntilMidnight,
  muted,
  onComplete,
  onBack,
  customMode,
}: SudokuGameProps) {
  const storageKey = `folio_progress_sudoku_${puzzle.dateKey}_${puzzle.difficulty}`;

  const [board, setBoard] = useState<number[][]>(() => {
    if (completion) return puzzle.solution.map((r) => [...r]);
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedSudokuProgress;
        if (Array.isArray(parsed.board) && parsed.board.length === 9) {
          return parsed.board;
        }
      }
    } catch {
      // ignore
    }
    return puzzle.givens.map((r) => [...r]);
  });

  const [notes, setNotes] = useState<number[][][]>(() => {
    if (completion) {
      return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedSudokuProgress;
        if (Array.isArray(parsed.notes) && parsed.notes.length === 9) {
          return parsed.notes;
        }
      }
    } catch {
      // ignore
    }
    return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
  });

  const [elapsed, setElapsed] = useState<number>(() => {
    if (completion) return completion.timeSeconds;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedSudokuProgress;
        return Number(parsed.elapsed) || 0;
      }
    } catch {
      // ignore
    }
    return 0;
  });

  const [mistakes, setMistakes] = useState<number>(() => {
    if (completion) return completion.mistakes;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedSudokuProgress;
        return Number(parsed.mistakes) || 0;
      }
    } catch {
      // ignore
    }
    return 0;
  });

  const [selected, setSelected] = useState<[number, number] | null>([0, 0]);
  const [notesMode, setNotesMode] = useState(false);
  const [autoCheck, setAutoCheck] = useState(false);
  const [flaggedErrors, setFlaggedErrors] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isLocked = Boolean(completion);

  // Timer tick while active
  useEffect(() => {
    if (isLocked) return;
    const id = window.setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isLocked]);

  // Persist in-progress board
  useEffect(() => {
    if (isLocked) return;
    try {
      const payload: SavedSudokuProgress = { board, notes, elapsed, mistakes };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [board, notes, elapsed, mistakes, isLocked, storageKey]);

  const checkWin = useCallback(
    (candidate: number[][], currentMistakes: number) => {
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (candidate[r][c] !== puzzle.solution[r][c]) return false;
        }
      }
      playTone('win', muted);
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
      onComplete(Math.max(1, elapsed), currentMistakes);
      return true;
    },
    [elapsed, muted, onComplete, puzzle.solution, storageKey]
  );

  const enterDigit = useCallback(
    (digit: number) => {
      if (isLocked || !selected) return;
      const [r, c] = selected;
      if (puzzle.givens[r][c] !== 0) return;

      if (notesMode && digit !== 0) {
        playTone('tap', muted);
        setNotes((prev) => {
          const next = prev.map((row) => row.map((cell) => [...cell]));
          const cellNotes = next[r][c];
          if (cellNotes.includes(digit)) {
            next[r][c] = cellNotes.filter((n) => n !== digit);
          } else {
            next[r][c] = [...cellNotes, digit].sort((a, b) => a - b);
          }
          return next;
        });
        return;
      }

      const nextBoard = board.map((row) => [...row]);
      nextBoard[r][c] = digit;
      setBoard(nextBoard);

      // Clear notes in cell once filled
      if (digit !== 0) {
        setNotes((prev) => {
          const next = prev.map((row) => row.map((cell) => [...cell]));
          next[r][c] = [];
          return next;
        });
      }

      const cellKey = `${r}-${c}`;
      let nextMistakes = mistakes;

      if (digit !== 0 && autoCheck && digit !== puzzle.solution[r][c]) {
        playTone('error', muted);
        nextMistakes = mistakes + 1;
        setMistakes(nextMistakes);
        setFlaggedErrors((prev) => new Set(prev).add(cellKey));
        setStatusMessage(`Row ${r + 1}, Column ${c + 1} does not match.`);
      } else {
        playTone('tap', muted);
        setFlaggedErrors((prev) => {
          if (!prev.has(cellKey)) return prev;
          const next = new Set(prev);
          next.delete(cellKey);
          return next;
        });
        setStatusMessage(null);
      }

      if (digit !== 0) {
        checkWin(nextBoard, nextMistakes);
      }
    },
    [
      autoCheck,
      board,
      checkWin,
      isLocked,
      mistakes,
      muted,
      notesMode,
      puzzle.givens,
      puzzle.solution,
      selected,
    ]
  );

  const handleCheckErrors = useCallback(() => {
    if (isLocked) return;
    const errors = new Set<string>();
    let wrongCount = 0;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (puzzle.givens[r][c] === 0 && board[r][c] !== 0) {
          if (board[r][c] !== puzzle.solution[r][c]) {
            errors.add(`${r}-${c}`);
            wrongCount++;
          }
        }
      }
    }

    setFlaggedErrors(errors);
    if (wrongCount > 0) {
      playTone('error', muted);
      setMistakes((prev) => prev + 1);
      setStatusMessage(
        `${wrongCount} incorrect ${wrongCount === 1 ? 'entry' : 'entries'} highlighted.`
      );
    } else {
      playTone('found', muted);
      setStatusMessage('All filled squares so far are accurate.');
    }
  }, [board, isLocked, muted, puzzle.givens, puzzle.solution]);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isLocked) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        enterDigit(Number(e.key));
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        e.preventDefault();
        enterDigit(0);
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setNotesMode((prev) => !prev);
      } else if (selected) {
        const [r, c] = selected;
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelected([Math.max(0, r - 1), c]);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelected([Math.min(8, r + 1), c]);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setSelected([r, Math.max(0, c - 1)]);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          setSelected([r, Math.min(8, c + 1)]);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enterDigit, isLocked, selected]);

  const filledCount = useMemo(() => {
    let count = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (board[r][c] !== 0) count++;
      }
    }
    return count;
  }, [board]);

  const selectedValue =
    selected && board[selected[0]][selected[1]] !== 0
      ? board[selected[0]][selected[1]]
      : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2DED5] pb-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#57534E] hover:text-[#18181B] transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            {customMode?.backLabel || 'All Puzzles'}
          </button>
          <div>
            <h2 className="text-2xl font-semibold text-[#18181B]">
              {customMode ? customMode.title : 'Daily Sudoku'}
            </h2>
            <p className="text-xs text-[#57534E] tabular-nums">
              {customMode
                ? `${customMode.subtitle} · ${filledCount}/81 filled`
                : `No. ${puzzle.puzzleNumber} · ${DIFFICULTY_LABELS[puzzle.difficulty]} · ${puzzle.dateKey} · ${filledCount}/81 filled`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2 font-mono tabular-nums text-[#18181B]">
            <Clock className="w-4 h-4 text-[#57534E]" />
            <span>{formatTimer(completion ? completion.timeSeconds : elapsed)}</span>
          </div>
          <span className="text-[#57534E] tabular-nums">
            Error checks: {completion ? completion.mistakes : mistakes}
          </span>
        </div>
      </div>

      {completion && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-950">
                {customMode
                  ? `Completed ${customMode.title} in ${formatTimer(completion.timeSeconds)}`
                  : `Completed today’s Sudoku in ${formatTimer(completion.timeSeconds)}`}
              </p>
              <p className="text-xs text-emerald-800">
                {customMode
                  ? 'First solve credited +5 pox to your virtual account.'
                  : 'One play per calendar day is enforced. Viewing today’s solved grid.'}
              </p>
            </div>
          </div>
          {customMode ? (
            customMode.onReplay && (
              <button
                type="button"
                onClick={customMode.onReplay}
                className="h-9 px-3.5 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-100 text-xs font-semibold text-emerald-950 transition-colors whitespace-nowrap"
              >
                Play Again
              </button>
            )
          ) : (
            <div className="text-right">
              <p className="text-xs text-emerald-800">Next puzzle in</p>
              <p className="font-mono text-base font-semibold text-emerald-950 tabular-nums">
                {formatCountdown(secondsUntilMidnight)}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,460px)_1fr] gap-8 items-start">
        {/* 9x9 Sudoku Grid */}
        <div className="bg-white border-2 border-[#18181B] rounded-lg overflow-hidden select-none shadow-xs">
          <div className="grid grid-cols-9">
            {board.map((row, r) =>
              row.map((val, c) => {
                const isGiven = puzzle.givens[r][c] !== 0;
                const isSelected = selected?.[0] === r && selected?.[1] === c;
                const isPeer =
                  selected &&
                  (selected[0] === r ||
                    selected[1] === c ||
                    (Math.floor(selected[0] / 3) === Math.floor(r / 3) &&
                      Math.floor(selected[1] / 3) === Math.floor(c / 3)));
                const isSameDigit = selectedValue !== 0 && val === selectedValue;
                const isError = flaggedErrors.has(`${r}-${c}`);
                const cellNotes = notes[r][c];

                const borderRight =
                  c === 8
                    ? ''
                    : c % 3 === 2
                      ? 'border-r-2 border-r-[#18181B]'
                      : 'border-r border-r-[#E2DED5]';
                const borderBottom =
                  r === 8
                    ? ''
                    : r % 3 === 2
                      ? 'border-b-2 border-b-[#18181B]'
                      : 'border-b border-b-[#E2DED5]';

                let bgClass = 'bg-white';
                if (isError) {
                  bgClass = 'bg-rose-50';
                } else if (isSelected) {
                  bgClass = 'bg-sky-100';
                } else if (isSameDigit) {
                  bgClass = 'bg-amber-50';
                } else if (isPeer) {
                  bgClass = 'bg-[#F7F5F0]';
                }

                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    disabled={isLocked}
                    onClick={() => setSelected([r, c])}
                    aria-label={`Row ${r + 1} Column ${c + 1}${val ? ` value ${val}` : ' empty'}`}
                    className={`aspect-square relative flex items-center justify-center text-lg sm:text-xl font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#2563EB] ${borderRight} ${borderBottom} ${bgClass} ${
                      isError
                        ? 'text-rose-700 font-bold'
                        : isGiven
                          ? 'text-[#18181B] font-bold'
                          : 'text-[#2563EB] font-semibold'
                    }`}
                  >
                    {val !== 0 ? (
                      <span>{val}</span>
                    ) : cellNotes.length > 0 ? (
                      <div className="grid grid-cols-3 w-full h-full p-0.5 text-[9px] sm:text-[10px] leading-none text-[#57534E] font-medium">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                          <span
                            key={n}
                            className="flex items-center justify-center"
                          >
                            {cellNotes.includes(n) ? n : ''}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {isError && (
                      <span
                        aria-hidden="true"
                        className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-rose-600 rounded-full"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Controls Panel */}
        <div className="space-y-5">
          {!isLocked && (
            <>
              <div className="grid grid-cols-5 sm:grid-cols-9 lg:grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => enterDigit(n)}
                    className="h-12 rounded-lg border border-[#E2DED5] bg-white hover:bg-[#F2EFE9] active:scale-[0.98] text-lg font-semibold text-[#18181B] tabular-nums transition-all"
                  >
                    {n}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => enterDigit(0)}
                  className="flex-1 min-w-[110px] h-11 px-4 inline-flex items-center justify-center gap-2 rounded-lg border border-[#E2DED5] bg-white hover:bg-[#F2EFE9] text-sm font-medium text-[#18181B] transition-colors whitespace-nowrap"
                >
                  <Eraser className="w-4 h-4" />
                  Erase
                </button>
                <button
                  type="button"
                  onClick={() => setNotesMode((p) => !p)}
                  aria-pressed={notesMode}
                  className={`flex-1 min-w-[110px] h-11 px-4 inline-flex items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap ${
                    notesMode
                      ? 'border-[#18181B] bg-[#18181B] text-[#FAF9F6]'
                      : 'border-[#E2DED5] bg-white hover:bg-[#F2EFE9] text-[#18181B]'
                  }`}
                >
                  <Pencil className="w-4 h-4" />
                  Notes {notesMode ? 'On' : 'Off'}
                </button>
              </div>

              <div className="pt-2 border-t border-[#E2DED5] space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCheckErrors}
                    className="h-11 px-4 inline-flex items-center gap-2 rounded-lg bg-[#18181B] hover:bg-zinc-800 text-[#FAF9F6] text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Check Errors
                  </button>

                  <label className="inline-flex items-center gap-2 px-3 h-11 rounded-lg border border-[#E2DED5] bg-white text-sm text-[#18181B] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoCheck}
                      onChange={(e) => setAutoCheck(e.target.checked)}
                      className="accent-[#18181B] w-4 h-4"
                    />
                    Auto-check entries
                  </label>
                </div>

                {statusMessage && (
                  <div
                    role="status"
                    className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${
                      flaggedErrors.size > 0
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{statusMessage}</span>
                  </div>
                )}

                <p className="text-xs text-[#57534E] leading-relaxed">
                  Use arrow keys to move, keys 1–9 to enter digits, N to toggle pencil notes, and Backspace to clear a cell.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
