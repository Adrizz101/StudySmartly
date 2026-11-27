import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings, AccentKey, Mode, Course, ScheduleEvent, TutorSession, SlideDocument, Transcription, DEFAULT_SETTINGS } from '@/types';
import { loadSettings, saveSettings, load, save } from '@/lib/storage';
import { applyTheme } from '@/lib/theme';
import { supabase } from '@/integrations/supabase/client';
import { fetchPersistedCollections, migrateLegacyCollections, syncPersistedCollection } from '@/lib/persistence.functions';

type Updater<T> = (value: T | ((prev: T) => T)) => void;
type PersistedResource = 'courses' | 'schedule_events' | 'tutor_sessions' | 'presentation_documents';
type PersistedCollections = {
  courses: Course[];
  schedule_events: ScheduleEvent[];
  tutor_sessions: TutorSession[];
  presentation_documents: SlideDocument[];
};
type PersistedItem = { id: string; [key: string]: unknown };
type PendingSave = { before: PersistedItem[]; timer: ReturnType<typeof setTimeout> };

const emptyCollections: PersistedCollections = {
  courses: [],
  schedule_events: [],
  tutor_sessions: [],
  presentation_documents: [],
};
const collectionKeys = {
  courses: 'courses',
  schedule_events: 'events',
  tutor_sessions: 'tutorSessions',
  presentation_documents: 'documents',
} as const;
const OWNER_KEY = 'studysmart:persistence-owner';

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

async function currentAccessToken(expectedUserId: string): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token || data.session.user.id !== expectedUserId) {
    throw new Error('Your account session changed. Sign in again to sync your saved data.');
  }
  return data.session.access_token;
}

function toPersistedRecords(items: PersistedItem[]) {
  return items.map((item) => ({
    id: item.id,
    payload: item as Record<string, unknown>,
  }));
}

export function AppProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [transcriptions, setTranscriptionsState] = useState<Transcription[]>([]);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const pendingSaves = useRef<Partial<Record<PersistedResource, PendingSave>>>({});
  const queryKey = ['app-persistence', userId] as const;

  useEffect(() => {
    setSettingsState(loadSettings());
    setTranscriptionsState(load<Transcription[]>('transcriptions', []));
    setStorageLoaded(true);
  }, []);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) console.error('[Persistence] Could not read the active session:', error);
      setUserId(data.session?.user.id ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => { applyTheme(settings.mode, settings.accent); }, [settings.mode, settings.accent]);
  useEffect(() => { if (storageLoaded) saveSettings(settings); }, [settings, storageLoaded]);
  useEffect(() => { if (storageLoaded) save('transcriptions', transcriptions); }, [transcriptions, storageLoaded]);

  const collectionsQuery = useQuery<PersistedCollections>({
    queryKey,
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    retry: 2,
    networkMode: 'online',
    queryFn: async () => {
      if (!userId) throw new Error('Sign in to load your saved data.');
      const accessToken = await currentAccessToken(userId);
      const initial = await fetchPersistedCollections({ data: { accessToken } });
      if (!initial.success) throw new Error(initial.error);

      // Import pre-migration browser data once. Existing cloud rows always win
      // on ID conflicts; missing local records are added without overwriting them.
      if (typeof window !== 'undefined') {
        const localOwner = window.localStorage.getItem(OWNER_KEY);
        if (!localOwner || localOwner === userId) {
          const legacy = {
            tutor_sessions: load<TutorSession[]>('tutorSessions', []),
            presentation_documents: load<SlideDocument[]>('documents', []),
            courses: load<Course[]>('courses', []),
            schedule_events: load<ScheduleEvent[]>('events', []),
          };
          const hasLegacyData = Object.values(legacy).some((items) => items.length > 0);
          if (hasLegacyData) {
            const migration = await migrateLegacyCollections({
              data: {
                accessToken,
                collections: {
                  tutor_sessions: toPersistedRecords(legacy.tutor_sessions as PersistedItem[]),
                  presentation_documents: toPersistedRecords(legacy.presentation_documents as PersistedItem[]),
                  courses: toPersistedRecords(legacy.courses as PersistedItem[]),
                  schedule_events: toPersistedRecords(legacy.schedule_events as PersistedItem[]),
                },
              },
            });
            if (!migration.success) throw new Error(migration.error);
            window.localStorage.setItem(OWNER_KEY, userId);
            Object.values(collectionKeys).forEach((key) => window.localStorage.removeItem('studysmart:' + key));
            const refreshed = await fetchPersistedCollections({ data: { accessToken } });
            if (!refreshed.success) throw new Error(refreshed.error);
            return refreshed.data as PersistedCollections;
          }
          if (!localOwner) window.localStorage.setItem(OWNER_KEY, userId);
        }
      }
      return initial.data as PersistedCollections;
    },
  });

  const persistenceMutation = useMutation({
    mutationKey: ['app-persistence-sync', userId],
    scope: { id: 'app-persistence-' + (userId ?? 'signed-out') },
    networkMode: 'online',
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('session changed')) return false;
      return failureCount < 3;
    },
    retryDelay: (attempt) => Math.min(1000 * (2 ** attempt), 30000),
    mutationFn: async (variables: {
      userId: string;
      resource: PersistedResource;
      items: PersistedItem[];
      before: PersistedItem[];
      deletedIds: string[];
    }) => {
      const accessToken = await currentAccessToken(variables.userId);
      const result = await syncPersistedCollection({
        data: {
          accessToken,
          resource: variables.resource,
          items: toPersistedRecords(variables.items),
          deletedIds: variables.deletedIds,
        },
      });
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onError: (error, variables) => {
      console.error('[Persistence] Changes could not be synced; rolling back the failed optimistic update:', error);
      const key = ['app-persistence', variables.userId] as const;
      const state = queryClient.getQueryData<PersistedCollections>(key);
      if (!state) return;

      // Roll back only records that still contain this mutation's optimistic
      // value. Later edits to the same record are preserved.
      const beforeById = new Map(variables.before.map((item) => [item.id, item]));
      const afterById = new Map(variables.items.map((item) => [item.id, item]));
      const currentById = new Map(state[variables.resource].map((item) => [item.id, item]));
      const allIds = new Set([...beforeById.keys(), ...afterById.keys()]);
      for (const id of allIds) {
        const before = beforeById.get(id);
        const after = afterById.get(id);
        if (JSON.stringify(before) === JSON.stringify(after)) continue;
        const current = currentById.get(id);
        if (JSON.stringify(current) !== JSON.stringify(after)) continue;
        if (before) currentById.set(id, before);
        else currentById.delete(id);
      }
      queryClient.setQueryData<PersistedCollections>(key, {
        ...state,
        [variables.resource]: [...currentById.values()],
      });
    },
  });

  const scheduleSave = useCallback((
    resource: PersistedResource,
    before: PersistedItem[],
    after: PersistedItem[],
  ) => {
    if (!userId) return;
    const pending = pendingSaves.current[resource];
    const baseline = pending?.before ?? before;
    if (pending) clearTimeout(pending.timer);
    const timer = setTimeout(() => {
      delete pendingSaves.current[resource];
      const latestState = queryClient.getQueryData<PersistedCollections>(['app-persistence', userId]);
      const latest = (latestState?.[resource] ?? after) as PersistedItem[];
      const beforeIds = new Set(baseline.map((item) => item.id));
      const afterIds = new Set(latest.map((item) => item.id));
      const deletedIds = baseline.filter((item) => !afterIds.has(item.id)).map((item) => item.id);
      const hasChanges = deletedIds.length > 0 || latest.some((item) => {
        const previous = baseline.find((candidate) => candidate.id === item.id);
        return JSON.stringify(previous) !== JSON.stringify(item);
      });
      if (!hasChanges) return;
      persistenceMutation.mutate({
        userId,
        resource,
        items: latest,
        before: baseline,
        deletedIds,
      });
    }, 450);
    pendingSaves.current[resource] = { before: baseline, timer };
  }, [persistenceMutation, queryClient, userId]);

  const updateCollection = useCallback((
    resource: PersistedResource,
    updater: Updater<PersistedItem[]>,
  ) => {
    if (!userId) return;
    const previousState = queryClient.getQueryData<PersistedCollections>(['app-persistence', userId]) ?? emptyCollections;
    const previous = previousState[resource] as PersistedItem[];
    const next = typeof updater === 'function'
      ? (updater as (value: PersistedItem[]) => PersistedItem[])(previous)
      : updater;
    queryClient.setQueryData<PersistedCollections>(['app-persistence', userId], {
      ...previousState,
      [resource]: next,
    });
    scheduleSave(resource, previous, next);
  }, [queryClient, scheduleSave, userId]);

  const setSettings = useCallback<Updater<Settings>>((value) => setSettingsState(value as Settings), []);
  const updateSettings = useCallback((partial: Partial<Settings>) =>
    setSettingsState((previous) => ({ ...previous, ...partial })), []);
  const setMode = useCallback((mode: Mode) => setSettingsState((previous) => ({ ...previous, mode })), []);
  const setAccent = useCallback((accent: AccentKey) => setSettingsState((previous) => ({ ...previous, accent })), []);

  const setCourses = useCallback<Updater<Course[]>>((value) => updateCollection('courses', value as Updater<PersistedItem[]>), [updateCollection]);
  const addCourse = useCallback((course: Course) => updateCollection('courses', (previous) => [...previous, course]), [updateCollection]);
  const updateCourse = useCallback((id: string, partial: Partial<Course>) =>
    updateCollection('courses', (previous) => previous.map((course) => course.id === id ? { ...course, ...partial } : course)), [updateCollection]);
  const deleteCourse = useCallback((id: string) => {
    updateCollection('courses', (previous) => previous.filter((course) => course.id !== id));
    updateCollection('schedule_events', (previous) => previous.filter((event) => event.courseId !== id));
  }, [updateCollection]);

  const setEvents = useCallback<Updater<ScheduleEvent[]>>((value) => updateCollection('schedule_events', value as Updater<PersistedItem[]>), [updateCollection]);
  const addEvents = useCallback((events: ScheduleEvent[]) => updateCollection('schedule_events', (previous) => [...previous, ...events]), [updateCollection]);
  const updateEvent = useCallback((id: string, partial: Partial<ScheduleEvent>) =>
    updateCollection('schedule_events', (previous) => previous.map((event) => event.id === id ? { ...event, ...partial } : event)), [updateCollection]);
  const deleteEvent = useCallback((id: string) =>
    updateCollection('schedule_events', (previous) => previous.filter((event) => event.id !== id)), [updateCollection]);

  const setTutorSessions = useCallback<Updater<TutorSession[]>>((value) => updateCollection('tutor_sessions', value as Updater<PersistedItem[]>), [updateCollection]);
  const setDocuments = useCallback<Updater<SlideDocument[]>>((value) => updateCollection('presentation_documents', value as Updater<PersistedItem[]>), [updateCollection]);
  const setTranscriptions = useCallback<Updater<Transcription[]>>((value) => setTranscriptionsState(value as Transcription[]), []);

  if (!storageLoaded || !userId || (collectionsQuery.isLoading && !collectionsQuery.data)) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-text">Loading your StudySmartly workspace…</div>;
  }
  if (!collectionsQuery.data && collectionsQuery.isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg px-6 text-center text-text">
        <p>Could not load your saved workspace. Check your connection and try again.</p>
        <button className="rounded-lg border border-border px-4 py-2 text-sm" onClick={() => void collectionsQuery.refetch()}>Retry sync</button>
      </div>
    );
  }

  const collections = collectionsQuery.data ?? emptyCollections;
  return (
    <AppContext.Provider value={{
      settings, setSettings, updateSettings, setMode, setAccent,
      courses: collections.courses, setCourses, addCourse, updateCourse, deleteCourse,
      events: collections.schedule_events, setEvents, addEvents, updateEvent, deleteEvent,
      tutorSessions: collections.tutor_sessions, setTutorSessions,
      documents: collections.presentation_documents, setDocuments,
      transcriptions, setTranscriptions,
    }}>
      {children}
    </AppContext.Provider>
  );
}
