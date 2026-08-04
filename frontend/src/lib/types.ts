/**
 * API types.
 *
 * Deliberately declared here rather than imported from @kalba/content: the
 * frontend talks to the API over HTTP and should not depend on the seeder's
 * package. These shapes mirror what the API actually returns.
 */

export type Level = 'MIL1' | 'MIL2' | 'MIL3' | 'MIL4' | 'MIL5' | 'MIL6';

export type ExerciseType =
  | 'select'
  | 'listen_select'
  | 'listen_type'
  | 'speak'
  | 'write'
  | 'word_bank'
  | 'match'
  | 'fill_blank'
  | 'react';

export interface Example {
  lt: string;
  en: string;
}

export interface Word {
  id: string;
  lt: string;
  en: string;
  pron: string;
  pos: string;
  level: Level;
  category: string;
  gender: string | null;
  emoji: string | null;
  grammar: string | null;
  usage: string | null;
  examples: Example[];
  tags: string[];
  alt: string[];
}

export interface Exercise {
  type: ExerciseType;
  prompt: string;
  instruction?: string;
  audioText?: string;
  answer: string;
  altAnswers?: string[];
  options?: string[];
  tiles?: string[];
  pairs?: { lt: string; en: string }[];
  explanation?: string;
  wordLt?: string;
  difficulty?: 1 | 2 | 3;
}

export interface LevelMeta {
  level: Level;
  index: number;
  nameLt: string;
  nameEn: string;
  cefrHint: string;
  emoji: string;
}

export interface LessonNode {
  slug: string;
  title: string;
  subtitle: string;
  emoji: string;
  xp: number;
  wordCount: number;
  hasGrammar: boolean;
  completed: boolean;
  completions: number;
  bestAccuracy: number;
  lastCompleted: string | null;
}

export interface UnitNode {
  slug: string;
  title: string;
  description: string;
  emoji: string;
  color: string;
  level: Level;
  lessons: LessonNode[];
}

export interface LevelNode extends LevelMeta {
  unlocked: boolean;
  lessonCount: number;
  completedCount: number;
  units: UnitNode[];
}

export interface CourseResponse {
  course: { slug: string; title: string; description: string };
  levels: LevelNode[];
}

export interface LessonResponse {
  lesson: {
    slug: string;
    title: string;
    subtitle: string;
    emoji: string;
    xp: number;
    unit: { slug: string; title: string; emoji: string; color: string; level: Level };
    grammar: { title: string; body: string } | null;
    words: Word[];
    exercises: Exercise[];
  };
  progress: {
    completions: number;
    bestAccuracy: number;
    lastAccuracy: number;
    lastCompleted: string | null;
  } | null;
}

export interface LevelProgress {
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progress: number;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarEmoji: string;
  xp: number;
  level: LevelProgress;
  streak: number;
  longestStreak: number;
  lastActiveOn: string | null;
  dailyGoalXp: number;
  settings: {
    theme: 'system' | 'light' | 'dark';
    largeText: boolean;
    reducedMotion: boolean;
    ttsRate: number;
    timezone: string;
  };
  createdAt: string;
  hasPassword: boolean;
  hasGoogle: boolean;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface UnlockedAchievement {
  slug: string;
  title: string;
  description: string;
  emoji: string;
  tier: string;
  xpReward: number;
}

export interface AnswerResult {
  index: number;
  type: string;
  correct: boolean;
  typo: boolean;
  expected: string;
  given: string;
  xp: number;
  explanation?: string;
}

export interface LessonSummary {
  lessonSlug: string;
  total: number;
  correct: number;
  accuracy: number;
  perfect: boolean;
  firstCompletion: boolean;
  xp: {
    fromAnswers: number;
    completionBonus: number;
    perfectBonus: number;
    achievements: number;
    total: number;
  };
  results: AnswerResult[];
  streak: number;
  streakIncreased: boolean;
  level: LevelProgress;
  unlockedAchievements: UnlockedAchievement[];
  dailyGoal: { goalXp: number; earnedToday: number; met: boolean };
}

export interface ProgressSummary {
  xp: number;
  level: LevelProgress;
  militaryLevel: LevelMeta;
  streak: { current: number; longest: number; lastActiveOn: string | null };
  dailyGoal: { goalXp: number; earnedToday: number; met: boolean };
  lessons: { completed: number; total: number; perfect: number };
  words: { learned: number };
  accuracy: { percent: number; answers: number };
  skills: { type: string; correct: number; total: number; accuracy: number }[];
  calendar: { day: string; xp: number; lessons: number; exercises: number }[];
}

export interface Achievement {
  slug: string;
  title: string;
  description: string;
  emoji: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  xpReward: number;
  metric: string;
  threshold: number;
  value?: number;
  progress: number;
  unlocked: boolean;
  unlockedAt?: string | null;
}

export interface Flashcard {
  id: string;
  word: Word;
  ease: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueAt: string;
}

export interface DeckStats {
  total: number;
  dueNow: number;
  dueTomorrow: number;
  dueWithinWeek: number;
  mature: number;
  young: number;
  distinctWords: number;
}

export interface GrammarPageSummary {
  slug: string;
  title: string;
  level: Level;
  summary: string;
  order: number;
}

export interface GrammarPage extends GrammarPageSummary {
  body: string;
}

export interface LeaderboardRow {
  rank: number;
  id: string;
  displayName: string;
  avatarEmoji: string;
  xp: number;
  level: number;
  streak: number;
  isYou: boolean;
}

export interface TutorSuggestion {
  mode: 'explain' | 'correct' | 'converse' | 'roleplay' | 'drill';
  label: string;
  prompt: string;
}

export interface AiStatus {
  enabled: boolean;
  model: string | null;
  suggestions: TutorSuggestion[];
}

export interface TutorResponse {
  reply: string;
  source: 'ai' | 'local';
  relatedWords: string[];
}

export interface NextLesson {
  next: {
    slug: string;
    title: string;
    subtitle: string;
    emoji: string;
    xp: number;
    unit: { slug: string; title: string; emoji: string; color: string; level: Level };
    isReview: boolean;
  } | null;
  completed: number;
  total: number;
}
