import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { AlertCircle, BookOpen, Braces, CheckCircle2, GraduationCap, Play } from 'lucide-react';
import { OpenMAICCourseware } from '@yanzongzhen/openmaic-courseware-react';
import type { OpenMAICClassroomData } from '@yanzongzhen/openmaic-courseware-react';
import '@yanzongzhen/openmaic-courseware-react/styles.css';

type ClassroomData = OpenMAICClassroomData;

const SAMPLE_CLASSROOM: ClassroomData = {
  id: 'studysmartly-demo',
  stage: {
    id: 'studysmartly-demo',
    name: 'Introduction to the Solar System',
    description: 'A short sample lesson for testing the native OpenMAIC renderer.',
  },
  scenes: [
    {
      id: 'scene-1',
      stageId: 'studysmartly-demo',
      title: 'Our Solar System',
      order: 0,
      type: 'slide',
      content: {
        type: 'slide',
        canvas: {
          id: 'canvas-1',
          viewportSize: 1280,
          viewportRatio: 16 / 9,
          theme: {
            backgroundColor: '#0f172a',
            fontColor: '#f8fafc',
            fontName: 'Arial',
            themeColors: ['#818cf8', '#34d399', '#fbbf24'],
          },
          background: { type: 'solid', color: '#0f172a' },
          elements: [
            {
              id: 'slide-1-title',
              type: 'text',
              left: 88,
              top: 96,
              width: 1104,
              height: 110,
              content: '<p>Our Solar System</p>',
              defaultFontName: 'Arial',
              defaultColor: '#f8fafc',
              fontSize: 54,
            },
            {
              id: 'slide-1-subtitle',
              type: 'text',
              left: 92,
              top: 232,
              width: 1080,
              height: 100,
              content: '<p>One star, eight planets, and countless smaller worlds.</p>',
              defaultFontName: 'Arial',
              defaultColor: '#cbd5e1',
              fontSize: 30,
            },
            {
              id: 'slide-1-fact',
              type: 'text',
              left: 92,
              top: 390,
              width: 1060,
              height: 120,
              content: '<p>The Sun’s gravity keeps planets, dwarf planets, asteroids, and comets in orbit.</p>',
              defaultFontName: 'Arial',
              defaultColor: '#a5b4fc',
              fontSize: 24,
            },
          ],
        },
      },
    },
    {
      id: 'scene-2',
      stageId: 'studysmartly-demo',
      title: 'The Eight Planets',
      order: 1,
      type: 'slide',
      content: {
        type: 'slide',
        canvas: {
          id: 'canvas-2',
          viewportSize: 1280,
          viewportRatio: 16 / 9,
          theme: {
            backgroundColor: '#111827',
            fontColor: '#f8fafc',
            fontName: 'Arial',
            themeColors: ['#38bdf8', '#34d399', '#fbbf24'],
          },
          background: { type: 'solid', color: '#111827' },
          elements: [
            {
              id: 'slide-2-title',
              type: 'text',
              left: 88,
              top: 72,
              width: 1104,
              height: 100,
              content: '<p>The Eight Planets</p>',
              defaultFontName: 'Arial',
              defaultColor: '#f8fafc',
              fontSize: 48,
            },
            {
              id: 'slide-2-inner',
              type: 'text',
              left: 96,
              top: 200,
              width: 1080,
              height: 260,
              content: '<p><b>Inner rocky planets</b><br/>Mercury · Venus · Earth · Mars</p><p><b>Outer giant planets</b><br/>Jupiter · Saturn · Uranus · Neptune</p>',
              defaultFontName: 'Arial',
              defaultColor: '#e2e8f0',
              fontSize: 30,
            },
            {
              id: 'slide-2-fact',
              type: 'text',
              left: 96,
              top: 500,
              width: 1080,
              height: 90,
              content: '<p>Memory tip: the planets are ordered outward from the Sun.</p>',
              defaultFontName: 'Arial',
              defaultColor: '#6ee7b7',
              fontSize: 24,
            },
          ],
        },
      },
    },
  ],
  createdAt: '2026-11-06T00:00:00.000Z',
};

export const Route = createFileRoute('/classroom')({
  head: () => ({
    meta: [
      { title: 'StudySmartly — AI Classroom' },
      { name: 'description', content: 'Render interactive OpenMAIC courseware natively inside StudySmartly.' },
    ],
  }),
  component: ClassroomPage,
});

function ClassroomPage() {
  const [jsonInput, setJsonInput] = useState(() => JSON.stringify(SAMPLE_CLASSROOM, null, 2));
  const [classroom, setClassroom] = useState<ClassroomData | null>(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const loadClassroom = () => {
    try {
      const parsed: unknown = JSON.parse(jsonInput);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('The root JSON value must be an object.');
      }
      const candidate = parsed as Partial<ClassroomData>;
      if (
        typeof candidate.id !== 'string' ||
        !candidate.id.trim() ||
        typeof candidate.createdAt !== 'string' ||
        !candidate.createdAt.trim() ||
        !candidate.stage ||
        typeof candidate.stage !== 'object' ||
        typeof candidate.stage.id !== 'string' ||
        !Array.isArray(candidate.scenes) ||
        candidate.scenes.some((scene) => !scene || typeof scene.id !== 'string')
      ) {
        throw new Error('The classroom JSON must include id, createdAt, a stage with its own id, and scenes with ids.');
      }
      setClassroom(parsed as ClassroomData);
      setError('');
      setLoaded(true);
    } catch (cause) {
      setClassroom(null);
      setLoaded(false);
      setError(cause instanceof Error ? cause.message : 'Unable to parse this classroom JSON.');
    }
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/15 via-slate-900/80 to-emerald-500/10 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-300/20 bg-indigo-300/10 text-indigo-200">
            <GraduationCap size={25} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">Native courseware renderer</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">AI Classroom</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Load an OpenMAIC classroom JSON payload and explore it directly inside StudySmartly. No iframe is used.
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-xl backdrop-blur-xl sm:p-6">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-100">
          <Braces size={17} className="text-indigo-200" />
          Classroom JSON payload
        </div>
        <textarea
          value={jsonInput}
          onChange={(event) => setJsonInput(event.target.value)}
          spellCheck={false}
          aria-label="OpenMAIC classroom JSON"
          className="min-h-[280px] w-full resize-y rounded-xl border border-white/10 bg-slate-950/80 p-4 font-mono text-xs leading-6 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-indigo-300/50 focus:ring-2 focus:ring-indigo-300/10"
        />
        {error && (
          <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-rose-300">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Expected structure: a classroom object with a stage and scenes array.</p>
          <button
            type="button"
            onClick={loadClassroom}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg transition hover:bg-indigo-200"
          >
            <Play size={15} /> Render classroom
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <BookOpen size={17} className="text-emerald-300" />
            Native classroom preview
          </div>
          {loaded && (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
              <CheckCircle2 size={14} /> JSON parsed
            </span>
          )}
        </div>
        {classroom ? (
          <div className="min-h-[560px] bg-slate-950">
            <OpenMAICCourseware
              classroom={classroom}
              height="80vh"
              theme="dark"
              showToolbar
              onError={(cause) => setError(cause.message || 'The OpenMAIC renderer could not load this classroom.')}
            />
          </div>
        ) : (
          <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400">
              <BookOpen size={25} />
            </div>
            <p className="text-sm font-semibold text-slate-200">Your classroom preview will appear here</p>
            <p className="max-w-md text-xs leading-5 text-slate-500">Paste a valid OpenMAIC classroom JSON payload above, then select Render classroom.</p>
          </div>
        )}
      </section>
    </main>
  );
}
