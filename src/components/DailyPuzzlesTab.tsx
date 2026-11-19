import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock, Play } from 'lucide-react';
import { useGameStore } from '@/src/lib/gameStore';
import {
  DIFFICULTY_LABELS,
  Difficulty,
  PuzzleType,
  formatCountdown,
  formatTimer,
  getFormattedDateLabel,
} from '@/src/lib/dailyUtils';
import { generateDailySudoku } from '@/src/puzzles/sudokuGenerator';
import { generateDailyCrossword } from '@/src/puzzles/crosswordData';
import { generateDailyWordSearch } from '@/src/puzzles/wordSearchGenerator';
import { SudokuGame } from '@/src/components/puzzles/SudokuGame';
import { CrosswordGame } from '@/src/components/puzzles/CrosswordGame';
import { WordSearchGame } from '@/src/components/puzzles/WordSearchGame';

interface DailyPuzzlesTabProps {
  activePuzzle: PuzzleType | null;
  setActivePuzzle: (p: PuzzleType | null) => void;
}

const DIFFICULTY_DETAILS: Record<Difficulty, string> = {
  easy: 'Approachable · More Sudoku givens, starter crossword letters, and 8×8 Word Search',
  medium: 'Classic · Balanced daily Sudoku, standard 5×5 Mini Crossword, and 10×10 Word Search',
  hard: 'Challenging · Fewer Sudoku givens, clever wordplay clues, and 12×12 Word Search',
};

function hasSavedProgress(key: string): boolean {
  try {
    return Boolean(localStorage.getItem(key));
  } catch {
    return false;
  }
}

export function DailyPuzzlesTab({
  activePuzzle,
  setActivePuzzle,
}: DailyPuzzlesTabProps) {
  const {
    todayDateKey,
    secondsUntilMidnight,
    getTodayCompletion,
    completePuzzle,
    muted,
    difficulty,
    setDifficulty,
    user,
    signIn,
  } = useGameStore();

  const [justCompletedNotice, setJustCompletedNotice] = useState<string | null>(
    null
  );

  const sudokuComp = getTodayCompletion('sudoku');
  const crosswordComp = getTodayCompletion('crossword');
  const wordSearchComp = getTodayCompletion('wordsearch');

  const sudokuDiff = sudokuComp?.difficulty || difficulty;
  const crosswordDiff = crosswordComp?.difficulty || difficulty;
  const wordSearchDiff = wordSearchComp?.difficulty || difficulty;

  const dailySudoku = useMemo(
    () => generateDailySudoku(todayDateKey, sudokuDiff),
    [todayDateKey, sudokuDiff]
  );
  const dailyCrossword = useMemo(
    () => generateDailyCrossword(todayDateKey, crosswordDiff),
    [todayDateKey, crosswordDiff]
  );
  const dailyWordSearch = useMemo(
    () => generateDailyWordSearch(todayDateKey, wordSearchDiff),
    [todayDateKey, wordSearchDiff]
  );

  const solvedTodayCount =
    (sudokuComp ? 1 : 0) + (crosswordComp ? 1 : 0) + (wordSearchComp ? 1 : 0);

  const handleComplete = async (
    type: PuzzleType,
    timeSeconds: number,
    mistakes: number,
    usedDifficulty: Difficulty
  ) => {
    await completePuzzle(type, timeSeconds, mistakes, usedDifficulty);
    const label =
      type === 'sudoku'
        ? 'Daily Sudoku'
        : type === 'crossword'
          ? 'Daily Crossword'
          : 'Daily Word Search';
    setJustCompletedNotice(
      `${label} (${DIFFICULTY_LABELS[usedDifficulty]}) solved in ${formatTimer(timeSeconds)}! +5 pox transferred to your virtual account.`
    );
  };

  if (activePuzzle === 'sudoku') {
    return (
      <SudokuGame
        puzzle={dailySudoku}
        completion={sudokuComp}
        secondsUntilMidnight={secondsUntilMidnight}
        muted={muted}
        onComplete={(t, m) => void handleComplete('sudoku', t, m, sudokuDiff)}
        onBack={() => setActivePuzzle(null)}
      />
    );
  }

  if (activePuzzle === 'crossword') {
    return (
      <CrosswordGame
        puzzle={dailyCrossword}
        completion={crosswordComp}
        secondsUntilMidnight={secondsUntilMidnight}
        muted={muted}
        onComplete={(t, m) =>
          void handleComplete('crossword', t, m, crosswordDiff)
        }
        onBack={() => setActivePuzzle(null)}
      />
    );
  }

  if (activePuzzle === 'wordsearch') {
    return (
      <WordSearchGame
        puzzle={dailyWordSearch}
        completion={wordSearchComp}
        secondsUntilMidnight={secondsUntilMidnight}
        muted={muted}
        onComplete={(t, m) =>
          void handleComplete('wordsearch', t, m, wordSearchDiff)
        }
        onBack={() => setActivePuzzle(null)}
      />
    );
  }

  const cards: Array<{
    type: PuzzleType;
    title: string;
    meta: string;
    description: string;
    completion: ReturnType<typeof getTodayCompletion>;
    inProgress: boolean;
    accentColor: string;
    icon: React.ReactNode;
  }> = [
    {
      type: 'sudoku',
      title: 'Daily Sudoku',
      meta: `No. ${dailySudoku.puzzleNumber} · ${DIFFICULTY_LABELS[sudokuDiff]} · 9×9 Grid`,
      description:
        'Fill every row, column, and 3×3 box with digits 1 through 9 without repeats.',
      completion: sudokuComp,
      inProgress:
        !sudokuComp &&
        hasSavedProgress(`folio_progress_sudoku_${todayDateKey}_${sudokuDiff}`),
      accentColor: 'border-t-emerald-700',
      icon: (
        <svg
          viewBox="0 0 36 36"
          className="w-9 h-9 text-[#18181B]"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="2"
            y="2"
            width="32"
            height="32"
            rx="4"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M12.67 2v32M23.33 2v32M2 12.67h32M2 23.33h32"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <text
            x="7.5"
            y="9.5"
            fill="currentColor"
            fontSize="6"
            fontWeight="700"
            textAnchor="middle"
          >
            9
          </text>
          <text
            x="18"
            y="20"
            fill="#047857"
            fontSize="6"
            fontWeight="700"
            textAnchor="middle"
          >
            4
          </text>
          <text
            x="28.5"
            y="30.5"
            fill="currentColor"
            fontSize="6"
            fontWeight="700"
            textAnchor="middle"
          >
            1
          </text>
        </svg>
      ),
    },
    {
      type: 'crossword',
      title: 'Daily Crossword',
      meta: `Mini No. ${dailyCrossword.puzzleNumber} · ${DIFFICULTY_LABELS[crosswordDiff]} · ${dailyCrossword.title}`,
      description:
        'Crisp bite-sized wordplay with interlocking Across and Down clues.',
      completion: crosswordComp,
      inProgress:
        !crosswordComp &&
        hasSavedProgress(
          `folio_progress_crossword_${todayDateKey}_${crosswordDiff}`
        ),
      accentColor: 'border-t-amber-600',
      icon: (
        <svg
          viewBox="0 0 36 36"
          className="w-9 h-9 text-[#18181B]"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="2"
            y="2"
            width="32"
            height="32"
            rx="4"
            stroke="currentColor"
            strokeWidth="2"
          />
          <rect x="3" y="3" width="10" height="10" fill="currentColor" />
          <rect x="23" y="23" width="10" height="10" fill="currentColor" />
          <path
            d="M13 2v32M23 2v32M2 13h32M2 23h32"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      ),
    },
    {
      type: 'wordsearch',
      title: 'Daily Word Search',
      meta: `No. ${dailyWordSearch.puzzleNumber} · ${DIFFICULTY_LABELS[wordSearchDiff]} · ${dailyWordSearch.gridSize}×${dailyWordSearch.gridSize} · ${dailyWordSearch.theme}`,
      description: `Scan the grid to uncover all ${dailyWordSearch.words.length} hidden theme words.`,
      completion: wordSearchComp,
      inProgress:
        !wordSearchComp &&
        hasSavedProgress(
          `folio_progress_wordsearch_${todayDateKey}_${wordSearchDiff}`
        ),
      accentColor: 'border-t-blue-700',
      icon: (
        <svg
          viewBox="0 0 36 36"
          className="w-9 h-9 text-[#18181B]"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="2"
            y="2"
            width="32"
            height="32"
            rx="4"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M8 10h20M8 18h20M8 26h20"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray="3 4"
          />
          <path
            d="M8 26L26 10"
            stroke="#1D4ED8"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {justCompletedNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm text-emerald-950 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{justCompletedNotice}</span>
          </div>
          {!user && (
            <button
              type="button"
              onClick={() => void signIn()}
              className="text-xs font-semibold text-emerald-900 underline underline-offset-4 hover:text-emerald-700"
            >
              Sign in with Google to post to Leaderboard
            </button>
          )}
        </div>
      )}

      {/* Difficulty Selector Workspace Bar (above puzzle cards) */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2DED5] pb-5">
        <div className="space-y-0.5">
          <h2 className="text-base font-semibold text-[#18181B]">
            Puzzle Difficulty
          </h2>
          <p className="text-xs text-[#57534E]">
            {DIFFICULTY_DETAILS[difficulty]}
          </p>
        </div>

        <div
          role="group"
          aria-label="Select puzzle difficulty"
          className="inline-flex items-center gap-1 p-1 bg-[#F2EFE9] border border-[#E2DED5] rounded-lg self-start sm:self-auto shrink-0"
        >
          {(['easy', 'medium', 'hard'] as const).map((level) => {
            const active = difficulty === level;
            return (
              <button
                key={level}
                type="button"
                aria-pressed={active}
                onClick={() => setDifficulty(level)}
                className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white text-[#18181B] shadow-xs font-semibold'
                    : 'text-[#57534E] hover:text-[#18181B]'
                }`}
              >
                {DIFFICULTY_LABELS[level]}
              </button>
            );
          })}
        </div>
      </section>

      {/* Three Daily Puzzle Cards (placed above Today's Puzzle Folio) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card) => {
          const isSolved = Boolean(card.completion);
          return (
            <article
              key={card.type}
              className={`bg-white border border-[#E2DED5] border-t-4 ${card.accentColor} rounded-xl p-6 flex flex-col justify-between gap-6 transition-transform duration-150 hover:-translate-y-0.5`}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  {card.icon}
                  {isSolved ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      Solved in {formatTimer(card.completion!.timeSeconds)}
                    </span>
                  ) : card.inProgress ? (
                    <span className="text-xs font-medium text-amber-800">
                      In Progress
                    </span>
                  ) : (
                    <span className="text-xs text-[#57534E]">Ready to Play</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-2xl font-bold text-[#18181B]">
                    {card.title}
                  </h2>
                  <p className="text-xs text-[#57534E]">{card.meta}</p>
                  <p className="text-sm text-[#57534E] leading-relaxed pt-1">
                    {card.description}
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-[#E2DED5]">
                {isSolved ? (
                  <>
                    <div className="flex items-center justify-between text-xs text-[#57534E]">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Next puzzle in
                      </span>
                      <span className="font-mono font-semibold text-[#18181B] tabular-nums">
                        {formatCountdown(secondsUntilMidnight)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActivePuzzle(card.type)}
                      className="w-full h-11 px-4 rounded-lg border border-[#E2DED5] bg-[#FAF9F6] hover:bg-[#F2EFE9] text-sm font-semibold text-[#18181B] transition-colors whitespace-nowrap"
                    >
                      View Completed Board
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActivePuzzle(card.type)}
                    className="w-full h-11 px-4 rounded-lg bg-[#18181B] hover:bg-zinc-800 text-sm font-semibold text-[#FAF9F6] inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {card.inProgress
                      ? 'Resume Puzzle'
                      : `Play ${card.title.replace('Daily ', '')}`}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {/* Today's Puzzle Folio Info Banner (below the puzzle windows) */}
      <section className="bg-white border border-[#E2DED5] rounded-2xl p-6 sm:p-8 space-y-2">
        <p className="text-xs font-medium text-[#57534E] tracking-wide">
          {getFormattedDateLabel()} · {solvedTodayCount} of 3 solved today
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-[#18181B] tracking-tight">
          Today’s Puzzle Folio
        </h1>
        <p className="text-sm text-[#57534E] leading-relaxed max-w-3xl">
          You earn <strong>5 pox</strong> (virtual money) on solving one puzzle and when you have <strong>50 pox</strong> you can buy a puzzle of your choice. One puzzle per title each calendar day—solve cleanly to extend your streak and post your time to today’s leaderboard.
        </p>
      </section>
    </div>
  );
}
