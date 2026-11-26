import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Calendar, Check, ClipboardCheck, FileText,
  LayoutDashboard, Mic, PenTool, Sparkles, X, Zap, KeyRound,
} from 'lucide-react';

const steps = [
  { title: 'Welcome to StudySmartly', icon: Sparkles, what: 'Your AI-powered study workspace brings planning, visual learning, exam practice, presentations, and lecture notes together in one place.', how: 'Use the sidebar to navigate between the different tools. Each workspace supports a different part of your learning routine. This tour introduces the main tools and explains when each one is useful.', when: 'Start here whenever you want a quick overview of the platform.', tip: 'Replay this Academy tour at any time from Settings.' },
  { title: 'The Dashboard', icon: LayoutDashboard, what: 'Your central hub gives you a snapshot of your study activity and what is coming up next.', how: 'Review your daily stats, check the upcoming schedule, and use dashboard shortcuts to jump into active courses and study tools.', when: 'Visit the Dashboard whenever you log in, then use your schedule and priorities to plan the day.', tip: 'Choose one realistic priority first. A short, focused session is easier to start than an overloaded task list.' },
  { title: 'Adaptive Study Planner', icon: Calendar, what: 'A structured planning workspace that turns syllabus topics and available study time into an actionable plan.', how: 'Paste your syllabus or upload a supported PDF, select “Extract Topics”, review the extracted topics, and then select “Generate Plan”. When a linked study session is complete, click “Done” to update topic mastery and schedule a review three days later.', when: 'Set it up at the start of a term, after receiving a syllabus, or whenever a large workload feels difficult to organise.', tip: 'Review extracted topics before generating the plan. Correcting topic names early makes later tracking more useful.' },
  { title: 'AI Tutor', icon: PenTool, what: 'A study chat where you can ask questions, upload PDFs or images, and generate interactive visual concept maps.', how: 'Open AI Tutor, enter a question or topic, and optionally attach a PDF or image. After the tutor responds, use Visualize to create an interactive concept map of the topic.', when: 'Use it to understand difficult concepts, work through textbook material, or review a topic visually.', tip: 'Ask one focused question at a time, then use Visualize when a concept map would help you see how the ideas connect.' },
  { title: 'PYQ Exam Arena', icon: ClipboardCheck, what: 'A practice-test workspace that turns past-paper material into questions and helps you review mistakes.', how: 'Paste past-paper questions or source material to generate MCQs, then take the test and submit your answers. Open Mistake Analyzer to review the concepts behind incorrect answers. Select “Explain with AI Tutor” to continue the topic in the Tutor chat.', when: 'Use it during regular revision and increase practice in the one to two weeks before an exam.', tip: 'Spend time understanding why an answer was wrong. Reattempting a similar question is more useful than only checking the score.' },
  { title: 'Presentation Studio', icon: FileText, what: 'An AI-assisted slide workspace for turning a topic into a structured visual presentation.', how: 'Enter your topic and generate a slide deck. Review the visual layouts, edit slide text directly, and use the export option to create a PDF when your deck is ready.', when: 'Use it to create revision decks, study guides, or project presentations.', tip: 'Check facts, spelling, image relevance, and slide readability before exporting AI-generated material.' },
  { title: 'Lecture Transcriber', icon: Mic, what: 'A speech-to-text workspace designed to turn supported live audio into text notes.', how: 'Open the Transcriber and grant microphone permission when your browser asks. Start recording to capture and transcribe supported audio, then review the transcript and correct names or technical terms.', when: 'Use it during a live class or while reviewing a recorded lecture, where recording is permitted.', tip: 'Follow your school’s rules and get required permission before recording a teacher or other people. Keep your own concise summary alongside the transcript.' },
  { title: 'Pro Tips & Settings', icon: Zap, what: 'Settings lets you configure your account and personalise the study workspace.', how: 'Open Settings to set a password fallback after email-code sign-in, change theme and accent colour, adjust Pomodoro focus and break settings, configure optional connectors, and replay this Academy tour.', when: 'Visit Settings when you first configure the app, when preferences change, or whenever you need to revisit the tutorial.', tip: 'Built-in browser features and existing free connectors work without adding an API key. Optional provider keys may have their own pricing or usage limits.' },
  { title: 'Unlimited AI & Limits', icon: KeyRound, what: 'StudySmartly is 100% free. Because I use shared free-tier AI keys, there is a limit of 15 AI actions per day so everyone gets a fair share. Want unlimited access? Go to Settings and paste in your own free Gemini or OpenRouter API key. The app will use your key and bypass all limits!', how: 'In Settings, open “Bring Your Own Key (Unlimited AI)”. Expand “How to get your free API keys” for step-by-step instructions for Google AI Studio and OpenRouter, then paste your key into the matching field and save.', when: 'Use your own provider key if you reach the shared daily allowance or want AI requests to use your own provider account.', tip: 'This bypasses StudySmartly’s shared 15-action cap, not your provider’s own quotas, model availability, or terms. Check the provider’s current free-tier conditions.' },
];

type StudyAcademyProps = { onClose: () => void };

export default function StudyAcademy({ onClose }: StudyAcademyProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const reduceMotion = useReducedMotion();
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  const activeStep = steps[step];
  const Icon = activeStep.icon;

  const finish = useCallback(() => {
    try { window.localStorage.setItem('studysmartly_academy_seen', 'true'); }
    catch (error) { console.warn('[StudySmartly Academy] Could not save tutorial preference:', error); }
    onClose();
  }, [onClose]);

  const move = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  useEffect(() => {
    nextButtonRef.current?.focus();
  }, [step]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const slide = {
    enter: (travel: number) => ({ opacity: 0, x: reduceMotion ? 0 : travel * 44 }),
    center: { opacity: 1, x: 0 },
    exit: (travel: number) => ({ opacity: 0, x: reduceMotion ? 0 : travel * -44 }),
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/80 px-3 py-5 backdrop-blur-xl sm:px-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) finish(); }}>
      <motion.section role="dialog" aria-modal="true" aria-labelledby="academy-title" aria-describedby="academy-description"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 22, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: reduceMotion ? 0.12 : 0.28, ease: 'easeOut' }}
        className="relative my-auto w-full max-w-2xl overflow-hidden rounded-3xl border border-white/15 bg-[#10151b]/95 shadow-[0_30px_100px_rgba(0,0,0,0.65)]">
        <div className="h-1.5 w-full bg-white/10">
          <motion.div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-300" initial={false} animate={{ width: String(((step + 1) / steps.length) * 100) + '%' }} transition={{ duration: reduceMotion ? 0 : 0.35, ease: 'easeOut' }} />
        </div>
        <div className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-8 sm:pt-7">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-300">StudySmartly Academy</p><p className="mt-1 text-xs font-medium text-slate-400">Step {step + 1} of {steps.length}</p></div>
          <button type="button" onClick={finish} aria-label="Close Academy tutorial" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"><X size={18} /></button>
        </div>
        <div className="min-h-[390px] px-5 pb-5 pt-7 sm:min-h-[410px] sm:px-8 sm:pb-7">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div key={step} custom={direction} variants={slide} initial="enter" animate="center" exit="exit" transition={{ duration: reduceMotion ? 0.12 : 0.24, ease: [0.22, 1, 0.36, 1] }} className="space-y-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-300"><Icon size={27} strokeWidth={1.8} /></div>
              <div><h2 id="academy-title" className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{activeStep.title}</h2><p id="academy-description" className="mt-3 text-sm leading-7 text-slate-300 sm:text-[15px]">{activeStep.what}</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 sm:p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">How to use it</p><p className="mt-2 text-sm leading-7 text-slate-300">{activeStep.how}</p>
                <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">When to use it</p><p className="mt-2 text-sm leading-7 text-slate-300">{activeStep.when}</p>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[0.07] p-3.5"><Zap size={17} className="mt-0.5 shrink-0 text-amber-300" /><p className="text-xs leading-6 text-amber-100/90"><span className="font-bold text-amber-200">Pro Tip: </span>{activeStep.tip}</p></div>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/20 px-5 py-4 sm:px-8">
          <button type="button" onClick={finish} className="min-h-11 rounded-xl px-3 text-sm font-medium text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">Skip tour</button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => move(step - 1)} disabled={step === 0} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-semibold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"><ArrowLeft size={16} /> Back</button>
            <button ref={nextButtonRef} type="button" onClick={() => step === steps.length - 1 ? finish() : move(step + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-300 px-5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-950/25 transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#10151b]">
              {step === steps.length - 1 ? <><Check size={16} /> Finish</> : <>Next <ArrowRight size={16} /></>}
            </button>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
