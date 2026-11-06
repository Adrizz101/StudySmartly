import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ExternalLink, GraduationCap, RefreshCw } from 'lucide-react';

const DEFAULT_LESSON_URL = 'https://open.maic.chat';

export const Route = createFileRoute('/classroom')({
  head: () => ({
    meta: [
      { title: 'StudySmartly — AI Classroom' },
      { name: 'description', content: 'Open interactive lessons in the OpenMAIC AI Classroom.' },
    ],
  }),
  component: ClassroomPage,
});

function isValidLessonUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'open.maic.chat';
  } catch {
    return false;
  }
}

function ClassroomPage() {
  const [inputUrl, setInputUrl] = useState(DEFAULT_LESSON_URL);
  const [lessonUrl, setLessonUrl] = useState(DEFAULT_LESSON_URL);
  const [error, setError] = useState('');

  const loadLesson = () => {
    const nextUrl = inputUrl.trim();
    if (!isValidLessonUrl(nextUrl)) {
      setError('Enter a valid HTTPS OpenMAIC lesson URL (open.maic.chat).');
      return;
    }
    setError('');
    setLessonUrl(nextUrl);
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">Immersive learning space</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">AI Classroom</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Open OpenMAIC lessons in a dedicated browser tab. This avoids the blank embedded renderer and lets OpenMAIC run in its own supported environment.
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-xl backdrop-blur-xl sm:p-6">
        <label htmlFor="openmaic-lesson-url" className="mb-2 block text-sm font-medium text-slate-200">
          OpenMAIC lesson URL
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="openmaic-lesson-url"
            type="url"
            value={inputUrl}
            onChange={(event) => setInputUrl(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') loadLesson(); }}
            placeholder="https://open.maic.chat/classroom/..."
            autoComplete="url"
            className="min-h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-indigo-300/50 focus:ring-2 focus:ring-indigo-300/10"
          />
          <button
            type="button"
            onClick={loadLesson}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            <RefreshCw size={16} /> Use this lesson
          </button>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
      </section>

      <section className="overflow-hidden rounded-3xl border border-indigo-300/20 bg-gradient-to-br from-indigo-500/15 via-slate-950/90 to-slate-900 p-6 shadow-2xl sm:p-10">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-200/20 bg-indigo-300/10 text-indigo-200">
            <GraduationCap size={32} />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-200">Ready to learn</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">Continue in OpenMAIC</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Your lesson will open in a new tab, where the full OpenMAIC classroom experience can run independently of StudySmartly.
          </p>
          <a
            href={lessonUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-indigo-300 px-7 py-4 text-base font-bold text-slate-950 shadow-xl shadow-indigo-950/30 transition hover:-translate-y-0.5 hover:bg-indigo-200 sm:w-auto"
          >
            Open in New Tab <ExternalLink size={18} />
          </a>
          <p className="mt-4 max-w-full truncate text-xs text-slate-500">{lessonUrl}</p>
        </div>
      </section>
    </main>
  );
}
