import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Lightbulb,
} from 'lucide-react';
import { DailyWordSearch } from '@/src/puzzles/wordSearchGenerator';
import { CompletionRecord } from '@/src/lib/gameStore';
import {
  DIFFICULTY_LABELS,
  formatCountdown,
  formatTimer,
  playTone,
} from '@/src/lib/dailyUtils';

interface WordSearchGameProps {
  puzzle: DailyWordSearch;
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

interface SavedWordSearchProgress {
  foundWords: string[];
  elapsed: number;
  mistakes: number;
}

function getLineCells(
  start: [number, number],
  end: [number, number]
): Array<[number, number]> {
  const dr = end[0] - start[0];
  const dc = end[1] - start[1];

  const absR = Math.abs(dr);
  const absC = Math.abs(dc);

  if (dr !== 0 && dc !== 0 && absR !== absC) {
    return [];
  }

  const steps = Math.max(absR, absC);
  const stepR = dr === 0 ? 0 : dr / steps;
  const stepC = dc === 0 ? 0 : dc / steps;

  const cells: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    cells.push([start[0] + stepR * i, start[1] + stepC * i]);
  }
  return cells;
}

export function WordSearchGame({
  puzzle,
  completion,
  secondsUntilMidnight,
  muted,
  onComplete,
  onBack,
  customMode,
}: WordSearchGameProps) {
  const storageKey = `folio_progress_wordsearch_${puzzle.dateKey}_${puzzle.difficulty}`;
  const isLocked = Boolean(completion);

  const [foundWords, setFoundWords] = useState<string[]>(() => {
    if (completion) return [...puzzle.words];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedWordSearchProgress;
        if (Array.isArray(parsed.foundWords)) return parsed.foundWords;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [elapsed, setElapsed] = useState<number>(() => {
    if (completion) return completion.timeSeconds;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedWordSearchProgress;
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
        const parsed = JSON.parse(raw) as SavedWordSearchProgress;
        return Number(parsed.mistakes) || 0;
      }
    } catch {
      // ignore
    }
    return 0;
  });

  const [dragStart, setDragStart] = useState<[number, number] | null>(null);
  const [dragEnd, setDragEnd] = useState<[number, number] | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hintCell, setHintCell] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    tone: 'error' | 'info' | 'success';
  } | null>(null);

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
      const payload: SavedWordSearchProgress = {
        foundWords,
        elapsed,
        mistakes,
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [elapsed, foundWords, isLocked, mistakes, storageKey]);

  const foundCellSet = useMemo(() => {
    const set = new Set<string>();
    for (const placement of puzzle.placements) {
      if (foundWords.includes(placement.word)) {
        for (const [r, c] of placement.cells) {
          set.add(`${r}-${c}`);
        }
      }
    }
    return set;
  }, [foundWords, puzzle.placements]);

  const activeSelectionCells = useMemo(() => {
    if (!dragStart || !dragEnd) return new Set<string>();
    const line = getLineCells(dragStart, dragEnd);
    return new Set(line.map(([r, c]) => `${r}-${c}`));
  }, [dragEnd, dragStart]);

  const evaluateSelection = useCallback(
    (start: [number, number], end: [number, number]) => {
      if (isLocked) return;
      const line = getLineCells(start, end);
      if (line.length < 2) {
        return;
      }

      const forward = line.map(([r, c]) => puzzle.grid[r][c]).join('');
      const backward = [...forward].reverse().join('');

      const remaining = puzzle.words.filter((w) => !foundWords.includes(w));
      const matched = remaining.find((w) => w === forward || w === backward);

      if (matched) {
        playTone('found', muted);
        const nextFound = [...foundWords, matched];
        setFoundWords(nextFound);
        setHintCell(null);
        setStatusMessage({
          text: `Found ${matched}! (${nextFound.length}/${puzzle.words.length})`,
          tone: 'success',
        });

        if (nextFound.length === puzzle.words.length) {
          playTone('win', muted);
          try {
            localStorage.removeItem(storageKey);
          } catch {
            // ignore
          }
          onComplete(Math.max(1, elapsed), mistakes);
        }
      } else {
        playTone('error', muted);
        setMistakes((prev) => prev + 1);
        setStatusMessage({
          text: `"${forward}" is not on today's remaining word list.`,
          tone: 'error',
        });
      }
    },
    [
      elapsed,
      foundWords,
      isLocked,
      mistakes,
      muted,
      onComplete,
      puzzle.grid,
      puzzle.words,
      storageKey,
    ]
  );

  useEffect(() => {
    const onGlobalPointerUp = () => {
      if (!isDragging) return;
      setIsDragging(false);
      if (dragStart && dragEnd) {
        if (dragStart[0] !== dragEnd[0] || dragStart[1] !== dragEnd[1]) {
          evaluateSelection(dragStart, dragEnd);
          setDragStart(null);
          setDragEnd(null);
        }
      }
    };
    window.addEventListener('pointerup', onGlobalPointerUp);
    return () => window.removeEventListener('pointerup', onGlobalPointerUp);
  }, [dragEnd, dragStart, evaluateSelection, isDragging]);

  const handleCellPointerDown = (r: number, c: number) => {
    if (isLocked) return;
    // Support two-click selection as well as drag
    if (dragStart && !isDragging && (dragStart[0] !== r || dragStart[1] !== c)) {
      const line = getLineCells(dragStart, [r, c]);
      if (line.length >= 2) {
        evaluateSelection(dragStart, [r, c]);
        setDragStart(null);
        setDragEnd(null);
        return;
      }
    }
    setDragStart([r, c]);
    setDragEnd([r, c]);
    setIsDragging(true);
  };

  const handleCellPointerEnter = (r: number, c: number) => {
    if (!isDragging || isLocked) return;
    setDragEnd([r, c]);
  };

  const handleHint = () => {
    if (isLocked) return;
    const nextPlacement = puzzle.placements.find(
      (p) => !foundWords.includes(p.word)
    );
    if (!nextPlacement) return;
    const [r, c] = nextPlacement.cells[0];
    setHintCell(`${r}-${c}`);
    setStatusMessage({
      text: `Hint: ${nextPlacement.word} starts at Row ${r + 1}, Column ${c + 1}.`,
      tone: 'info',
    });
  };

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
              {customMode ? customMode.title : `Daily Word Search · ${puzzle.theme}`}
            </h2>
            <p className="text-xs text-[#57534E] tabular-nums">
              {customMode
                ? `${customMode.subtitle} · ${foundWords.length}/${puzzle.words.length} found`
                : `No. ${puzzle.puzzleNumber} · ${DIFFICULTY_LABELS[puzzle.difficulty]} · ${puzzle.gridSize}×${puzzle.gridSize} · ${foundWords.length}/${puzzle.words.length} found`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2 font-mono tabular-nums text-[#18181B]">
            <Clock className="w-4 h-4 text-[#57534E]" />
            <span>{formatTimer(completion ? completion.timeSeconds : elapsed)}</span>
          </div>
          <span className="text-[#57534E] tabular-nums">
            Misses: {completion ? completion.mistakes : mistakes}
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
                  : `Completed today’s Word Search in ${formatTimer(completion.timeSeconds)}`}
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

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,480px)_1fr] gap-8 items-start">
        {/* 10x10 Letter Grid */}
        <div
          className="bg-white border-2 border-[#18181B] rounded-xl p-2 sm:p-3 select-none touch-none"
          onPointerLeave={() => {
            if (isDragging) {
              setIsDragging(false);
              setDragStart(null);
              setDragEnd(null);
            }
          }}
        >
          <div
            className={`grid gap-1 ${
              puzzle.gridSize === 8
                ? 'grid-cols-8'
                : puzzle.gridSize === 12
                  ? 'grid-cols-12'
                  : 'grid-cols-10'
            }`}
          >
            {puzzle.grid.map((row, r) =>
              row.map((letter, c) => {
                const key = `${r}-${c}`;
                const isFound = foundCellSet.has(key);
                const isSelected = activeSelectionCells.has(key);
                const isHint = hintCell === key;

                let cellStyle =
                  'bg-[#FAF9F6] text-[#18181B] hover:bg-[#F2EFE9]';
                if (isSelected) {
                  cellStyle = 'bg-[#18181B] text-[#FAF9F6] scale-[0.96]';
                } else if (isFound) {
                  cellStyle = 'bg-emerald-100 text-emerald-950 font-bold';
                } else if (isHint) {
                  cellStyle =
                    'bg-amber-100 text-amber-950 ring-2 ring-amber-500 font-bold';
                }

                const fontSize =
                  puzzle.gridSize === 12
                    ? 'text-sm sm:text-base'
                    : 'text-base sm:text-lg';

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={isLocked}
                    onPointerDown={() => handleCellPointerDown(r, c)}
                    onPointerEnter={() => handleCellPointerEnter(r, c)}
                    aria-label={`Row ${r + 1} Column ${c + 1} letter ${letter}`}
                    className={`aspect-square rounded-md flex items-center justify-center ${fontSize} font-semibold transition-all ${cellStyle}`}
                  >
                    {letter}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Word List & Controls */}
        <div className="space-y-5">
          <div className="bg-white border border-[#E2DED5] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2DED5] pb-3">
              <h3 className="text-sm font-semibold text-[#18181B]">
                Hidden Words ({foundWords.length}/{puzzle.words.length})
              </h3>
              {!isLocked && (
                <button
                  type="button"
                  onClick={handleHint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E2DED5] bg-[#FAF9F6] hover:bg-[#F2EFE9] text-[#18181B] transition-colors"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-amber-600" />
                  Hint
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {puzzle.words.map((word) => {
                const isFound = foundWords.includes(word);
                return (
                  <div
                    key={word}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium tracking-wide transition-colors flex items-center justify-between ${
                      isFound
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 line-through'
                        : 'bg-[#FAF9F6] border-[#E2DED5] text-[#18181B]'
                    }`}
                  >
                    <span>{word}</span>
                    {isFound && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {statusMessage && (
            <div
              role="status"
              className={`flex items-center gap-2 text-sm px-3.5 py-2.5 rounded-lg border ${
                statusMessage.tone === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : statusMessage.tone === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{statusMessage.text}</span>
            </div>
          )}

          {!isLocked && (
            <p className="text-xs text-[#57534E] leading-relaxed">
              Click and drag across any horizontal, vertical, or diagonal line of letters—or click the first letter and then the last letter of a word.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
