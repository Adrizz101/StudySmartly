import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Settings, AccentKey, Mode, Course, ScheduleEvent, TutorSession, SlideDocument, Transcription } from '@/types';
import { loadSettings, saveSettings, load, save } from '@/lib/storage';
import { applyTheme } from '@/lib/theme';

type Updater<T> = (value: T | ((prev: T) => T)) => void;

interface AppState {
  settings: Settings;
  setSettings: Updater<Settings>;
  updateSettings: (partial: Partial<Settings>) => void;
  setMode: (m: Mode) => void;
  setAccent: (a: AccentKey) => void;
  courses: Course[];
  setCourses: Updater<Course[]>;
  addCourse: (c: Course) => void;
  updateCourse: (id: string, partial: Partial<Course>) => void;
  deleteCourse: (id: string) => void;
  events: ScheduleEvent[];
  setEvents: Updater<ScheduleEvent[]>;
  addEvents: (e: ScheduleEvent[]) => void;
  updateEvent: (id: string, partial: Partial<ScheduleEvent>) => void;
  deleteEvent: (id: string) => void;
  tutorSessions: TutorSession[];
  setTutorSessions: Updater<TutorSession[]>;
  documents: SlideDocument[];
  setDocuments: Updater<SlideDocument[]>;
  transcriptions: Transcription[];
  setTranscriptions: Updater<Transcription[]>;
}

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings());
  const [courses, setCoursesState] = useState<Course[]>(() => load<Course[]>('courses', []));
  const [events, setEventsState] = useState<ScheduleEvent[]>(() => load<ScheduleEvent[]>('events', []));
  const [tutorSessions, setTutorSessionsState] = useState<TutorSession[]>(() => load<TutorSession[]>('tutorSessions', []));
  const [documents, setDocumentsState] = useState<SlideDocument[]>(() => load<SlideDocument[]>('documents', []));
  const [transcriptions, setTranscriptionsState] = useState<Transcription[]>(() => load<Transcription[]>('transcriptions', []));

  useEffect(() => { applyTheme(settings.mode, settings.accent); }, [settings.mode, settings.accent]);
  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => { save('courses', courses); }, [courses]);
  useEffect(() => { save('events', events); }, [events]);
  useEffect(() => { save('tutorSessions', tutorSessions); }, [tutorSessions]);
  useEffect(() => { save('documents', documents); }, [documents]);
  useEffect(() => { save('transcriptions', transcriptions); }, [transcriptions]);

  const setSettings = useCallback<Updater<Settings>>((s) => setSettingsState(s as any), []);
  const updateSettings = useCallback((partial: Partial<Settings>) =>
    setSettingsState((prev) => ({ ...prev, ...partial })), []);
  const setMode = useCallback((m: Mode) => setSettingsState((prev) => ({ ...prev, mode: m })), []);
  const setAccent = useCallback((a: AccentKey) => setSettingsState((prev) => ({ ...prev, accent: a })), []);

  const setCourses = useCallback<Updater<Course[]>>((c) => setCoursesState(c as any), []);
  const addCourse = useCallback((c: Course) => setCoursesState((prev) => [...prev, c]), []);
  const updateCourse = useCallback((id: string, partial: Partial<Course>) =>
    setCoursesState((prev) => prev.map((c) => (c.id === id ? { ...c, ...partial } : c))), []);
  const deleteCourse = useCallback((id: string) => {
    setCoursesState((prev) => prev.filter((c) => c.id !== id));
    setEventsState((prev) => prev.filter((e) => e.courseId !== id));
  }, []);

  const setEvents = useCallback<Updater<ScheduleEvent[]>>((e) => setEventsState(e as any), []);
  const addEvents = useCallback((e: ScheduleEvent[]) => setEventsState((prev) => [...prev, ...e]), []);
  const updateEvent = useCallback((id: string, partial: Partial<ScheduleEvent>) =>
    setEventsState((prev) => prev.map((e) => (e.id === id ? { ...e, ...partial } : e))), []);
  const deleteEvent = useCallback((id: string) =>
    setEventsState((prev) => prev.filter((e) => e.id !== id)), []);

  const setTutorSessions = useCallback<Updater<TutorSession[]>>((s) => setTutorSessionsState(s as any), []);
  const setDocuments = useCallback<Updater<SlideDocument[]>>((d) => setDocumentsState(d as any), []);
  const setTranscriptions = useCallback<Updater<Transcription[]>>((t) => setTranscriptionsState(t as any), []);

  return (
    <AppContext.Provider value={{
      settings, setSettings, updateSettings, setMode, setAccent,
      courses, setCourses, addCourse, updateCourse, deleteCourse,
      events, setEvents, addEvents, updateEvent, deleteEvent,
      tutorSessions, setTutorSessions,
      documents, setDocuments,
      transcriptions, setTranscriptions,
    }}>
      {children}
    </AppContext.Provider>
  );
}
