import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { BookOpen, CalendarDays, CheckCircle2, Clock3, FileText, Plus, RefreshCw, Settings2, Target, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/store';
import InteractiveLoader from '@/components/ui/InteractiveLoader';
import { readSource } from '@/lib/source-files';
import { extractSyllabusTopics } from '@/lib/learning-ai.functions';

type Priority = 'low' | 'normal' | 'high';
type Topic = { id: string; user_id: string; course_id: string | null; subject: string; chapter: string; concept: string; mastery_score: number; priority: Priority; last_practiced_at: string | null };
type StudySession = { id: string; topic_id: string | null; title: string; subject: string; chapter: string | null; concept: string | null; scheduled_start: string; scheduled_end: string; duration_minutes: number; status: 'planned' | 'completed' | 'missed' | 'skipped'; priority: Priority; rationale: string | null };
type Preferences = { weekday_available_minutes: number; weekend_available_minutes: number; preferred_start_time: string; preferred_end_time: string; session_duration_minutes: number; break_duration_minutes: number; study_days: number[]; timezone: string };

const DEFAULTS: Preferences = { weekday_available_minutes: 120, weekend_available_minutes: 180, preferred_start_time: '16:00', preferred_end_time: '21:00', session_duration_minutes: 40, break_duration_minutes: 10, study_days: [1,2,3,4,5,6,0], timezone: 'Asia/Kolkata' };
const priorityWeight: Record<Priority, number> = { high: 3, normal: 2, low: 1 };
const dayLabel = (date: Date) => date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

export default function AdaptivePlanner() {
  const { courses, events } = useApp();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);
  const [subject, setSubject] = useState('');
  const [chapter, setChapter] = useState('');
  const [concept, setConcept] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [mastery, setMastery] = useState(0);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [userId, setUserId] = useState('');
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [importMode, setImportMode] = useState<'paste' | 'file'>('paste');
  const [syllabusText, setSyllabusText] = useState('');
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);

  const loadPlanner = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) throw new Error('Please sign in again to open your study planner.');
      setUserId(auth.user.id);
      const [topicResult, sessionResult, prefResult] = await Promise.all([
        (supabase as any).from('learning_topics').select('*').order('updated_at', { ascending: false }),
        (supabase as any).from('study_sessions').select('*').order('scheduled_start', { ascending: true }).limit(250),
        (supabase as any).from('planner_preferences').select('*').maybeSingle(),
      ]);
      if (topicResult.error) throw topicResult.error;
      if (sessionResult.error) throw sessionResult.error;
      if (prefResult.error) throw prefResult.error;
      setTopics((topicResult.data || []) as Topic[]);
      setSessions((sessionResult.data || []) as StudySession[]);
      if (prefResult.data) setPreferences({ ...DEFAULTS, ...prefResult.data } as Preferences);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your planner.');
    } finally { setBusy(false); }
  }, []);

  useEffect(() => { void loadPlanner(); }, [loadPlanner]);

  async function addTopic(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      if (!subject.trim() || !chapter.trim() || !concept.trim()) throw new Error('Fill in subject, chapter and topic.');
      const { data, error: insertError } = await supabase.from('learning_topics').insert({
        user_id: userId, subject: subject.trim(), chapter: chapter.trim(), concept: concept.trim(),
        priority, mastery_score: mastery, course_id: courses.find(c => c.name.toLowerCase() === subject.trim().toLowerCase())?.id ?? null,
      }).select('*').single();
      if (insertError) throw insertError;
      setTopics(prev => [data as Topic, ...prev]); setSubject(''); setChapter(''); setConcept(''); setMastery(0); setPriority('normal');
      setNotice('Topic added to your learning list.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add topic.'); }
    finally { setSaving(false); }
  }


  async function bulkImportTopics() {
    setExtracting(true); setError(''); setNotice('');
    try {
      let source = null;
      if (importMode === 'paste' && !syllabusText.trim()) throw new Error('Paste your syllabus text first.');
      if (importMode === 'file' && !syllabusFile) throw new Error('Choose a PDF, text file or image first.');
      if (importMode === 'file' && syllabusFile) source = await readSource(syllabusFile);
      const text = importMode === 'paste' ? syllabusText.trim() : source?.text ?? '';
      const result = await extractSyllabusTopics({
        data: { text, images: source?.images ?? [] },
      });
      if (!result.topics.length) throw new Error('No syllabus topics could be identified. Try a clearer or more complete source.');
      const rows = result.topics.slice(0, 300).map(topic => ({
        user_id: userId,
        subject: topic.subject.trim(),
        chapter: topic.chapter.trim(),
        concept: topic.concept.trim(),
        priority: topic.priority.toLowerCase() as Priority,
        mastery_score: topic.mastery,
        course_id: courses.find(course => course.name.toLowerCase() === topic.subject.trim().toLowerCase())?.id ?? null,
        evidence: { source: 'bulk_syllabus_import' },
      })).filter(topic => topic.subject && topic.chapter && topic.concept);
      if (!rows.length) throw new Error('The extraction did not return any complete topics.');
      const { data, error: insertError } = await (supabase as any).from('learning_topics')
        .upsert(rows, { onConflict: 'user_id,subject,chapter,concept', ignoreDuplicates: true })
        .select('*');
      if (insertError) throw insertError;
      const added = (data || []) as Topic[];
      setTopics(prev => [...added, ...prev]);
      setNotice(`Successfully added ${added.length} topics to your planner!${result.topics.length > 300 ? ' (First 300 imported.)' : ''}`);
      setSyllabusText(''); setSyllabusFile(null); setShowBulkImport(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not import syllabus topics.');
    } finally { setExtracting(false); }
  }



  async function savePreferences() {
    setSaving(true); setError(''); setNotice('');
    try {
      if (preferences.preferred_end_time <= preferences.preferred_start_time) throw new Error('End time must be later than start time.');
      const { error: upsertError } = await supabase.from('planner_preferences').upsert({ user_id: userId, ...preferences, updated_at: new Date().toISOString() });
      if (upsertError) throw upsertError;
      setNotice('Your study preferences have been saved.');
      setShowSettings(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save preferences.'); }
    finally { setSaving(false); }
  }

  const upcoming = useMemo(() => sessions.filter(s => s.status === 'planned').sort((a,b) => a.scheduled_start.localeCompare(b.scheduled_start)), [sessions]);
  const completedCount = sessions.filter(s => s.status === 'completed').length;
  const weakTopics = [...topics].sort((a,b) => a.mastery_score - b.mastery_score).slice(0,4);

  async function generatePlan() {
    setSaving(true); setError(''); setNotice('');
    try {
      if (!topics.length) throw new Error('Add at least one topic before generating a plan.');
      const duration = preferences.session_duration_minutes;
      const breakMs = preferences.break_duration_minutes * 60000;
      const startParts = preferences.preferred_start_time.split(':').map(Number);
      const endParts = preferences.preferred_end_time.split(':').map(Number);
      const startMinute = startParts[0] * 60 + startParts[1];
      const endMinute = endParts[0] * 60 + endParts[1];
      const available = endMinute - startMinute;
      if (available < duration) throw new Error('Your available time window is shorter than one study session.');
      const ranked = [...topics].sort((a,b) =>
        (priorityWeight[b.priority] * 100 + (100 - b.mastery_score)) -
        (priorityWeight[a.priority] * 100 + (100 - a.mastery_score))
      );
      const occupied: Array<{ start: number; end: number }> = [];
      sessions.filter(s => s.status === 'planned').forEach(s => occupied.push({ start: new Date(s.scheduled_start).getTime(), end: new Date(s.scheduled_end).getTime() }));
      const now = new Date();
      events.forEach(ev => {
        const start = new Date(`${ev.date}T${ev.startTime}:00`).getTime();
        const end = new Date(`${ev.date}T${ev.endTime}:00`).getTime();
        if (Number.isFinite(start) && Number.isFinite(end)) occupied.push({ start, end });
      });
      const proposed: Array<Record<string, unknown>> = [];
      let cursor = 0;
      for (let dayOffset = 0; dayOffset < 14 && cursor < ranked.length * 2; dayOffset++) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
        if (!preferences.study_days.includes(day.getDay())) continue;
        const minutesAvailable = day.getDay() === 0 || day.getDay() === 6 ? preferences.weekend_available_minutes : preferences.weekday_available_minutes;
        const count = Math.min(Math.floor(minutesAvailable / (duration + preferences.break_duration_minutes || 1)), Math.floor(available / duration));
        let placed = 0;
        for (let slot = 0; slot < Math.floor(available / duration) && placed < count && cursor < ranked.length * 2; slot++) {
          const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(startMinute / 60), startMinute % 60 + slot * (duration + preferences.break_duration_minutes));
          const end = new Date(start.getTime() + duration * 60000);
          if (start.getTime() <= Date.now()) continue;
          const conflict = occupied.some(o => start.getTime() < o.end && end.getTime() > o.start) || proposed.some(p => start.getTime() < new Date(String(p.scheduled_end)).getTime() && end.getTime() > new Date(String(p.scheduled_start)).getTime());
          if (conflict) continue;
          const topic = ranked[cursor % ranked.length];
          proposed.push({
            user_id: userId, topic_id: topic.id, title: topic.concept, subject: topic.subject,
            chapter: topic.chapter, concept: topic.concept, scheduled_start: start.toISOString(),
            scheduled_end: end.toISOString(), duration_minutes: duration, status: 'planned',
            priority: topic.priority, source: 'adaptive_planner',
            rationale: topic.mastery_score < 50 ? 'Prioritised because this topic has a low mastery score.' : topic.priority === 'high' ? 'Prioritised based on your selected importance.' : 'Scheduled to maintain consistent revision.',
          });
          placed++; cursor++;
        }
      }
      if (!proposed.length) throw new Error('No free study slots were found in the next 14 days. Adjust your availability or remove conflicting events.');
      const { data, error: insertError } = await supabase.from('study_sessions').insert(proposed).select('*');
      if (insertError) throw insertError;
      setSessions(prev => [...prev, ...(data as StudySession[])].sort((a,b) => a.scheduled_start.localeCompare(b.scheduled_start)));
      setNotice(`Created ${data.length} study sessions over the next 14 days. Existing events and planned sessions were kept clear.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not generate your study plan.'); }
    finally { setSaving(false); }
  }

  async function updateSessionStatus(session: StudySession, status: StudySession['status']) {
    setError(''); setNotice('');
    const { error: updateError } = await supabase.from('study_sessions').update({
      status, completed_at: status === 'completed' ? new Date().toISOString() : null, updated_at: new Date().toISOString(),
    }).eq('id', session.id);
    if (updateError) { setError(updateError.message); return; }
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, status } : s));
    setNotice(status === 'completed' ? 'Session marked complete. Your next plan can prioritise remaining weak topics.' : 'Session status updated.');
  }

  async function deleteTopic(topic: Topic) {
    if (!window.confirm(`Remove “${topic.concept}” from your learning list?`)) return;
    const { error: deleteError } = await supabase.from('learning_topics').delete().eq('id', topic.id);
    if (deleteError) { setError(deleteError.message); return; }
    setTopics(prev => prev.filter(t => t.id !== topic.id));
    setNotice('Topic removed.');
  }

  return <div className="learning-workspace space-y-6">
    <header className="learning-heading"><div><span className="workspace-eyebrow">PLAN / ADAPTIVE STUDY PLANNER</span><h1>Adaptive Study Planner</h1><p className="text-sm text-text-muted mt-1">A realistic revision plan built around your weak topics, available time and existing commitments.</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => setShowSettings(v => !v)}><Settings2 size={16}/> Preferences</Button><Button onClick={() => void generatePlan()} disabled={saving || busy || !topics.length}><RefreshCw size={16}/>{saving ? 'Working…' : 'Generate plan'}</Button></div>
    </header>
    {error && <p role="alert" className="learning-error">{error}</p>}
    {notice && <p role="status" className="text-sm text-study-emerald-500">{notice}</p>}
    {showSettings && <section className="glass rounded-xl p-5 space-y-4"><h2 className="font-semibold text-text">Your study availability</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <label className="text-sm text-text-muted">Weekday minutes/day<input className="learning-input mt-1" type="number" min="0" max="720" value={preferences.weekday_available_minutes} onChange={e=>setPreferences(p=>({...p,weekday_available_minutes:Number(e.target.value)}))}/></label>
        <label className="text-sm text-text-muted">Weekend minutes/day<input className="learning-input mt-1" type="number" min="0" max="720" value={preferences.weekend_available_minutes} onChange={e=>setPreferences(p=>({...p,weekend_available_minutes:Number(e.target.value)}))}/></label>
        <label className="text-sm text-text-muted">Session length<input className="learning-input mt-1" type="number" min="15" max="180" value={preferences.session_duration_minutes} onChange={e=>setPreferences(p=>({...p,session_duration_minutes:Number(e.target.value)}))}/></label>
        <label className="text-sm text-text-muted">Break between sessions<input className="learning-input mt-1" type="number" min="0" max="60" value={preferences.break_duration_minutes} onChange={e=>setPreferences(p=>({...p,break_duration_minutes:Number(e.target.value)}))}/></label>
        <label className="text-sm text-text-muted">Study window starts<input className="learning-input mt-1" type="time" value={preferences.preferred_start_time} onChange={e=>setPreferences(p=>({...p,preferred_start_time:e.target.value}))}/></label>
        <label className="text-sm text-text-muted">Study window ends<input className="learning-input mt-1" type="time" value={preferences.preferred_end_time} onChange={e=>setPreferences(p=>({...p,preferred_end_time:e.target.value}))}/></label>
      </div>
      <div className="flex flex-wrap gap-2">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i)=><label key={d} className="flex items-center gap-2 text-sm text-text"><input type="checkbox" checked={preferences.study_days.includes(i)} onChange={e=>setPreferences(p=>({...p,study_days:e.target.checked?[...p.study_days,i]:p.study_days.filter(x=>x!==i)}))}/>{d}</label>)}</div>
      <Button onClick={() => void savePreferences()} disabled={saving}>Save preferences</Button>
    </section>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[{label:'Topics tracked',value:topics.length,icon:BookOpen},{label:'Planned sessions',value:upcoming.length,icon:CalendarDays},{label:'Completed',value:completedCount,icon:CheckCircle2},{label:'Weak topics',value:topics.filter(t=>t.mastery_score<50).length,icon:Target}].map(s=><div key={s.label} className="glass rounded-xl p-4"><s.icon size={19} className="text-accent-500 mb-2"/><div className="text-2xl font-bold text-text">{s.value}</div><div className="text-xs text-text-muted">{s.label}</div></div>)}
    </div>
    <div className="grid lg:grid-cols-[1fr_1.2fr] gap-4">
      <section className="glass rounded-xl p-5 space-y-4">
        {showBulkImport && <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex gap-2"><Button type="button" size="sm" variant={importMode === 'paste' ? 'default' : 'outline'} onClick={() => setImportMode('paste')}>Paste Text</Button><Button type="button" size="sm" variant={importMode === 'file' ? 'default' : 'outline'} onClick={() => setImportMode('file')}>Upload File</Button></div>
          {importMode === 'paste' ? <label className="block text-sm text-text-muted">Paste syllabus or chapter list<textarea className="learning-input mt-1 min-h-40 w-full resize-y" value={syllabusText} onChange={e => setSyllabusText(e.target.value)} placeholder="Paste your syllabus here. Include subject and chapter headings where possible." rows={7}/></label> :
            <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-5 text-center text-sm text-text-muted"><Upload size={22}/><span>{syllabusFile ? syllabusFile.name : 'Choose a PDF, TXT file or image'}</span><span className="text-xs">PDF, TXT, PNG, JPG or WEBP · Max 20 MB</span><input className="sr-only" type="file" accept=".pdf,.txt,.md,.csv,image/*" onChange={e => setSyllabusFile(e.target.files?.[0] ?? null)}/></label>}
          {extracting ? <InteractiveLoader/> : <Button type="button" onClick={() => void bulkImportTopics()} disabled={saving || busy || extracting}><FileText size={16}/> Extract &amp; Add Topics</Button>}
          <p className="text-xs text-text-muted">Existing topics are kept; duplicate subject/chapter/concept entries are skipped.</p>
        </div>}
        <div className="border-t border-border pt-4"><h2 className="font-semibold text-text">Add a learning topic manually</h2><p className="text-xs text-text-muted mt-1">Use this form for individual topics.</p></div>
        <form onSubmit={addTopic} className="space-y-3">
          <label className="block text-sm text-text-muted">Subject<input className="learning-input mt-1" value={subject} onChange={e=>setSubject(e.target.value)} placeholder="e.g. Mathematics" required/></label>
          <label className="block text-sm text-text-muted">Chapter<input className="learning-input mt-1" value={chapter} onChange={e=>setChapter(e.target.value)} placeholder="e.g. Polynomials" required/></label>
          <label className="block text-sm text-text-muted">Concept / topic<input className="learning-input mt-1" value={concept} onChange={e=>setConcept(e.target.value)} placeholder="e.g. Zeroes of a polynomial" required/></label>
          <div className="grid grid-cols-2 gap-3"><label className="text-sm text-text-muted">Priority<select className="learning-input mt-1" value={priority} onChange={e=>setPriority(e.target.value as Priority)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label><label className="text-sm text-text-muted">Current mastery: {mastery}%<input className="learning-input mt-1" type="range" min="0" max="100" step="5" value={mastery} onChange={e=>setMastery(Number(e.target.value))}/></label></div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={saving || busy}><Plus size={16}/> Add topic</Button>
            <Button type="button" variant="outline" onClick={() => { setShowBulkImport(v => !v); setError(''); setNotice(''); }} disabled={extracting}>
              <Upload size={16}/> {showBulkImport ? 'Close Bulk Import' : 'Bulk Import'}
            </Button>
          </div>
        </form>
      </section>
      <section className="glass rounded-xl p-5"><h2 className="font-semibold text-text mb-3">Topics to focus on</h2>
        {busy ? <p className="text-sm text-text-muted">Loading your learning data…</p> : weakTopics.length ? <div className="space-y-3">{weakTopics.map(t=><div key={t.id} className="flex items-center gap-3"><div className="min-w-0 flex-1"><div className="text-sm font-medium text-text">{t.concept}</div><div className="text-xs text-text-muted">{t.subject} · {t.chapter} · {t.priority} priority</div><div className="h-1.5 bg-surface-hover rounded-full mt-2 overflow-hidden"><div className="h-full bg-accent-500 rounded-full" style={{width:`${t.mastery_score}%`}}/></div></div><span className="text-xs text-text-muted tabular-nums">{t.mastery_score}%</span><Button variant="ghost" size="icon" aria-label={`Remove ${t.concept}`} onClick={()=>void deleteTopic(t)}><Trash2 size={15}/></Button></div>)}</div> : <p className="text-sm text-text-muted">Add topics to build your personalised revision plan.</p>}
      </section>
    </div>
    <section className="glass rounded-xl p-5"><div className="flex items-center justify-between mb-4"><div><h2 className="font-semibold text-text">Upcoming study sessions</h2><p className="text-xs text-text-muted mt-1">Scheduled around your availability and existing calendar events.</p></div><Clock3 size={18} className="text-accent-500"/></div>
      {busy ? <p className="text-sm text-text-muted">Loading sessions…</p> : upcoming.length ? <div className="space-y-2">{upcoming.map(s=><article key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"><div className="min-w-0 flex-1"><div className="text-sm font-medium text-text">{s.title}</div><div className="text-xs text-text-muted">{s.subject}{s.chapter? ` · ${s.chapter}`:''} · {dayLabel(new Date(s.scheduled_start))} · {new Date(s.scheduled_start).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}–{new Date(s.scheduled_end).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div><div className="text-xs text-text-muted mt-1">{s.rationale}</div></div><span className="text-xs text-text-muted">{s.duration_minutes} min</span><Button variant="outline" size="sm" onClick={()=>void updateSessionStatus(s,'completed')}><CheckCircle2 size={14}/> Done</Button><Button variant="ghost" size="icon" aria-label="Mark session missed" onClick={()=>void updateSessionStatus(s,'missed')}><Clock3 size={14}/></Button></article>)}</div> : <div className="text-center py-8"><CalendarDays className="mx-auto text-text-dim mb-2" size={30}/><p className="text-sm text-text-muted">No sessions planned yet.</p><p className="text-xs text-text-dim mt-1">Add topics, then generate your first revision plan.</p></div>}
    </section>
  </div>;
}
