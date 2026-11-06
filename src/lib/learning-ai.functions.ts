import { createMiddleware, createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { deckSchema, boardSchema, examSchema, mistakeAnalysisSchema, revisionPackageSchema, validateSlideCount } from './learning-models';


type ServerResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

async function safeResult<T>(
  feature: string,
  friendlyMessage: string,
  operation: () => Promise<T> | T,
): Promise<ServerResult<T>> {
  try {
    return { success: true, data: await operation() };
  } catch (error) {
    console.error(`[Learning AI] ${feature} failed:`, error);
    return { success: false, error: friendlyMessage };
  }
}

const safeServerBoundary = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    console.error('[Learning AI] Server function boundary failed:', error);
    return { success: false as const, error: 'This request could not be completed. Please sign in again and retry.' };
  }
});

const source = z.object({ name: z.string(), text: z.string(), images: z.array(z.string().startsWith('data:image/')) });
const input = z.object({ prompt: z.string().min(1).max(100000), sources: z.array(source), consent: z.literal(true) });
export const generateDeck = createServerFn({ method: 'POST' }).middleware([safeServerBoundary, requireSupabaseAuth])
  .inputValidator(input.extend({ count: z.number(), metadata: z.string(), outline: z.string() }))
  .handler(async ({ data }) => safeResult('generateDeck', 'Could not generate the presentation. Please try again.', async () => {
    const count = validateSlideCount(data.count);
    const { structuredAI } = await import('./learning-ai.server');
    const slides: z.infer<typeof deckSchema>['slides'] = [];
    let title = '', subject = '', runId: string | undefined;
    // Small batches preserve the student's exact count without imposing a fixed deck limit.
    for (let start = 0; start < count; start += 6) {
      const length = Math.min(6, count - start);
      const result = await structuredAI(deckSchema,
        'You are an editorial presentation designer at Gamma quality and a source-grounded researcher at NotebookLM quality. These are polished presentations, NOT study guides. Return only content conforming to the supplied structured-output schema; do not add prose or markdown. Build varied bento, timeline, comparison, process, dossier, spotlight and metric layouts. Include substantive specific detail, not filler. Titles <=65 characters; body <=400 characters; at most 4 bullets and 4 cards per slide; each card text <=200 characters. Do not invent numeric metrics. Include visual image prompts where useful. Return precisely the requested batch length.',
        `${data.prompt}\nStudent cover: ${data.metadata}\nApproved outline: ${data.outline}\nTotal slides ${count}. Generate slides ${start+1}-${start+length}. Previous headings: ${slides.map(s => s.heading).join('; ')}. First overall slide is a title cover; last is a meaningful conclusion.`, data.sources, runId);
      if (result.output.slides.length !== length) throw new Error('The generated slide count did not match. No partial deck has been saved.');

      // Resolve stock imagery on the server so the Pexels API key is never exposed to the browser.
      const { fetchWebImage } = await import('./web-images.server');
      const slidesWithImages = await Promise.all(result.output.slides.map(async (slide) => {
        const searchQuery = slide.imagePrompt.trim() || slide.heading;
        const webImage = await fetchWebImage(searchQuery);
        const fallbackImage = `https://image.pollinations.ai/prompt/${encodeURIComponent(searchQuery)}?width=1200&height=675&nologo=true`;
        return {
          ...slide,
          image: webImage ?? fallbackImage,
        };
      }));

      slides.push(...slidesWithImages); title ||= result.output.title; subject ||= result.output.subject; runId = result.runId;
    }
    return { title, subject, slides };
  }));
export const outlineDeck = createServerFn({ method: 'POST' }).middleware([safeServerBoundary, requireSupabaseAuth])
  .inputValidator(input.extend({ count: z.number() })).handler(async ({ data }) => safeResult('outlineDeck', 'Could not create the presentation outline. Please try again.', async () => {
    validateSlideCount(data.count);
    const { structuredAI } = await import('./learning-ai.server');
    return (await structuredAI(z.object({ headings: z.array(z.string()) }), 'Plan an editorial presentation. Return one specific heading per slide, exact requested count. Return only content conforming to the supplied structured-output schema; do not add prose or markdown.', `${data.prompt}\n${data.count} slides`, data.sources)).output;
  }));
export const editDeckSlide = createServerFn({ method: 'POST' }).middleware([safeServerBoundary, requireSupabaseAuth])
  .inputValidator(input.extend({ slide: z.string() })).handler(async ({ data }) => safeResult('editDeckSlide', 'Could not edit this slide. Please try again.', async () => {
    const { structuredAI } = await import('./learning-ai.server');
    const { deckSlideSchema } = await import('./learning-models');
    return (await structuredAI(deckSlideSchema, 'Edit only the selected slide following the student request. Preserve factual accuracy, citations and detail unless explicitly changed. Use at most 4 cards/bullets and concise text that fits a presentation.', `${data.prompt}\nCurrent slide: ${data.slide}`, data.sources)).output;
  }));
export const explainBoard = createServerFn({ method: 'POST' }).middleware([safeServerBoundary, requireSupabaseAuth])
  .inputValidator(input.extend({ board: z.string(), messages: z.array(z.object({ question: z.string(), answer: z.string(), citations: z.array(z.string()) })) })).handler(async ({ data }) => safeResult('explainBoard', 'Could not explain the whiteboard. Please try again.', async () => {
    const { structuredAI } = await import('./learning-ai.server');
    const tutorPrompt = [
      'You are an interactive visual tutor: a warm, encouraging, patient classroom teacher and precise educational whiteboard illustrator. Make the student feel comfortable asking questions; never shame them or imply that a doubt is obvious.',
      'Respond naturally to interruptions and follow-up doubts. If the student asks a question during an explanation, acknowledge it briefly and positively (for example, “That is a good question. Let us look at it.”), then answer that exact doubt before continuing. Use the previous discussion as context, but prioritize the newest question.',
      'Teach the reasoning, not just the result or a narration of what is written on the board. Explain why each step, relationship, diagram, or arrow is used; connect the visual representation to the underlying concept and use a short example when it improves understanding. spoken_script must sound like a real teacher speaking directly to one student, with natural transitions and complete grammatical sentences. chat_response must be a concise, direct, encouraging reply written as complete sentences. Never output fragments, gibberish, placeholders, or unfinished sentences.',
      'Maintain context from the full messages array supplied with this request. Treat each question and tutor response as the conversation history, not just the latest turn.',
      'For visual topics such as a leaf, flower, human organ, machine, engine, or scientific structure, generate diagram_image_prompt: a concise, specific prompt for a detailed textbook-quality educational illustration with a plain light background, scientifically accurate structure, clear proportions, and no embedded labels, lettering, captions, or watermark. If explaining a visual topic, board_elements must contain ONLY text and arrow elements that act as labels pointing to parts of the generated image; never create rectangles, ellipses, flowcharts, or a substitute drawing. The illustration is centered at x: 550, y: 700, width: 500, height: 400 in the 1600 by 1800 coordinate space. Place short text labels in the side margins (x: 30–350 on the left or x: 1120–1500 on the right), spaced vertically around y: 650–1150. Place arrows between each label and its corresponding image feature; arrows should point inward toward the correct structure and must not cross unnecessarily. Keep labels compact and specific. For non-visual topics, leave diagram_image_prompt empty or omit it and use suitable flowcharts, comparisons, sequences, cause-and-effect layouts, rectangles, ellipses, and arrows.',
      'CRITICAL LAYOUT RULE: For image-based diagrams, follow the image-and-label coordinates above and do not apply the vertical-stack layout. For non-image lessons, space elements vertically, start at y: 100, and increase each subsequent row by exactly 180. Avoid overlaps.',
      'Generate session_title as a concise topic-based title of 2–4 words. Use readable plain text and meaningful labels. Use a 1600 by 1800 coordinate space. For non-visual topics only, use rectangles to group related information and arrows to connect concepts. Keep each element purposeful and ensure all text fits inside its box. Return at most 12 elements.',
      'Never use LaTeX, markdown, dollar signs, backslashes, subscripts, or math delimiters. Write chemical formulas as CO2, H2O, and C6H12O6. Reference student elements by position when annotating. Do not overwrite student work.',
    ].join(' ');
    return (await structuredAI(
      boardSchema,
      tutorPrompt,
      `${data.prompt}\nSelected/current board: ${data.board}\nFull messages array (oldest to newest): ${JSON.stringify(data.messages)}`,
      data.sources,
    )).output;
  }));
export const prepareExam = createServerFn({ method: 'POST' }).middleware([safeServerBoundary, requireSupabaseAuth])
  .inputValidator(input.extend({ key: z.string() })).handler(async ({ data }) => safeResult('prepareExam', 'Could not prepare the exam. Check the source and try again.', async () => {
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
  }));


export const analyzeExamMistakes = createServerFn({ method: 'POST' }).middleware([safeServerBoundary, requireSupabaseAuth])
  .inputValidator(input.extend({
    attempt: z.object({
      exam: examSchema,
      answers: z.record(z.string(), z.number().int().min(0).max(3)),
    }),
  }))
  .handler(async ({ data }) => safeResult('analyzeExamMistakes', 'Could not analyse these mistakes. Complete a test with verified incorrect answers, then retry.', async () => {
    const missed = data.attempt.exam.questions.flatMap((q, index) => {
      const answer = data.attempt.answers[String(index)];
      if (!q.verified || q.correct === null || answer === undefined || answer === q.correct) return [];
      return [{
        question: q.question,
        options: q.options,
        studentAnswer: q.options[answer] ?? 'No answer',
        correctAnswer: q.options[q.correct],
        subject: q.subject,
        chapter: q.chapter,
        concept: q.concept,
        solution: q.steps,
        distractors: q.distractors,
      }];
    });
    if (!missed.length) {
      throw new Error('There are no verified incorrect answers to analyse. Complete a test with at least one mistake first.');
    }
    const { structuredAI } = await import('./learning-ai.server');
    const result = await structuredAI(
      mistakeAnalysisSchema,
      'You are a careful, supportive school learning diagnostician. Analyse only the supplied incorrect answers. Identify plausible learning patterns from evidence, but do not claim certainty from one question. Do not shame the student or label them. Give concise explanations and practical next steps. Generate up to five new four-option practice questions that test the same concepts without copying the original wording. Ensure each practice answer index is correct and explanations are accurate. Do not invent student history or claim to know why an error occurred if evidence is insufficient.',
      `Analyse these verified mistakes from the student's completed test. Return a concise report grounded in the supplied questions and solutions only:\n${JSON.stringify(missed)}`,
      [],
    );
    return result.output;
  }));



export const extractSyllabusTopics = createServerFn({ method: 'POST' })
  .middleware([safeServerBoundary, requireSupabaseAuth])
  .inputValidator(z.object({
    text: z.string().max(1000000),
    images: z.array(z.string().startsWith('data:image/')).max(50).default([]),
  }))
  .handler(async ({ data }) => safeResult('extractSyllabusTopics', 'Could not extract syllabus topics. Check the file or text and try again.', async () => {
    const { extractTopicsFromText } = await import('./learning-ai.server');
    return extractTopicsFromText(data.text, data.images);
  }));


export const generateRevisionPackage = createServerFn({ method: 'POST' })
  .middleware([safeServerBoundary, requireSupabaseAuth])
  .inputValidator(z.object({
    title: z.string().min(1).max(200),
    transcript: z.string().min(1).max(100000),
    consent: z.literal(true),
  }))
  .handler(async ({ data }) => safeResult('generateRevisionPackage', 'Could not create the revision package. Please try again.', async () => {
    const { structuredAI } = await import('./learning-ai.server');
    const result = await structuredAI(
      revisionPackageSchema,
      'Create a source-grounded lecture revision package. Write concise, well-organised summary notes, extract the important definitions that are explicitly supported by the transcript, and create exactly three useful four-option practice MCQs. Each correctIndex is zero-based. Ensure exactly one correct answer per question and provide a brief explanation. Do not invent facts absent from the transcript; if a term is unclear, omit it rather than guessing.',
      `Lecture: ${data.title}\nCreate a revision package from this transcript:\n${data.transcript}`,
      [],
    );
    return result.output;
  }));

export const parseScheduleWithAI = createServerFn({ method: 'POST' })
  .middleware([safeServerBoundary, requireSupabaseAuth])
  .inputValidator(z.object({ text: z.string().trim().min(1).max(100000) }))
  .handler(async ({ data }) => safeResult('parseScheduleWithAI', 'Could not parse schedule. Please check the format.', async () => {
      const { parseScheduleWithAI: parseSchedule } = await import('./learning-ai.server');
      const result = await parseSchedule(data.text);
      return result.events;
    }));
