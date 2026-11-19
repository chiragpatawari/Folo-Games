import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Delete,
  ShieldCheck,
} from 'lucide-react';
import { CrosswordClue, DailyCrossword } from '@/src/puzzles/crosswordData';
import { CompletionRecord } from '@/src/lib/gameStore';
import {
  DIFFICULTY_LABELS,
  formatCountdown,
  formatTimer,
  playTone,
} from '@/src/lib/dailyUtils';

interface CrosswordGameProps {
  puzzle: DailyCrossword;
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

interface SavedCrosswordProgress {
  grid: string[][];
  elapsed: number;
  mistakes: number;
}

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
];

export function CrosswordGame({
  puzzle,
  completion,
  secondsUntilMidnight,
  muted,
  onComplete,
  onBack,
  customMode,
}: CrosswordGameProps) {
  const storageKey = `folio_progress_crossword_${puzzle.dateKey}_${puzzle.difficulty}`;
  const isLocked = Boolean(completion);

  const [grid, setGrid] = useState<string[][]>(() => {
    if (completion) {
      return puzzle.rows.map((r) => r.split('').map((ch) => (ch === '#' ? '#' : ch)));
    }
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedCrosswordProgress;
        if (Array.isArray(parsed.grid) && parsed.grid.length === 5) {
          return parsed.grid;
        }
      }
    } catch {
      // ignore
    }
    return puzzle.rows.map((row, r) =>
      row.split('').map((ch, c) => {
        if (ch === '#') return '#';
        return puzzle.prefilledCells[`${r}-${c}`] || '';
      })
    );
  });

  const [elapsed, setElapsed] = useState<number>(() => {
    if (completion) return completion.timeSeconds;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedCrosswordProgress;
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
        const parsed = JSON.parse(raw) as SavedCrosswordProgress;
        return Number(parsed.mistakes) || 0;
      }
    } catch {
      // ignore
    }
    return 0;
  });

  const firstWhiteCell = useMemo<[number, number]>(() => {
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (puzzle.rows[r][c] !== '#') return [r, c];
      }
    }
    return [0, 0];
  }, [puzzle.rows]);

  const [selected, setSelected] = useState<[number, number]>(firstWhiteCell);
  const [direction, setDirection] = useState<'across' | 'down'>('across');
  const [flaggedErrors, setFlaggedErrors] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isLocked) return;
    const id = window.setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isLocked]);

  useEffect(() => {
    if (isLocked) return;
    try {
      const payload: SavedCrosswordProgress = { grid, elapsed, mistakes };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [grid, elapsed, mistakes, isLocked, storageKey]);

  const activeClue: CrosswordClue | null = useMemo(() => {
    const [sr, sc] = selected;
    const list = direction === 'across' ? puzzle.acrossClues : puzzle.downClues;
    const found = list.find((cl) => {
      if (direction === 'across') {
        return cl.row === sr && sc >= cl.col && sc < cl.col + cl.length;
      }
      return cl.col === sc && sr >= cl.row && sr < cl.row + cl.length;
    });
    if (found) return found;
    const fallbackList =
      direction === 'across' ? puzzle.downClues : puzzle.acrossClues;
    return (
      fallbackList.find((cl) => {
        if (cl.direction === 'across') {
          return cl.row === sr && sc >= cl.col && sc < cl.col + cl.length;
        }
        return cl.col === sc && sr >= cl.row && sr < cl.row + cl.length;
      }) || null
    );
  }, [direction, puzzle.acrossClues, puzzle.downClues, selected]);

  const activeCells = useMemo(() => {
    const set = new Set<string>();
    if (!activeClue) return set;
    for (let i = 0; i < activeClue.length; i++) {
      const r = activeClue.direction === 'across' ? activeClue.row : activeClue.row + i;
      const c = activeClue.direction === 'across' ? activeClue.col + i : activeClue.col;
      set.add(`${r}-${c}`);
    }
    return set;
  }, [activeClue]);

  const checkSolved = useCallback(
    (candidate: string[][], currentMistakes: number) => {
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (puzzle.rows[r][c] === '#') continue;
          if (candidate[r][c] !== puzzle.rows[r][c]) return false;
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
    [elapsed, muted, onComplete, puzzle.rows, storageKey]
  );

  const stepCursor = useCallback(
    (delta: 1 | -1) => {
      const [r, c] = selected;
      if (direction === 'across') {
        const nc = c + delta;
        if (nc >= 0 && nc < 5 && puzzle.rows[r][nc] !== '#') {
          setSelected([r, nc]);
        }
      } else {
        const nr = r + delta;
        if (nr >= 0 && nr < 5 && puzzle.rows[nr][c] !== '#') {
          setSelected([nr, c]);
        }
      }
    },
    [direction, puzzle.rows, selected]
  );

  const typeLetter = useCallback(
    (letter: string) => {
      if (isLocked) return;
      const [r, c] = selected;
      if (puzzle.rows[r][c] === '#') return;
      if (puzzle.prefilledCells[`${r}-${c}`]) {
        stepCursor(1);
        return;
      }

      playTone('tap', muted);
      const nextGrid = grid.map((row) => [...row]);
      nextGrid[r][c] = letter.toUpperCase();
      setGrid(nextGrid);
      setStatusMessage(null);
      setFlaggedErrors((prev) => {
        if (!prev.has(`${r}-${c}`)) return prev;
        const copy = new Set(prev);
        copy.delete(`${r}-${c}`);
        return copy;
      });

      const solved = checkSolved(nextGrid, mistakes);
      if (!solved) {
        stepCursor(1);
      }
    },
    [
      checkSolved,
      grid,
      isLocked,
      mistakes,
      muted,
      puzzle.prefilledCells,
      puzzle.rows,
      selected,
      stepCursor,
    ]
  );

  const handleBackspace = useCallback(() => {
    if (isLocked) return;
    const [r, c] = selected;
    if (puzzle.rows[r][c] === '#') return;
    if (puzzle.prefilledCells[`${r}-${c}`]) {
      stepCursor(-1);
      return;
    }

    playTone('tap', muted);
    setStatusMessage(null);
    if (grid[r][c] !== '') {
      const nextGrid = grid.map((row) => [...row]);
      nextGrid[r][c] = '';
      setGrid(nextGrid);
      setFlaggedErrors((prev) => {
        if (!prev.has(`${r}-${c}`)) return prev;
        const copy = new Set(prev);
        copy.delete(`${r}-${c}`);
        return copy;
      });
    } else {
      stepCursor(-1);
    }
  }, [
    grid,
    isLocked,
    muted,
    puzzle.prefilledCells,
    puzzle.rows,
    selected,
    stepCursor,
  ]);

  const handleCheckPuzzle = useCallback(() => {
    if (isLocked) return;
    const errors = new Set<string>();
    let wrongCount = 0;

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (puzzle.rows[r][c] === '#') continue;
        if (grid[r][c] !== '' && grid[r][c] !== puzzle.rows[r][c]) {
          errors.add(`${r}-${c}`);
          wrongCount++;
        }
      }
    }

    setFlaggedErrors(errors);
    if (wrongCount > 0) {
      playTone('error', muted);
      setMistakes((p) => p + 1);
      setStatusMessage(
        `${wrongCount} incorrect ${wrongCount === 1 ? 'letter' : 'letters'} marked.`
      );
    } else {
      playTone('found', muted);
      setStatusMessage('Every letter entered so far is correct.');
    }
  }, [grid, isLocked, muted, puzzle.rows]);

  const jumpToClue = useCallback((clue: CrosswordClue) => {
    setDirection(clue.direction);
    setSelected([clue.row, clue.col]);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isLocked) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        typeLetter(e.key);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === ' ') {
        e.preventDefault();
        setDirection((d) => (d === 'across' ? 'down' : 'across'));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setDirection('across');
        const [r, c] = selected;
        for (let nc = c + 1; nc < 5; nc++) {
          if (puzzle.rows[r][nc] !== '#') {
            setSelected([r, nc]);
            break;
          }
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setDirection('across');
        const [r, c] = selected;
        for (let nc = c - 1; nc >= 0; nc--) {
          if (puzzle.rows[r][nc] !== '#') {
            setSelected([r, nc]);
            break;
          }
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setDirection('down');
        const [r, c] = selected;
        for (let nr = r + 1; nr < 5; nr++) {
          if (puzzle.rows[nr][c] !== '#') {
            setSelected([nr, c]);
            break;
          }
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setDirection('down');
        const [r, c] = selected;
        for (let nr = r - 1; nr >= 0; nr--) {
          if (puzzle.rows[nr][c] !== '#') {
            setSelected([nr, c]);
            break;
          }
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleBackspace, isLocked, puzzle.rows, selected, typeLetter]);

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
              {customMode ? customMode.title : `Daily Crossword · ${puzzle.title}`}
            </h2>
            <p className="text-xs text-[#57534E] tabular-nums">
              {customMode
                ? customMode.subtitle
                : `Mini No. ${puzzle.puzzleNumber} · ${DIFFICULTY_LABELS[puzzle.difficulty]} · ${puzzle.dateKey} · 5×5 Grid`}
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
                  : `Completed today’s Mini Crossword in ${formatTimer(completion.timeSeconds)}`}
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

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_1fr] gap-8 items-start">
        <div className="space-y-4">
          {/* Active Clue Banner */}
          {activeClue && (
            <div className="bg-[#F2EFE9] border border-[#E2DED5] rounded-lg px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs font-semibold text-[#57534E] uppercase tracking-wider">
                  {activeClue.number} {activeClue.direction}
                </span>
                <p className="text-sm font-medium text-[#18181B]">
                  {activeClue.clue}
                </p>
              </div>
              {!isLocked && (
                <button
                  type="button"
                  onClick={() =>
                    setDirection((d) => (d === 'across' ? 'down' : 'across'))
                  }
                  className="px-2.5 py-1 text-xs font-medium bg-white border border-[#E2DED5] rounded-md text-[#18181B] hover:bg-[#FAF9F6] shrink-0"
                >
                  {direction === 'across' ? 'Across' : 'Down'}
                </button>
              )}
            </div>
          )}

          {/* 5x5 Crossword Grid */}
          <div className="bg-white border-2 border-[#18181B] rounded-lg overflow-hidden select-none">
            <div className="grid grid-cols-5">
              {grid.map((row, r) =>
                row.map((val, c) => {
                  const isBlack = puzzle.rows[r][c] === '#';
                  if (isBlack) {
                    return (
                      <div
                        key={`${r}-${c}`}
                        aria-hidden="true"
                        className="aspect-square bg-[#18181B] border border-[#18181B]"
                      />
                    );
                  }

                  const isSelected = selected[0] === r && selected[1] === c;
                  const isInWord = activeCells.has(`${r}-${c}`);
                  const isError = flaggedErrors.has(`${r}-${c}`);
                  const isPrefilled = Boolean(puzzle.prefilledCells[`${r}-${c}`]);
                  const num = puzzle.cellNumbers[r][c];

                  let bgClass = isPrefilled ? 'bg-[#F7F5F0]' : 'bg-white';
                  if (isError) bgClass = 'bg-rose-50';
                  else if (isSelected) bgClass = 'bg-sky-100';
                  else if (isInWord) bgClass = 'bg-amber-50';

                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      disabled={isLocked}
                      onClick={() => {
                        if (selected[0] === r && selected[1] === c) {
                          setDirection((d) => (d === 'across' ? 'down' : 'across'));
                        } else {
                          setSelected([r, c]);
                        }
                      }}
                      className={`aspect-square relative border border-[#D6D1C7] flex items-center justify-center text-2xl font-bold transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#2563EB] ${bgClass} ${
                        isError
                          ? 'text-rose-700'
                          : isPrefilled
                            ? 'text-[#57534E]'
                            : 'text-[#18181B]'
                      }`}
                    >
                      {num > 0 && (
                        <span className="absolute top-1 left-1.5 text-[10px] font-semibold text-[#57534E] leading-none">
                          {num}
                        </span>
                      )}
                      <span>{val}</span>
                      {isError && (
                        <span
                          aria-hidden="true"
                          className="absolute bottom-1 right-1 w-1.5 h-1.5 bg-rose-600 rounded-full"
                        />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {!isLocked && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleCheckPuzzle}
                  className="h-10 px-4 inline-flex items-center gap-2 rounded-lg bg-[#18181B] hover:bg-zinc-800 text-[#FAF9F6] text-sm font-medium transition-colors whitespace-nowrap"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Check Errors
                </button>
                <span className="text-xs text-[#57534E]">
                  Space to flip direction
                </span>
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

              {/* Compact On-Screen Keyboard */}
              <div className="space-y-1.5 pt-1">
                {KEYBOARD_ROWS.map((kRow, idx) => (
                  <div key={idx} className="flex justify-center gap-1">
                    {kRow.map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() =>
                          k === 'BACK' ? handleBackspace() : typeLetter(k)
                        }
                        className="h-10 flex-1 max-w-[40px] rounded-md border border-[#E2DED5] bg-white hover:bg-[#F2EFE9] text-xs font-semibold text-[#18181B] flex items-center justify-center transition-colors"
                      >
                        {k === 'BACK' ? <Delete className="w-4 h-4" /> : k}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Clues Panel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white border border-[#E2DED5] rounded-xl p-5">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#57534E] border-b border-[#E2DED5] pb-2">
              Across
            </h3>
            <ul className="space-y-1.5">
              {puzzle.acrossClues.map((cl) => {
                const isActive =
                  activeClue?.direction === 'across' &&
                  activeClue.number === cl.number;
                return (
                  <li key={`a-${cl.number}`}>
                    <button
                      type="button"
                      onClick={() => jumpToClue(cl)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-sm transition-colors flex items-baseline gap-2 ${
                        isActive
                          ? 'bg-amber-50 text-[#18181B] font-semibold'
                          : 'text-[#57534E] hover:bg-[#FAF9F6] hover:text-[#18181B]'
                      }`}
                    >
                      <span className="font-mono text-xs font-bold shrink-0">
                        {cl.number}
                      </span>
                      <span>{cl.clue}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#57534E] border-b border-[#E2DED5] pb-2">
              Down
            </h3>
            <ul className="space-y-1.5">
              {puzzle.downClues.map((cl) => {
                const isActive =
                  activeClue?.direction === 'down' &&
                  activeClue.number === cl.number;
                return (
                  <li key={`d-${cl.number}`}>
                    <button
                      type="button"
                      onClick={() => jumpToClue(cl)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-sm transition-colors flex items-baseline gap-2 ${
                        isActive
                          ? 'bg-amber-50 text-[#18181B] font-semibold'
                          : 'text-[#57534E] hover:bg-[#FAF9F6] hover:text-[#18181B]'
                      }`}
                    >
                      <span className="font-mono text-xs font-bold shrink-0">
                        {cl.number}
                      </span>
                      <span>{cl.clue}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
