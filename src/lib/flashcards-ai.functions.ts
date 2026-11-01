import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import type { SourceInput } from './learning-models';

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
    question: z.string().min(3).max(500),
    answer: z.string().min(1).max(1200),
    explanation: z.string().max(1200).default(''),
    topic: z.string().max(180).default(''),
    difficulty: z.enum(['easy','normal','hard']).default('normal'),
  })).min(1).max(40),
});
export const generateFlashcards = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input)
  .handler(async ({ data }) => {
    const { structuredAI } = await import('./learning-ai.server');
    const sources: SourceInput[] = [
      ...(data.sources as SourceInput[]),
      ...(data.sourceText.trim() ? [{ name: 'Student notes and exam mistakes', text: data.sourceText, images: [] }] : []),
    ];
    if (!sources.length) throw new Error('Paste notes, upload a PDF, or select exam mistakes before generating cards.');
    const result = await structuredAI(
      flashcardSchema,
      'Create accurate, useful active-recall flashcards for a school student. Questions must test one concept each. Answers must be concise but complete. Explanations clarify why. Stay grounded in supplied source text and diagrams; never invent details absent from them. Avoid duplicates and ambiguous questions. Return only structured output.',
      `Subject: ${data.subject}\nTopic: ${data.topic}\nCreate exactly ${data.count} flashcards. Use the supplied material as the source of truth.`,
      sources,
    );
    if (!result.output.cards.length) throw new Error('The AI did not produce any flashcards.');
    return result.output;
  });
