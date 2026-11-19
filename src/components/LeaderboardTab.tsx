import React, { useMemo, useState } from 'react';
import { Award, Clock, LogIn } from 'lucide-react';
import { useGameStore } from '@/src/lib/gameStore';
import {
  DIFFICULTY_LABELS,
  PuzzleType,
  formatTimer,
  getFormattedDateLabel,
} from '@/src/lib/dailyUtils';

const FILTER_OPTIONS: Array<{ id: PuzzleType; label: string }> = [
  { id: 'sudoku', label: 'Sudoku' },
  { id: 'crossword', label: 'Crossword' },
  { id: 'wordsearch', label: 'Word Search' },
];

export function LeaderboardTab() {
  const {
    leaderboard,
    leaderboardLoading,
    todayDateKey,
    user,
    signIn,
    getTodayCompletion,
  } = useGameStore();

  const [filter, setFilter] = useState<PuzzleType>('sudoku');

  const filteredEntries = useMemo(
    () =>
      leaderboard
        .filter((entry) => entry.puzzleType === filter)
        .sort((a, b) => a.timeSeconds - b.timeSeconds),
    [filter, leaderboard]
  );

  const solvedLocallyWithoutAuth =
    !user && Boolean(getTodayCompletion(filter));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E2DED5] pb-6">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[#57534E]">
            {getFormattedDateLabel()} · {todayDateKey}
          </p>
          <h1 className="text-3xl font-bold text-[#18181B]">
            Today’s Fastest Solves
          </h1>
          <p className="text-sm text-[#57534E]">
            Live rankings for today’s identical daily editions, sorted by fastest completion time.
          </p>
        </div>

        {/* Filter Tabs */}
        <div
          role="tablist"
          aria-label="Puzzle leaderboard filter"
          className="inline-flex items-center gap-1 p-1 bg-[#F2EFE9] border border-[#E2DED5] rounded-lg shrink-0"
        >
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.id;
            return (
              <button
                key={opt.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setFilter(opt.id)}
                className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white text-[#18181B] shadow-xs'
                    : 'text-[#57534E] hover:text-[#18181B]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {solvedLocallyWithoutAuth && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-amber-950">
            You solved today’s {FILTER_OPTIONS.find((o) => o.id === filter)?.label}{' '}
            in{' '}
            <span className="font-mono font-semibold tabular-nums">
              {formatTimer(getTodayCompletion(filter)!.timeSeconds)}
            </span>
            . Sign in with Google to publish your time to the global leaderboard.
          </p>
          <button
            type="button"
            onClick={() => void signIn()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#18181B] text-[#FAF9F6] rounded-lg hover:bg-zinc-800 transition-colors whitespace-nowrap"
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign in with Google
          </button>
        </div>
      )}

      <div className="bg-white border border-[#E2DED5] rounded-xl overflow-hidden">
        {leaderboardLoading ? (
          <div className="p-12 text-center text-sm text-[#57534E]">
            Loading today’s solve times...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Award className="w-8 h-8 text-[#57534E] mx-auto" />
            <p className="text-base font-semibold text-[#18181B]">
              No recorded solves yet for today’s{' '}
              {FILTER_OPTIONS.find((o) => o.id === filter)?.label}
            </p>
            <p className="text-sm text-[#57534E]">
              Complete today’s puzzle while signed in to claim Rank #1.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E2DED5] bg-[#FAF9F6] text-xs font-semibold text-[#57534E]">
                <th className="py-3.5 px-5 w-24">Rank</th>
                <th className="py-3.5 px-5">Player Name</th>
                <th className="py-3.5 px-5">Difficulty</th>
                <th className="py-3.5 px-5 text-right">Completion Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2DED5] text-sm">
              {filteredEntries.map((entry, idx) => {
                const rank = idx + 1;
                const isMe = Boolean(user && entry.userId === user.uid);
                const diffLabel =
                  DIFFICULTY_LABELS[entry.difficulty || 'medium'];
                return (
                  <tr
                    key={entry.id}
                    className={isMe ? 'bg-amber-50/60' : 'hover:bg-[#FAF9F6]'}
                  >
                    <td className="py-3.5 px-5 font-mono font-semibold tabular-nums text-[#18181B]">
                      #{rank}
                    </td>
                    <td className="py-3.5 px-5 font-medium text-[#18181B]">
                      <span>{entry.playerName}</span>
                      {isMe && (
                        <span className="ml-2 text-xs font-normal text-[#57534E]">
                          · You
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-[#57534E]">
                      {diffLabel}
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono font-semibold tabular-nums text-[#18181B]">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#57534E]" />
                        {formatTimer(entry.timeSeconds)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
