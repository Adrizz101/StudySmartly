import { useRef, useState } from 'react';
import { Excalidraw, convertToExcalidrawElements, exportToBlob } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { useServerFn } from '@tanstack/react-start';
import { Sparkles, Download, Moon, Sun, Trash2, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { explainBoard } from '@/lib/learning-ai.functions';
import { load, save } from '@/lib/storage';
import { dataURL } from '@/lib/source-files';
import type { SourceInput } from '@/lib/learning-models';
import { AIConsent, requireAISession } from './AIConsent';
import { SourcePicker } from './SourcePicker';

type BoardMessage = { question: string; answer: string; citations: string[] };

export default function DrawingBoard() {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [prompt, setPrompt] = useState('');
  const [sources, setSources] = useState<SourceInput[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dark, setDark] = useState(false);
  const [messages, setMessages] = useState<BoardMessage[]>(() => load('board-discussion', []));
  const explain = useServerFn(explainBoard);
  const initial = useRef(load('whiteboard', null));
  const runRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  function stopPlayback() {
    runRef.current += 1;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    setBusy(false);
  }

  function wait(ms: number, run: number) {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        timersRef.current = timersRef.current.filter((item) => item !== timer);
        resolve();
      }, ms);
      timersRef.current.push(timer);
      if (run !== runRef.current) { clearTimeout(timer); resolve(); }
    });
  }

  async function ask() {
    const question = prompt.trim();
    if (!api || !question) return;
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
          ...(element.type === 'text' ? { text, fontSize: 20, autoResize: true } : {}),
          ...(element.type === 'arrow' || element.type === 'line'
            ? { points: [[0, 0], [element.width, element.height]] as [number, number][] }
            : {}),
        };
      });
      const added = convertToExcalidrawElements(normalized as any[]);
      const all = [...elements];
      for (const element of added) {
        if (run !== runRef.current) return;
        all.push(element);
        api.updateScene({ elements: [...all] });
        await wait(30, run);
      }
      if (run !== runRef.current) return;
      api.scrollToContent(added, { fitToContent: true });

      const nextMessages = [...messages, {
        question,
        answer: result.chat_response,
        citations: result.citations,
      }];
      setMessages(nextMessages);
      save('board-discussion', nextMessages);
      setPrompt('');

      if ('speechSynthesis' in window && result.spoken_script.trim()) {
        const utterance = new SpeechSynthesisUtterance(result.spoken_script);
        utterance.rate = 0.96;
        utterance.pitch = 1;
        utterance.onend = () => { if (run === runRef.current) setBusy(false); };
        utterance.onerror = () => { if (run === runRef.current) setBusy(false); };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } else {
        setBusy(false);
      }
    } catch (cause) {
      if (run === runRef.current) {
        setError(cause instanceof Error ? cause.message : 'Could not explain this board.');
        setBusy(false);
      }
    }
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
            if (window.confirm('Clear the entire board and chat?')) {
              stopPlayback(); api?.resetScene(); setMessages([]);
              localStorage.removeItem('studysmart:board-discussion');
            }
          }}><Trash2 /></Button>
        </div>
      </header>
      <div className="whiteboard-workspace">
        <section className="drawing-surface" aria-label="Interactive whiteboard">
          <Excalidraw excalidrawAPI={setApi} initialData={initial.current} theme={dark ? 'dark' : 'light'}
            onChange={(elements, _state, files) => save('whiteboard', { elements, files })} />
        </section>
        <aside className="board-copilot">
          <div className="board-copilot-heading"><Sparkles size={17} /><span>Visual tutor</span>
            {busy && <span className="board-speaking">Working / speaking</span>}
          </div>
          <div className="board-discussion" aria-live="polite">
            {messages.length === 0 && <p className="board-empty">Ask a question to start a live lesson. Your discussion will appear here.</p>}
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
              <Button className="board-send" disabled={busy || !prompt.trim()} onClick={() => void ask()}>
                <Sparkles size={16} /> Explain on board
              </Button>
              <Button className="board-stop" variant="destructive" disabled={!busy} onClick={stopPlayback}>
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
