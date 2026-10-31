import { useRef, useState } from 'react';
import { Excalidraw, convertToExcalidrawElements, exportToBlob } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { useServerFn } from '@tanstack/react-start';
import { Download, Moon, Sun, Trash2, Sparkles, Send, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { explainBoard } from '@/lib/learning-ai.functions';
import { load, save } from '@/lib/storage';
import { dataURL } from '@/lib/source-files';
import type { SourceInput } from '@/lib/learning-models';
import { AIConsent, requireAISession } from './AIConsent';
import { SourcePicker } from './SourcePicker';

type ChatMessage = { question: string; answer: string; citations: string[] };

export default function DrawingBoard() {
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [prompt, setPrompt] = useState('');
  const [sources, setSources] = useState<SourceInput[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dark, setDark] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => load('board-discussion', []));
  const explain = useServerFn(explainBoard);
  const initial = useRef(load('whiteboard', null));
  const runRef = useRef(0);
  const discussionRef = useRef<HTMLDivElement>(null);

  function stopPlayback() {
    runRef.current += 1;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    setBusy(false);
  }

  function wait(ms: number, run: number) {
    return new Promise<boolean>((resolve) => {
      window.setTimeout(() => resolve(runRef.current === run), ms);
    });
  }

  async function animateBoard(elements: ReturnType<typeof convertToExcalidrawElements>, run: number) {
    if (!api) return;
    const existing = [...api.getSceneElements()];
    for (const element of elements) {
      if (runRef.current !== run) return;
      if (element.type === 'text' && typeof element.text === 'string') {
        const fullText = element.text;
        for (let length = 1; length <= fullText.length; length += 1) {
          if (runRef.current !== run) return;
          const partial = { ...element, text: fullText.slice(0, length) };
          api.updateScene({ elements: [...existing, partial] });
          if (!(await wait(30, run))) return;
        }
      } else {
        existing.push(element);
        api.updateScene({ elements: [...existing] });
        if (!(await wait(30, run))) return;
      }
      if (element.type === 'text') existing.push(element);
    }
    if (runRef.current === run && elements.length) api.scrollToContent(elements, { fitToContent: true });
  }

  async function ask() {
    const question = prompt.trim();
    if (!api || !question || busy) return;
    stopPlayback();
    const run = ++runRef.current;
    setError('');
    setBusy(true);
    try {
      if (!consent) throw new Error('Consent to AI processing before continuing.');
      await requireAISession();
      if (runRef.current !== run) return;
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
      if (runRef.current !== run) return;
      const context = messages.slice(-8).map((message) => `Student: ${message.question}\nTutor: ${message.answer}`).join('\n\n');
      const result = await explain({
        data: {
          prompt: question,
          board: JSON.stringify(selection.length ? selection : elements),
          history: context,
          sources: [...sources, { name: 'Student whiteboard', text: 'Student drawing; inspect selected objects and image.', images: [image] }],
          consent: true,
        },
      });
      if (runRef.current !== run) return;

      const offset = selection.length ? 0 : Math.max(0, ...elements.map((element) => element.y + element.height)) + 60;
      const ink = getComputedStyle(document.documentElement).getPropertyValue('--board-tutor').trim() || '#0f9f6e';
      const descriptors = result.board_elements.map((element) => {
        const text = element.type === 'text' ? element.text.replace(/[$\\]/g, '').trim() : '';
        const lineCount = Math.max(1, Math.ceil(text.length / 28));
        return {
          type: element.type,
          x: element.x,
          y: element.y + offset,
          width: element.type === 'text' ? Math.min(520, Math.max(180, Math.min(28, text.length) * 10 + 36)) : Math.max(1, Math.abs(element.width)),
          height: element.type === 'text' ? Math.max(48, lineCount * 28 + 20) : Math.max(1, Math.abs(element.height)),
          strokeColor: ink,
          ...(element.type === 'text' ? { text, fontSize: 20, autoResize: true } : {}),
          ...(element.type === 'arrow' || element.type === 'line' ? { points: [[0, 0], [element.width, element.height]] as [number, number][] } : {}),
        };
      });
      const added = convertToExcalidrawElements(descriptors as Parameters<typeof convertToExcalidrawElements>[0]);
      await animateBoard(added, run);
      if (runRef.current !== run) return;

      const next = [...messages, { question, answer: result.chat_response, citations: result.citations }];
      setMessages(next);
      save('board-discussion', next);
      setPrompt('');
      if (result.spoken_script.trim() && 'speechSynthesis' in window) {
        const speech = new SpeechSynthesisUtterance(result.spoken_script);
        speech.lang = 'en-IN';
        speech.rate = 0.96;
        window.speechSynthesis.speak(speech);
      }
    } catch (cause) {
      if (runRef.current === run) setError(cause instanceof Error ? cause.message : 'Could not explain this board.');
    } finally {
      if (runRef.current === run) setBusy(false);
    }
  }

  return (
    <div className="learning-workspace">
      <header className="learning-heading">
        <div><span className="workspace-eyebrow">EXPLORE / WHITEBOARD</span><h1>Interactive Classroom</h1></div>
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
              stopPlayback(); api?.resetScene(); setMessages([]); save('board-discussion', []);
            }
          }}><Trash2 /></Button>
        </div>
      </header>

      <div className="whiteboard-workspace">
        <section className="drawing-surface" aria-label="Interactive whiteboard">
          <Excalidraw excalidrawAPI={setApi} initialData={initial.current} theme={dark ? 'dark' : 'light'} onChange={(scene, _state, files) => save('whiteboard', { elements: scene, files })} />
        </section>

        <aside className="board-copilot">
          <div className="board-chat-heading"><span className="flex gap-2 items-center text-sm font-semibold"><Sparkles size={17} /> Classroom chat</span>
            {busy && <Button variant="destructive" size="sm" onClick={stopPlayback}><Square size={14} /> Stop</Button>}
          </div>
          <div className="board-discussion" ref={discussionRef} aria-live="polite">
            {messages.length === 0 && <div className="board-empty"><Sparkles size={20} /><p>Ask a question about your topic or the drawing. Your tutor will explain, speak, and build the diagram live.</p></div>}
            {messages.map((message, index) => (
              <article key={index} className="board-message">
                <div className="board-user-message"><strong>You</strong><p>{message.question}</p></div>
                <div className="board-assistant-message"><strong>Visual tutor</strong><p className="whitespace-pre-wrap">{message.answer}</p></div>
                {message.citations.length > 0 && <small>{message.citations.join(' · ')}</small>}
              </article>
            ))}
            {busy && <p className="learning-status">Tutor is preparing the board…</p>}
          </div>
          <form className="board-composer" onSubmit={(event) => { event.preventDefault(); void ask(); }}>
            <textarea className="learning-input board-chat-input" aria-label="Message the classroom tutor" placeholder="Ask a follow-up question…" value={prompt} onChange={(event) => {
              if (busy) stopPlayback();
              setPrompt(event.target.value);
            }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void ask(); } }} />
            <Button type="submit" className="w-full" disabled={!prompt.trim() || busy}><Send size={16} /> Send message</Button>
          </form>
          <div className="board-settings"><SourcePicker sources={sources} onChange={setSources} /><AIConsent consent={consent} onConsent={setConsent} /></div>
          {error && <p role="alert" className="learning-error">{error}</p>}
        </aside>
      </div>
    </div>
  );
}
