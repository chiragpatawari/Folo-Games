import React, { useState } from 'react';
import { Coins, Flame, LogIn, LogOut, Trophy, Volume2, VolumeX } from 'lucide-react';
import { ErrorBoundary } from '@/src/components/ErrorBoundary';
import { GameStoreProvider, useGameStore } from '@/src/lib/gameStore';
import { PuzzleType } from '@/src/lib/dailyUtils';
import { DailyPuzzlesTab } from '@/src/components/DailyPuzzlesTab';
import { LeaderboardTab } from '@/src/components/LeaderboardTab';
import { CreateGameTab } from '@/src/components/CreateGameTab';
import { BuyPuzzlesTab } from '@/src/components/BuyPuzzlesTab';
import { PWAInstallButton } from '@/src/components/PWAInstallPrompt';
import { OfflineIndicator } from '@/src/components/OfflineIndicator';

type AppTab = 'daily' | 'leaderboard' | 'create' | 'shop';

function FolioGamesShell() {
  const [activeTab, setActiveTab] = useState<AppTab>('daily');
  const [activePuzzle, setActivePuzzle] = useState<PuzzleType | null>(null);
  const {
    user,
    authReady,
    authError,
    signIn,
    signOut,
    muted,
    setMuted,
    stats,
    displayStreak,
  } = useGameStore();

  const handleNavClick = (tab: AppTab) => {
    setActiveTab(tab);
    if (tab === 'daily') {
      setActivePuzzle(null);
    }
  };

  const navItems: ReadonlyArray<{ id: AppTab; label: string }> = [
    { id: 'daily', label: 'Daily Puzzles' },
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'create', label: 'Create Game' },
    { id: 'shop', label: 'Buy Puzzles' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#18181B]">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#FAF9F6]/95 backdrop-blur-xs border-b border-[#E2DED5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap xl:flex-nowrap items-center justify-between gap-x-4 gap-y-2">
          {/* Zone 1: Virtual balance + explanation left of Folio Games, Published by Chirag Patawari below Folio Games, Streak & Best Streak right of Folio Games */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
            <div className="flex flex-col items-start gap-1 max-w-[215px] shrink-0">
              <button
                type="button"
                onClick={() => handleNavClick('shop')}
                title="Virtual pox account — click to open Buy Puzzles"
                className="px-2.5 py-1.5 rounded-lg border border-[#E2DED5] bg-white hover:bg-[#F2EFE9] transition-colors inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-[#18181B] tabular-nums whitespace-nowrap shrink-0"
              >
                <Coins className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Virtual balance is {stats.poxBalance} pox</span>
              </button>
              <p className="text-[10px] leading-tight text-[#57534E]">
                You earn 5 pox (virtual money) on solving one puzzle and when you have 50 pox you can buy a puzzle of your choice.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleNavClick('daily')}
              className="flex flex-col items-start text-left shrink-0"
            >
              <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-[#18181B] whitespace-nowrap leading-none">
                Folio Games
              </span>
              <span className="text-[11px] font-medium text-[#57534E] whitespace-nowrap leading-tight mt-0.5">
                Published by Chirag Patawari
              </span>
              <span className="text-[10px] text-[#78716C] whitespace-nowrap leading-none mt-0.5">
                powered by Google
              </span>
            </button>

            <div className="flex flex-col justify-center gap-0.5 border-l border-[#E2DED5] pl-3 text-[11px] font-medium text-[#18181B] tabular-nums whitespace-nowrap shrink-0">
              <span className="inline-flex items-center gap-1.5">
                <Flame className="w-3 h-3 text-amber-600 shrink-0" />
                <span>
                  Streak: <strong>{displayStreak}</strong>{' '}
                  {displayStreak === 1 ? 'day' : 'days'}
                </span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#57534E]">
                <Trophy className="w-3 h-3 text-[#18181B] shrink-0" />
                <span>
                  Best Streak: <strong className="text-[#18181B]">{stats.bestStreak}</strong>{' '}
                  {stats.bestStreak === 1 ? 'day' : 'days'}
                </span>
              </span>
            </div>
          </div>

          {/* Zone 2: Primary Navigation Links (Buy Puzzles next to Create Game) */}
          <nav
            aria-label="Primary navigation"
            className="hidden xl:flex items-center gap-5 text-sm font-medium"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`py-2.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'border-[#18181B] text-[#18181B] font-semibold'
                      : 'border-transparent text-[#57534E] hover:text-[#18181B]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Top-right Install App & Account Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton />

            {!authReady ? (
              <span className="text-xs text-[#57534E] whitespace-nowrap px-2">
                Loading...
              </span>
            ) : user ? (
              <button
                type="button"
                onClick={() => void signOut()}
                title={`Signed in as ${user.displayName || user.email || 'Player'}`}
                className="h-9 px-3 rounded-lg border border-[#E2DED5] bg-white hover:bg-[#F2EFE9] text-xs font-medium text-[#18181B] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 max-w-[140px]"
              >
                <span className="truncate">
                  {user.displayName?.split(' ')[0] || 'Account'}
                </span>
                <LogOut className="w-3.5 h-3.5 text-[#57534E] shrink-0" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void signIn()}
                className="h-9 px-3.5 rounded-lg bg-[#18181B] hover:bg-zinc-800 text-xs font-semibold text-[#FAF9F6] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign in
              </button>
            )}
          </div>
        </div>

        {/* Tablet & Mobile Tab Switcher */}
        <nav
          aria-label="Mobile navigation"
          className="xl:hidden border-t border-[#E2DED5] px-2 flex items-center justify-around"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`py-2 px-2 text-xs font-medium border-b-2 whitespace-nowrap shrink-0 transition-colors ${
                  isActive
                    ? 'border-[#18181B] text-[#18181B] font-semibold'
                    : 'border-transparent text-[#57534E]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      {authError && (
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 pt-4">
          <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-2.5 text-xs text-rose-800">
            {authError}
          </div>
        </div>
      )}

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'daily' && (
          <DailyPuzzlesTab
            activePuzzle={activePuzzle}
            setActivePuzzle={setActivePuzzle}
          />
        )}
        {activeTab === 'leaderboard' && <LeaderboardTab />}
        {activeTab === 'create' && <CreateGameTab />}
        {activeTab === 'shop' && <BuyPuzzlesTab />}
      </main>

      <footer className="border-t border-[#E2DED5] bg-[#FAF9F6]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-[#57534E]">
          <span>Folio Games · Daily Puzzles &amp; Studio</span>
          <button
            type="button"
            onClick={() => setMuted(!muted)}
            className="inline-flex items-center gap-1.5 hover:text-[#18181B] transition-colors"
          >
            {muted ? (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                Sound Off
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                Sound On
              </>
            )}
          </button>
        </div>
      </footer>

      <OfflineIndicator />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <GameStoreProvider>
        <FolioGamesShell />
      </GameStoreProvider>
    </ErrorBoundary>
  );
}
