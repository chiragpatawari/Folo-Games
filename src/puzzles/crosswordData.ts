import { Difficulty, createSeededRng, hashString, shuffleSeeded } from '@/src/lib/dailyUtils';

export interface CrosswordClue {
  number: number;
  direction: 'across' | 'down';
  clue: string;
  answer: string;
  row: number;
  col: number;
  length: number;
}

export interface DailyCrossword {
  dateKey: string;
  difficulty: Difficulty;
  puzzleNumber: number;
  title: string;
  rows: string[]; // 5 strings of length 5, '#' for black square
  prefilledCells: Record<string, string>; // "r-c" -> starter letter (used in easy mode)
  acrossClues: CrosswordClue[];
  downClues: CrosswordClue[];
  cellNumbers: number[][]; // 0 if unnumbered
}

interface RawCrossword {
  title: string;
  rows: string[];
  across: Record<string, string>;
  down: Record<string, string>;
  hardAcross: Record<string, string>;
  hardDown: Record<string, string>;
}

const RAW_CROSSWORDS: RawCrossword[] = [
  {
    title: 'Gallery Opening',
    rows: ['##AIM', 'SAUCE', 'ELDER', 'ASIDE', 'TOO##'],
    across: {
      AIM: 'Point a camera or dart',
      SAUCE: 'Marinara or hollandaise',
      ELDER: 'Senior village council member',
      ASIDE: 'Stage remark to the audience',
      TOO: 'As well',
    },
    down: {
      SEAT: 'Reserved spot at the theater',
      ALSO: 'In addition',
      AUDIO: 'Podcast sound track',
      ICED: 'Chilled, as summer coffee',
      MERE: 'No more than',
    },
    hardAcross: {
      AIM: 'Archer’s focus before release',
      SAUCE: 'Simmered accompaniment in a reduction pan',
      ELDER: 'Older figure—or a blossom-bearing shrub',
      ASIDE: 'Line whispered past the fourth wall',
      TOO: 'Excessively',
    },
    hardDown: {
      SEAT: 'Chair in an amphitheater',
      ALSO: 'Word linking two afterthoughts',
      AUDIO: 'Half of an AV setup',
      ICED: 'Finished with fondant, or cooled over cubes',
      MERE: 'Slightest, as a formality',
    },
  },
  {
    title: 'Print Shop',
    rows: ['##DON', 'PRIME', 'EAGER', 'GRIND', 'SET##'],
    across: {
      DON: 'Put on, as a winter coat',
      PRIME: 'Number like 2, 3, 5, or 7',
      EAGER: 'Enthusiastically ready',
      GRIND: 'Crush coffee beans finely',
      SET: 'Group of tennis games',
    },
    down: {
      PEGS: 'Cribbage board markers',
      RARE: 'Hard to come by',
      DIGIT: 'Single numeral from 0 to 9',
      OMEN: 'Sign of things to come',
      NERD: 'Trivia night enthusiast',
    },
    hardAcross: {
      DON: 'Oxford fellow, or slip into',
      PRIME: 'Indivisible except by one and itself',
      EAGER: 'Leaning forward at the starting line',
      GRIND: 'Daily routine—or millwork for espresso',
      SET: 'Hardened, as mortar',
    },
    hardDown: {
      PEGS: 'Tent fasteners driven into turf',
      RARE: 'Scarce on the collector’s market',
      DIGIT: 'Finger, or a single base-10 symbol',
      OMEN: 'Portent in classical drama',
      NERD: 'Devoted specialist in obscure lore',
    },
  },
  {
    title: 'Coastal Tide',
    rows: ['##RIG', 'TWICE', 'HAVEN', 'ERASE', 'EEL##'],
    across: {
      RIG: 'Offshore drilling platform',
      TWICE: 'On two separate occasions',
      HAVEN: 'Safe harbor',
      ERASE: 'Wipe clean from a whiteboard',
      EEL: 'Ribbonlike reef swimmer',
    },
    down: {
      THEE: 'Archaic "you"',
      WARE: 'Pottery or hardware suffix',
      RIVAL: 'Friendly competitor',
      ICES: 'Frosts a birthday cake',
      GENE: 'Unit of heredity',
    },
    hardAcross: {
      RIG: 'Outfit a schooner with masts and lines',
      TWICE: 'Once more after the first time',
      HAVEN: 'Sheltered inlet out of the gale',
      ERASE: 'Strike from the slate',
      EEL: 'Sinuous nocturnal reef dweller',
    },
    hardDown: {
      THEE: 'Quaker-era objective pronoun',
      WARE: 'Merchandise ending with soft- or stone-',
      RIVAL: 'Contender across the net',
      ICES: 'Glazes a patisserie crown',
      GENE: 'Double-helix segment',
    },
  },
  {
    title: 'Morning Diner',
    rows: ['##TOP', 'CRANE', 'HASTE', 'ACTOR', 'TEE##'],
    across: {
      TOP: 'Spinning wooden toy',
      CRANE: 'Origami bird or tall construction boom',
      HASTE: 'Speed that proverbially makes waste',
      ACTOR: 'Performer on stage or screen',
      TEE: 'Golfer’s wooden peg',
    },
    down: {
      CHAT: 'Casual back-and-forth talk',
      RACE: 'Sprint to the finish tape',
      TASTE: 'Culinary discernment',
      ONTO: 'Aware of the trick',
      PEER: 'Colleague of equal standing',
    },
    hardAcross: {
      TOP: 'Apex—or a gyroscopic toy',
      CRANE: 'Stretch one’s neck, like a wading bird',
      HASTE: 'Frenzy that undoes careful craft',
      ACTOR: 'One taking cues under stage lights',
      TEE: 'First-hole launch perch',
    },
    hardDown: {
      CHAT: 'Parlor exchange without an agenda',
      RACE: 'Time trial from gun to tape',
      TASTE: 'One of five senses—or aesthetic judgment',
      ONTO: 'Not fooled by',
      PEER: 'Gaze intently, or a jury member',
    },
  },
  {
    title: 'Backstage Notes',
    rows: ['##WIT', 'STORY', 'ARMOR', 'PIANO', 'SON##'],
    across: {
      WIT: 'Quick verbal cleverness',
      STORY: 'Newspaper feature or tall tale',
      ARMOR: 'Knight’s protective plates',
      PIANO: '88-key concert instrument',
      SON: 'Family heir',
    },
    down: {
      SAPS: 'Drains of energy',
      TRIO: 'Jazz ensemble of three',
      WOMAN: 'Adult female',
      IRON: 'Pressing appliance for shirts',
      TYRO: 'Absolute beginner',
    },
    hardAcross: {
      WIT: 'Repartee’s sharpest ingredient',
      STORY: 'Architectural level or printed narrative',
      ARMOR: 'Chain mail and breastplate ensemble',
      PIANO: 'Softly, in Italian sheet music',
      SON: 'Lineal descendant in a family tree',
    },
    hardDown: {
      SAPS: 'Depletes gradually',
      TRIO: 'Chamber group with piano, violin, and cello',
      WOMAN: 'Adult subject of a portrait',
      IRON: 'Element 26, or a laundry press',
      TYRO: 'Novice learning the ropes',
    },
  },
];

function computePuzzleNumber(dateKey: string): number {
  const epoch = new Date(2026, 0, 1).getTime();
  const [y, m, d] = dateKey.split('-').map(Number);
  const target = new Date(y, m - 1, d).getTime();
  return Math.max(1, Math.floor((target - epoch) / 86400000) + 1);
}

export function generateDailyCrossword(
  dateKey: string,
  difficulty: Difficulty = 'medium'
): DailyCrossword {
  const idx = hashString(`crossword_${dateKey}`) % RAW_CROSSWORDS.length;
  const raw = RAW_CROSSWORDS[idx];

  const cellNumbers: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
  const acrossClues: CrosswordClue[] = [];
  const downClues: CrosswordClue[] = [];

  const acrossMap = difficulty === 'hard' ? raw.hardAcross : raw.across;
  const downMap = difficulty === 'hard' ? raw.hardDown : raw.down;

  let nextNum = 1;

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (raw.rows[r][c] === '#') continue;

      const startsAcross =
        (c === 0 || raw.rows[r][c - 1] === '#') &&
        c + 1 < 5 &&
        raw.rows[r][c + 1] !== '#';
      const startsDown =
        (r === 0 || raw.rows[r - 1][c] === '#') &&
        r + 1 < 5 &&
        raw.rows[r + 1][c] !== '#';

      if (!startsAcross && !startsDown) continue;

      const num = nextNum++;
      cellNumbers[r][c] = num;

      if (startsAcross) {
        let answer = '';
        let cc = c;
        while (cc < 5 && raw.rows[r][cc] !== '#') {
          answer += raw.rows[r][cc];
          cc++;
        }
        acrossClues.push({
          number: num,
          direction: 'across',
          clue: acrossMap[answer] || raw.across[answer] || `Across (${answer.length})`,
          answer,
          row: r,
          col: c,
          length: answer.length,
        });
      }

      if (startsDown) {
        let answer = '';
        let rr = r;
        while (rr < 5 && raw.rows[rr][c] !== '#') {
          answer += raw.rows[rr][c];
          rr++;
        }
        downClues.push({
          number: num,
          direction: 'down',
          clue: downMap[answer] || raw.down[answer] || `Down (${answer.length})`,
          answer,
          row: r,
          col: c,
          length: answer.length,
        });
      }
    }
  }

  // Easy mode pre-fills 5 helpful anchor letters across the grid
  const prefilledCells: Record<string, string> = {};
  if (difficulty === 'easy') {
    const whiteCoords: Array<[number, number]> = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (raw.rows[r][c] !== '#') whiteCoords.push([r, c]);
      }
    }
    const rng = createSeededRng(`cw_easy_${dateKey}`);
    const picked = shuffleSeeded(whiteCoords, rng).slice(0, 5);
    for (const [r, c] of picked) {
      prefilledCells[`${r}-${c}`] = raw.rows[r][c];
    }
  }

  return {
    dateKey,
    difficulty,
    puzzleNumber: computePuzzleNumber(dateKey),
    title: raw.title,
    rows: raw.rows,
    prefilledCells,
    acrossClues,
    downClues,
    cellNumbers,
  };
}

export const CROSSWORD_THEMES = RAW_CROSSWORDS.map((cw, index) => ({
  index,
  title: cw.title,
}));

export function generateCustomCrossword(
  seedKey: string,
  themeIndex: number,
  difficulty: Difficulty = 'medium',
  puzzleNumber = 1
): DailyCrossword {
  const safeIdx = Math.abs(Math.floor(themeIndex)) % RAW_CROSSWORDS.length;
  const raw = RAW_CROSSWORDS[safeIdx];

  const cellNumbers: number[][] = Array.from({ length: 5 }, () => Array(5).fill(0));
  const acrossClues: CrosswordClue[] = [];
  const downClues: CrosswordClue[] = [];

  const acrossMap = difficulty === 'hard' ? raw.hardAcross : raw.across;
  const downMap = difficulty === 'hard' ? raw.hardDown : raw.down;

  let nextNum = 1;

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (raw.rows[r][c] === '#') continue;

      const startsAcross =
        (c === 0 || raw.rows[r][c - 1] === '#') &&
        c + 1 < 5 &&
        raw.rows[r][c + 1] !== '#';
      const startsDown =
        (r === 0 || raw.rows[r - 1][c] === '#') &&
        r + 1 < 5 &&
        raw.rows[r + 1][c] !== '#';

      if (!startsAcross && !startsDown) continue;

      const num = nextNum++;
      cellNumbers[r][c] = num;

      if (startsAcross) {
        let answer = '';
        let cc = c;
        while (cc < 5 && raw.rows[r][cc] !== '#') {
          answer += raw.rows[r][cc];
          cc++;
        }
        acrossClues.push({
          number: num,
          direction: 'across',
          clue: acrossMap[answer] || raw.across[answer] || `Across (${answer.length})`,
          answer,
          row: r,
          col: c,
          length: answer.length,
        });
      }

      if (startsDown) {
        let answer = '';
        let rr = r;
        while (rr < 5 && raw.rows[rr][c] !== '#') {
          answer += raw.rows[rr][c];
          rr++;
        }
        downClues.push({
          number: num,
          direction: 'down',
          clue: downMap[answer] || raw.down[answer] || `Down (${answer.length})`,
          answer,
          row: r,
          col: c,
          length: answer.length,
        });
      }
    }
  }

  const prefilledCells: Record<string, string> = {};
  if (difficulty === 'easy') {
    const whiteCoords: Array<[number, number]> = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (raw.rows[r][c] !== '#') whiteCoords.push([r, c]);
      }
    }
    const rng = createSeededRng(`custom_cw_easy_${seedKey}`);
    const picked = shuffleSeeded(whiteCoords, rng).slice(0, 5);
    for (const [r, c] of picked) {
      prefilledCells[`${r}-${c}`] = raw.rows[r][c];
    }
  }

  return {
    dateKey: seedKey,
    difficulty,
    puzzleNumber,
    title: raw.title,
    rows: raw.rows,
    prefilledCells,
    acrossClues,
    downClues,
    cellNumbers,
  };
}
