import { createMiddleware, createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import type { SourceInput } from './learning-models';


type ServerResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

const safeServerBoundary = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    console.error('[Flashcards] Server function boundary failed:', error);
    return { success: false as const, error: 'This request could not be completed. Please sign in again and retry.' };
  }
});

const source = z.object({
  name: z.string().min(1).max(240),
  text: z.string().max(100000),
  images: z.array(z.string().startsWith('data:image/')).max(50),
});
const input = z.object({
  topic: z.string().min(2).max(300),
  subject: z.string().max(120).default('General'),
  sourceText: z.string().max(50000).default(''),
  sources: z.array(source).max(10).default([]),
  count: z.number().int().min(5).max(40).default(12),
  consent: z.literal(true),
});
const flashcardSchema = z.object({
  cards: z.array(z.object({
    type: z.enum(['basic', 'mcq']).default('basic'),
    question: z.string().min(3).max(500),
    answer: z.string().min(1).max(1200),
    explanation: z.string().max(1200).default(''),
    topic: z.string().max(180).default(''),
    difficulty: z.enum(['easy','normal','hard']).default('normal'),
    options: z.array(z.string().min(1).max(400)).max(4).default([]),
    correctOptionIndex: z.number().int().min(0).max(3).nullable().default(null),
  }).superRefine((card, ctx) => {
    if (card.type === 'mcq') {
      if (card.options.length !== 4) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'MCQ cards must have exactly four options.', path: ['options'] });
      if (card.correctOptionIndex === null || card.correctOptionIndex >= card.options.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'MCQ cards must identify a valid correct option.', path: ['correctOptionIndex'] });
    } else if (card.options.length || card.correctOptionIndex !== null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Basic cards must not include MCQ options or a correct option index.', path: ['options'] });
    }
  })).min(1).max(40),
});
export const generateFlashcards = createServerFn({ method: 'POST' })
  .middleware([safeServerBoundary, requireSupabaseAuth])
  .inputValidator(input)
  .handler(async ({ data }): Promise<ServerResult<z.infer<typeof flashcardSchema>>> => {
    try {
    const { structuredAI } = await import('./learning-ai.server');
    const sources: SourceInput[] = [
      ...(data.sources as SourceInput[]),
      ...(data.sourceText.trim() ? [{ name: 'Student notes and exam mistakes', text: data.sourceText, images: [] }] : []),
    ];
    if (!sources.length) throw new Error('Paste notes, upload a PDF, or select exam mistakes before generating cards.');
    const result = await structuredAI(
      flashcardSchema,
      'Create accurate, useful active-recall flashcards for a school student. Generate a balanced mix of approximately 60% basic question-answer cards and 40% four-option MCQ cards (at least one of each when count is 5 or more). For basic cards set type=basic, options=[], correctOptionIndex=null. For MCQ cards set type=mcq, provide exactly four plausible options and correctOptionIndex as a zero-based index from 0 to 3; answer must contain the correct answer text and explanation must explain why it is correct. Questions must test one concept each. Stay grounded in supplied source text and diagrams; never invent details. Avoid duplicates and ambiguous questions. Return only structured output.',
      `Subject: ${data.subject}\nTopic: ${data.topic}\nCreate exactly ${data.count} flashcards. Use the supplied material as the source of truth.`,
      sources,
    );
    if (!result.output.cards.length) throw new Error('The AI did not produce any flashcards.');
    return { success: true, data: result.output };
    } catch (error) {
      console.error('[Flashcards] Generation failed:', error);
      return { success: false, error: 'Could not generate flashcards. Check your source material and try again.' };
    }
  });
