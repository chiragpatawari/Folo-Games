import { Difficulty, createSeededRng, hashString, shuffleSeeded } from '@/src/lib/dailyUtils';

export interface WordPlacement {
  word: string;
  cells: Array<[number, number]>;
}

export interface DailyWordSearch {
  dateKey: string;
  difficulty: Difficulty;
  gridSize: number;
  puzzleNumber: number;
  theme: string;
  grid: string[][];
  words: string[];
  placements: WordPlacement[];
}

interface WordTheme {
  theme: string;
  words: string[];
}

const THEMES: WordTheme[] = [
  {
    theme: 'Astronomy',
    words: ['QUASAR', 'NEBULA', 'COMET', 'ORBIT', 'PULSAR', 'ECLIPSE', 'ZENITH', 'LUNAR', 'SOLSTICE', 'AURORA'],
  },
  {
    theme: 'Architecture',
    words: ['ARCHWAY', 'COLUMN', 'FACADE', 'CORNICE', 'ATRIUM', 'VAULT', 'GABLE', 'PLINTH', 'PORTICO', 'CUPOLA'],
  },
  {
    theme: 'Botany',
    words: ['STAMEN', 'PETAL', 'XYLEM', 'CANOPY', 'SPORE', 'TENDRIL', 'BLOSSOM', 'ROOTS', 'NECTAR', 'POLLEN'],
  },
  {
    theme: 'Culinary Arts',
    words: ['BRAISE', 'SIMMER', 'WHISK', 'REDUCE', 'SAUTE', 'CRUMB', 'GLAZE', 'ZEST', 'POACH', 'SEAR'],
  },
  {
    theme: 'Oceanography',
    words: ['TRENCH', 'CORAL', 'ESTUARY', 'CURRENT', 'ATOLL', 'TIDAL', 'KELP', 'ABYSS', 'LAGOON', 'PELAGIC'],
  },
  {
    theme: 'Typography',
    words: ['SERIF', 'KERNING', 'GLYPH', 'ITALIC', 'FOLIO', 'MARGIN', 'ASCENT', 'LEAD', 'LIGATURE', 'PICA'],
  },
  {
    theme: 'Music Theory',
    words: ['CADENCE', 'CHORD', 'OCTAVE', 'TEMPO', 'LEGATO', 'SONATA', 'PITCH', 'TREBLE', 'HARMONY', 'STACCATO'],
  },
  {
    theme: 'Geology',
    words: ['BASALT', 'QUARTZ', 'STRATA', 'FOSSIL', 'MAGMA', 'SHALE', 'FAULT', 'GEODE', 'GRANITE', 'MINERAL'],
  },
  {
    theme: 'Cartography',
    words: ['COMPASS', 'LATITUDE', 'ATLAS', 'LEGEND', 'MERIDIAN', 'SCALE', 'CONTOUR', 'GLOBE', 'AZIMUTH', 'ISLAND'],
  },
  {
    theme: 'Cinema',
    words: ['MONTAGE', 'FRAME', 'SCRIPT', 'LENS', 'DOLLY', 'REEL', 'FADE', 'SCENE', 'STUDIO', 'SPLICE'],
  },
];

const EASY_DIRECTIONS: Array<[number, number]> = [
  [0, 1], // right
  [1, 0], // down
];

const ALL_DIRECTIONS: Array<[number, number]> = [
  [0, 1],   // right
  [1, 0],   // down
  [1, 1],   // down-right
  [-1, 1],  // up-right
  [0, -1],  // left
  [-1, 0],  // up
  [-1, -1], // up-left
  [1, -1],  // down-left
];

const DIFFICULTY_CONFIG: Record<
  Difficulty,
  { size: number; wordCount: number; directions: Array<[number, number]> }
> = {
  easy: { size: 8, wordCount: 6, directions: EASY_DIRECTIONS },
  medium: { size: 10, wordCount: 8, directions: ALL_DIRECTIONS },
  hard: { size: 12, wordCount: 10, directions: ALL_DIRECTIONS },
};

function computePuzzleNumber(dateKey: string): number {
  const epoch = new Date(2026, 0, 1).getTime();
  const [y, m, d] = dateKey.split('-').map(Number);
  const target = new Date(y, m - 1, d).getTime();
  return Math.max(1, Math.floor((target - epoch) / 86400000) + 1);
}

export function generateDailyWordSearch(
  dateKey: string,
  difficulty: Difficulty = 'medium'
): DailyWordSearch {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const size = cfg.size;
  const themeObj = THEMES[hashString(`ws_theme_${dateKey}`) % THEMES.length];
  const rng = createSeededRng(`wordsearch_${dateKey}_${difficulty}`);

  const candidateWords = themeObj.words
    .filter((w) => w.length <= size)
    .slice(0, cfg.wordCount);
  const sortedWords = [...candidateWords].sort((a, b) => b.length - a.length);

  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(''));
  const placements: WordPlacement[] = [];

  for (const word of sortedWords) {
    let placed = false;
    const dirs = shuffleSeeded(cfg.directions, rng);

    for (let attempt = 0; attempt < 250 && !placed; attempt++) {
      const [dr, dc] = dirs[attempt % dirs.length];
      const startR = Math.floor(rng() * size);
      const startC = Math.floor(rng() * size);

      const endR = startR + dr * (word.length - 1);
      const endC = startC + dc * (word.length - 1);

      if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;

      let canPlace = true;
      const cells: Array<[number, number]> = [];
      for (let i = 0; i < word.length; i++) {
        const r = startR + dr * i;
        const c = startC + dc * i;
        const existing = grid[r][c];
        if (existing !== '' && existing !== word[i]) {
          canPlace = false;
          break;
        }
        cells.push([r, c]);
      }

      if (canPlace) {
        for (let i = 0; i < word.length; i++) {
          const [r, c] = cells[i];
          grid[r][c] = word[i];
        }
        placements.push({ word, cells });
        placed = true;
      }
    }

    if (!placed) {
      outer: for (const [dr, dc] of dirs) {
        for (let startR = 0; startR < size; startR++) {
          for (let startC = 0; startC < size; startC++) {
            const endR = startR + dr * (word.length - 1);
            const endC = startC + dc * (word.length - 1);
            if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;

            let canPlace = true;
            const cells: Array<[number, number]> = [];
            for (let i = 0; i < word.length; i++) {
              const r = startR + dr * i;
              const c = startC + dc * i;
              if (grid[r][c] !== '' && grid[r][c] !== word[i]) {
                canPlace = false;
                break;
              }
              cells.push([r, c]);
            }
            if (canPlace) {
              for (let i = 0; i < word.length; i++) {
                const [r, c] = cells[i];
                grid[r][c] = word[i];
              }
              placements.push({ word, cells });
              placed = true;
              break outer;
            }
          }
        }
      }
    }
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === '') {
        grid[r][c] = alphabet[Math.floor(rng() * alphabet.length)];
      }
    }
  }

  return {
    dateKey,
    difficulty,
    gridSize: size,
    puzzleNumber: computePuzzleNumber(dateKey),
    theme: themeObj.theme,
    grid,
    words: placements.map((p) => p.word),
    placements,
  };
}

export const WORD_SEARCH_THEMES = THEMES.map((t, index) => ({
  index,
  theme: t.theme,
  words: t.words,
}));

export function generateCustomWordSearch(
  seedKey: string,
  options: {
    difficulty?: Difficulty;
    themeIndex?: number;
    customTheme?: string;
    customWords?: string[];
    puzzleNumber?: number;
  }
): DailyWordSearch {
  const difficulty = options.difficulty || 'medium';
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const size = cfg.size;
  const safeThemeIdx = Math.abs(Math.floor(options.themeIndex || 0)) % THEMES.length;
  const baseTheme = THEMES[safeThemeIdx];
  const rng = createSeededRng(`custom_ws_${seedKey}_${difficulty}`);

  const cleanedCustom = (options.customWords || [])
    .map((w) => w.toUpperCase().replace(/[^A-Z]/g, ''))
    .filter((w) => w.length >= 3 && w.length <= size);

  const uniqueWords: string[] = [];
  for (const w of cleanedCustom) {
    if (!uniqueWords.includes(w)) uniqueWords.push(w);
  }

  const candidateWords =
    uniqueWords.length >= 3
      ? uniqueWords.slice(0, cfg.wordCount)
      : baseTheme.words.filter((w) => w.length <= size).slice(0, cfg.wordCount);

  const sortedWords = [...candidateWords].sort((a, b) => b.length - a.length);
  const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(''));
  const placements: WordPlacement[] = [];

  for (const word of sortedWords) {
    let placed = false;
    const dirs = shuffleSeeded(cfg.directions, rng);

    for (let attempt = 0; attempt < 250 && !placed; attempt++) {
      const [dr, dc] = dirs[attempt % dirs.length];
      const startR = Math.floor(rng() * size);
      const startC = Math.floor(rng() * size);

      const endR = startR + dr * (word.length - 1);
      const endC = startC + dc * (word.length - 1);

      if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;

      let canPlace = true;
      const cells: Array<[number, number]> = [];
      for (let i = 0; i < word.length; i++) {
        const r = startR + dr * i;
        const c = startC + dc * i;
        const existing = grid[r][c];
        if (existing !== '' && existing !== word[i]) {
          canPlace = false;
          break;
        }
        cells.push([r, c]);
      }

      if (canPlace) {
        for (let i = 0; i < word.length; i++) {
          const [r, c] = cells[i];
          grid[r][c] = word[i];
        }
        placements.push({ word, cells });
        placed = true;
      }
    }

    if (!placed) {
      outer: for (const [dr, dc] of dirs) {
        for (let startR = 0; startR < size; startR++) {
          for (let startC = 0; startC < size; startC++) {
            const endR = startR + dr * (word.length - 1);
            const endC = startC + dc * (word.length - 1);
            if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;

            let canPlace = true;
            const cells: Array<[number, number]> = [];
            for (let i = 0; i < word.length; i++) {
              const r = startR + dr * i;
              const c = startC + dc * i;
              if (grid[r][c] !== '' && grid[r][c] !== word[i]) {
                canPlace = false;
                break;
              }
              cells.push([r, c]);
            }
            if (canPlace) {
              for (let i = 0; i < word.length; i++) {
                const [r, c] = cells[i];
                grid[r][c] = word[i];
              }
              placements.push({ word, cells });
              placed = true;
              break outer;
            }
          }
        }
      }
    }
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === '') {
        grid[r][c] = alphabet[Math.floor(rng() * alphabet.length)];
      }
    }
  }

  return {
    dateKey: seedKey,
    difficulty,
    gridSize: size,
    puzzleNumber: options.puzzleNumber ?? 1,
    theme: (options.customTheme || '').trim() || baseTheme.theme,
    grid,
    words: placements.map((p) => p.word),
    placements,
  };
}
