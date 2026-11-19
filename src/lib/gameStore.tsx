import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
} from '@/src/lib/firebase';
import {
  Difficulty,
  PuzzleType,
  getSecondsUntilLocalMidnight,
  getTodayDateKey,
  getYesterdayDateKey,
} from '@/src/lib/dailyUtils';

export const POX_PER_SOLVE = 5;
export const POX_PER_PUZZLE = 50;

export interface StreakStats {
  currentStreak: number;
  bestStreak: number;
  lastSolvedDate: string;
  totalSolved: number;
  poxBalance: number;
}

export interface CompletionRecord {
  dateKey: string;
  puzzleType: PuzzleType;
  difficulty?: Difficulty;
  timeSeconds: number;
  mistakes: number;
  completed: boolean;
}

export interface PurchasedPuzzleRecord {
  id: string;
  puzzleType: PuzzleType;
  difficulty: Difficulty;
  title: string;
  seedKey: string;
  themeIndex: number;
  customTheme: string;
  customWords: string[];
  costPox: number;
  solved: boolean;
  bestTimeSeconds: number;
  createdAtMs: number;
}

export interface PurchaseDraftItem {
  puzzleType: PuzzleType;
  difficulty: Difficulty;
  title: string;
  themeIndex: number;
  customTheme: string;
  customWords: string[];
}

export interface LeaderboardEntry {
  id: string;
  userId: string;
  playerName: string;
  dateKey: string;
  puzzleType: PuzzleType;
  difficulty?: Difficulty;
  timeSeconds: number;
}

interface LocalStoreShape {
  stats: StreakStats;
  completions: Record<string, CompletionRecord>;
  purchasedPuzzles: PurchasedPuzzleRecord[];
}

const LOCAL_STORAGE_KEY = 'folio_games_state_v1';

const DEFAULT_STATS: StreakStats = {
  currentStreak: 0,
  bestStreak: 0,
  lastSolvedDate: '',
  totalSolved: 0,
  poxBalance: 0,
};

function sanitizeDisplayName(name: string | null | undefined): string {
  const cleaned = (name || 'Player').trim().replace(/\s+/g, ' ');
  return (cleaned || 'Player').slice(0, 40);
}

function sanitizePurchasedWords(words: string[] | undefined): string[] {
  if (!Array.isArray(words)) return [];
  return words
    .map((w) => String(w).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 16))
    .filter((w) => w.length >= 3)
    .slice(0, 12);
}

function readLocalState(): LocalStoreShape {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return { stats: DEFAULT_STATS, completions: {}, purchasedPuzzles: [] };
    }
    const parsed = JSON.parse(raw) as Partial<LocalStoreShape>;
    const totalSolved = Number(parsed.stats?.totalSolved) || 0;
    const rawPox = parsed.stats?.poxBalance;
    const poxBalance =
      typeof rawPox === 'number' && Number.isFinite(rawPox)
        ? Math.max(0, Math.floor(rawPox))
        : 0;

    return {
      stats: {
        currentStreak: Number(parsed.stats?.currentStreak) || 0,
        bestStreak: Number(parsed.stats?.bestStreak) || 0,
        lastSolvedDate:
          typeof parsed.stats?.lastSolvedDate === 'string'
            ? parsed.stats.lastSolvedDate
            : '',
        totalSolved,
        poxBalance,
      },
      completions: parsed.completions || {},
      purchasedPuzzles: Array.isArray(parsed.purchasedPuzzles)
        ? parsed.purchasedPuzzles
        : [],
    };
  } catch {
    return { stats: DEFAULT_STATS, completions: {}, purchasedPuzzles: [] };
  }
}

function writeLocalState(next: LocalStoreShape): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
}

function effectiveCurrentStreak(stats: StreakStats, todayKey: string): number {
  if (!stats.lastSolvedDate) return 0;
  if (stats.lastSolvedDate === todayKey) return stats.currentStreak;
  if (stats.lastSolvedDate === getYesterdayDateKey(todayKey)) {
    return stats.currentStreak;
  }
  return 0;
}

interface GameStoreContextValue {
  user: User | null;
  authReady: boolean;
  todayDateKey: string;
  secondsUntilMidnight: number;
  stats: StreakStats;
  displayStreak: number;
  completions: Record<string, CompletionRecord>;
  purchasedPuzzles: PurchasedPuzzleRecord[];
  leaderboard: LeaderboardEntry[];
  leaderboardLoading: boolean;
  authError: string | null;
  muted: boolean;
  setMuted: (val: boolean) => void;
  difficulty: Difficulty;
  setDifficulty: (val: Difficulty) => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  completePuzzle: (
    puzzleType: PuzzleType,
    timeSeconds: number,
    mistakes: number,
    difficulty?: Difficulty
  ) => Promise<void>;
  getTodayCompletion: (puzzleType: PuzzleType) => CompletionRecord | null;
  buyPuzzles: (items: PurchaseDraftItem[]) => Promise<PurchasedPuzzleRecord[]>;
  completePurchasedPuzzle: (
    puzzleId: string,
    timeSeconds: number
  ) => Promise<{ awardedPox: number }>;
}

const GameStoreContext = createContext<GameStoreContextValue | null>(null);

export function GameStoreProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [todayDateKey, setTodayDateKey] = useState(() => getTodayDateKey());
  const [secondsUntilMidnight, setSecondsUntilMidnight] = useState(() =>
    getSecondsUntilLocalMidnight()
  );
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('folio_games_muted') === '1';
    } catch {
      return false;
    }
  });

  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    try {
      const saved = localStorage.getItem('folio_games_difficulty');
      if (saved === 'easy' || saved === 'medium' || saved === 'hard') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'medium';
  });

  const [localState, setLocalState] = useState<LocalStoreShape>(() =>
    readLocalState()
  );
  const [remoteStats, setRemoteStats] = useState<StreakStats | null>(null);
  const [remoteCompletions, setRemoteCompletions] = useState<
    Record<string, CompletionRecord>
  >({});
  const [remotePurchased, setRemotePurchased] = useState<
    PurchasedPuzzleRecord[]
  >([]);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  // Midnight countdown & date rollover tick
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = new Date();
      const nextKey = getTodayDateKey(now);
      setTodayDateKey((prev) => (prev !== nextKey ? nextKey : prev));
      setSecondsUntilMidnight(getSecondsUntilLocalMidnight(now));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('folio_games_muted', muted ? '1' : '0');
    } catch {
      // ignore
    }
  }, [muted]);

  useEffect(() => {
    try {
      localStorage.setItem('folio_games_difficulty', difficulty);
    } catch {
      // ignore
    }
  }, [difficulty]);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Ensure user profile doc exists on sign-in & sync any local completions
  useEffect(() => {
    if (!authReady || !user) {
      setRemoteStats(null);
      setRemoteCompletions({});
      setRemotePurchased([]);
      return;
    }

    let cancelled = false;
    const userRef = doc(db, 'users', user.uid);

    const ensureProfileAndSync = async () => {
      let profileExists = false;

      try {
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          profileExists = true;
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      }

      if (cancelled) return;

      const playerName = sanitizeDisplayName(user.displayName);

      if (!profileExists) {
        const guestLocal = readLocalState();
        try {
          await setDoc(userRef, {
            userId: user.uid,
            displayName: playerName,
            currentStreak: guestLocal.stats.currentStreak,
            bestStreak: guestLocal.stats.bestStreak,
            lastSolvedDate: guestLocal.stats.lastSolvedDate,
            totalSolved: guestLocal.stats.totalSolved,
            poxBalance: Math.min(1000000, Math.max(0, guestLocal.stats.poxBalance)),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
        }
      }

      if (cancelled) return;

      // Sync any local completions for today that aren't in Firestore yet
      const guestLocal = readLocalState();
      const todayTypes: PuzzleType[] = ['sudoku', 'crossword', 'wordsearch'];
      for (const pt of todayTypes) {
        const key = `${todayDateKey}_${pt}`;
        const localComp = guestLocal.completions[key];
        if (!localComp || !localComp.completed) continue;

        const compRef = doc(db, 'users', user.uid, 'dailyCompletions', key);
        try {
          const compSnap = await getDoc(compRef);
          if (!compSnap.exists()) {
            const safeTime = Math.min(
              86400,
              Math.max(1, Math.round(localComp.timeSeconds))
            );
            const safeMistakes = Math.min(
              1000,
              Math.max(0, Math.round(localComp.mistakes))
            );
            const entryId = `${todayDateKey}_${pt}_${user.uid}`;
            const entryRef = doc(db, 'leaderboardEntries', entryId);

            const batch = writeBatch(db);
            batch.set(compRef, {
              userId: user.uid,
              dateKey: todayDateKey,
              puzzleType: pt,
              difficulty: localComp.difficulty || 'medium',
              timeSeconds: safeTime,
              mistakes: safeMistakes,
              completed: true,
              createdAt: serverTimestamp(),
            });
            batch.set(entryRef, {
              userId: user.uid,
              playerName,
              dateKey: todayDateKey,
              puzzleType: pt,
              difficulty: localComp.difficulty || 'medium',
              timeSeconds: safeTime,
              createdAt: serverTimestamp(),
            });
            await batch.commit();
          }
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.WRITE,
            `users/${user.uid}/dailyCompletions/${key}`
          );
        }
      }

      if (cancelled) return;

      // Sync any guest purchased puzzles not yet in Firestore
      for (const puz of guestLocal.purchasedPuzzles) {
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(puz.id)) continue;
        const puzRef = doc(db, 'users', user.uid, 'purchasedPuzzles', puz.id);
        try {
          const puzSnap = await getDoc(puzRef);
          if (!puzSnap.exists()) {
            await setDoc(puzRef, {
              id: puz.id,
              userId: user.uid,
              puzzleType: puz.puzzleType,
              difficulty: puz.difficulty,
              title: puz.title.slice(0, 60) || 'Custom Puzzle',
              seedKey: puz.seedKey.slice(0, 80),
              themeIndex: Math.min(100, Math.max(0, Math.floor(puz.themeIndex))),
              customTheme: (puz.customTheme || '').slice(0, 40),
              customWords: sanitizePurchasedWords(puz.customWords),
              costPox: POX_PER_PUZZLE,
              solved: Boolean(puz.solved),
              bestTimeSeconds: Math.min(
                86400,
                Math.max(0, Math.round(puz.bestTimeSeconds || 0))
              ),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.WRITE,
            `users/${user.uid}/purchasedPuzzles/${puz.id}`
          );
        }
      }
    };

    void ensureProfileAndSync();

    const unsubProfile = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        const totalSolved = Number(d.totalSolved) || 0;
        const poxBalance =
          typeof d.poxBalance === 'number'
            ? Math.max(0, Math.floor(d.poxBalance))
            : 0;
        setRemoteStats({
          currentStreak: Number(d.currentStreak) || 0,
          bestStreak: Number(d.bestStreak) || 0,
          lastSolvedDate:
            typeof d.lastSolvedDate === 'string' ? d.lastSolvedDate : '',
          totalSolved,
          poxBalance,
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      }
    );

    const completionsQuery = query(
      collection(db, 'users', user.uid, 'dailyCompletions'),
      where('userId', '==', user.uid)
    );

    const unsubCompletions = onSnapshot(
      completionsQuery,
      (snap) => {
        const next: Record<string, CompletionRecord> = {};
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          next[docSnap.id] = {
            dateKey: String(d.dateKey),
            puzzleType: d.puzzleType as PuzzleType,
            difficulty:
              d.difficulty === 'easy' ||
              d.difficulty === 'medium' ||
              d.difficulty === 'hard'
                ? d.difficulty
                : undefined,
            timeSeconds: Number(d.timeSeconds) || 0,
            mistakes: Number(d.mistakes) || 0,
            completed: Boolean(d.completed),
          };
        });
        setRemoteCompletions(next);
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.LIST,
          `users/${user.uid}/dailyCompletions`
        );
      }
    );

    const purchasedQuery = query(
      collection(db, 'users', user.uid, 'purchasedPuzzles'),
      where('userId', '==', user.uid)
    );

    const unsubPurchased = onSnapshot(
      purchasedQuery,
      (snap) => {
        const list: PurchasedPuzzleRecord[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          const createdMillis =
            d.createdAt && typeof d.createdAt.toMillis === 'function'
              ? d.createdAt.toMillis()
              : Date.now();
          list.push({
            id: String(d.id || docSnap.id),
            puzzleType: d.puzzleType as PuzzleType,
            difficulty:
              d.difficulty === 'easy' ||
              d.difficulty === 'medium' ||
              d.difficulty === 'hard'
                ? d.difficulty
                : 'medium',
            title: String(d.title || 'Custom Puzzle'),
            seedKey: String(d.seedKey || docSnap.id),
            themeIndex: Number(d.themeIndex) || 0,
            customTheme: String(d.customTheme || ''),
            customWords: Array.isArray(d.customWords)
              ? d.customWords.map(String)
              : [],
            costPox: Number(d.costPox) || POX_PER_PUZZLE,
            solved: Boolean(d.solved),
            bestTimeSeconds: Number(d.bestTimeSeconds) || 0,
            createdAtMs: createdMillis,
          });
        });
        list.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setRemotePurchased(list);
      },
      (error) => {
        handleFirestoreError(
          error,
          OperationType.LIST,
          `users/${user.uid}/purchasedPuzzles`
        );
      }
    );

    return () => {
      cancelled = true;
      unsubProfile();
      unsubCompletions();
      unsubPurchased();
    };
  }, [authReady, user, todayDateKey]);

  // Public daily leaderboard listener for today's dateKey
  useEffect(() => {
    setLeaderboardLoading(true);
    const lbQuery = query(
      collection(db, 'leaderboardEntries'),
      where('dateKey', '==', todayDateKey)
    );

    const unsub = onSnapshot(
      lbQuery,
      (snap) => {
        const entries: LeaderboardEntry[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          entries.push({
            id: docSnap.id,
            userId: String(d.userId),
            playerName: String(d.playerName),
            dateKey: String(d.dateKey),
            puzzleType: d.puzzleType as PuzzleType,
            difficulty:
              d.difficulty === 'easy' ||
              d.difficulty === 'medium' ||
              d.difficulty === 'hard'
                ? d.difficulty
                : undefined,
            timeSeconds: Number(d.timeSeconds) || 0,
          });
        });
        entries.sort((a, b) => a.timeSeconds - b.timeSeconds);
        setLeaderboard(entries);
        setLeaderboardLoading(false);
      },
      (error) => {
        setLeaderboardLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'leaderboardEntries');
      }
    );

    return () => unsub();
  }, [todayDateKey]);

  const signIn = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to sign in right now.';
      setAuthError(msg);
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthError(null);
    await firebaseSignOut(auth);
  }, []);

  const activeStats = user && remoteStats ? remoteStats : localState.stats;
  const activeCompletions = useMemo(() => {
    if (user) {
      return { ...localState.completions, ...remoteCompletions };
    }
    return localState.completions;
  }, [user, localState.completions, remoteCompletions]);

  const activePurchased = useMemo(() => {
    if (user) {
      const map = new Map<string, PurchasedPuzzleRecord>();
      for (const p of localState.purchasedPuzzles) {
        map.set(p.id, p);
      }
      for (const p of remotePurchased) {
        map.set(p.id, p);
      }
      return Array.from(map.values()).sort(
        (a, b) => b.createdAtMs - a.createdAtMs
      );
    }
    return [...localState.purchasedPuzzles].sort(
      (a, b) => b.createdAtMs - a.createdAtMs
    );
  }, [user, localState.purchasedPuzzles, remotePurchased]);

  const getTodayCompletion = useCallback(
    (puzzleType: PuzzleType): CompletionRecord | null => {
      const key = `${todayDateKey}_${puzzleType}`;
      const rec = activeCompletions[key];
      return rec && rec.completed ? rec : null;
    },
    [activeCompletions, todayDateKey]
  );

  const completePuzzle = useCallback(
    async (
      puzzleType: PuzzleType,
      timeSeconds: number,
      mistakes: number,
      puzzleDifficulty: Difficulty = difficulty
    ) => {
      const key = `${todayDateKey}_${puzzleType}`;
      if (activeCompletions[key]?.completed) {
        // Strict limit: one play per puzzle per calendar day
        return;
      }

      const safeTime = Math.min(86400, Math.max(1, Math.round(timeSeconds)));
      const safeMistakes = Math.min(1000, Math.max(0, Math.round(mistakes)));

      const prevStats = activeStats;
      const yesterdayKey = getYesterdayDateKey(todayDateKey);
      let nextCurrentStreak = 1;
      if (prevStats.lastSolvedDate === todayDateKey) {
        nextCurrentStreak = Math.max(1, prevStats.currentStreak);
      } else if (prevStats.lastSolvedDate === yesterdayKey) {
        nextCurrentStreak = prevStats.currentStreak + 1;
      }
      const nextBestStreak = Math.max(prevStats.bestStreak, nextCurrentStreak);
      const nextTotalSolved = prevStats.totalSolved + 1;
      const nextPoxBalance = Math.min(
        1000000,
        prevStats.poxBalance + POX_PER_SOLVE
      );

      const nextStats: StreakStats = {
        currentStreak: nextCurrentStreak,
        bestStreak: nextBestStreak,
        lastSolvedDate: todayDateKey,
        totalSolved: nextTotalSolved,
        poxBalance: nextPoxBalance,
      };

      const record: CompletionRecord = {
        dateKey: todayDateKey,
        puzzleType,
        difficulty: puzzleDifficulty,
        timeSeconds: safeTime,
        mistakes: safeMistakes,
        completed: true,
      };

      // Always mirror locally
      const nextLocal: LocalStoreShape = {
        stats: nextStats,
        completions: {
          ...localState.completions,
          [key]: record,
        },
        purchasedPuzzles: localState.purchasedPuzzles,
      };
      setLocalState(nextLocal);
      writeLocalState(nextLocal);

      // Persist to Firestore if authenticated
      if (user) {
        const playerName = sanitizeDisplayName(user.displayName);
        const userRef = doc(db, 'users', user.uid);
        const compRef = doc(db, 'users', user.uid, 'dailyCompletions', key);
        const entryId = `${todayDateKey}_${puzzleType}_${user.uid}`;
        const entryRef = doc(db, 'leaderboardEntries', entryId);

        try {
          const userSnap = await getDoc(userRef);
          const batch = writeBatch(db);
          if (!userSnap.exists()) {
            batch.set(userRef, {
              userId: user.uid,
              displayName: playerName,
              currentStreak: nextStats.currentStreak,
              bestStreak: nextStats.bestStreak,
              lastSolvedDate: nextStats.lastSolvedDate,
              totalSolved: nextStats.totalSolved,
              poxBalance: nextStats.poxBalance,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            batch.update(userRef, {
              displayName: playerName,
              currentStreak: nextStats.currentStreak,
              bestStreak: nextStats.bestStreak,
              lastSolvedDate: nextStats.lastSolvedDate,
              totalSolved: nextStats.totalSolved,
              poxBalance: nextStats.poxBalance,
              updatedAt: serverTimestamp(),
            });
          }

          batch.set(compRef, {
            userId: user.uid,
            dateKey: todayDateKey,
            puzzleType,
            difficulty: puzzleDifficulty,
            timeSeconds: safeTime,
            mistakes: safeMistakes,
            completed: true,
            createdAt: serverTimestamp(),
          });

          batch.set(entryRef, {
            userId: user.uid,
            playerName,
            dateKey: todayDateKey,
            puzzleType,
            difficulty: puzzleDifficulty,
            timeSeconds: safeTime,
            createdAt: serverTimestamp(),
          });

          await batch.commit();
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.WRITE,
            `users/${user.uid}/dailyCompletions/${key}`
          );
        }
      }
    },
    [
      activeCompletions,
      activeStats,
      difficulty,
      localState.completions,
      localState.purchasedPuzzles,
      todayDateKey,
      user,
    ]
  );

  const buyPuzzles = useCallback(
    async (items: PurchaseDraftItem[]): Promise<PurchasedPuzzleRecord[]> => {
      if (items.length === 0) return [];
      const totalCost = items.length * POX_PER_PUZZLE;
      if (activeStats.poxBalance < totalCost) {
        throw new Error(
          `Not enough pox. You need ${totalCost} pox to unlock ${items.length} ${items.length === 1 ? 'puzzle' : 'puzzles'}.`
        );
      }

      const nowMs = Date.now();
      const created: PurchasedPuzzleRecord[] = items.map((item, idx) => {
        const rand = Math.random().toString(36).slice(2, 7);
        const id = `puz_${nowMs}_${idx}_${rand}`;
        return {
          id,
          puzzleType: item.puzzleType,
          difficulty: item.difficulty,
          title: (item.title || 'Custom Puzzle').trim().slice(0, 60) || 'Custom Puzzle',
          seedKey: id,
          themeIndex: Math.min(100, Math.max(0, Math.floor(item.themeIndex))),
          customTheme: (item.customTheme || '').trim().slice(0, 40),
          customWords: sanitizePurchasedWords(item.customWords),
          costPox: POX_PER_PUZZLE,
          solved: false,
          bestTimeSeconds: 0,
          createdAtMs: nowMs + idx,
        };
      });

      const nextBalance = activeStats.poxBalance - totalCost;
      const nextStats: StreakStats = {
        ...activeStats,
        poxBalance: nextBalance,
      };

      const nextLocal: LocalStoreShape = {
        stats: nextStats,
        completions: localState.completions,
        purchasedPuzzles: [...created, ...localState.purchasedPuzzles],
      };
      setLocalState(nextLocal);
      writeLocalState(nextLocal);

      if (user) {
        const playerName = sanitizeDisplayName(user.displayName);
        const userRef = doc(db, 'users', user.uid);
        try {
          const userSnap = await getDoc(userRef);
          const batch = writeBatch(db);
          if (!userSnap.exists()) {
            batch.set(userRef, {
              userId: user.uid,
              displayName: playerName,
              currentStreak: nextStats.currentStreak,
              bestStreak: nextStats.bestStreak,
              lastSolvedDate: nextStats.lastSolvedDate,
              totalSolved: nextStats.totalSolved,
              poxBalance: nextBalance,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            batch.update(userRef, {
              poxBalance: nextBalance,
              updatedAt: serverTimestamp(),
            });
          }

          for (const puz of created) {
            const puzRef = doc(
              db,
              'users',
              user.uid,
              'purchasedPuzzles',
              puz.id
            );
            batch.set(puzRef, {
              id: puz.id,
              userId: user.uid,
              puzzleType: puz.puzzleType,
              difficulty: puz.difficulty,
              title: puz.title,
              seedKey: puz.seedKey,
              themeIndex: puz.themeIndex,
              customTheme: puz.customTheme,
              customWords: puz.customWords,
              costPox: POX_PER_PUZZLE,
              solved: false,
              bestTimeSeconds: 0,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }

          await batch.commit();
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.WRITE,
            `users/${user.uid}/purchasedPuzzles`
          );
        }
      }

      return created;
    },
    [activeStats, localState.completions, localState.purchasedPuzzles, user]
  );

  const completePurchasedPuzzle = useCallback(
    async (
      puzzleId: string,
      timeSeconds: number
    ): Promise<{ awardedPox: number }> => {
      const target = activePurchased.find((p) => p.id === puzzleId);
      if (!target) return { awardedPox: 0 };

      const safeTime = Math.min(86400, Math.max(1, Math.round(timeSeconds)));
      const firstSolve = !target.solved;
      const awardedPox = firstSolve ? POX_PER_SOLVE : 0;

      const nextBestTime =
        target.bestTimeSeconds > 0
          ? Math.min(target.bestTimeSeconds, safeTime)
          : safeTime;

      const nextStats: StreakStats = {
        ...activeStats,
        totalSolved: firstSolve
          ? activeStats.totalSolved + 1
          : activeStats.totalSolved,
        poxBalance: Math.min(1000000, activeStats.poxBalance + awardedPox),
      };

      const updatedList = localState.purchasedPuzzles.some(
        (p) => p.id === puzzleId
      )
        ? localState.purchasedPuzzles.map((p) =>
            p.id === puzzleId
              ? { ...p, solved: true, bestTimeSeconds: nextBestTime }
              : p
          )
        : [
            { ...target, solved: true, bestTimeSeconds: nextBestTime },
            ...localState.purchasedPuzzles,
          ];

      const nextLocal: LocalStoreShape = {
        stats: nextStats,
        completions: localState.completions,
        purchasedPuzzles: updatedList,
      };
      setLocalState(nextLocal);
      writeLocalState(nextLocal);

      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const puzRef = doc(db, 'users', user.uid, 'purchasedPuzzles', puzzleId);
        try {
          const batch = writeBatch(db);
          if (firstSolve) {
            batch.update(userRef, {
              totalSolved: nextStats.totalSolved,
              poxBalance: nextStats.poxBalance,
              updatedAt: serverTimestamp(),
            });
          }
          batch.update(puzRef, {
            solved: true,
            bestTimeSeconds: nextBestTime,
            updatedAt: serverTimestamp(),
          });
          await batch.commit();
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.UPDATE,
            `users/${user.uid}/purchasedPuzzles/${puzzleId}`
          );
        }
      }

      return { awardedPox };
    },
    [
      activePurchased,
      activeStats,
      localState.completions,
      localState.purchasedPuzzles,
      user,
    ]
  );

  const displayStreak = useMemo(
    () => effectiveCurrentStreak(activeStats, todayDateKey),
    [activeStats, todayDateKey]
  );

  const value: GameStoreContextValue = {
    user,
    authReady,
    todayDateKey,
    secondsUntilMidnight,
    stats: activeStats,
    displayStreak,
    completions: activeCompletions,
    purchasedPuzzles: activePurchased,
    leaderboard,
    leaderboardLoading,
    authError,
    muted,
    setMuted,
    difficulty,
    setDifficulty,
    signIn,
    signOut,
    completePuzzle,
    getTodayCompletion,
    buyPuzzles,
    completePurchasedPuzzle,
  };

  return (
    <GameStoreContext.Provider value={value}>
      {children}
    </GameStoreContext.Provider>
  );
}

export function useGameStore(): GameStoreContextValue {
  const ctx = useContext(GameStoreContext);
  if (!ctx) {
    throw new Error('useGameStore must be used inside GameStoreProvider');
  }
  return ctx;
}
