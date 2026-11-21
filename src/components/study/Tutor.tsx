import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { Link } from '@tanstack/react-router';
import { useApp } from '@/store';
import { supabase } from '@/integrations/supabase/client';
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
  const [mobilePanel, setMobilePanel] = useState<'chat' | 'history' | 'tools'>('chat');
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
        ? '\n\n[The student attached an image, but image analysis is not available in this phase. Ask them to describe the relevant content in text.]'
        : '');
      const { data: authData } = await supabase.auth.getSession();
      const accessToken = authData.session?.access_token;
      if (!accessToken) throw new Error('Your session expired. Please sign in again.');

      const result = await respondToTutor({
        data: { subject: ctxSubject, question, history, accessToken },
      });
      if (!result.success) throw new Error(result.error);
      if (!result.text.trim()) throw new Error('The tutor returned an empty response.');

      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.text,
        timestamp: Date.now(),
      };
      updateSession(sessionId, (s) => ({ ...s, messages: [...s.messages, aiMsg] }));
    } catch (error) {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: error instanceof Error && error.message
          ? error.message
          : 'The AI service is temporarily unavailable. Please try again shortly.',
        timestamp: Date.now(),
      };
      updateSession(sessionId, (s) => ({ ...s, messages: [...s.messages, errMsg] }));
    } finally {
      setIsThinking(false);
    }
  }, [input, pendingImage, isThinking, activeSessionId, activeSession, subject, createSession, updateSession, setTutorSessions]);

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
    <div className="flex h-[calc(100dvh-120px)] min-h-0 flex-col gap-3 overflow-hidden lg:grid lg:grid-cols-[220px_minmax(0,1fr)_210px] lg:grid-rows-1">
      <nav aria-label="Tutor sections" className="relative z-50 isolate grid shrink-0 grid-cols-3 gap-1 rounded-xl border border-border bg-[#09090b] p-1 shadow-lg lg:hidden">
        <button type="button" aria-pressed={mobilePanel === "chat"} onClick={() => setMobilePanel("chat")} className={mobilePanel === "chat" ? "rounded-lg bg-accent-600 px-2 py-2 text-xs font-medium text-white" : "rounded-lg px-2 py-2 text-xs font-medium text-text-muted hover:bg-surface-active"}>Chat</button>
        <button type="button" aria-pressed={mobilePanel === "history"} onClick={() => setMobilePanel("history")} className={mobilePanel === "history" ? "rounded-lg bg-accent-600 px-2 py-2 text-xs font-medium text-white" : "rounded-lg px-2 py-2 text-xs font-medium text-text-muted hover:bg-surface-active"}>Your learning</button>
        <button type="button" aria-pressed={mobilePanel === "tools"} onClick={() => setMobilePanel("tools")} className={mobilePanel === "tools" ? "rounded-lg bg-accent-600 px-2 py-2 text-xs font-medium text-white" : "rounded-lg px-2 py-2 text-xs font-medium text-text-muted hover:bg-surface-active"}>Study tools</button>
      </nav>
      <aside className={"glass surface-elevated min-h-0 flex-col overflow-hidden rounded-xl p-3 " + (mobilePanel === "history" ? "flex flex-1" : "hidden") + " lg:flex"}>
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

      <section className={"glass surface-elevated min-h-0 min-w-0 flex-col overflow-hidden rounded-xl " + (mobilePanel === "chat" ? "flex flex-1" : "hidden") + " lg:flex"}>
        <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5 lg:px-4 lg:py-3">
          <Sparkles size={17} className="text-accent-500" />
          <div className="min-w-0 flex-1">
            <div className="truncate whitespace-nowrap text-xs font-semibold text-text sm:text-sm">StudySmartly AI Tutor</div>
            <div className="hidden text-xs text-text-dim lg:block">Your study conversation</div>
          </div>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" placeholder="Subject" className="w-20 shrink-0 rounded-lg border border-border bg-surface-hover px-2 py-2 text-xs text-text outline-none focus:border-accent-500 sm:w-28 lg:w-36" />
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 py-3 lg:space-y-4 lg:px-4 lg:py-4">
          {!activeSession || activeSession.messages.length === 0 ? (
            <div className="flex min-h-full flex-col items-center justify-center py-4 text-center lg:py-8">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-accent-600/15 lg:mb-4 lg:h-14 lg:w-14 lg:rounded-2xl"><Bot size={23} className="text-accent-500 lg:h-7 lg:w-7" /></div>
              <h2 className="mb-2 text-lg font-semibold text-text sm:text-xl">What are we learning today?</h2>
              <p className="mb-4 hidden max-w-md text-sm text-text-muted lg:mb-6 lg:block">Ask a question or choose a starting point. You can request a direct explanation or learn step by step.</p>
              <div className="mt-2 grid w-full max-w-xl grid-cols-2 gap-2 lg:mt-0 lg:grid-cols-2">
                {QUICK_PROMPTS.map((qp) => {
                  const Icon = qp.icon;
                  return <Button variant="source" key={qp.text} onClick={() => handleQuickPrompt(qp.text, qp.subject)} className="flex min-h-12 items-center gap-2 rounded-lg border border-border p-2 text-left transition-colors hover:border-accent-500 hover:bg-surface-hover lg:min-h-16 lg:items-start lg:gap-3 lg:rounded-xl lg:p-3">
                    <Icon size={18} className="mt-0.5 shrink-0 text-accent-500" />
                    <span className="text-xs leading-snug text-text sm:text-sm">{qp.text}</span>
                  </Button>;
                })}
              </div>
            </div>
          ) : activeSession.messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
          {isThinking && <div className="flex items-center gap-2 text-sm text-text-muted"><Bot size={17} className="text-accent-500" /> Thinking…</div>}
          <div ref={messagesEndRef} />
        </div>

        <div className="relative z-20 mt-auto flex shrink-0 flex-col gap-2 border-t border-white/10 bg-[#09090b] p-4 shadow-[0_-8px_24px_rgba(0,0,0,0.22)]">
          {pendingImage && <div className="flex items-center gap-2 text-xs text-text-muted"><ImageIcon size={14} className="shrink-0" /> Image preview only for now. Describe it in your message; image analysis is coming in Phase 3.</div>}
          <div className="flex min-w-0 items-end gap-2">
            <ImageUpload compact onImageSelected={setPendingImage} label="Choose image" />
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            }} rows={1} placeholder="Ask your tutor anything…" className="h-11 min-h-[44px] max-h-11 min-w-0 flex-1 resize-none overflow-y-auto rounded-xl border border-border bg-surface-hover px-3 py-2 text-sm leading-5 text-text outline-none focus:border-accent-500" />
            <Button variant="source" aria-label="Send message" onClick={sendMessage} disabled={(!input.trim() && !pendingImage) || isThinking} className="h-11 min-h-[44px] shrink-0 rounded-xl bg-accent-600 p-2.5 text-white transition-colors hover:bg-accent-700 disabled:opacity-50"><Send size={18} /></Button>
          </div>
          <div className="flex items-start gap-1.5 text-[10px] leading-snug text-text-dim lg:items-center lg:text-[11px]"><AlertCircle size={11} className="mt-0.5 shrink-0 lg:mt-0" /><span className="min-w-0">AI answers can make mistakes. Check important information against your textbook or teacher.</span></div>
        </div>
      </section>

      <aside className={"glass surface-elevated min-h-0 overflow-y-auto rounded-xl p-3 " + (mobilePanel === "tools" ? "block flex-1" : "hidden") + " lg:block"}>
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


const MarkdownMessage = memo(function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="prose-chat space-y-3 break-words">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkMath, remarkBreaks]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ children }) => <h1 className="text-base font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="pt-1 text-sm font-semibold">{children}</h3>,
          h4: ({ children }) => <h4 className="pt-1 text-sm font-semibold">{children}</h4>,
          h5: ({ children }) => <h5 className="pt-1 text-sm font-semibold">{children}</h5>,
          h6: ({ children }) => <h6 className="pt-1 text-sm font-semibold">{children}</h6>,
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-accent-500/50 pl-3 text-text-muted">{children}</blockquote>,
          code: ({ children }) => <code className="rounded bg-black/10 px-1 py-0.5 text-[0.9em]">{children}</code>,
          pre: ({ children }) => <pre className="overflow-x-auto rounded-lg bg-black/10 p-3 text-xs">{children}</pre>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

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
          <MarkdownMessage content={message.content} />
        </div>
      </div>
    </div>
  );
}
