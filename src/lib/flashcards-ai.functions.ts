import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

const input = z.object({
  topic: z.string().min(2).max(300),
  subject: z.string().max(120).default('General'),
  sourceText: z.string().max(50000).default(''),
  count: z.number().int().min(5).max(40).default(12),
  consent: z.literal(true),
});
const flashcardSchema = z.object({
  cards: z.array(z.object({
    question: z.string().min(3).max(500),
    answer: z.string().min(1).max(1200),
    explanation: z.string().max(1200),
    topic: z.string().max(180),
    difficulty: z.enum(['easy','normal','hard']),
  })).min(1).max(40),
});
export const generateFlashcards = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(input)
  .handler(async ({ data }) => {
    const { structuredAI } = await import('./learning-ai.server');
    const result = await structuredAI(
      flashcardSchema,
      'Create accurate, useful active-recall flashcards for a school student. Questions must test one concept each. Answers must be concise but complete. Explanations clarify why. Stay grounded in supplied source text when present; never invent details absent from it. Avoid duplicates and ambiguous questions. Return only structured output.',
      `Subject: ${data.subject}\nTopic: ${data.topic}\nCreate exactly ${data.count} flashcards.\nSOURCE MATERIAL:\n${data.sourceText}`,
      [],
    );
    if (result.output.cards.length < 1) throw new Error('The AI did not produce any flashcards.');
    return result.output;
  });
