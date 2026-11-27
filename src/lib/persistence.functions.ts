import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const accessInput = z.object({ accessToken: z.string().min(1).max(5000) });
const resourceSchema = z.enum(['tutor_sessions', 'presentation_documents', 'courses', 'schedule_events']);
type Resource = z.infer<typeof resourceSchema>;

const coursePayload = z.object({
  id: z.string().trim().min(1).max(200),
  name: z.string().max(200),
  code: z.string().max(80),
  color: z.string().max(80),
  active: z.boolean(),
  progress: z.number().min(0).max(100),
  examDate: z.string().optional(),
}).passthrough();

const scheduleEventPayload = z.object({
  id: z.string().trim().min(1).max(200),
  title: z.string().min(1).max(300),
  courseId: z.string().nullable(),
  date: z.string().max(100),
  startTime: z.string().max(50),
  endTime: z.string().max(50),
  type: z.enum(['lecture', 'exam', 'assignment', 'study', 'other']),
  recurrence: z.enum(['none', 'weekly']).optional(),
  notes: z.string().max(5000).optional(),
}).passthrough();

const tutorMessage = z.object({
  id: z.string().min(1).max(200),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().max(100000),
  timestamp: z.number(),
  image: z.string().optional(),
  conceptMap: z.unknown().optional(),
}).passthrough();

const tutorSessionPayload = z.object({
  id: z.string().trim().min(1).max(200),
  subject: z.string().max(300),
  messages: z.array(tutorMessage).max(1000),
  createdAt: z.number(),
}).passthrough();

const slidePayload = z.object({
  id: z.string().min(1).max(200),
  heading: z.string().max(1000),
  body: z.string().max(100000),
  bullets: z.array(z.string().max(5000)),
  layout: z.string().max(80),
}).passthrough();

const presentationPayload = z.object({
  id: z.string().trim().min(1).max(200),
  title: z.string().max(500),
  subject: z.string().max(300),
  slides: z.array(slidePayload).max(300),
  updatedAt: z.number(),
  format: z.enum(['slides', 'guide']),
}).passthrough();

const payloadSchemas = {
  tutor_sessions: tutorSessionPayload,
  presentation_documents: presentationPayload,
  courses: coursePayload,
  schedule_events: scheduleEventPayload,
} satisfies Record<Resource, z.ZodTypeAny>;

function validatePayload(resource: Resource, payload: Record<string, unknown>) {
  switch (resource) {
    case 'tutor_sessions': return tutorSessionPayload.safeParse(payload);
    case 'presentation_documents': return presentationPayload.safeParse(payload);
    case 'courses': return coursePayload.safeParse(payload);
    case 'schedule_events': return scheduleEventPayload.safeParse(payload);
  }
}

const recordSchema = z.object({
  id: z.string().trim().min(1).max(200),
  payload: z.record(z.string(), z.unknown()),
}).superRefine((value, ctx) => {
  if (value.payload.id !== value.id) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['payload', 'id'], message: 'Record ID must match its payload ID.' });
  }
});

function validateRecords(resource: Resource, records: Array<{ id: string; payload: Record<string, unknown> }>, ctx: z.RefinementCtx, path: Array<string | number>) {
  records.forEach((record, index) => {
    const parsed = validatePayload(resource, record.payload);
    if (!parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...path, index, 'payload'],
        message: 'A ' + resource.replaceAll('_', ' ') + ' record has an invalid shape.',
      });
    }
  });
}

const collectionsSchema = z.object({
  tutor_sessions: z.array(recordSchema).max(500),
  presentation_documents: z.array(recordSchema).max(200),
  courses: z.array(recordSchema).max(500),
  schedule_events: z.array(recordSchema).max(2000),
}).superRefine((collections, ctx) => {
  validateRecords('tutor_sessions', collections.tutor_sessions, ctx, ['tutor_sessions']);
  validateRecords('presentation_documents', collections.presentation_documents, ctx, ['presentation_documents']);
  validateRecords('courses', collections.courses, ctx, ['courses']);
  validateRecords('schedule_events', collections.schedule_events, ctx, ['schedule_events']);
});

const tableNames: Record<Resource, string> = {
  tutor_sessions: 'tutor_sessions',
  presentation_documents: 'presentation_documents',
  courses: 'courses',
  schedule_events: 'schedule_events',
};
type DbClient = { from: (table: string) => any };

async function getUserContext(accessToken: string) {
  const { getAuthenticatedAIContext } = await import('@/lib/user-ai-keys.server');
  return getAuthenticatedAIContext(accessToken);
}

function mapRows(rows: Array<{ id: string; payload: Record<string, unknown> }> | null) {
  return (rows ?? []).map((row) => row.payload);
}

async function loadCollections(db: DbClient, userId: string) {
  const names = Object.keys(tableNames) as Resource[];
  const entries = await Promise.all(names.map(async (resource) => {
    const { data, error } = await db.from(tableNames[resource])
      .select('id,payload')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (error) throw new Error('Could not load ' + resource.replaceAll('_', ' ') + '.');
    return [resource, mapRows(data)] as const;
  }));
  return Object.fromEntries(entries) as Record<Resource, Record<string, unknown>[]>;
}

export const fetchPersistedCollections = createServerFn({ method: 'POST' })
  .inputValidator(accessInput)
  .handler(async ({ data }) => {
    try {
      const { userId, supabase } = await getUserContext(data.accessToken);
      const collections = await loadCollections(supabase as DbClient, userId);
      return { success: true as const, data: collections };
    } catch (error) {
      console.error('[Persistence] Fetch failed:', error);
      return { success: false as const, error: error instanceof Error ? error.message : 'Could not load your saved data.' };
    }
  });

export const migrateLegacyCollections = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ accessToken: accessInput.shape.accessToken, collections: collectionsSchema }))
  .handler(async ({ data }) => {
    try {
      const { userId, supabase } = await getUserContext(data.accessToken);
      const db = supabase as DbClient;
      const counts: Partial<Record<Resource, number>> = {};
      for (const resource of Object.keys(tableNames) as Resource[]) {
        const items = data.collections[resource];
        if (!items.length) continue;
        const rows = items.map((item) => ({
          id: item.id,
          user_id: userId,
          payload: item.payload,
        }));
        const { error } = await db.from(tableNames[resource])
          .upsert(rows, { onConflict: 'user_id,id', ignoreDuplicates: true });
        if (error) throw new Error('Could not migrate ' + resource.replaceAll('_', ' ') + '.');
        counts[resource] = items.length;
      }
      return { success: true as const, data: counts };
    } catch (error) {
      console.error('[Persistence] Legacy migration failed:', error);
      return { success: false as const, error: error instanceof Error ? error.message : 'Could not migrate your saved data.' };
    }
  });

const syncInput = z.object({
  accessToken: accessInput.shape.accessToken,
  resource: resourceSchema,
  items: z.array(recordSchema).max(2000),
  deletedIds: z.array(z.string().min(1).max(200)).max(2000),
}).superRefine((value, ctx) => {
  validateRecords(value.resource, value.items, ctx, ['items']);
});

export const syncPersistedCollection = createServerFn({ method: 'POST' })
  .inputValidator(syncInput)
  .handler(async ({ data }) => {
    try {
      const { userId, supabase } = await getUserContext(data.accessToken);
      const db = supabase as DbClient;
      const table = tableNames[data.resource];
      if (data.items.length) {
        const rows = data.items.map((item) => ({
          id: item.id,
          user_id: userId,
          payload: item.payload,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await db.from(table).upsert(rows, { onConflict: 'user_id,id' });
        if (error) throw new Error('Could not save ' + data.resource.replaceAll('_', ' ') + '.');
      }
      if (data.deletedIds.length) {
        const { error } = await db.from(table)
          .delete()
          .eq('user_id', userId)
          .in('id', data.deletedIds);
        if (error) throw new Error('Could not delete saved ' + data.resource.replaceAll('_', ' ') + '.');
      }
      return { success: true as const };
    } catch (error) {
      console.error('[Persistence] Sync failed:', error);
      return { success: false as const, error: error instanceof Error ? error.message : 'Could not save your changes.' };
    }
  });
