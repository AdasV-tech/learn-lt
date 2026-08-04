/**
 * Shared shapes for the Kalba curriculum.
 *
 * Kalba teaches Military Lithuanian only. Everything in this package is plain
 * data — no database, no framework — so the content can be validated, unit
 * tested and re-used by any consumer (the Prisma seeder today, a static export
 * or a second language tomorrow).
 */

/**
 * The six military levels. They form one continuous progression from a soldier
 * arriving in country to one who can brief, report and lead in Lithuanian.
 *
 *   MIL1  Naujokas          Recruit        — sounds, courtesy, first commands
 *   MIL2  Kareivis          Soldier        — drill, movement, formations
 *   MIL3  Skyrininkas       Section member — terrain, map reading, navigation
 *   MIL4  Specialistas      Specialist     — weapons, equipment, vehicles, supply
 *   MIL5  Ryšininkas        Signaller      — radio procedure, reports, requests
 *   MIL6  Vadas             Commander      — casualty care, contact drills, orders
 */
export type Level = 'MIL1' | 'MIL2' | 'MIL3' | 'MIL4' | 'MIL5' | 'MIL6';

export const LEVELS: Level[] = ['MIL1', 'MIL2', 'MIL3', 'MIL4', 'MIL5', 'MIL6'];

export interface LevelMeta {
  level: Level;
  /** Ordinal, 1-based. */
  index: number;
  /** Lithuanian name of the rank-styled tier. */
  nameLt: string;
  /** English name. */
  nameEn: string;
  /** Rough CEFR equivalence of the *language* difficulty, for reference only. */
  cefrHint: 'A1' | 'A1–A2' | 'A2' | 'A2–B1' | 'B1' | 'B1–B2';
  /** NATO-style tier insignia used on the level badge. */
  emoji: string;
}

export const LEVEL_META: Record<Level, LevelMeta> = {
  MIL1: {
    level: 'MIL1',
    index: 1,
    nameLt: 'Naujokas',
    nameEn: 'Recruit',
    cefrHint: 'A1',
    emoji: '🎖️',
  },
  MIL2: {
    level: 'MIL2',
    index: 2,
    nameLt: 'Kareivis',
    nameEn: 'Soldier',
    cefrHint: 'A1–A2',
    emoji: '🪖',
  },
  MIL3: {
    level: 'MIL3',
    index: 3,
    nameLt: 'Skyrininkas',
    nameEn: 'Section Member',
    cefrHint: 'A2',
    emoji: '🧭',
  },
  MIL4: {
    level: 'MIL4',
    index: 4,
    nameLt: 'Specialistas',
    nameEn: 'Specialist',
    cefrHint: 'A2–B1',
    emoji: '⚙️',
  },
  MIL5: {
    level: 'MIL5',
    index: 5,
    nameLt: 'Ryšininkas',
    nameEn: 'Signaller',
    cefrHint: 'B1',
    emoji: '📡',
  },
  MIL6: {
    level: 'MIL6',
    index: 6,
    nameLt: 'Vadas',
    nameEn: 'Commander',
    cefrHint: 'B1–B2',
    emoji: '⭐',
  },
};

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'pronoun'
  | 'numeral'
  | 'preposition'
  | 'conjunction'
  | 'particle'
  | 'interjection'
  | 'phrase'
  | 'command'
  | 'letter';

export type Gender = 'm' | 'f' | 'n';

export interface Example {
  /** Lithuanian sentence in normal orthography. */
  lt: string;
  /** Natural English translation (not word-for-word). */
  en: string;
}

export interface Word {
  /** Dictionary (citation) form — the primary key of the vocabulary table. */
  lt: string;
  /** English gloss. Multiple senses separated by "; ". */
  en: string;
  /**
   * Learner-friendly respelling. Capitals mark the stressed syllable where the
   * standard stress is stable; see docs/LINGUISTIC_NOTES.md for the scheme.
   */
  pron: string;
  pos: PartOfSpeech;
  level: Level;
  /** Topic bucket, used for grouping, distractor choice and flashcard decks. */
  category: string;
  gender?: Gender;
  /** Single emoji used as the visual mnemonic on the vocabulary card. */
  emoji?: string;
  /**
   * Grammar note: declension pattern, aspect partner, the case a verb governs,
   * irregularities, or how a command is formed. Shown on the back of the card.
   */
  grammar?: string;
  /** Doctrinal or usage note — when it is said, by whom, and to whom. */
  usage?: string;
  examples?: Example[];
  /** Free-form tags for search and deck building, e.g. "drill", "9-line". */
  tags?: string[];
  /**
   * Other forms accepted when the learner types this word — feminine endings,
   * informal variants, common alternates.
   */
  alt?: string[];
}

/** Every interactive question type the lesson player can render. */
export type ExerciseType =
  /** Pick the correct translation from four options. */
  | 'select'
  /** Hear Lithuanian audio, pick the meaning. */
  | 'listen_select'
  /** Hear Lithuanian audio, type exactly what was said. */
  | 'listen_type'
  /** Read the prompt aloud; scored by the speech recogniser. */
  | 'speak'
  /** Translate a sentence by typing it. */
  | 'write'
  /** Assemble a sentence from shuffled word tiles. */
  | 'word_bank'
  /** Match Lithuanian and English pairs. */
  | 'match'
  /** Fill the gap in a sentence (case, conjugation, or missing proword). */
  | 'fill_blank'
  /** React to a shouted command by choosing the correct action. */
  | 'react';

export interface Exercise {
  type: ExerciseType;
  /** What the learner is shown/asked. */
  prompt: string;
  /** Optional secondary instruction, e.g. "Type in Lithuanian". */
  instruction?: string;
  /** Text spoken by the TTS voice for listening exercises (always Lithuanian). */
  audioText?: string;
  /** The canonical correct answer. */
  answer: string;
  /** Other spellings accepted as correct (diacritic-free forms are automatic). */
  altAnswers?: string[];
  /** Options for `select` / `listen_select` / `react`. Includes the answer. */
  options?: string[];
  /** Tiles for `word_bank` — the answer's words plus distractor tiles. */
  tiles?: string[];
  /** Pairs for `match`. */
  pairs?: { lt: string; en: string }[];
  /** Shown after answering — a short "why" note. */
  explanation?: string;
  /** Vocabulary entry this exercise practises, if any. */
  wordLt?: string;
  /** Difficulty 1–3; feeds the XP calculation. */
  difficulty?: 1 | 2 | 3;
}

/** A short sentence-level drill authored per lesson; expands into exercises. */
export interface Drill {
  lt: string;
  en: string;
  /** Which exercise types to generate. Defaults to word_bank + write. */
  modes?: ExerciseType[];
  /** Word (or exact substring) blanked out for `fill_blank`. */
  blank?: string;
  explanation?: string;
}

export interface GrammarNote {
  title: string;
  /** Markdown. Rendered in the lesson briefing and the grammar reference. */
  body: string;
}

export interface Lesson {
  slug: string;
  title: string;
  /** One-line summary shown on the lesson node. */
  subtitle: string;
  emoji: string;
  /** Vocabulary introduced here, by `Word.lt`. */
  words: string[];
  drills?: Drill[];
  grammar?: GrammarNote;
  /** Hand-authored exercises appended after the generated ones. */
  extraExercises?: Exercise[];
  /** Base XP; the runtime adds bonuses for accuracy and speed. */
  xp?: number;
}

export interface Unit {
  slug: string;
  title: string;
  description: string;
  emoji: string;
  level: Level;
  /** Accent colour (hex) for the unit header and path nodes. */
  color: string;
  lessons: Lesson[];
}

export interface Course {
  slug: string;
  title: string;
  description: string;
  units: Unit[];
}

export interface AchievementDef {
  slug: string;
  title: string;
  description: string;
  emoji: string;
  /** Which counter unlocks it. */
  metric:
    | 'xp'
    | 'streak'
    | 'lessons'
    | 'words'
    | 'perfect_lessons'
    | 'speaking'
    | 'writing'
    | 'listening'
    | 'level'
    | 'accuracy';
  threshold: number;
  /** Bonus XP granted on unlock. */
  xpReward: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface GrammarPage {
  slug: string;
  title: string;
  level: Level;
  summary: string;
  /** Markdown body. */
  body: string;
  order: number;
}
