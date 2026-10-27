import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { deckSchema, boardSchema, examSchema, validateSlideCount } from './learning-models';

const source = z.object({ name: z.string(), text: z.string(), images: z.array(z.string().startsWith('data:image/')) });
const input = z.object({ prompt: z.string().min(1).max(100000), sources: z.array(source), consent: z.literal(true) });
export const generateDeck = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(input.extend({ count: z.number(), metadata: z.string(), outline: z.string() }))
  .handler(async ({ data }) => {
    const count = validateSlideCount(data.count);
    const { structuredAI } = await import('./learning-ai.server');
    const slides: z.infer<typeof deckSchema>['slides'] = [];
    let title = '', subject = '', runId: string | undefined;
    // Small batches preserve the student's exact count without imposing a fixed deck limit.
    for (let start = 0; start < count; start += 6) {
      const length = Math.min(6, count - start);
      const result = await structuredAI(deckSchema,
        'You are an editorial presentation designer at Gamma quality and a source-grounded researcher at NotebookLM quality. These are polished presentations, NOT study guides. Build varied bento, timeline, comparison, process, dossier, spotlight and metric layouts. Include substantive specific detail, not filler. Titles <=65 characters; body <=400 characters; at most 4 bullets and 4 cards per slide; each card text <=200 characters. Do not invent numeric metrics. Include visual image prompts where useful. Return precisely the requested batch length.',
        `${data.prompt}\nStudent cover: ${data.metadata}\nApproved outline: ${data.outline}\nTotal slides ${count}. Generate slides ${start+1}-${start+length}. Previous headings: ${slides.map(s => s.heading).join('; ')}. First overall slide is a title cover; last is a meaningful conclusion.`, data.sources, runId);
      if (result.output.slides.length !== length) throw new Error('The generated slide count did not match. No partial deck has been saved.');
      slides.push(...result.output.slides); title ||= result.output.title; subject ||= result.output.subject; runId = result.runId;
    }
    return { title, subject, slides };
  });
export const outlineDeck = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(input.extend({ count: z.number() })).handler(async ({ data }) => {
    validateSlideCount(data.count);
    const { structuredAI } = await import('./learning-ai.server');
    return (await structuredAI(z.object({ headings: z.array(z.string()) }), 'Plan an editorial presentation. Return one specific heading per slide, exact requested count.', `${data.prompt}\n${data.count} slides`, data.sources)).output;
  });
export const editDeckSlide = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(input.extend({ slide: z.string() })).handler(async ({ data }) => {
    const { structuredAI } = await import('./learning-ai.server');
    const { deckSlideSchema } = await import('./learning-models');
    return (await structuredAI(deckSlideSchema, 'Edit only the selected slide following the student request. Preserve factual accuracy, citations and detail unless explicitly changed. Use at most 4 cards/bullets and concise text that fits a presentation.', `${data.prompt}\nCurrent slide: ${data.slide}`, data.sources)).output;
  });
export const explainBoard = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(input.extend({ board: z.string(), history: z.string() })).handler(async ({ data }) => {
    const { structuredAI } = await import('./learning-ai.server');
    return (await structuredAI(boardSchema, 'Be a collaborative visual teacher. Inspect the drawing and selected objects, explain the exact doubt directly and correctly. Produce drawable diagram elements plus a stepwise explanation, not Socratic canned prompts. Coordinates on a 1000 by 650 scene, non-overlapping boxes and labels. Text elements width <=450, font about 22px. Arrow endpoints use width/height offsets. Up to 20 elements; use math and topic-specific diagrams. Reference student elements by their positions when annotating. Do not overwrite student work.', `${data.prompt}\nSelected/current board: ${data.board}\nPrevious discussion: ${data.history}`, data.sources)).output;
  });
export const prepareExam = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(input.extend({ key: z.string() })).handler(async ({ data }) => {
    const { structuredAI } = await import('./learning-ai.server');
    const first = await structuredAI(examSchema, 'Extract only actual MCQ questions from the supplied past paper, exactly four options, preserve question wording. Do not invent past-paper questions. Tag subject, chapter and microconcept. Solve each independently with steps and explanation of each distractor. correct is zero-based 0-3 or null when uncertain. verified=false pending independent verification. Supplied official key is authoritative only when its question numbering maps unambiguously; report conflicting or ambiguous keys. No missing-image guesses.', `${data.prompt}\nAnswer key supplied by student:\n${data.key}`, data.sources);
    const second = await structuredAI(examSchema, 'Independently verify every extracted MCQ by solving again and checking source paper and student-supplied key. Preserve order, options and question wording exactly. Only set verified=true if the solution is unambiguous and the first pass and your independent solution agree, or an unambiguous supplied official key resolves it. Flag conflicts, missing figures and uncertain questions with verified=false and correct=null. Never fabricate verification or official provenance. Provide full steps and why each distractor fails.', `${data.prompt}\nSupplied key: ${data.key}\nFirst pass: ${JSON.stringify(first.output)}`, data.sources, first.runId);
    const questions = second.output.questions.map((q, i) => {
      const original = first.output.questions[i];
      const same = original && q.question === original.question && JSON.stringify(q.options) === JSON.stringify(original.options);
      const agreed = same && q.correct === original.correct;
      return { ...q, verified: Boolean(q.verified && agreed && q.options.length === 4), correct: agreed ? q.correct : null };
    });
    if (!questions.length) throw new Error('No four-option MCQs were found in these sources.');
    return { title: second.output.title, questions };
  });