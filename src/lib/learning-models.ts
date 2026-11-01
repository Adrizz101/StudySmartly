import { z } from 'zod';

export const layouts = ['title', 'bento', 'timeline', 'comparison', 'process', 'spotlight', 'dossier', 'stats', 'content', 'split', 'summary'] as const;
export const deckSlideSchema = z.object({
  heading: z.string(), body: z.string(), category: z.string(),
  layout: z.enum(layouts), bullets: z.array(z.string()),
  cards: z.array(z.object({ title: z.string(), text: z.string(), value: z.string() })),
  citations: z.array(z.string()), imagePrompt: z.string(),
});
export const deckSchema = z.object({ title: z.string(), subject: z.string(), slides: z.array(deckSlideSchema) });
export const boardSchema = z.object({
  diagram_image_prompt: z.string().optional().describe('A concise image-generation prompt for a clear textbook-style educational diagram, when a visual topic benefits from an illustration.'),
  session_title: z.string().min(2).max(48).refine((value) => { const words = value.trim().split(/\s+/).filter(Boolean).length; return words >= 2 && words <= 4; }, 'Session title must contain 2–4 words.').describe('A concise 2–4 word title for this tutoring session.'),
  spoken_script: z.string().min(1).describe('A natural, conversational spoken explanation written in complete sentences.'),
  board_elements: z.array(z.object({
    type: z.enum(['text', 'rectangle', 'ellipse', 'arrow', 'line']),
    x: z.number(), y: z.number(), width: z.number(), height: z.number(),
    text: z.string().describe('Clear, readable plain text.'),
  })).min(1).max(20),
  chat_response: z.string().min(1).describe('A brief, direct reply written as a complete sentence.'),
  citations: z.array(z.string()),
});
export const questionSchema = z.object({
  question: z.string(), options: z.array(z.string()), correct: z.number().nullable(),
  subject: z.string(), chapter: z.string(), concept: z.string(),
  steps: z.array(z.string()), distractors: z.array(z.string()),
  evidence: z.string(), verified: z.boolean(),
});
export const examSchema = z.object({ title: z.string(), questions: z.array(questionSchema) });


export const syllabusExtractionSchema = z.object({
  topics: z.array(z.object({
    subject: z.string().min(1),
    chapter: z.string().min(1),
    concept: z.string().min(1),
    priority: z.enum(['High', 'Normal', 'Low']),
    mastery: z.number().min(0).max(100),
  })),
});
export type SyllabusExtraction = z.infer<typeof syllabusExtractionSchema>;

export const mistakeAnalysisSchema = z.object({
  summary: z.string().min(1),
  strengths: z.array(z.string()).max(4),
  findings: z.array(z.object({
    subject: z.string(),
    chapter: z.string(),
    concept: z.string(),
    pattern: z.enum(['concept_gap', 'misreading', 'calculation', 'recall', 'application', 'careless_or_unclear']),
    evidence: z.string(),
    explanation: z.string(),
    next_steps: z.array(z.string()).min(1).max(4),
  })).max(8),
  practice: z.array(z.object({
    question: z.string(),
    options: z.array(z.string()).length(4),
    correct: z.number().int().min(0).max(3),
    explanation: z.string(),
    concept: z.string(),
  })).max(5),
});
export type MistakeAnalysis = z.infer<typeof mistakeAnalysisSchema>;

export type ExamQuestion = z.infer<typeof questionSchema>;
export type Exam = z.infer<typeof examSchema>;
export type BoardAnswer = z.infer<typeof boardSchema>;
export interface SourceInput { name: string; text: string; images: string[] }
export interface Attempt { id: string; exam: Exam; answers: Record<number, number>; submittedAt: number }

export function validateSlideCount(count: number) {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('Choose a positive whole number of slides.');
  return count;
}
export function canGrade(q: ExamQuestion) {
  return q.verified && q.options.length === 4 && q.correct !== null && Number.isInteger(q.correct) && q.correct >= 0 && q.correct < 4;
}
export function scoreExam(exam: Exam, answers: Record<number, number>) {
  let correct = 0, incorrect = 0, unattempted = 0, excluded = 0;
  exam.questions.forEach((q, i) => {
    if (!canGrade(q)) { excluded++; return; }
    if (answers[i] === undefined) unattempted++;
    else if (answers[i] === q.correct) correct++;
    else incorrect++;
  });
  const total = correct + incorrect + unattempted;
  return { correct, incorrect, unattempted, excluded, total, percentage: total ? Math.round(correct / total * 100) : 0 };
}
export function diagnose(attempts: Attempt[]) {
  const rows = new Map<string, { subject: string; chapter: string; concept: string; correct: number; total: number; wrong: string[] }>();
  for (const a of attempts) a.exam.questions.forEach((q, i) => {
    if (!canGrade(q)) return;
    const key = `${q.subject}|${q.chapter}|${q.concept}`;
    const r = rows.get(key) ?? { subject: q.subject, chapter: q.chapter, concept: q.concept, correct: 0, total: 0, wrong: [] };
    r.total++; if (a.answers[i] === q.correct) r.correct++; else r.wrong.push(q.steps.join(' '));
    rows.set(key, r);
  });
  return [...rows.values()].sort((a,b) => a.correct/a.total - b.correct/b.total);
}
