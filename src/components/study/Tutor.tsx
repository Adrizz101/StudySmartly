import { Button } from '@/components/ui/button';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/store';
import { ChatMessage, TutorSession } from '@/types';
import { generateSocraticResponse, isApiKeyConfigured, callOpenAI } from '@/lib/socratic';
import { ImageUpload } from '@/components/ImageUpload';
import {
  Send, Bot, User, Plus, Trash2, Sparkles, Image as ImageIcon,
  GraduationCap, BookOpen, Brain, Clock, AlertCircle,
} from 'lucide-react';

const QUICK_PROMPTS = [
  { icon: BookOpen, text: 'Explain the concept of entropy in thermodynamics', subject: 'Physics' },
  { icon: Brain, text: 'Help me understand the Krebs cycle step by step', subject: 'Biology' },
  { icon: GraduationCap, text: 'What is the difference between mitosis and meiosis?', subject: 'Biology' },
  { icon: Clock, text: 'How do I solve limits using L\'Hôpital\'s rule?', subject: 'Calculus' },
];

const SOCRATIC_SYSTEM = `You are a Socratic study companion. Your role is to GUIDE students to discover answers themselves through thoughtful questioning — NOT to give direct answers. Ask one guiding question at a time. Be encouraging, patient, and academic. If the student is stuck after several exchanges, provide a hint rather than the full answer.`;

export default function Tutor() {
  const { settings, tutorSessions, setTutorSessions } = useApp();
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
    if (!input.trim() && !pendingImage) return;
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
    updateSession(sessionId, (s) => ({
      ...s,
      messages: [...s.messages, userMsg],
    }));
    setInput('');
    setPendingImage('');
    setIsThinking(true);

    const turnCount = currentMessages.filter((m) => m.role === 'user').length;
    const ctxSubject = subject || activeSession?.subject || 'this topic';

    if (isApiKeyConfigured(settings.aiApiKey)) {
      try {
        const apiMessages = [
          { role: 'system', content: SOCRATIC_SYSTEM },
          ...currentMessages.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: userMsg.content + (userMsg.image ? ' [Image attached]' : '') },
        ];
        const response = await callOpenAI(settings.aiBaseUrl, settings.aiApiKey, settings.aiModel, apiMessages);
        const aiMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response,
          timestamp: Date.now(),
        };
        updateSession(sessionId, (s) => ({ ...s, messages: [...s.messages, aiMsg] }));
      } catch (err) {
        const errMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `I couldn't connect to the AI service: ${(err as Error).message}. Falling back to Socratic mode.\n\n${generateSocraticResponse({ subject: ctxSubject, question: userMsg.content }, turnCount)}`,
          timestamp: Date.now(),
        };
        updateSession(sessionId, (s) => ({ ...s, messages: [...s.messages, errMsg] }));
      }
    } else {
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 600));
      const aiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: generateSocraticResponse({ subject: ctxSubject, question: userMsg.content }, turnCount),
        timestamp: Date.now(),
      };
      updateSession(sessionId, (s) => ({ ...s, messages: [...s.messages, aiMsg] }));
    }

    setIsThinking(false);
  }, [input, pendingImage, activeSessionId, activeSession, subject, settings, createSession, updateSession]);

  const handleQuickPrompt = useCallback((prompt: string, subj: string) => {
    setSubject(subj);
    setInput(prompt);
  }, []);

  const deleteSession = useCallback((id: string) => {
    setTutorSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(null);
  }, [setTutorSessions, activeSessionId]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-120px)]">
      {/* Session list */}
      <div className="lg:w-64 shrink-0 glass rounded-xl p-3 surface-elevated overflow-y-auto">
        <Button variant="source"
          onClick={() => { setActiveSessionId(null); setSubject(''); }}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-accent-600 hover:bg-accent-700 text-study-white text-sm font-medium transition-colors mb-3"
        >
          <Plus size={16} /> New Session
        </Button>
        <div className="space-y-1">
          {tutorSessions.length === 0 && (
            <p className="text-xs text-text-dim text-center py-4">No sessions yet</p>
          )}
          {tutorSessions.map((session) => (
            <div
              key={session.id}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors min-h-[44px] ${
                activeSessionId === session.id ? 'bg-surface-active' : 'hover:bg-surface-hover'
              }`}
              onClick={() => setActiveSessionId(session.id)}
            >
              <Bot size={15} className="text-text-dim shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text truncate">{session.subject}</div>
                <div className="text-xs text-text-dim">{session.messages.length} msgs</div>
              </div>
              <Button variant="source"
                onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-text-dim hover:text-study-rose-500 transition-all"
              >
                <Trash2 size={13} />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col glass rounded-xl surface-elevated overflow-hidden">
        {/* Subject bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Sparkles size={16} className="text-accent-500" />
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject (e.g. Biology, Calculus)"
            className="flex-1 bg-transparent text-sm font-medium text-text focus:outline-none placeholder:text-text-dim"
          />
          {!isApiKeyConfigured(settings.aiApiKey) && (
            <span className="text-xs px-2 py-1 rounded-full bg-study-amber-500/15 text-study-amber-500 font-medium whitespace-nowrap">
              Socratic Mode
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {!activeSession || activeSession.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="w-16 h-16 rounded-2xl bg-accent-600/15 flex items-center justify-center mb-4">
                <Bot size={32} className="text-accent-500" />
              </div>
              <h3 className="text-lg font-semibold text-text mb-1">Socratic AI Tutor</h3>
              <p className="text-sm text-text-muted max-w-sm mb-6">
                Ask a question and I'll guide you to the answer through thoughtful questions — building your understanding, not just giving answers.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {QUICK_PROMPTS.map((qp) => {
                  const Icon = qp.icon;
                  return (
                    <Button variant="source"
                      key={qp.text}
                      onClick={() => handleQuickPrompt(qp.text, qp.subject)}
                      className="flex items-start gap-2.5 p-3 rounded-xl border border-border hover:border-accent-500 hover:bg-surface-hover text-left transition-all group"
                    >
                      <Icon size={18} className="text-accent-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-medium text-text-muted">{qp.subject}</div>
                        <div className="text-sm text-text group-hover:text-accent-500 transition-colors">{qp.text}</div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : (
            activeSession.messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))
          )}
          {isThinking && (
            <div className="flex items-center gap-2 text-text-muted">
              <div className="w-8 h-8 rounded-full bg-accent-600/15 flex items-center justify-center shrink-0">
                <Bot size={16} className="text-accent-500" />
              </div>
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-accent-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-accent-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-accent-500 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-border p-3">
          {pendingImage && (
            <div className="mb-2 flex items-center gap-2 text-xs text-text-muted">
              <ImageIcon size={14} /> Image attached
            </div>
          )}
          <div className="flex items-end gap-2">
            <ImageUpload compact onImageSelected={setPendingImage} label="Upload screenshot" />
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              rows={1}
              placeholder="Ask a question... (Enter to send, Shift+Enter for newline)"
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500 resize-none max-h-32"
              style={{ minHeight: '44px' }}
            />
            <Button variant="source"
              aria-label="Send message" onClick={sendMessage}
              disabled={(!input.trim() && !pendingImage) || isThinking}
              className="p-3 rounded-xl bg-accent-600 hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed text-study-white transition-colors shrink-0"
            >
              <Send size={18} />
            </Button>
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-text-dim">
            <AlertCircle size={11} />
            Socratic guidance only — always verify with your instructor for authoritative answers.
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} animate-fadeIn`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isUser ? 'bg-study-blue-600' : 'bg-accent-600/15'
      }`}>
        {isUser ? <User size={16} className="text-study-white" /> : <Bot size={16} className="text-accent-500" />}
      </div>
      <div className={`max-w-[80%] ${isUser ? 'items-end' : ''}`}>
        {message.image && (
          <img src={message.image} alt="Attachment" className="rounded-xl mb-2 max-h-48 object-cover border border-border" />
        )}
        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-study-blue-600 text-study-white rounded-tr-sm'
            : 'bg-surface-hover text-text rounded-tl-sm'
        }`}>
          <div className="prose-chat whitespace-pre-wrap">{message.content}</div>
        </div>
      </div>
    </div>
  );
}
