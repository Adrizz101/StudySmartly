import type { ScheduleEvent } from '@/types';

export interface SchedulingTopic { id: string; subject: string; chapter: string; concept: string; mastery_score: number; estimated_hours?: number | null; estimatedHours?: number | null; priority: 'low' | 'normal' | 'high'; }
export interface SchedulingPreferences { weekday_available_minutes: number; weekend_available_minutes: number; preferred_start_time: string; preferred_end_time: string; session_duration_minutes: number; break_duration_minutes: number; study_days: number[]; }
export interface ExistingStudySession { scheduled_start: string; scheduled_end: string; status: 'planned' | 'completed' | 'missed' | 'skipped'; }
export interface PlannedStudySession { topic_id: string; title: string; subject: string; chapter: string; concept: string; scheduled_start: string; scheduled_end: string; duration_minutes: number; status: 'planned'; priority: 'low' | 'normal' | 'high'; source: 'adaptive_planner'; rationale: string; }
interface TimeBlock { start: number; end: number }
const priorityWeight = { high: 3, normal: 2, low: 1 };
const DAY_MS = 24 * 60 * 60 * 1000;
function mergeBlocks(blocks: TimeBlock[]): TimeBlock[] {
  const sorted = blocks.filter(block => block.end > block.start).sort((a, b) => a.start - b.start);
  const merged: TimeBlock[] = [];
  for (const block of sorted) { const previous = merged[merged.length - 1]; if (previous && block.start <= previous.end) previous.end = Math.max(previous.end, block.end); else merged.push({ ...block }); }
  return merged;
}
function timeParts(value: string): number { const [hours, minutes] = value.split(':').map(Number); return (hours || 0) * 60 + (minutes || 0); }
export function buildStudySchedule(input: { topics: SchedulingTopic[]; existingSessions: ExistingStudySession[]; events: ScheduleEvent[]; preferences: SchedulingPreferences; now?: Date; replaceFuturePlanned?: boolean; }): { sessions: PlannedStudySession[]; availableMinutes: number; remainingMinutes: number; unscheduledTopics: number } {
  const now = input.now ? new Date(input.now) : new Date();
  const preferences = input.preferences;
  const windowStart = timeParts(preferences.preferred_start_time);
  const windowEnd = timeParts(preferences.preferred_end_time);
  if (windowEnd <= windowStart) throw new Error('Your study window must end after it starts.');
  const rankedTopics = input.topics.filter(topic => topic.mastery_score < 100).sort((a, b) => (priorityWeight[b.priority] * 100 + (100 - b.mastery_score)) - (priorityWeight[a.priority] * 100 + (100 - a.mastery_score)));
  const pending = rankedTopics.map(topic => { const estimate = Number(topic.estimated_hours ?? topic.estimatedHours ?? 1); return { topic, remaining: Math.max(15, Math.ceil((Number.isFinite(estimate) && estimate > 0 ? estimate : 1) * 60)) }; });
  const breakMs = Math.max(0, preferences.break_duration_minutes) * 60_000;
  const eventBufferMs = 15 * 60_000;
  const fixedBlocks: TimeBlock[] = [];
  const dayEvents: Array<{ event: ScheduleEvent; baseDate: Date }> = [];
  for (const event of input.events) { const [year, month, day] = event.date.split('-').map(Number); const baseDate = new Date(year, month - 1, day); if (Number.isFinite(baseDate.getTime())) dayEvents.push({ event, baseDate }); }
  const dayStarts: Date[] = [];
  for (let offset = 0; offset < 14; offset++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset); dayStarts.push(date);
    for (const { event, baseDate } of dayEvents) {
      if (date.getTime() < new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate()).getTime()) continue;
      if (event.recurrence === 'weekly' && date.getDay() !== baseDate.getDay()) continue;
      if (event.recurrence !== 'weekly' && date.toDateString() !== baseDate.toDateString()) continue;
      const [startHour, startMinute] = event.startTime.split(':').map(Number); const [endHour, endMinute] = event.endTime.split(':').map(Number);
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), startHour, startMinute).getTime();
      let end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), endHour, endMinute).getTime(); if (end <= start) end += DAY_MS;
      fixedBlocks.push({ start: start - eventBufferMs, end: end + eventBufferMs });
    }
  }
  const horizonEnd = dayStarts[13] ? new Date(dayStarts[13].getTime() + DAY_MS) : now;
  if (!input.replaceFuturePlanned) {
    for (const session of input.existingSessions) {
      if (session.status !== 'planned') continue;
      const start = new Date(session.scheduled_start).getTime(); const end = new Date(session.scheduled_end).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && end > now.getTime() && start < horizonEnd.getTime()) fixedBlocks.push({ start: start - breakMs, end: end + breakMs });
    }
  }
  const sessions: PlannedStudySession[] = []; const placedBlocks: TimeBlock[] = []; let availableMinutes = 0;
  const dailyCap = (date: Date) => date.getDay() === 0 || date.getDay() === 6 ? preferences.weekend_available_minutes : preferences.weekday_available_minutes;
  const configuredDuration = Math.max(15, Math.min(60, preferences.session_duration_minutes));
  for (const date of dayStarts) {
    if (!preferences.study_days.includes(date.getDay())) continue;
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(windowStart / 60), windowStart % 60).getTime();
    const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(windowEnd / 60), windowEnd % 60).getTime();
    const nowFloor = Math.ceil(now.getTime() / 300_000) * 300_000;
    const usableStart = Math.max(dayStart, date.toDateString() === now.toDateString() ? nowFloor : dayStart);
    const baseBlocks = mergeBlocks([...fixedBlocks, ...placedBlocks].filter(block => block.end > dayStart && block.start < dayEnd));
    let freeMinutes = Math.max(0, Math.floor((dayEnd - usableStart) / 60_000));
    for (const block of baseBlocks) { const overlapStart = Math.max(usableStart, block.start); const overlapEnd = Math.min(dayEnd, block.end); if (overlapEnd > overlapStart) freeMinutes -= Math.ceil((overlapEnd - overlapStart) / 60_000); }
    const dayBudget = Math.max(0, Math.min(dailyCap(date), freeMinutes)); availableMinutes += dayBudget; let usedMinutes = 0;
    // One chunk per topic per day forces long topics to continue on a later day.
    for (const item of pending) {
      if (usedMinutes >= dayBudget || item.remaining <= 0) continue;
      const chunkLimit = item.remaining > 60 ? Math.min(45, configuredDuration) : configuredDuration;
      const duration = Math.min(item.remaining, chunkLimit, dayBudget - usedMinutes); if (duration < 15) continue;
      let chosenStart = 0;
      for (let candidate = usableStart; candidate + duration * 60_000 <= dayEnd; candidate += 5 * 60_000) {
        const candidateEnd = candidate + duration * 60_000;
        if (!fixedBlocks.concat(placedBlocks).some(block => candidate < block.end && candidateEnd > block.start)) { chosenStart = candidate; break; }
      }
      if (!chosenStart) continue;
      const end = chosenStart + duration * 60_000; placedBlocks.push({ start: chosenStart - breakMs, end: end + breakMs });
      const rationale = item.topic.mastery_score < 50 ? 'Prioritised because this topic has a low mastery score.' : item.topic.priority === 'high' ? 'Prioritised based on your selected importance.' : 'Scheduled as part of your personalised revision plan.';
      sessions.push({ topic_id: item.topic.id, title: item.topic.concept, subject: item.topic.subject, chapter: item.topic.chapter, concept: item.topic.concept, scheduled_start: new Date(chosenStart).toISOString(), scheduled_end: new Date(end).toISOString(), duration_minutes: duration, status: 'planned', priority: item.topic.priority, source: 'adaptive_planner', rationale });
      item.remaining -= duration; usedMinutes += duration;
    }
  }
  const remainingMinutes = pending.reduce((total, item) => total + item.remaining, 0);
  return { sessions, availableMinutes, remainingMinutes, unscheduledTopics: pending.filter(item => item.remaining > 0).length };
}