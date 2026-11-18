import { Button } from '@/components/ui/button';
import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from '@tanstack/react-router';
import { useApp } from '@/store';
import { respondToTutor } from '@/lib/learning-ai.functions';
import { ChatMessage, TutorSession } from '@/types';
import { ImageUpload } from '@/components/ImageUpload';
import {
  Send, Bot, User, Plus, Trash2, Sparkles, Image as ImageIcon,
  GraduationCap, BookOpen, Brain, Clock, AlertCircle, FileText,
  Layers, CalendarDays, Presentation, PanelLeft, Library,
} from 'lucide-react';

const QUICK_PROMPTS = [
  { icon: BookOpen, text: 'Explain a difficult concept step by step', subject: 'General' },
  { icon: Brain, text: 'Help me understand this biology topic', subject: 'Biology' },
  { icon: GraduationCap, text: 'Explain a question from my textbook', subject: 'General' },
  { icon: Clock, text: 'Help me prepare for an upcoming exam', subject: 'General' },
];

const SOCRATIC_SYSTEM = `You are StudySmartly's AI Tutor. Give clear, accurate explanations at the student's level. Break difficult ideas into manageable steps, use examples, and ask a short check-for-understanding question when useful. Do not force Socratic questioning when the student asks for a direct explanation. If uncertain, say so.`;

const TOOL_LINKS = [
  { to: '/flashcards' as const, label: 'Flashcards', detail: 'Revise with spaced repetition', icon: Layers },
  { to: '/exams' as const, label: 'Exam Arena', detail: 'Practise exam questions', icon: GraduationCap },
  { to: '/transcriber' as const, label: 'Lecture Transcriber', detail: 'Turn lectures into notes', icon: FileText },
  { to: '/studio' as const, label: 'Presentation Studio', detail: 'Create study presentations', icon: Presentation },
  { to: '/planner' as const, label: 'Adaptive Planner', detail: 'Organise study sessions', icon: CalendarDays },
];

export default function Tutor() {
  const { tutorSessions, setTutorSessions } = useApp();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [subject, setSubject] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = tutorSessions.find((s) => s.id === activeSessionId) || null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages]);

  const updateSession = useCallback((id: string, updater: (s: TutorSession) => TutorSession) => {
    setTutorSessions((prev) => prev.map((s) => (s.id === id ? updater(s) : s)));
  }, [setTutorSessions]);

  const createSession = useCallback((): string => {
    const id = crypto.randomUUID();
    const session: TutorSession = {
      id,
      subject: subject || 'General',
      messages: [],
      createdAt: Date.now(),
    };
    setTutorSessions((prev) => [session, ...prev]);
    return id;
  }, [subject, setTutorSessions]);

  const sendMessage = useCallback(async () => {
    if ((!input.trim() && !pendingImage) || isThinking) return;
    const isNewSession = !activeSessionId;
    const sessionId = activeSessionId || createSession();
    setActiveSessionId(sessionId);
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
      image: pendingImage || undefined,
    };

    const currentMessages = activeSession?.messages || [];
    if (isNewSession) {
      setTutorSessions((prev) => prev.map((s) => s.id === sessionId
        ? { ...s, subject: subject || s.subject, messages: [userMsg] }
        : s));
    } else {
      updateSession(sessionId, (s) => ({ ...s, messages: [...s.messages, userMsg] }));
    }
    setInput('');
    setPendingImage('');
    setIsThinking(true);

    const ctxSubject = subject || activeSession?.subject || 'this topic';
    try {
      const history = [
        ...currentMessages
          .filter((message) => message.role === 'user' || message.role === 'assistant')
          .slice(-15)
          .map((message) => ({ role: message.role as 'user' | 'assistant', content: message.content })),
      ];
      const question = userMsg.content + (userMsg.image
        ? '\\n\\n[The student attached an image, but image analysis is not available in this phase. Ask them to describe the relevant content in text.]'
        : '');
      const result = await respondToTutor({
        data: {
          subject: ctxSubject,
          question,
          history,
        },
      });
      if (!result.success) throw new Error(result.error);
      const response = result.data.response;
      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };
      updateSession(sessionId, (s) => ({ ...s, messages: [...s.messages, aiMsg] }));
    } catch {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'The AI service is temporarily unavailable. Please try again shortly.',
        timestamp: Date.now(),
      };
      updateSession(sessionId, (s) => ({ ...s, messages: [...s.messages, errMsg] }));
    } finally {
      setIsThinking(false);
    }
  }, [input, pendingImage, isThinking, activeSessionId, activeSession, subject, settings, createSession, updateSession, setTutorSessions]);

  const handleQuickPrompt = useCallback((prompt: string, subj: string) => {
    setSubject(subj);
    setInput(prompt);
  }, []);

  const deleteSession = useCallback((id: string) => {
    setTutorSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(null);
  }, [setTutorSessions, activeSessionId]);

  const startNewSession = () => {
    setActiveSessionId(null);
    setSubject('');
    setInput('');
    setPendingImage('');
  };

  return (
    <div className="grid h-[calc(100dvh-120px)] min-h-[560px] grid-cols-1 gap-3 overflow-hidden lg:grid-cols-[220px_minmax(0,1fr)_210px]">
      <aside className="glass surface-elevated flex max-h-36 flex-col overflow-hidden rounded-xl p-3 lg:max-h-none">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-text"><PanelLeft size={16} /> Your learning</div>
          <Button variant="ghost" size="icon" aria-label="New chat" onClick={startNewSession}><Plus size={17} /></Button>
        </div>
        <Button variant="source" onClick={startNewSession} className="mb-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent-600 px-3 py-2 text-sm font-medium text-white hover:bg-accent-700">
          <Plus size={16} /> New chat
        </Button>
        <div className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-text-dim"><Library size={13} /> Recent chats</div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {tutorSessions.length === 0 && <p className="px-2 py-4 text-xs text-text-dim">Your conversations will appear here.</p>}
          {tutorSessions.map((session) => (
            <div key={session.id} className={`group flex min-h-10 items-center gap-2 rounded-lg px-2 py-2 transition-colors ${activeSessionId === session.id ? 'bg-surface-active' : 'hover:bg-surface-hover'}`}>
              <button type="button" onClick={() => { setActiveSessionId(session.id); setSubject(session.subject); }} className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium text-text">{session.subject}</div>
                <div className="text-xs text-text-dim">{session.messages.length} messages</div>
              </button>
              <Button variant="ghost" size="icon" aria-label="Delete conversation" onClick={() => deleteSession(session.id)} className="h-8 w-8 opacity-70 lg:opacity-0 lg:group-hover:opacity-100"><Trash2 size={13} /></Button>
            </div>
          ))}
        </div>
        <div className="mt-3 hidden border-t border-border pt-3 text-xs text-text-dim lg:block">
          <div className="mb-1 flex items-center gap-2 font-medium text-text-muted"><FileText size={13} /> Your materials</div>
          File and lecture attachments are being added in the next phase.
        </div>
      </aside>

      <section className="glass surface-elevated flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Sparkles size={17} className="text-accent-500" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-text">StudySmartly AI Tutor</div>
            <div className="text-xs text-text-dim">Your study conversation</div>
          </div>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" placeholder="Subject" className="w-28 rounded-lg border border-border bg-surface-hover px-2 py-2 text-xs text-text outline-none focus:border-accent-500 sm:w-36" />
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {!activeSession || activeSession.messages.length === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-center py-8 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-600/15"><Bot size={28} className="text-accent-500" /></div>
              <h2 className="mb-2 text-xl font-semibold text-text">What are we learning today?</h2>
              <p className="mb-6 max-w-md text-sm text-text-muted">Ask a question or choose a starting point. You can request a direct explanation or learn step by step.</p>
              <div className="grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                {QUICK_PROMPTS.map((qp) => {
                  const Icon = qp.icon;
                  return <Button variant="source" key={qp.text} onClick={() => handleQuickPrompt(qp.text, qp.subject)} className="flex min-h-16 items-start gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-accent-500 hover:bg-surface-hover">
                    <Icon size={18} className="mt-0.5 shrink-0 text-accent-500" />
                    <span className="text-sm text-text">{qp.text}</span>
                  </Button>;
                })}
              </div>
            </div>
          ) : activeSession.messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
          {isThinking && <div className="flex items-center gap-2 text-sm text-text-muted"><Bot size={17} className="text-accent-500" /> Thinking…</div>}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-border p-3">
          {pendingImage && <div className="mb-2 flex items-center gap-2 text-xs text-text-muted"><ImageIcon size={14} /> Image preview only for now. Describe it in your message; image analysis is coming in Phase 3.</div>}
          <div className="flex items-end gap-2">
            <ImageUpload compact onImageSelected={setPendingImage} label="Choose image" />
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            }} rows={1} placeholder="Ask your tutor anything…" className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-border bg-surface-hover px-3.5 py-2.5 text-sm text-text outline-none focus:border-accent-500" />
            <Button variant="source" aria-label="Send message" onClick={sendMessage} disabled={(!input.trim() && !pendingImage) || isThinking} className="shrink-0 rounded-xl bg-accent-600 p-3 text-white transition-colors hover:bg-accent-700 disabled:opacity-50"><Send size={18} /></Button>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-text-dim"><AlertCircle size={11} /> AI answers can make mistakes. Check important information against your textbook or teacher.</div>
        </div>
      </section>

      <aside className="glass surface-elevated rounded-xl p-3">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-text"><BookOpen size={16} /> Study tools</div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          {TOOL_LINKS.map((tool) => {
            const Icon = tool.icon;
            return <Link key={tool.label} to={tool.to} className="flex min-h-14 items-center gap-2 rounded-lg border border-border p-2 transition-colors hover:border-accent-500 hover:bg-surface-hover">
              <Icon size={17} className="shrink-0 text-accent-500" />
              <span className="min-w-0"><span className="block text-xs font-semibold text-text">{tool.label}</span><span className="hidden text-[10px] text-text-dim lg:block">{tool.detail}</span></span>
            </Link>;
          })}
        </div>
        <div className="mt-4 hidden rounded-lg bg-surface-hover p-3 text-xs text-text-muted lg:block">
          <div className="mb-1 font-semibold text-text">Coming next</div>
          Upload PDFs, textbook photos and lecture transcripts directly into a chat.
        </div>
      </aside>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} animate-fadeIn`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isUser ? 'bg-study-blue-600' : 'bg-accent-600/15'}`}>
        {isUser ? <User size={16} className="text-white" /> : <Bot size={16} className="text-accent-500" />}
      </div>
      <div className={`max-w-[85%] ${isUser ? 'items-end' : ''}`}>
        {message.image && <img src={message.image} alt="Selected attachment preview" className="mb-2 max-h-48 rounded-xl border border-border object-cover" />}
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isUser ? 'rounded-tr-sm bg-study-blue-600 text-white' : 'rounded-tl-sm bg-surface-hover text-text'}`}>
          <div className="prose-chat whitespace-pre-wrap">{message.content}</div>
        </div>
      </div>
    </div>
  );
}
