import { useEffect, useRef, useState } from 'react';
import { Excalidraw, convertToExcalidrawElements, exportToBlob } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { useServerFn } from '@tanstack/react-start';
import { Sparkles, Download, Moon, Sun, Trash2, Square, Pause, Play, History, MessageCircle, Plus } from 'lucide-react';
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
  timestamp: string;
  messages: BoardMessage[];
  board_elements: unknown[];
};

const SESSIONS_KEY = 'studysmartly_sessions';

function readSessions(): BoardSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(SESSIONS_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .filter((item) => typeof item.id === 'string' && typeof item.title === 'string' && Array.isArray(item.messages))
      .map((item) => ({
        id: item.id as string,
        title: item.title as string,
        timestamp: typeof item.timestamp === 'string' ? item.timestamp : typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
        messages: item.messages as BoardMessage[],
        board_elements: (Array.isArray(item.board_elements) ? item.board_elements : Array.isArray(item.boardElements) ? item.boardElements : []) as unknown[],
      }));
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
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const lastMessage = messages.at(-1);
    if (!lastMessage) return null;
    return sessions.find((session) => session.messages.length === messages.length && session.messages.at(-1)?.question === lastMessage.question)?.id ?? null;
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const explain = useServerFn(explainBoard);
  const initial = useRef(load('whiteboard', null));
  const runRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cancelWaitsRef = useRef<(() => void)[]>([]);
  const sessionsRef = useRef(sessions);
  const messagesRef = useRef(messages);
  const activeSessionRef = useRef<string | null>(activeSessionId);
  const animatingRef = useRef(false);

  useEffect(() => () => {
    runRef.current += 1;
    timersRef.current.forEach(clearTimeout);
    cancelWaitsRef.current.forEach((cancel) => cancel());
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  function commitSessions(next: BoardSession[]) {
    sessionsRef.current = next;
    setSessions(next);
    try {
      window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(next));
    } catch {
      setError('Session storage is full. Your current lesson is still available until you leave this page.');
    }
  }

  function persistSession(nextMessages: BoardMessage[], elements: unknown[], preferredId = activeSessionRef.current, generatedTitle?: string) {
    const id = preferredId || createSessionId();
    const firstQuestion = nextMessages[0]?.question;
    const existing = sessionsRef.current.find((session) => session.id === id);
    const session: BoardSession = {
      id,
      title: generatedTitle || existing?.title || firstQuestion?.slice(0, 48) || 'New doubt session',
      timestamp: new Date().toISOString(),
      messages: nextMessages,
      board_elements: elements,
    };
    const next = [session, ...sessionsRef.current.filter((item) => item.id !== id)]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
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
      const result = await explain({
        data: {
          prompt: question,
          board: JSON.stringify(selection.length ? selection : elements),
          messages: messagesRef.current,
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
      const currentBottom = elements.reduce((bottom, element) => Math.max(bottom, element.y + element.height), 0);
      const firstY = elements.length === 0 ? 100 : currentBottom + 180;
      let normalized: Record<string, unknown>[];
      try {
        normalized = result.board_elements.map((element, index) => {
          const text = element.text.replace(/[$\\]/g, '').trim();
          const lineCount = Math.max(1, text.split(/\r?\n/).length);
          const width = Math.max(300, text.length * 12);
          const height = Math.max(element.height, lineCount * 30 + 36);
          return {
            type: element.type,
            x: Math.max(100, element.x),
            y: firstY + index * 180,
            width: Math.max(width, Math.abs(element.width)),
            height: Math.max(height, Math.abs(element.height)),
            strokeColor: ink,
            ...(element.type === 'text'
              ? { text, fontSize: 20, autoResize: true }
              : element.type === 'rectangle' || element.type === 'ellipse'
                ? { label: { text, fontSize: 20, autoResize: true } }
                : {}),
            ...(element.type === 'arrow' || element.type === 'line'
              ? { points: [[0, 0], [element.width, element.height]] as [number, number][] }
              : {}),
          };
        });
      } catch (mappingError) {
        throw new Error(mappingError instanceof Error ? 'Could not prepare the tutor diagram: ' + mappingError.message : 'Could not prepare the tutor diagram.');
      }
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
      let added: ReturnType<typeof convertToExcalidrawElements>;
      try {
        added = convertToExcalidrawElements(normalized as any[]);
        const all = [...elements];
        for (const element of added) {
          if (run !== runRef.current) return;
          all.push(element);
          api.updateScene({ elements: [...all] });
          await wait(35, run);
        }
      } catch (renderError) {
        throw new Error(renderError instanceof Error ? 'The tutor diagram could not be drawn: ' + renderError.message : 'The tutor diagram could not be drawn.');
      }
      if (run !== runRef.current) return;
      api.scrollToContent(added, { fitToContent: true });
      drawingFinished = true;
      animatingRef.current = false;

      const nextMessages = [...messagesRef.current, {
        question,
        answer: result.chat_response,
        citations: result.citations,
      }];
      messagesRef.current = nextMessages;
      setMessages(nextMessages);
      save('board-discussion', nextMessages);
      const finalElements = api.getSceneElements();
      save('whiteboard', { elements: finalElements, files: api.getFiles() });
      persistSession(nextMessages, finalElements, activeSessionRef.current, result.session_title);
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
    messagesRef.current = session.messages;
    setMessages(session.messages);
    save('board-discussion', session.messages);
    setError('');
    try {
      api?.updateScene({ elements: session.board_elements as any[] });
      save('whiteboard', { elements: session.board_elements, files: api?.getFiles() || {} });
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'Could not restore this session board.');
    }
    setPrompt('');
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
          <Button variant="outline" size="icon" aria-label="New session" title="New session" onClick={() => {
            if (window.confirm('Start a new session? The current session will remain in Session History.')) {
              stopPlayback();
              api?.resetScene();
              messagesRef.current = [];
              setMessages([]);
              activeSessionRef.current = null;
              setActiveSessionId(null);
              save('board-discussion', []);
              save('whiteboard', { elements: [], files: {} });
            }
          }}><Plus /></Button>
        </div>
      </header>
      <div className="whiteboard-workspace">
        <section className="drawing-surface" aria-label="Interactive whiteboard">
          <Excalidraw excalidrawAPI={setApi} initialData={initial.current} theme={dark ? 'dark' : 'light'}
            onChange={(elements, _state, files) => {
              save('whiteboard', { elements, files });
              if (activeSessionRef.current && !animatingRef.current) {
                persistSession(messagesRef.current, elements, activeSessionRef.current);
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
                  <span className="board-history-meta">{session.messages.length} {session.messages.length === 1 ? 'doubt' : 'doubts'} · {new Date(session.timestamp).toLocaleString()}</span>
                </button>
              ))}
            </section>
          )}

          <div className="board-discussion" aria-live="polite">
            {messages.length === 0 && <p className="board-empty"><MessageCircle size={16} /> Ask a question to start a live lesson. Your doubts and explanations will be saved in Session History.</p>}
            {messages.map((message, index) => (
              <article key={index} className="board-chat-pair">
                <div className="board-chat-bubble board-chat-user"><span className="board-chat-role">You</span><p>{message.question}</p></div>
                <div className="board-chat-bubble board-chat-ai"><span className="board-chat-role">AI Tutor</span><p>{message.answer}</p>
                  {message.citations.length > 0 && <small>{message.citations.join(' · ')}</small>}
                </div>
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
