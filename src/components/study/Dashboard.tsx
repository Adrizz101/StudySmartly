import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { useApp } from '@/store';
import { ViewKey } from '@/types';
import { Calendar, Bot, FileText, Mic, BookOpen, Clock, TrendingUp, AlertCircle, Plus, Layers3, Brain } from 'lucide-react';
import { formatDateLabel, formatTimeLabel } from '@/lib/syllabus';
import { useGamification } from '@/lib/useGamification';

interface DashboardProps {
  onNavigate: (v: ViewKey) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { courses, events, tutorSessions, documents, transcriptions, settings } = useApp();
  const { stats: gamification } = useGamification();
  type NextSession = { kind: 'flashcards'; deckId: string; subject: string; topic: string; count: number } | { kind: 'topic'; subject: string; topic: string; chapter: string; mastery: number };
  const [nextSession, setNextSession] = useState<NextSession | null>(null);
  const [nextSessionLoading, setNextSessionLoading] = useState(true);
  const [nextSessionError, setNextSessionError] = useState(false);
  type WeakTopic = { subject: string; chapter: string; concept: string; mastery_score: number };
  const [learningTwinTopics, setLearningTwinTopics] = useState<WeakTopic[]>([]);
  const [learningTwinLoading, setLearningTwinLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadLearningTwin() {
      try {
        const { data, error } = await (supabase as any).from('learning_topics')
          .select('subject, chapter, concept, mastery_score')
          .lt('mastery_score', 50)
          .order('mastery_score', { ascending: true })
          .limit(2);
        if (error) throw error;
        if (active) setLearningTwinTopics((data ?? []).map((topic: any) => ({
          subject: String(topic.subject || 'General'),
          chapter: String(topic.chapter || ''),
          concept: String(topic.concept || topic.chapter || 'Revision'),
          mastery_score: Number(topic.mastery_score ?? 0),
        })));
      } catch (error) {
        console.warn('[Dashboard] Could not load Learning Twin topics:', error);
        if (active) setLearningTwinTopics([]);
      } finally {
        if (active) setLearningTwinLoading(false);
      }
    }
    void loadLearningTwin();
    return () => { active = false; };
  }, []);

  function reviewLearningTwinTopic(topic: WeakTopic) {
    const prompt = 'I want to review ' + topic.concept + '. I\'m struggling with it. Please teach it step by step, starting with the foundations, and check my understanding as we go. Subject: ' + topic.subject + (topic.chapter ? '. Chapter: ' + topic.chapter : '') + '. My current mastery score is ' + topic.mastery_score + '%.';
    try { window.sessionStorage.setItem('studysmartly_tutor_prompt', prompt); }
    catch (error) { console.warn('[Dashboard] Could not persist Learning Twin Tutor handoff:', error); }
    onNavigate('tutor');
  }

  useEffect(() => {
    let active = true;
    async function loadNextSession() {
      setNextSessionLoading(true);
      try {
        const { data, error } = await supabase.from('flashcards')
          .select('id, deck_id, subject, topic, due_at')
          .lte('due_at', new Date().toISOString())
          .order('due_at', { ascending: true }).limit(500);
        if (error) throw error;
        const groups = new Map<string, { deckId: string; subject: string; topic: string; count: number }>();
        for (const card of data ?? []) {
          const deckId = String(card.deck_id ?? '');
          const subject = String(card.subject || 'General');
          const topic = String(card.topic || subject);
          if (!deckId) continue;
          const key = deckId + '::' + subject + '::' + topic;
          const group = groups.get(key) ?? { deckId, subject, topic, count: 0 };
          group.count += 1;
          groups.set(key, group);
        }
        const dueRecommendation = [...groups.values()].sort((a, b) => b.count - a.count)[0];
        if (dueRecommendation) {
          if (active) { setNextSession({ kind: 'flashcards', ...dueRecommendation }); setNextSessionError(false); }
        } else {
          const { data: weakTopic, error: topicError } = await (supabase as any).from('learning_topics')
            .select('subject, chapter, concept, mastery_score')
            .lt('mastery_score', 50)
            .order('mastery_score', { ascending: true })
            .limit(1)
            .maybeSingle();
          if (topicError) throw topicError;
          if (active) {
            setNextSession(weakTopic ? {
              kind: 'topic',
              subject: String(weakTopic.subject || 'General'),
              topic: String(weakTopic.concept || weakTopic.chapter || 'Revision'),
              chapter: String(weakTopic.chapter || ''),
              mastery: Number(weakTopic.mastery_score ?? 0),
            } : null);
            setNextSessionError(false);
          }
        }
      } catch (error) {
        console.warn('[Dashboard] Could not load due flashcards:', error);
        if (active) { setNextSession(null); setNextSessionError(true); }
      } finally {
        if (active) setNextSessionLoading(false);
      }
    }
    void loadNextSession();
    return () => { active = false; };
  }, []);

  function startRecommendedSession() {
    if (!nextSession) { onNavigate('tutor'); return; }
    if (nextSession.kind === 'topic') {
      const prompt = 'Teach me this weak topic with the AI Tutor. Explain it step by step and use a visual concept map where helpful. Subject: ' + nextSession.subject + '. Chapter: ' + nextSession.chapter + '. Topic: ' + nextSession.topic + '. My current mastery score is ' + nextSession.mastery + '%. Start with the foundations, use a labelled diagram or structured explanation where useful, and finish with a short recall check.';
      try { window.sessionStorage.setItem('studysmartly_tutor_prompt', prompt); }
      catch (error) { console.warn('[Dashboard] Could not persist Tutor topic handoff:', error); }
      onNavigate('tutor');
      return;
    }
    try {
      window.sessionStorage.setItem('studysmartly_flashcard_handoff', JSON.stringify({
        deckId: nextSession.deckId, subject: nextSession.subject, topic: nextSession.topic,
      }));
    } catch (error) {
      console.warn('[Dashboard] Could not persist study-session handoff:', error);
    }
    onNavigate('flashcards');
  }

  const activeCourses = courses.filter((c) => c.active);
  const today = new Date().toISOString().slice(0, 10);
  const todayEvents = events.filter((e) => e.date === today).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const upcomingEvents = events
    .filter((e) => e.date >= today)
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
    .slice(0, 5);

  const stats = [
    { label: 'Active Courses', value: activeCourses.length, icon: BookOpen, accent: 'text-accent-500' },
    { label: 'Today\'s Schedule', value: todayEvents.length, icon: Clock, accent: 'text-study-amber-500' },
    { label: 'Tutor Sessions', value: tutorSessions.length, icon: Bot, accent: 'text-study-blue-500' },
    { label: 'Documents', value: documents.length, icon: FileText, accent: 'text-study-purple-500' },
  ];

  const quickActions: { label: string; desc: string; icon: typeof Calendar; view: ViewKey; color: string }[] = [
    { label: 'Plan Schedule', desc: 'Add events or parse a syllabus', icon: Calendar, view: 'schedule', color: 'from-study-emerald-500 to-study-teal-600' },
    { label: 'AI Tutor', desc: 'Chat, upload PDFs, and generate visual concept maps.', icon: Bot, view: 'tutor', color: 'from-study-blue-500 to-study-indigo-600' },
    { label: 'Smart Flashcards', desc: 'Generate cards and review with spaced repetition', icon: Layers3, view: 'flashcards', color: 'from-study-purple-500 to-study-indigo-600' },
    { label: 'Build Document', desc: 'Generate slides & study guides', icon: FileText, view: 'studio', color: 'from-study-amber-500 to-study-orange-600' },
    { label: 'Transcribe Lecture', desc: 'Live speech-to-text capture', icon: Mic, view: 'transcriber', color: 'from-study-rose-500 to-study-pink-600' },
  ];

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl glass surface-elevated p-5 lg:p-6 motion-card">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 md:gap-8">
          <div className="min-w-0 flex-1">
            <h2 className="dashboard-hero-title text-3xl lg:text-4xl font-extrabold leading-tight">
              {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}
              {settings.userName ? `, ${settings.userName}` : ''}
            </h2>
            <p className="text-text-muted mt-1 text-sm lg:text-base">
              {todayEvents.length > 0
                ? `You have ${todayEvents.length} ${todayEvents.length === 1 ? 'event' : 'events'} today. Stay focused!`
                : 'No events scheduled today. A great time to catch up or plan ahead.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => onNavigate("planner")} className="rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-bold text-zinc-950 hover:shadow-[0_0_20px_rgba(16,185,129,.4)]">Build my study plan</button>
              <button onClick={() => onNavigate("exams")} className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-text hover:bg-white/10">Practice an exam</button>
            </div>
          </div>
          <motion.img
            src="/logo.jpg"
            alt="StudySmartly"
            className="dashboard-hero-logo mix-blend-screen w-32 md:w-48 h-auto object-contain shrink-0 self-center sm:self-auto"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>

      <section className="rounded-2xl glass surface-elevated border border-border p-4 sm:p-5 motion-card" aria-labelledby="daily-goal-title">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-400">Daily goal</span>
            <h3 id="daily-goal-title" className="mt-1 text-lg font-bold text-text">Earn {gamification.daily_goal} XP today</h3>
            <p className="mt-1 text-sm text-text-muted">
              {gamification.daily_xp >= gamification.daily_goal
                ? 'Daily goal complete. Great work today.'
                : `${Math.max(0, gamification.daily_goal - gamification.daily_xp)} XP to reach your daily goal.`}
              {' '}One successful study action keeps your streak active.
            </p>
          </div>
          <div className="w-full shrink-0 sm:w-56">
            <div className="mb-1 flex items-center justify-between text-xs font-semibold tabular-nums text-text-muted">
              <span>⚡ {gamification.daily_xp} XP</span>
              <span>{gamification.daily_goal} XP</span>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-surface-hover"
              role="progressbar"
              aria-label="Daily XP goal progress"
              aria-valuemin={0}
              aria-valuemax={gamification.daily_goal}
              aria-valuenow={Math.min(gamification.daily_xp, gamification.daily_goal)}
            >
              <div
                className="h-full rounded-full bg-accent-500 transition-[width] duration-300"
                style={{ width: `${Math.min(100, (gamification.daily_xp / gamification.daily_goal) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl glass surface-elevated border border-border p-4 sm:p-5 motion-card" aria-labelledby="learning-twin-title">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-500/15 text-accent-400"><Brain size={20} /></div>
          <div className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-400">Personalised learning profile</span>
            <h3 id="learning-twin-title" className="mt-1 text-lg font-bold text-text">Your Learning Twin</h3>
          </div>
        </div>
        {learningTwinLoading ? <p className="text-sm text-text-muted">Finding topics to strengthen…</p> : learningTwinTopics.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {learningTwinTopics.map((topic, index) => (
              <div key={topic.subject + ":" + topic.chapter + ":" + topic.concept + ":" + index} className="min-w-0 rounded-xl border border-border bg-surface-hover/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-text">{topic.concept}</p>
                    <p className="mt-1 text-xs text-text-muted">{topic.subject}{topic.chapter ? " · " + topic.chapter : ""}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-1 text-xs font-semibold tabular-nums text-amber-400">{topic.mastery_score}%</span>
                </div>
                <Button className="mt-3 min-h-10 w-full text-sm" onClick={() => reviewLearningTwinTopic(topic)}>Fix this with AI Tutor</Button>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-text-muted">No weak topics recorded yet. As you practise across StudySmartly, your Learning Twin will highlight what to strengthen here.</p>}
      </section>

      <section className="relative overflow-hidden rounded-2xl glass surface-elevated border border-accent-500/25 p-5 sm:p-6 motion-card" aria-labelledby="next-study-session-title">
        <div className="absolute -right-10 -top-12 h-44 w-44 rounded-full bg-accent-500/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-400">Your learning recommendation</span>
            <h3 id="next-study-session-title" className="mt-2 text-xl sm:text-2xl font-bold text-text">Your Next Best Study Session</h3>
            {nextSessionLoading ? <p className="mt-2 text-sm text-text-muted">Checking your review schedule…</p> : nextSession ? (
              <div className="mt-3 space-y-1 text-sm">
                <p className="text-text"><span className="text-text-muted">Subject:</span> {nextSession.subject}</p>
                <p className="text-text"><span className="text-text-muted">Topic:</span> {nextSession.topic}</p>
                <p className="text-text-muted"><span className="text-text">Reason:</span> {nextSession.kind === 'flashcards' ? 'You have ' + nextSession.count + ' flashcard' + (nextSession.count === 1 ? '' : 's') + ' due for review.' : 'Your mastery is ' + nextSession.mastery + '%, below the 50% target. Study it with the AI Tutor.'}</p>
              </div>
            ) : <p className="mt-2 max-w-xl text-sm text-text-muted">{nextSessionError ? 'Your review schedule could not be loaded. You can still start a visual lesson.' : 'No flashcards are due and no topics are below 50% mastery. Keep up your revision.'}</p>}
          </div>
          <Button onClick={startRecommendedSession} disabled={nextSessionLoading} className="relative min-h-12 shrink-0 px-6 text-base font-semibold">
            Start Session
          </Button>
        </div>
      </section>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass rounded-xl p-4 lg:p-5 surface-elevated motion-card">
              <div className="flex items-center justify-between mb-2">
                <Icon size={20} className={stat.accent} />
              </div>
              <div className="text-2xl lg:text-3xl font-bold text-text">{stat.value}</div>
              <div className="text-xs text-text-muted mt-1">{stat.label}</div>
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="font-semibold text-text mb-3 text-sm uppercase tracking-wide text-text-muted">Quick Start</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Button variant="source"
                key={action.label}
                onClick={() => onNavigate(action.view)}
                className="group glass motion-card rounded-xl p-5 text-left hover:surface-elevated border border-border hover:border-border-light"
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-3 shadow-md group-hover:scale-110 transition-transform`}>
                  <Icon className="text-study-white" size={22} />
                </div>
                <h4 className="font-semibold text-text text-sm">{action.label}</h4>
                <p className="text-xs text-text-muted mt-1">{action.desc}</p>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Active courses + today's schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active courses */}
        <div className="glass rounded-xl p-5 surface-elevated motion-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text">Active Courses</h3>
            <Button variant="source"
              onClick={() => onNavigate('schedule')}
              className="text-xs text-accent-500 hover:text-accent-400 font-medium"
            >
              Manage
            </Button>
          </div>
          {activeCourses.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="mx-auto text-text-dim mb-2" size={32} />
              <p className="text-sm text-text-muted">No active courses yet</p>
              <Button variant="source"
                onClick={() => onNavigate('schedule')}
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent-500 hover:text-accent-400 font-medium"
              >
                <Plus size={16} /> Add your first course
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {activeCourses.slice(0, 4).map((course) => (
                <div key={course.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-hover transition-colors">
                  <div
                    className="w-2 h-10 rounded-full shrink-0"
                    style={{ backgroundColor: course.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text truncate">{course.name}</div>
                    <div className="text-xs text-text-dim">{course.code}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-text">{course.progress}%</div>
                    <div className="w-16 h-1.5 rounded-full bg-surface-hover overflow-hidden mt-1">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${course.progress}%`, backgroundColor: course.color }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's schedule */}
        <div className="glass rounded-xl p-5 surface-elevated">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text">Today & Upcoming</h3>
            <TrendingUp size={16} className="text-accent-500" />
          </div>
          {upcomingEvents.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="mx-auto text-text-dim mb-2" size={32} />
              <p className="text-sm text-text-muted">Nothing scheduled</p>
              <Button variant="source"
                onClick={() => onNavigate('schedule')}
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent-500 hover:text-accent-400 font-medium"
              >
                <Plus size={16} /> Add an event
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingEvents.map((event) => {
                const course = courses.find((c) => c.id === event.courseId);
                const isToday = event.date === today;
                return (
                  <div key={event.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-hover transition-colors">
                    <div
                      className="w-1 h-10 rounded-full shrink-0"
                      style={{ backgroundColor: course?.color || 'var(--accent)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text line-clamp-1">{event.title}</div>
                      <div className="text-xs text-text-dim flex min-w-0 items-center gap-2 mt-0.5">
                        <Clock size={11} className="shrink-0" />
                        <span className="min-w-0 truncate">{isToday ? 'Today' : formatDateLabel(event.date)} · {formatTimeLabel(event.startTime)}</span>
                      </div>
                    </div>
                    {event.type === 'exam' && (
                      <AlertCircle size={16} className="text-study-rose-500 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
