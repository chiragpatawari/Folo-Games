import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Coins,
  Plus,
  ShoppingBag,
  Trash2,
  Play,
} from 'lucide-react';
import {
  POX_PER_PUZZLE,
  POX_PER_SOLVE,
  PurchaseDraftItem,
  PurchasedPuzzleRecord,
  useGameStore,
} from '@/src/lib/gameStore';
import {
  DIFFICULTY_LABELS,
  Difficulty,
  PuzzleType,
  formatTimer,
} from '@/src/lib/dailyUtils';
import { generateCustomSudoku } from '@/src/puzzles/sudokuGenerator';
import {
  CROSSWORD_THEMES,
  generateCustomCrossword,
} from '@/src/puzzles/crosswordData';
import {
  WORD_SEARCH_THEMES,
  generateCustomWordSearch,
} from '@/src/puzzles/wordSearchGenerator';
import { SudokuGame } from '@/src/components/puzzles/SudokuGame';
import { CrosswordGame } from '@/src/components/puzzles/CrosswordGame';
import { WordSearchGame } from '@/src/components/puzzles/WordSearchGame';

const PUZZLE_TYPE_LABELS: Record<PuzzleType, string> = {
  sudoku: 'Sudoku (9×9)',
  crossword: 'Mini Crossword (5×5)',
  wordsearch: 'Word Search',
};

export function BuyPuzzlesTab() {
  const {
    stats,
    purchasedPuzzles,
    buyPuzzles,
    completePurchasedPuzzle,
    secondsUntilMidnight,
    muted,
  } = useGameStore();

  const [selectedType, setSelectedType] = useState<PuzzleType>('sudoku');
  const [selectedDiff, setSelectedDiff] = useState<Difficulty>('medium');
  const [sudokuTitle, setSudokuTitle] = useState('Personal Sudoku');
  const [cwThemeIndex, setCwThemeIndex] = useState(0);
  const [wsThemeIndex, setWsThemeIndex] = useState(0);
  const [wsUseCustomWords, setWsUseCustomWords] = useState(false);
  const [wsCustomTopic, setWsCustomTopic] = useState('');
  const [wsCustomWordsInput, setWsCustomWordsInput] = useState('');

  const [order, setOrder] = useState<PurchaseDraftItem[]>([]);
  const [isBuying, setIsBuying] = useState(false);
  const [feedback, setFeedback] = useState<{
    text: string;
    tone: 'success' | 'error';
  } | null>(null);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const [replayNonce, setReplayNonce] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);

  const unlockableCount = Math.floor(stats.poxBalance / POX_PER_PUZZLE);
  const remainingTowardNext = POX_PER_PUZZLE - (stats.poxBalance % POX_PER_PUZZLE);
  const progressPct = Math.min(
    100,
    Math.round(((stats.poxBalance % POX_PER_PUZZLE) / POX_PER_PUZZLE) * 100)
  );
  const orderCost = order.length * POX_PER_PUZZLE;
  const canAddMore = order.length < unlockableCount;

  const activePurchased = useMemo(
    () => purchasedPuzzles.find((p) => p.id === playingId) || null,
    [playingId, purchasedPuzzles]
  );

  const generatedActiveSudoku = useMemo(() => {
    if (!activePurchased || activePurchased.puzzleType !== 'sudoku') return null;
    return generateCustomSudoku(
      `${activePurchased.seedKey}_${isReplaying ? `r${replayNonce}` : 'base'}`,
      activePurchased.difficulty
    );
  }, [activePurchased, isReplaying, replayNonce]);

  const generatedActiveCrossword = useMemo(() => {
    if (!activePurchased || activePurchased.puzzleType !== 'crossword') {
      return null;
    }
    return generateCustomCrossword(
      `${activePurchased.seedKey}_${isReplaying ? `r${replayNonce}` : 'base'}`,
      activePurchased.themeIndex,
      activePurchased.difficulty
    );
  }, [activePurchased, isReplaying, replayNonce]);

  const generatedActiveWordSearch = useMemo(() => {
    if (!activePurchased || activePurchased.puzzleType !== 'wordsearch') {
      return null;
    }
    return generateCustomWordSearch(
      `${activePurchased.seedKey}_${isReplaying ? `r${replayNonce}` : 'base'}`,
      {
        difficulty: activePurchased.difficulty,
        themeIndex: activePurchased.themeIndex,
        customTheme: activePurchased.customTheme,
        customWords: activePurchased.customWords,
      }
    );
  }, [activePurchased, isReplaying, replayNonce]);

  const buildDraftItem = (): PurchaseDraftItem | null => {
    if (selectedType === 'sudoku') {
      const cleanTitle = sudokuTitle.trim() || 'Custom Sudoku';
      return {
        puzzleType: 'sudoku',
        difficulty: selectedDiff,
        title: cleanTitle.slice(0, 60),
        themeIndex: 0,
        customTheme: '',
        customWords: [],
      };
    }

    if (selectedType === 'crossword') {
      const theme = CROSSWORD_THEMES[cwThemeIndex] || CROSSWORD_THEMES[0];
      return {
        puzzleType: 'crossword',
        difficulty: selectedDiff,
        title: `Mini Crossword: ${theme.title}`.slice(0, 60),
        themeIndex: theme.index,
        customTheme: theme.title,
        customWords: [],
      };
    }

    // Word Search
    const theme = WORD_SEARCH_THEMES[wsThemeIndex] || WORD_SEARCH_THEMES[0];
    if (wsUseCustomWords) {
      const parsedWords = wsCustomWordsInput
        .split(/[\n,;\s]+/)
        .map((w) => w.toUpperCase().replace(/[^A-Z]/g, ''))
        .filter((w) => w.length >= 3 && w.length <= 12);
      const unique: string[] = [];
      for (const w of parsedWords) {
        if (!unique.includes(w)) unique.push(w);
      }
      if (unique.length < 3) {
        setFeedback({
          text: 'Enter at least 3 words (3–12 letters each) for a custom Word Search.',
          tone: 'error',
        });
        return null;
      }
      const topic = wsCustomTopic.trim() || 'Custom Words';
      return {
        puzzleType: 'wordsearch',
        difficulty: selectedDiff,
        title: `Word Search: ${topic}`.slice(0, 60),
        themeIndex: 0,
        customTheme: topic.slice(0, 40),
        customWords: unique.slice(0, 10),
      };
    }

    return {
      puzzleType: 'wordsearch',
      difficulty: selectedDiff,
      title: `Word Search: ${theme.theme}`.slice(0, 60),
      themeIndex: theme.index,
      customTheme: theme.theme.slice(0, 40),
      customWords: [],
    };
  };

  const handleAddToOrder = () => {
    setFeedback(null);
    if (!canAddMore) {
      setFeedback({
        text:
          unlockableCount === 0
            ? `You need at least ${POX_PER_PUZZLE} pox to add a puzzle. Solve puzzles to earn +${POX_PER_SOLVE} pox each.`
            : `Your current balance of ${stats.poxBalance} pox allows up to ${unlockableCount} ${unlockableCount === 1 ? 'puzzle' : 'puzzles'} at once.`,
        tone: 'error',
      });
      return;
    }
    const item = buildDraftItem();
    if (!item) return;
    setOrder((prev) => [...prev, item]);
  };

  const handleCheckout = async (itemsToBuy: PurchaseDraftItem[]) => {
    if (itemsToBuy.length === 0 || isBuying) return;
    setFeedback(null);
    setIsBuying(true);
    try {
      const purchased = await buyPuzzles(itemsToBuy);
      setOrder([]);
      setFeedback({
        text: `Unlocked ${purchased.length} ${purchased.length === 1 ? 'puzzle' : 'puzzles'} for ${purchased.length * POX_PER_PUZZLE} pox! Launch ${purchased.length === 1 ? 'it' : 'them'} anytime below.`,
        tone: 'success',
      });
    } catch (err) {
      setFeedback({
        text: err instanceof Error ? err.message : 'Unable to complete purchase.',
        tone: 'error',
      });
    } finally {
      setIsBuying(false);
    }
  };

  const handleQuickBuySingle = async () => {
    if (unlockableCount < 1) return;
    const item = buildDraftItem();
    if (!item) return;
    await handleCheckout([item]);
  };

  const handlePurchasedSolve = async (
    puz: PurchasedPuzzleRecord,
    timeSeconds: number
  ) => {
    const res = await completePurchasedPuzzle(puz.id, timeSeconds);
    setIsReplaying(false);
    if (res.awardedPox > 0) {
      setFeedback({
        text: `Solved "${puz.title}" in ${formatTimer(timeSeconds)}! +${res.awardedPox} pox added to your virtual account.`,
        tone: 'success',
      });
    }
  };

  // Active purchased puzzle board view
  if (activePurchased) {
    const completionObj =
      activePurchased.solved && !isReplaying
        ? {
            dateKey: activePurchased.seedKey,
            puzzleType: activePurchased.puzzleType,
            difficulty: activePurchased.difficulty,
            timeSeconds: activePurchased.bestTimeSeconds || 1,
            mistakes: 0,
            completed: true,
          }
        : null;

    const customMeta = {
      title: activePurchased.title,
      subtitle: `${DIFFICULTY_LABELS[activePurchased.difficulty]} · Unlocked Puzzle`,
      backLabel: 'Back to Buy Puzzles',
      onReplay: () => {
        setIsReplaying(true);
        setReplayNonce((n) => n + 1);
      },
    };

    if (activePurchased.puzzleType === 'sudoku' && generatedActiveSudoku) {
      return (
        <SudokuGame
          key={`${activePurchased.id}-${replayNonce}-${isReplaying ? 'play' : 'view'}`}
          puzzle={generatedActiveSudoku}
          completion={completionObj}
          secondsUntilMidnight={secondsUntilMidnight}
          muted={muted}
          customMode={customMeta}
          onComplete={(t) => void handlePurchasedSolve(activePurchased, t)}
          onBack={() => {
            setPlayingId(null);
            setIsReplaying(false);
          }}
        />
      );
    }

    if (
      activePurchased.puzzleType === 'crossword' &&
      generatedActiveCrossword
    ) {
      return (
        <CrosswordGame
          key={`${activePurchased.id}-${replayNonce}-${isReplaying ? 'play' : 'view'}`}
          puzzle={generatedActiveCrossword}
          completion={completionObj}
          secondsUntilMidnight={secondsUntilMidnight}
          muted={muted}
          customMode={customMeta}
          onComplete={(t) => void handlePurchasedSolve(activePurchased, t)}
          onBack={() => {
            setPlayingId(null);
            setIsReplaying(false);
          }}
        />
      );
    }

    if (
      activePurchased.puzzleType === 'wordsearch' &&
      generatedActiveWordSearch
    ) {
      return (
        <WordSearchGame
          key={`${activePurchased.id}-${replayNonce}-${isReplaying ? 'play' : 'view'}`}
          puzzle={generatedActiveWordSearch}
          completion={completionObj}
          secondsUntilMidnight={secondsUntilMidnight}
          muted={muted}
          customMode={customMeta}
          onComplete={(t) => void handlePurchasedSolve(activePurchased, t)}
          onBack={() => {
            setPlayingId(null);
            setIsReplaying(false);
          }}
        />
      );
    }
  }

  return (
    <div className="space-y-8">
      {/* Virtual Account & Pricing Overview */}
      <section className="bg-white border border-[#E2DED5] rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <p className="text-xs font-medium text-[#57534E] tracking-wide">
            Virtual Pox Account · {POX_PER_SOLVE} pox earned per solved puzzle · Optional Shop
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#18181B] tracking-tight">
            Buy Custom Puzzles
          </h1>
          <p className="text-sm text-[#57534E] leading-relaxed">
            Every solved puzzle transfers <strong>5 pox</strong> to your virtual account. At <strong>50 pox</strong> you can choose 1 puzzle of your own, at <strong>100 pox</strong> choose 2, at <strong>150 pox</strong> choose 3, and so on. Purchasing is completely optional—keep saving as long as you like.
          </p>
        </div>

        <div className="bg-[#FAF9F6] border border-[#E2DED5] rounded-xl p-5 min-w-[270px] space-y-3 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-medium text-[#57534E]">
              Virtual Balance
            </span>
            <span className="inline-flex items-center gap-1.5 text-lg font-bold text-[#18181B] tabular-nums">
              <Coins className="w-4 h-4 text-amber-600" />
              {stats.poxBalance} pox
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-[#E2DED5] overflow-hidden">
            <div
              className="h-full bg-[#18181B] transition-all duration-300"
              style={{
                width: `${stats.poxBalance >= POX_PER_PUZZLE && stats.poxBalance % POX_PER_PUZZLE === 0 ? 100 : progressPct}%`,
              }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-[#57534E] tabular-nums">
            <span>
              {unlockableCount > 0
                ? `Can choose up to ${unlockableCount} ${unlockableCount === 1 ? 'puzzle' : 'puzzles'}`
                : `${remainingTowardNext} pox away from 1 puzzle`}
            </span>
            <span className="font-medium text-[#18181B]">
              50 pox / puzzle
            </span>
          </div>
        </div>
      </section>

      {feedback && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-2.5 ${
            feedback.tone === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Configurator + Order Selection */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 items-start">
        <section className="bg-white border border-[#E2DED5] rounded-xl p-6 space-y-6">
          <div className="border-b border-[#E2DED5] pb-4">
            <h2 className="text-xl font-bold text-[#18181B]">
              Choose Your Puzzle
            </h2>
            <p className="text-xs text-[#57534E] mt-1">
              50 pox = 1 puzzle · 100 pox = 2 puzzles · 150 pox = 3 puzzles
            </p>
          </div>

          {/* Step 1: Puzzle Type */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#57534E]">
              Puzzle Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(['sudoku', 'crossword', 'wordsearch'] as const).map((t) => {
                const active = selectedType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedType(t)}
                    className={`h-11 px-3 rounded-lg border text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'border-[#18181B] bg-[#18181B] text-[#FAF9F6]'
                        : 'border-[#E2DED5] bg-[#FAF9F6] hover:bg-[#F2EFE9] text-[#18181B]'
                    }`}
                  >
                    {PUZZLE_TYPE_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Difficulty */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#57534E]">
              Difficulty
            </label>
            <div className="inline-flex items-center gap-1 p-1 bg-[#F2EFE9] border border-[#E2DED5] rounded-lg">
              {(['easy', 'medium', 'hard'] as const).map((level) => {
                const active = selectedDiff === level;
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setSelectedDiff(level)}
                    className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
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
          </div>

          {/* Step 3: Puzzle Customization */}
          {selectedType === 'sudoku' && (
            <div className="space-y-2">
              <label
                htmlFor="custom-sudoku-title"
                className="block text-xs font-semibold text-[#57534E]"
              >
                Puzzle Title (generates a fresh unique 9×9 board)
              </label>
              <input
                id="custom-sudoku-title"
                type="text"
                maxLength={50}
                value={sudokuTitle}
                onChange={(e) => setSudokuTitle(e.target.value)}
                placeholder="e.g. Evening Challenge"
                className="w-full h-11 rounded-lg border border-[#E2DED5] bg-white px-3 text-sm text-[#18181B] focus:outline-2 focus:outline-[#18181B]"
              />
            </div>
          )}

          {selectedType === 'crossword' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#57534E]">
                Choose Mini Crossword Edition
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CROSSWORD_THEMES.map((cw) => {
                  const active = cwThemeIndex === cw.index;
                  return (
                    <button
                      key={cw.index}
                      type="button"
                      onClick={() => setCwThemeIndex(cw.index)}
                      className={`h-10 px-3 rounded-lg border text-left text-xs sm:text-sm font-medium transition-colors truncate ${
                        active
                          ? 'border-[#18181B] bg-amber-50 text-[#18181B] font-semibold'
                          : 'border-[#E2DED5] bg-[#FAF9F6] hover:bg-[#F2EFE9] text-[#57534E]'
                      }`}
                    >
                      {cw.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedType === 'wordsearch' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWsUseCustomWords(false)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    !wsUseCustomWords
                      ? 'border-[#18181B] bg-[#18181B] text-[#FAF9F6]'
                      : 'border-[#E2DED5] bg-[#FAF9F6] text-[#57534E]'
                  }`}
                >
                  Curated Themes
                </button>
                <button
                  type="button"
                  onClick={() => setWsUseCustomWords(true)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    wsUseCustomWords
                      ? 'border-[#18181B] bg-[#18181B] text-[#FAF9F6]'
                      : 'border-[#E2DED5] bg-[#FAF9F6] text-[#57534E]'
                  }`}
                >
                  Write My Own Words
                </button>
              </div>

              {!wsUseCustomWords ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {WORD_SEARCH_THEMES.map((t) => {
                    const active = wsThemeIndex === t.index;
                    return (
                      <button
                        key={t.index}
                        type="button"
                        onClick={() => setWsThemeIndex(t.index)}
                        className={`h-10 px-3 rounded-lg border text-left text-xs font-medium transition-colors truncate ${
                          active
                            ? 'border-[#18181B] bg-amber-50 text-[#18181B] font-semibold'
                            : 'border-[#E2DED5] bg-[#FAF9F6] hover:bg-[#F2EFE9] text-[#57534E]'
                        }`}
                      >
                        {t.theme}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="ws-custom-topic"
                      className="block text-xs font-semibold text-[#57534E] mb-1"
                    >
                      Theme Name
                    </label>
                    <input
                      id="ws-custom-topic"
                      type="text"
                      maxLength={35}
                      value={wsCustomTopic}
                      onChange={(e) => setWsCustomTopic(e.target.value)}
                      placeholder="e.g. Favorite Foods"
                      className="w-full h-10 rounded-lg border border-[#E2DED5] bg-white px-3 text-sm text-[#18181B]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="ws-custom-words"
                      className="block text-xs font-semibold text-[#57534E] mb-1"
                    >
                      Custom Words (comma-separated, 3–10 words)
                    </label>
                    <textarea
                      id="ws-custom-words"
                      rows={2}
                      value={wsCustomWordsInput}
                      onChange={(e) => setWsCustomWordsInput(e.target.value)}
                      placeholder="PIZZA, PASTA, GELATO, ESPRESSO, TIRAMISU"
                      className="w-full rounded-lg border border-[#E2DED5] bg-white px-3 py-2 text-sm text-[#18181B]"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-2 border-t border-[#E2DED5] flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!canAddMore || isBuying}
              onClick={handleAddToOrder}
              className="h-11 px-4 rounded-lg border border-[#E2DED5] bg-[#FAF9F6] hover:bg-[#F2EFE9] disabled:opacity-45 text-sm font-semibold text-[#18181B] inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Add to Order (50 pox)
            </button>

            {order.length === 0 && (
              <button
                type="button"
                disabled={unlockableCount < 1 || isBuying}
                onClick={() => void handleQuickBuySingle()}
                className="h-11 px-5 rounded-lg bg-[#18181B] hover:bg-zinc-800 disabled:opacity-45 text-sm font-semibold text-[#FAF9F6] inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <ShoppingBag className="w-4 h-4" />
                Buy 1 Puzzle (50 pox)
              </button>
            )}
          </div>
        </section>

        {/* Optional Order Selection Box */}
        <section className="bg-white border border-[#E2DED5] rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#E2DED5] pb-4">
            <div>
              <h2 className="text-xl font-bold text-[#18181B]">
                Your Order Selection
              </h2>
              <p className="text-xs text-[#57534E] mt-0.5 tabular-nums">
                Optional · {order.length} of {unlockableCount} unlockable selected
              </p>
            </div>
            {order.length > 0 && (
              <button
                type="button"
                onClick={() => setOrder([])}
                className="text-xs font-medium text-[#57534E] hover:text-[#18181B]"
              >
                Clear
              </button>
            )}
          </div>

          {order.length === 0 ? (
            <div className="py-6 text-center space-y-2 text-sm text-[#57534E]">
              <p>No puzzles queued yet.</p>
              <p className="text-xs">
                {unlockableCount === 0
                  ? `Solve daily puzzles (+${POX_PER_SOLVE} pox each) until you reach 50 pox to unlock your first puzzle of choice.`
                  : `You have enough pox to choose up to ${unlockableCount} ${unlockableCount === 1 ? 'puzzle' : 'puzzles'} right now—or save your balance for later.`}
              </p>
            </div>
          ) : (
            <>
              <ul className="space-y-2.5">
                {order.map((item, idx) => (
                  <li
                    key={`${item.puzzleType}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[#E2DED5] bg-[#FAF9F6] px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#18181B] truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-[#57534E]">
                        {PUZZLE_TYPE_LABELS[item.puzzleType]} ·{' '}
                        {DIFFICULTY_LABELS[item.difficulty]} · 50 pox
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setOrder((prev) => prev.filter((_, i) => i !== idx))
                      }
                      aria-label={`Remove ${item.title}`}
                      className="p-1.5 text-[#57534E] hover:text-rose-700 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="pt-3 border-t border-[#E2DED5] space-y-3">
                <div className="flex items-center justify-between text-sm font-semibold text-[#18181B] tabular-nums">
                  <span>
                    Total ({order.length}{' '}
                    {order.length === 1 ? 'puzzle' : 'puzzles'})
                  </span>
                  <span>{orderCost} pox</span>
                </div>
                <button
                  type="button"
                  disabled={isBuying || stats.poxBalance < orderCost}
                  onClick={() => void handleCheckout(order)}
                  className="w-full h-11 px-4 rounded-lg bg-[#18181B] hover:bg-zinc-800 disabled:opacity-45 text-sm font-semibold text-[#FAF9F6] inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <ShoppingBag className="w-4 h-4" />
                  {isBuying
                    ? 'Unlocking...'
                    : `Buy ${order.length} ${order.length === 1 ? 'Puzzle' : 'Puzzles'} (${orderCost} pox)`}
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Purchased Puzzles Library */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#E2DED5] pb-3">
          <h2 className="text-2xl font-bold text-[#18181B]">
            Your Purchased Puzzles
          </h2>
          <span className="text-xs text-[#57534E] tabular-nums">
            {purchasedPuzzles.length} unlocked
          </span>
        </div>

        {purchasedPuzzles.length === 0 ? (
          <div className="bg-white border border-[#E2DED5] rounded-xl p-8 text-center text-sm text-[#57534E]">
            Puzzles you choose to buy with pox will appear here so you can play them anytime.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {purchasedPuzzles.map((puz) => (
              <article
                key={puz.id}
                className="bg-white border border-[#E2DED5] rounded-xl p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs text-[#57534E]">
                    <span>
                      {PUZZLE_TYPE_LABELS[puz.puzzleType]} ·{' '}
                      {DIFFICULTY_LABELS[puz.difficulty]}
                    </span>
                    {puz.solved && (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {formatTimer(puz.bestTimeSeconds)}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-[#18181B] truncate">
                    {puz.title}
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsReplaying(false);
                    setPlayingId(puz.id);
                  }}
                  className={`w-full h-10 px-4 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
                    puz.solved
                      ? 'border border-[#E2DED5] bg-[#FAF9F6] hover:bg-[#F2EFE9] text-[#18181B]'
                      : 'bg-[#18181B] hover:bg-zinc-800 text-[#FAF9F6]'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {puz.solved ? 'View or Replay' : 'Play Puzzle'}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
