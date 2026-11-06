import { useState, type ComponentProps } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { OpenMAICCourseware } from '@yanzongzhen/openmaic-courseware-react';
import '@yanzongzhen/openmaic-courseware-react/styles.css';
import { AlertCircle, BookOpen, GraduationCap, Upload } from 'lucide-react';

type ClassroomData = NonNullable<ComponentProps<typeof OpenMAICCourseware>['classroom']>;

export const Route = createFileRoute('/classroom')({
  head: () => ({
    meta: [
      { title: 'StudySmartly — AI Classroom' },
      { name: 'description', content: 'Load and explore immersive, multi-agent OpenMAIC lessons.' },
    ],
  }),
  component: ClassroomPage,
});

function ClassroomPage() {
  const [jsonInput, setJsonInput] = useState('');
  const [classroom, setClassroom] = useState<ClassroomData | null>(null);
  const [error, setError] = useState('');
  const [rendererError, setRendererError] = useState('');

  const loadClassroom = () => {
    setError('');
    setRendererError('');
    try {
      const parsed: unknown = JSON.parse(jsonInput);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('The JSON must contain a classroom object.');
      }
      const root = parsed as Record<string, unknown>;
      const classroomData = root.classroom && typeof root.classroom === 'object'
        ? root.classroom
        : parsed;
      if (!classroomData || typeof classroomData !== 'object' || Array.isArray(classroomData)) {
        throw new Error('The JSON does not contain a valid classroom object.');
      }
      setClassroom(classroomData as ClassroomData);
    } catch (cause) {
      setClassroom(null);
      setError(cause instanceof Error ? cause.message : 'Could not read this JSON. Check the format and try again.');
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/15 via-slate-900/80 to-emerald-500/10 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-300/20 bg-indigo-300/10 text-indigo-200">
            <GraduationCap size={25} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">Immersive learning space</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">AI Classroom</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Load an OpenMAIC lesson to explore guided slides, quizzes, and interactive classroom scenes.
              Generate your classroom with OpenMAIC, then paste its exported JSON below.
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-xl backdrop-blur-xl sm:p-6">
        <div className="mb-3 flex items-center gap-2 text-white">
          <Upload size={18} className="text-emerald-300" />
          <h2 className="font-semibold">Import a classroom</h2>
        </div>
        <label htmlFor="openmaic-classroom-json" className="mb-2 block text-sm text-slate-300">
          Paste the generated OpenMAIC classroom JSON
        </label>
        <textarea
          id="openmaic-classroom-json"
          value={jsonInput}
          onChange={(event) => setJsonInput(event.target.value)}
          placeholder="Paste your classroom JSON here…"
          spellCheck={false}
          className="min-h-52 w-full resize-y rounded-xl border border-white/10 bg-slate-950/70 p-4 font-mono text-xs leading-6 text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/10"
        />
        {error && (
          <p role="alert" className="mt-3 flex items-start gap-2 text-sm text-rose-300">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">This viewer renders exported classroom data in your browser. Generating a new lesson still requires an OpenMAIC generation service.</p>
          <button
            type="button"
            onClick={loadClassroom}
            disabled={!jsonInput.trim()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <BookOpen size={16} /> Load Classroom
          </button>
        </div>
      </section>

      {classroom && (
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <GraduationCap size={17} className="text-emerald-300" /> Loaded OpenMAIC lesson
            </div>
            <button type="button" onClick={() => { setClassroom(null); setRendererError(''); }} className="text-xs text-slate-400 underline underline-offset-4 hover:text-white">
              Close lesson
            </button>
          </div>
          {rendererError && <p role="alert" className="p-4 text-sm text-rose-300">{rendererError}</p>}
          <div className="min-h-[620px] bg-white text-slate-950">
            <OpenMAICCourseware
              classroom={classroom}
              height="min(82vh, 980px)"
              showToolbar
              theme="system"
              onError={(cause) => setRendererError(cause.message || 'The classroom renderer could not load this lesson.')}
            />
          </div>
        </section>
      )}
    </div>
  );
}
