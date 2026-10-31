import { useRef, useState } from 'react';
import { Excalidraw, convertToExcalidrawElements, exportToBlob } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { useServerFn } from '@tanstack/react-start';
import { Sparkles, Download, Moon, Sun, Trash2, Square, Pause, Play, History, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { explainBoard } from '@/lib/learning-ai.functions';
import { load, save } from '@/lib/storage';
import { dataURL } from '@/lib/source-files';
import type { SourceInput } from '@/lib/learning-models';
import { AIConsent, requireAISession } from './AIConsent';
import { SourcePicker } from './SourcePicker';

type BoardMessage = { question: string; answer: string; citations: string[] };
type BoardSession = {
  id: string;
  title: string;
  updatedAt: string;
  messages: BoardMessage[];
  boardElements: unknown[];
};

const SESSIONS_KEY = 'studysmartly_sessions';

function readSessions(): BoardSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(SESSIONS_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is BoardSession =>
      Boolean(item && typeof item === 'object' &&
        typeof item.id === 'string' && typeof item.title === 'string' &&
        typeof item.updatedAt === 'string' && Array.isArray(item.messages) &&
        Array.isArray(item.boardElements)),
    );
  } catch {
    return [];
  }
}

function createSessionId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function DrawingBoard() {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [prompt, setPrompt] = useState('');
  const [sources, setSources] = useState<SourceInput[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState('');
  const [dark, setDark] = useState(false);
  const [messages, setMessages] = useState<BoardMessage[]>(() => load('board-discussion', []));
  const [sessions, setSessions] = useState<BoardSession[]>(readSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const explain = useServerFn(explainBoard);
  const initial = useRef(load('whiteboard', null));
  const runRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cancelWaitsRef = useRef<(() => void)[]>([]);
  const sessionsRef = useRef(sessions);
  const activeSessionRef = useRef<string | null>(null);
  const animatingRef = useRef(false);

  function commitSessions(next: BoardSession[]) {
    sessionsRef.current = next;
    setSessions(next);
    try {
      window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(next));
    } catch {
      setError('Session storage is full. Your current lesson is still available until you leave this page.');
    }
  }

  function persistSession(nextMessages: BoardMessage[], elements: unknown[], preferredId = activeSessionRef.current) {
    const id = preferredId || createSessionId();
    const firstQuestion = nextMessages[0]?.question;
    const existing = sessionsRef.current.find((session) => session.id === id);
    const session: BoardSession = {
      id,
      title: firstQuestion?.slice(0, 72) || existing?.title || 'New doubt session',
      updatedAt: new Date().toISOString(),
      messages: nextMessages,
      boardElements: elements,
    };
    const next = [session, ...sessionsRef.current.filter((item) => item.id !== id)]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    activeSessionRef.current = id;
    setActiveSessionId(id);
    commitSessions(next);
  }

  function stopPlayback() {
    runRef.current += 1;
    cancelWaitsRef.current.forEach((cancel) => cancel());
    cancelWaitsRef.current = [];
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    setBusy(false);
    animatingRef.current = false;
  }

  function pausePlayback() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && isSpeaking && !isPaused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }

  function resumePlayback() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }

  function wait(ms: number, run: number) {
    return new Promise<void>((resolve) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout>;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        timersRef.current = timersRef.current.filter((item) => item !== timer);
        cancelWaitsRef.current = cancelWaitsRef.current.filter((cancel) => cancel !== cancelWait);
        resolve();
      };
      const cancelWait = () => finish();
      timer = setTimeout(finish, ms);
      timersRef.current.push(timer);
      cancelWaitsRef.current.push(cancelWait);
      if (run !== runRef.current) finish();
    });
  }

  async function ask() {
    const question = prompt.trim();
    if (!api || !question) return;
    // A new doubt always interrupts the current voice and any in-progress drawing.
    stopPlayback();
    const run = runRef.current;
    setError('');
    setBusy(true);
    try {
      if (!consent) throw new Error('Consent to AI processing before continuing.');
      await requireAISession();
      if (run !== runRef.current) return;
      const elements = api.getSceneElements();
      const selected = api.getAppState().selectedElementIds;
      const selection = elements.filter((element) => selected[element.id]);
      const blob = await exportToBlob({
        elements,
        appState: { ...api.getAppState(), exportBackground: true },
        files: api.getFiles(),
        mimeType: 'image/png',
      });
      const image = await dataURL(new File([blob], 'student-board.png', { type: 'image/png' }));
      const history = messages.slice(-8).map((message) =>
        'Student: ' + message.question + '\nTutor: ' + message.answer,
      ).join('\n\n');
      const result = await explain({
        data: {
          prompt: question,
          board: JSON.stringify(selection.length ? selection : elements),
          history,
          sources: [...sources, {
            name: 'Student whiteboard',
            text: 'Student drawing; inspect selected objects and image.',
            images: [image],
          }],
          consent: true,
        },
      });
      if (run !== runRef.current) return;

      const ink = getComputedStyle(document.documentElement).getPropertyValue('--board-tutor').trim() || '#0f9f6e';
      let nextY = Math.max(200, ...elements.map((element) => element.y + element.height + 40));
      const normalized = result.board_elements.map((element, index) => {
        const text = element.type === 'text' ? element.text.replace(/[$\\]/g, '').trim() : element.text;
        const y = index === 0 ? 50 : Math.max(200 + (index - 1) * 150, nextY);
        nextY = y + Math.max(90, element.height) + 60;
        return {
          type: element.type,
          x: index === 0 ? 100 : Math.max(100, element.x),
          y: selection.length ? element.y : y,
          width: element.type === 'text' ? Math.max(250, text.length * 12) : Math.max(1, Math.abs(element.width)),
          height: element.type === 'text' ? Math.max(60, element.height || 60) : Math.max(1, Math.abs(element.height)),
          strokeColor: ink,
          ...(element.type === 'text'
            ? { text, fontSize: 20, autoResize: true }
            : element.type === 'rectangle' || element.type === 'ellipse'
              ? { label: { text, fontSize: 20 } }
              : {}),
          ...(element.type === 'arrow' || element.type === 'line'
            ? { points: [[0, 0], [element.width, element.height]] as [number, number][] }
            : {}),
        };
      });
      // Speak the explanation while the board is being drawn.
      let drawingFinished = false;
      let speechFinished = !(typeof window !== 'undefined' && 'speechSynthesis' in window && result.spoken_script.trim());
      const finishIfDone = () => {
        if (drawingFinished && speechFinished && run === runRef.current) setBusy(false);
      };
      if (!speechFinished) {
        const utterance = new SpeechSynthesisUtterance(result.spoken_script);
        utterance.rate = 0.96;
        utterance.pitch = 1;
        utterance.onstart = () => { if (run === runRef.current) setIsSpeaking(true); };
        utterance.onpause = () => { if (run === runRef.current) setIsPaused(true); };
        utterance.onresume = () => { if (run === runRef.current) setIsPaused(false); };
        utterance.onend = () => {
          if (run === runRef.current) { setIsSpeaking(false); setIsPaused(false); }
          speechFinished = true;
          finishIfDone();
        };
        utterance.onerror = () => {
          if (run === runRef.current) { setIsSpeaking(false); setIsPaused(false); }
          speechFinished = true;
          finishIfDone();
        };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }

      animatingRef.current = true;
      const added = convertToExcalidrawElements(normalized as any[]);
      const all = [...elements];
      for (const element of added) {
        if (run !== runRef.current) return;
        if (element.type === 'text' && element.text) {
          const fullText = element.text;
          const chars = Array.from(fullText);
          const animated = { ...element, text: '' };
          all.push(animated);
          api.updateScene({ elements: [...all] });
          for (let index = 0; index < chars.length; index++) {
            if (run !== runRef.current) return;
            all[all.length - 1] = { ...animated, text: chars.slice(0, index + 1).join('') };
            api.updateScene({ elements: [...all] });
            await wait(18, run);
          }
        } else {
          all.push(element);
          api.updateScene({ elements: [...all] });
          await wait(30, run);
        }
      }
      if (run !== runRef.current) return;
      api.scrollToContent(added, { fitToContent: true });
      drawingFinished = true;
      animatingRef.current = false;

      const nextMessages = [...messages, {
        question,
        answer: result.chat_response,
        citations: result.citations,
      }];
      setMessages(nextMessages);
      save('board-discussion', nextMessages);
      const finalElements = api.getSceneElements();
      save('whiteboard', { elements: finalElements, files: api.getFiles() });
      persistSession(nextMessages, finalElements);
      setPrompt('');
      finishIfDone();
    } catch (cause) {
      if (run === runRef.current) {
        animatingRef.current = false;
        setError(cause instanceof Error ? cause.message : 'Could not explain this board.');
        setBusy(false);
        setIsSpeaking(false);
        setIsPaused(false);
      }
    }
  }

  function openSession(session: BoardSession) {
    stopPlayback();
    activeSessionRef.current = session.id;
    setActiveSessionId(session.id);
    setMessages(session.messages);
    save('board-discussion', session.messages);
    api?.updateScene({ elements: session.boardElements as any[] });
    save('whiteboard', { elements: session.boardElements, files: api?.getFiles() || {} });
    setPrompt('');
    setError('');
    setHistoryOpen(false);
  }

  return (
    <div className="learning-workspace">
      <header className="learning-heading">
        <div><span className="workspace-eyebrow">EXPLORE / WHITEBOARD</span><h1>Visual Whiteboard</h1></div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" aria-label="Toggle board theme" onClick={() => setDark(!dark)}>{dark ? <Sun /> : <Moon />}</Button>
          <Button variant="outline" size="icon" aria-label="Download board" onClick={async () => {
            if (!api) return;
            const blob = await exportToBlob({ elements: api.getSceneElements(), appState: api.getAppState(), files: api.getFiles(), mimeType: 'image/png' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url; anchor.download = 'StudySmart-whiteboard.png'; anchor.click();
            URL.revokeObjectURL(url);
          }}><Download /></Button>
          <Button variant="outline" size="icon" aria-label="Clear board" onClick={() => {
            if (window.confirm('Clear the entire board and start a new doubt session?')) {
              stopPlayback();
              api?.resetScene();
              setMessages([]);
              activeSessionRef.current = null;
              setActiveSessionId(null);
              save('board-discussion', []);
              save('whiteboard', { elements: [], files: {} });
            }
          }}><Trash2 /></Button>
        </div>
      </header>
      <div className="whiteboard-workspace">
        <section className="drawing-surface" aria-label="Interactive whiteboard">
          <Excalidraw excalidrawAPI={setApi} initialData={initial.current} theme={dark ? 'dark' : 'light'}
            onChange={(elements, _state, files) => {
              save('whiteboard', { elements, files });
              if (activeSessionRef.current && !animatingRef.current) {
                persistSession(messages, elements, activeSessionRef.current);
              }
            }} />
        </section>
        <aside className="board-copilot">
          <div className="board-copilot-heading"><Sparkles size={17} /><span>Visual tutor</span>
            {busy && <span className="board-speaking">{isPaused ? 'Voice paused' : isSpeaking ? 'Speaking' : 'Drawing lesson'}</span>}
          </div>

          <div className="board-history-toggle">
            <Button variant="outline" size="sm" className="w-full justify-between" onClick={() => setHistoryOpen(!historyOpen)} aria-expanded={historyOpen}>
              <span className="inline-flex items-center gap-2"><History size={15} /> Doubt Center · Session History ({sessions.length})</span>
              <span>{historyOpen ? 'Hide' : 'View'}</span>
            </Button>
          </div>
          {historyOpen && (
            <section className="board-history" aria-label="Saved doubt sessions">
              {sessions.length === 0 ? (
                <p className="board-history-empty">Your saved lessons will appear here after your first question.</p>
              ) : sessions.map((session) => (
                <button key={session.id} type="button"
                  className={`board-history-item${activeSessionId === session.id ? ' active' : ''}`}
                  onClick={() => openSession(session)}>
                  <span className="board-history-title">{session.title}</span>
                  <span className="board-history-meta">{session.messages.length} {session.messages.length === 1 ? 'doubt' : 'doubts'} · {new Date(session.updatedAt).toLocaleString()}</span>
                </button>
              ))}
            </section>
          )}

          <div className="board-discussion" aria-live="polite">
            {messages.length === 0 && <p className="board-empty"><MessageCircle size={16} /> Ask a question to start a live lesson. Your doubts and explanations will be saved in Session History.</p>}
            {messages.map((message, index) => (
              <article key={index} className="board-message">
                <strong>{message.question}</strong>
                <p className="whitespace-pre-wrap">{message.answer}</p>
                {message.citations.length > 0 && <small>{message.citations.join(' · ')}</small>}
              </article>
            ))}
            {busy && <p className="board-thinking">Preparing your explanation…</p>}
          </div>
          <div className="board-composer">
            <textarea className="learning-input board-chat-input" rows={2} aria-label="Whiteboard question"
              placeholder="Ask a follow-up question…" value={prompt}
              onChange={(event) => { if (busy) stopPlayback(); setPrompt(event.target.value); }}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void ask(); } }} />
            <div className="board-actions">
              <Button className="board-send" disabled={!prompt.trim()} onClick={() => void ask()}>
                <Sparkles size={16} /> {busy ? 'Ask this doubt' : 'Explain on board'}
              </Button>
              {isSpeaking && !isPaused && (
                <Button variant="outline" className="board-voice" onClick={pausePlayback} aria-label="Pause voice">
                  <Pause size={15} /> Pause
                </Button>
              )}
              {isPaused && (
                <Button variant="outline" className="board-voice" onClick={resumePlayback} aria-label="Resume voice">
                  <Play size={15} /> Resume
                </Button>
              )}
              <Button className="board-stop" variant="destructive" disabled={!busy && !isSpeaking} onClick={stopPlayback}>
                <Square size={15} /> Stop
              </Button>
            </div>
            <details className="board-options">
              <summary>Sources and AI consent</summary>
              <SourcePicker sources={sources} onChange={setSources} />
              <AIConsent consent={consent} onConsent={setConsent} />
            </details>
            {error && <p role="alert" className="learning-error">{error}</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
