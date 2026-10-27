import { Button } from '@/components/ui/button';
import { useState, useMemo, useEffect } from 'react';
import { useApp } from '@/store';
import { Course, ScheduleEvent } from '@/types';
import { parseSyllabus, formatDateLabel, formatTimeLabel } from '@/lib/syllabus';
import { Modal } from '@/components/Modal';
import {
  Plus, ChevronLeft, ChevronRight, Calendar as CalIcon, Trash2, FileText,
  BookOpen, Clock, FileUp, X, GraduationCap,
} from 'lucide-react';

const EVENT_TYPE_META: Record<ScheduleEvent['type'], { label: string; color: string }> = {
  lecture: { label: 'Lecture', color: '#3b82f6' },
  exam: { label: 'Exam', color: '#f43f5e' },
  assignment: { label: 'Assignment', color: '#f59e0b' },
  study: { label: 'Study', color: '#10b981' },
  other: { label: 'Other', color: '#8b94a6' },
};

const COURSE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export default function Schedule() {
  const { courses, addCourse, updateCourse, deleteCourse, events, addEvents, deleteEvent } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showSyllabusModal, setShowSyllabusModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: { date: string; day: number; inMonth: boolean }[] = [];
    // Previous month padding
    for (let i = 0; i < startOffset; i++) {
      const d = new Date(year, month, -startOffset + i + 1);
      days.push({ date: d.toISOString().slice(0, 10), day: d.getDate(), inMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      days.push({ date: date.toISOString().slice(0, 10), day: d, inMonth: true });
    }
    // Pad to fill grid
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d.toISOString().slice(0, 10), day: d.getDate(), inMonth: false });
    }
    return days;
  }, [currentDate]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, ScheduleEvent[]> = {};
    events.forEach((e) => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date]?.push(e);
    });
    Object.values(map).forEach((arr) => arr.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return map;
  }, [events]);

  const today = new Date().toISOString().slice(0, 10);
  const selectedEvents = selectedDate ? eventsByDate[selectedDate] || [] : [];
  const upcomingAll = events
    .filter((e) => e.date >= today)
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 glass rounded-xl p-1 surface-elevated">
          <Button variant="source"
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
            className="p-2 rounded-lg hover:bg-surface-hover text-text-muted transition-colors"
          >
            <ChevronLeft size={18} />
          </Button>
          <span className="text-sm font-semibold text-text px-2 min-w-[140px] text-center">{monthYear}</span>
          <Button variant="source"
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
            className="p-2 rounded-lg hover:bg-surface-hover text-text-muted transition-colors"
          >
            <ChevronRight size={18} />
          </Button>
          <Button variant="source"
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 rounded-lg hover:bg-surface-hover text-xs font-medium text-text-muted transition-colors"
          >
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button variant="source"
            onClick={() => setShowSyllabusModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass hover:surface-elevated text-sm font-medium text-text transition-all"
          >
            <FileUp size={16} /> Parse Syllabus
          </Button>
          <Button variant="source"
            onClick={() => { setEditingCourse(null); setShowCourseModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass hover:surface-elevated text-sm font-medium text-text transition-all"
          >
            <BookOpen size={16} /> Add Course
          </Button>
          <Button variant="source"
            onClick={() => { setSelectedDate(today); setShowEventModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-600 hover:bg-accent-700 text-study-white text-sm font-medium shadow-md transition-all"
          >
            <Plus size={16} /> Add Event
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Calendar */}
        <div className="lg:col-span-2 glass rounded-xl p-4 surface-elevated">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-text-dim py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const dayEvents = eventsByDate[day.date] || [];
              const isToday = day.date === today;
              const isSelected = day.date === selectedDate;
              return (
                <Button variant="source"
                  key={day.date}
                  onClick={() => setSelectedDate(day.date)}
                  className={`relative aspect-square rounded-lg p-1.5 flex flex-col items-start transition-all min-h-[44px] ${
                    !day.inMonth ? 'opacity-30' : ''
                  } ${
                    isSelected
                      ? 'bg-accent-600 text-study-white'
                      : isToday
                      ? 'bg-surface-active ring-1 ring-accent-500'
                      : 'hover:bg-surface-hover'
                  }`}
                >
                  <span className={`text-xs font-medium ${isSelected ? 'text-study-white' : 'text-text'}`}>
                    {day.day}
                  </span>
                  {dayEvents.length > 0 && (
                    <div className="flex gap-0.5 mt-auto flex-wrap">
                      {dayEvents.slice(0, 3).map((e) => {
                        const course = courses.find((c) => c.id === e.courseId);
                        const meta = EVENT_TYPE_META[e.type];
                        return (
                          <div
                            key={e.id}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: isSelected ? '#fff' : course?.color || meta.color }}
                          />
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <span className={`text-[8px] ${isSelected ? 'text-study-white' : 'text-text-dim'}`}>+{dayEvents.length - 3}</span>
                      )}
                    </div>
                  )}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Side panel: selected day + courses */}
        <div className="space-y-4">
          {/* Selected day events */}
          <div className="glass rounded-xl p-4 surface-elevated">
            <h3 className="font-semibold text-text mb-3 text-sm">
              {selectedDate ? formatDateLabel(selectedDate) : 'Select a day'}
            </h3>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-text-dim py-4 text-center">No events on this day</p>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map((event) => {
                  const course = courses.find((c) => c.id === event.courseId);
                  const meta = EVENT_TYPE_META[event.type];
                  return (
                    <div key={event.id} className="group flex items-start gap-2 p-2.5 rounded-lg hover:bg-surface-hover transition-colors">
                      <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: course?.color || meta.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text truncate">{event.title}</div>
                        <div className="text-xs text-text-dim flex items-center gap-1.5 mt-0.5">
                          <Clock size={11} />
                          {formatTimeLabel(event.startTime)} – {formatTimeLabel(event.endTime)}
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: (course?.color || meta.color) + '22', color: course?.color || meta.color }}>
                            {meta.label}
                          </span>
                        </div>
                        {course && <div className="text-xs text-text-dim mt-0.5">{course.name}</div>}
                      </div>
                      <Button variant="source"
                        onClick={() => deleteEvent(event.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-text-dim hover:text-study-rose-500 transition-all"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
            {selectedDate && (
              <Button variant="source"
                onClick={() => setShowEventModal(true)}
                className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-border hover:border-accent-500 hover:text-accent-500 text-text-dim text-sm transition-all"
              >
                <Plus size={15} /> Add event
              </Button>
            )}
          </div>

          {/* Course list */}
          <div className="glass rounded-xl p-4 surface-elevated">
            <h3 className="font-semibold text-text mb-3 text-sm">Courses</h3>
            {courses.length === 0 ? (
              <p className="text-sm text-text-dim py-4 text-center">No courses added yet</p>
            ) : (
              <div className="space-y-1.5">
                {courses.map((course) => (
                  <div key={course.id} className="group flex items-center gap-2 p-2 rounded-lg hover:bg-surface-hover transition-colors">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: course.color }} />
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setEditingCourse(course); setShowCourseModal(true); }}>
                      <div className="text-sm font-medium text-text truncate">{course.name}</div>
                      <div className="text-xs text-text-dim">{course.code}</div>
                    </div>
                    <Button variant="source"
                      onClick={() => deleteCourse(course.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-text-dim hover:text-study-rose-500 transition-all"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming events list */}
      {upcomingAll.length > 0 && (
        <div className="glass rounded-xl p-5 surface-elevated">
          <h3 className="font-semibold text-text mb-4 flex items-center gap-2">
            <CalIcon size={18} className="text-accent-500" /> All Upcoming Events
          </h3>
          <div className="space-y-2">
            {upcomingAll.slice(0, 20).map((event) => {
              const course = courses.find((c) => c.id === event.courseId);
              const meta = EVENT_TYPE_META[event.type];
              return (
                <div key={event.id} className="group flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors">
                  <div className="w-12 text-center shrink-0">
                    <div className="text-xs text-text-dim">{formatDateLabel(event.date).split(' ')[0]}</div>
                    <div className="text-lg font-bold text-text">{formatDateLabel(event.date).split(' ')[1]}</div>
                  </div>
                  <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: course?.color || meta.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text truncate">{event.title}</div>
                    <div className="text-xs text-text-dim flex items-center gap-2 mt-0.5">
                      <Clock size={11} /> {formatTimeLabel(event.startTime)}
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: meta.color + '22', color: meta.color }}>
                        {meta.label}
                      </span>
                    </div>
                  </div>
                  <Button variant="source"
                    onClick={() => deleteEvent(event.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-text-dim hover:text-study-rose-500 transition-all"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Course Modal */}
      <CourseModal
        open={showCourseModal}
        onClose={() => setShowCourseModal(false)}
        editing={editingCourse}
        onSave={(course) => {
          if (editingCourse) {
            updateCourse(editingCourse.id, course);
          } else {
            addCourse({ ...course, id: crypto.randomUUID() });
          }
          setShowCourseModal(false);
        }}
      />

      {/* Event Modal */}
      <EventModal
        open={showEventModal}
        onClose={() => setShowEventModal(false)}
        defaultDate={selectedDate || today}
        courses={courses}
        onSave={(event) => {
          addEvents([{ ...event, id: crypto.randomUUID() }]);
          setShowEventModal(false);
        }}
      />

      {/* Syllabus Modal */}
      <SyllabusModal
        open={showSyllabusModal}
        onClose={() => setShowSyllabusModal(false)}
        courses={courses}
        onParse={(text, courseId) => {
          const parsed = parseSyllabus(text, courseId);
          addEvents(parsed);
          setShowSyllabusModal(false);
        }}
      />
    </div>
  );
}

// --- Sub-components ---

function CourseModal({ open, onClose, editing, onSave }: {
  open: boolean;
  onClose: () => void;
  editing: Course | null;
  onSave: (c: Omit<Course, 'id'>) => void;
}) {
  const [name, setName] = useState(editing?.name || '');
  const [code, setCode] = useState(editing?.code || '');
  const [color, setColor] = useState(editing?.color || COURSE_COLORS[0] || '#10b981');
  const [progress, setProgress] = useState(editing?.progress || 0);
  const [active, setActive] = useState(editing?.active ?? true);
  const [examDate, setExamDate] = useState(editing?.examDate || '');

  useEffect(() => {
    if (editing) {
      setName(editing.name); setCode(editing.code); setColor(editing.color);
      setProgress(editing.progress); setActive(editing.active); setExamDate(editing.examDate || '');
    }
  }, [editing]);

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Course' : 'Add Course'}>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-text-muted block mb-1.5">Course Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Organic Chemistry"
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500 transition-colors"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-text-muted block mb-1.5">Course Code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. CHEM 201"
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500 transition-colors"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-text-muted block mb-1.5">Color</label>
          <div className="flex gap-2 flex-wrap">
            {COURSE_COLORS.map((c) => (
              <Button variant="source"
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-lg transition-all ${color === c ? 'ring-2 ring-offset-2 ring-offset-surface ring-accent-500 scale-110' : 'hover:scale-105'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-text-muted block mb-1.5">Progress: {progress}%</label>
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            className="w-full accent-accent-500"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-text-muted block mb-1.5">Exam Date (optional)</label>
          <input
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500 transition-colors"
          />
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="w-4 h-4 accent-accent-500 rounded"
          />
          <span className="text-sm text-text">Show in dashboard</span>
        </label>
        <Button variant="source"
          onClick={() => onSave({ name, code, color, progress, active, examDate: examDate || undefined })}
          disabled={!name.trim()}
          className="w-full py-2.5 rounded-xl bg-accent-600 hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed text-study-white font-medium text-sm transition-colors"
        >
          {editing ? 'Save Changes' : 'Add Course'}
        </Button>
      </div>
    </Modal>
  );
}

function EventModal({ open, onClose, defaultDate, courses, onSave }: {
  open: boolean;
  onClose: () => void;
  defaultDate: string;
  courses: Course[];
  onSave: (e: Omit<ScheduleEvent, 'id'>) => void;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [type, setType] = useState<ScheduleEvent['type']>('lecture');
  const [courseId, setCourseId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  return (
    <Modal open={open} onClose={onClose} title="Add Event">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-text-muted block mb-1.5">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Midterm Review Session"
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-text-muted block mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text-muted block mb-1.5">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ScheduleEvent['type'])}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500"
            >
              {Object.entries(EVENT_TYPE_META).map(([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-text-muted block mb-1.5">Start Time</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-text-muted block mb-1.5">End Time</label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-text-muted block mb-1.5">Course (optional)</label>
          <select
            value={courseId || ''}
            onChange={(e) => setCourseId(e.target.value || null)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500"
          >
            <option value="">No course</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-text-muted block mb-1.5">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Additional details..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500 resize-none"
          />
        </div>
        <Button variant="source"
          onClick={() => onSave({ title, date, startTime, endTime, type, courseId, notes })}
          disabled={!title.trim()}
          className="w-full py-2.5 rounded-xl bg-accent-600 hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed text-study-white font-medium text-sm transition-colors"
        >
          Add Event
        </Button>
      </div>
    </Modal>
  );
}

function SyllabusModal({ open, onClose, courses, onParse }: {
  open: boolean;
  onClose: () => void;
  courses: Course[];
  onParse: (text: string, courseId: string | null) => void;
}) {
  const [text, setText] = useState('');
  const [courseId, setCourseId] = useState<string | null>(null);

  return (
    <Modal open={open} onClose={onClose} title="Parse Syllabus Text" maxWidth="max-w-2xl">
      <div className="space-y-4">
        <p className="text-sm text-text-muted">
          Paste your syllabus text below. The parser will detect days, times, event types, and create schedule entries automatically.
        </p>
        <div>
          <label className="text-sm font-medium text-text-muted block mb-1.5">Assign to course (optional)</label>
          <select
            value={courseId || ''}
            onChange={(e) => setCourseId(e.target.value || null)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500"
          >
            <option value="">No specific course</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-text-muted block mb-1.5">Syllabus Text</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder={`e.g.\nMon Wed Fri 9:00 AM - 10:00 AM - Calculus II Lecture\nTue 2:00 PM - 3:30 PM - Physics Lab\nMidterm Exam - Friday November 15 at 1:00 PM\nHomework due every Tuesday at 11:59 PM`}
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500 resize-y font-mono"
          />
        </div>
        <div className="flex gap-3">
          <Button variant="source"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl glass hover:bg-surface-hover text-text font-medium text-sm transition-colors"
          >
            Cancel
          </Button>
          <Button variant="source"
            onClick={() => onParse(text, courseId)}
            disabled={!text.trim()}
            className="flex-1 py-2.5 rounded-xl bg-accent-600 hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed text-study-white font-medium text-sm transition-colors"
          >
            Parse & Add Events
          </Button>
        </div>
      </div>
    </Modal>
  );
}
