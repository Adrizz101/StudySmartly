import { Button } from '@/components/ui/button';
import { useApp } from '@/store';
import { ViewKey } from '@/types';
import { Calendar, Bot, FileText, Mic, BookOpen, Clock, TrendingUp, AlertCircle, Plus } from 'lucide-react';
import { formatDateLabel, formatTimeLabel } from '@/lib/syllabus';

interface DashboardProps {
  onNavigate: (v: ViewKey) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { courses, events, tutorSessions, documents, transcriptions, settings } = useApp();

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
    { label: 'AI Whiteboard', desc: 'Draw, upload and get visual explanations', icon: Bot, view: 'tutor', color: 'from-study-blue-500 to-study-indigo-600' },
    { label: 'Build Document', desc: 'Generate slides & study guides', icon: FileText, view: 'studio', color: 'from-study-amber-500 to-study-orange-600' },
    { label: 'Transcribe Lecture', desc: 'Live speech-to-text capture', icon: Mic, view: 'transcriber', color: 'from-study-rose-500 to-study-pink-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl glass surface-elevated p-6 lg:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="relative">
          <h2 className="text-2xl lg:text-3xl font-bold text-text">
            {new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening'}
            {settings.userName ? `, ${settings.userName}` : ''}
          </h2>
          <p className="text-text-muted mt-1 text-sm lg:text-base">
            {todayEvents.length > 0
              ? `You have ${todayEvents.length} ${todayEvents.length === 1 ? 'event' : 'events'} today. Stay focused!`
              : 'No events scheduled today. A great time to catch up or plan ahead.'}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="glass rounded-xl p-4 lg:p-5 surface-elevated">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Button variant="source"
                key={action.label}
                onClick={() => onNavigate(action.view)}
                className="group glass rounded-xl p-5 text-left hover:surface-elevated transition-all hover:scale-[1.02] border border-border hover:border-border-light"
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
        <div className="glass rounded-xl p-5 surface-elevated">
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
                      <div className="text-sm font-medium text-text truncate">{event.title}</div>
                      <div className="text-xs text-text-dim flex items-center gap-2 mt-0.5">
                        <Clock size={11} />
                        {isToday ? 'Today' : formatDateLabel(event.date)} · {formatTimeLabel(event.startTime)}
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
