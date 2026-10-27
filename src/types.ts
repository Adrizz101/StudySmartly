export type AccentKey = 'emerald' | 'bronze' | 'indigo';
export type Mode = 'dark' | 'light';

export type ViewKey =
  | 'dashboard'
  | 'schedule'
  | 'tutor'
  | 'studio'
  | 'exams'
  | 'transcriber'
  | 'settings';

export interface Course {
  id: string;
  name: string;
  code: string;
  color: string;
  active: boolean;
  progress: number;
  examDate?: string | undefined;
}

export interface ScheduleEvent {
  id: string;
  title: string;
  courseId: string | null;
  date: string;
  startTime: string;
  endTime: string;
  type: 'lecture' | 'exam' | 'assignment' | 'study' | 'other';
  notes?: string | undefined;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  image?: string | undefined;
}

export interface TutorSession {
  id: string;
  subject: string;
  messages: ChatMessage[];
  createdAt: number;
}

export type SlideLayout = 'title' | 'bento' | 'timeline' | 'comparison' | 'process' | 'spotlight' | 'dossier' | 'stats' | 'content' | 'split' | 'summary';
export interface SlideCard { title: string; text: string; value: string }
export type DeckTheme = 'editorial' | 'noir' | 'botanical';
export type SlidePalette = 'emerald-dark' | 'indigo-dark' | 'bronze-dark' | 'slate-dark' | 'rose-dark' | 'teal-dark';

export interface SlideStat {
  id: string;
  label: string;
  value: string;
}

export interface Slide {
  id: string;
  heading: string;
  body: string;
  bullets: string[];
  layout: SlideLayout;
  accent?: string | undefined;
  image?: string | undefined;
  category?: string | undefined;
  stats?: SlideStat[] | undefined;
  palette?: SlidePalette | undefined;
  cards?: SlideCard[] | undefined;
  citations?: string[] | undefined;
  imagePrompt?: string | undefined;
  imageAlt?: string | undefined;
}

export interface SlideDocument {
  id: string;
  title: string;
  subject: string;
  slides: Slide[];
  updatedAt: number;
  format: 'slides' | 'guide';
  student?: string | undefined;
  theme?: DeckTheme | undefined;
  sources?: { name: string; text: string; images: string[] }[] | undefined;
}

export interface Transcription {
  id: string;
  title: string;
  text: string;
  createdAt: number;
  duration: number;
}

export interface PomodoroSettings {
  focus: number;
  shortBreak: number;
  longBreak: number;
  longBreakInterval: number;
  autoStart: boolean;
  sound: boolean;
  notifications: boolean;
}

export interface Connectors {
  aiApiKey: string;
  aiBaseUrl: string;
  aiModel: string;
  imageApiKey: string;
}

export interface Settings {
  mode: Mode;
  accent: AccentKey;
  pomodoro: PomodoroSettings;
  aiApiKey: string;
  aiBaseUrl: string;
  aiModel: string;
  userName: string;
  imageApiKey: string;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'dark',
  accent: 'emerald',
  pomodoro: {
    focus: 25,
    shortBreak: 5,
    longBreak: 15,
    longBreakInterval: 4,
    autoStart: false,
    sound: true,
    notifications: true,
  },
  aiApiKey: '',
  aiBaseUrl: 'https://api.openai.com/v1',
  aiModel: 'gpt-4o-mini',
  userName: '',
  imageApiKey: '',
};

export const ACCENTS: Record<AccentKey, { name: string; hex: string; scale: Record<number, string> }> = {
  emerald: {
    name: 'Emerald',
    hex: '#10b981',
    scale: {
      50: '#ecfdf5',
      100: '#d1fae5',
      200: '#a7f3d0',
      300: '#6ee7b7',
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
    },
  },
  bronze: {
    name: 'Bronze',
    hex: '#d97706',
    scale: {
      50: '#fffbeb',
      100: '#fef3c7',
      200: '#fde68a',
      300: '#fcd34d',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
      800: '#92400e',
      900: '#78350f',
    },
  },
  indigo: {
    name: 'Soft Indigo',
    hex: '#6366f1',
    scale: {
      50: '#eef2ff',
      100: '#e0e7ff',
      200: '#c7d2fe',
      300: '#a5b4fc',
      400: '#818cf8',
      500: '#6366f1',
      600: '#4f46e5',
      700: '#4338ca',
      800: '#3730a3',
      900: '#312e81',
    },
  },
};

export const SLIDE_PALETTES: Record<SlidePalette, { name: string; bg: string; card: string; accent: string; text: string; muted: string }> = {
  'emerald-dark': { name: 'Emerald Dusk', bg: 'var(--source-1)', card: 'var(--source-2)', accent: 'var(--source-3)', text: 'var(--source-4)', muted: 'var(--source-5)' },
  'indigo-dark': { name: 'Indigo Night', bg: 'var(--source-6)', card: 'var(--source-7)', accent: 'var(--source-8)', text: 'var(--source-9)', muted: 'var(--source-10)' },
  'bronze-dark': { name: 'Bronze Ember', bg: 'var(--source-11)', card: 'var(--source-12)', accent: 'var(--source-13)', text: 'var(--source-14)', muted: 'var(--source-15)' },
  'slate-dark': { name: 'Slate Pro', bg: 'var(--source-16)', card: 'var(--source-17)', accent: 'var(--source-18)', text: 'var(--source-19)', muted: 'var(--source-20)' },
  'rose-dark': { name: 'Rose Quartz', bg: 'var(--source-21)', card: 'var(--source-22)', accent: 'var(--source-23)', text: 'var(--source-24)', muted: 'var(--source-25)' },
  'teal-dark': { name: 'Teal Wave', bg: 'var(--source-26)', card: 'var(--source-27)', accent: 'var(--source-28)', text: 'var(--source-29)', muted: 'var(--source-30)' },
};
