import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Excalidraw, convertToExcalidrawElements, exportToBlob } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { useServerFn } from '@tanstack/react-start';
import { Sparkles, Download, Moon, Sun, Square, Pause, Play, History, MessageCircle, Plus, Mic, MicOff, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { explainBoard } from '@/lib/learning-ai.functions';
import { load, save } from '@/lib/storage';
import { dataURL } from '@/lib/source-files';
import type { SourceInput } from '@/lib/learning-models';
import { AIConsent, requireAISession } from './AIConsent';
import { useFocusMode } from '@/components/focus-mode-context';
import { SourcePicker } from './SourcePicker';
import InteractiveLoader from '@/components/ui/InteractiveLoader';
import { stopNeuralVoice } from '@/lib/neural-voice';

type BoardMessage = { question: string; answer: string; citations: string[] };
type BoardSession = {
  id: string;
  title: string;
  timestamp: string;
  messages: BoardMessage[];
  board_elements: unknown[];
  board_files?: Record<string, any>;
  session_title?: string;
};


const DEFAULT_STROKE = '#1e1e1e';
const DEFAULT_BACKGROUND = 'transparent';

function createBoardElementId() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // Fall through for browsers without a usable crypto implementation.
  }
  return `board-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Validate both AI-generated element skeletons and persisted Excalidraw elements. */
function sanitizeBoardElements(input: unknown): Record<string, any>[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const source = raw as Record<string, any>;
    if (typeof source.type !== 'string' || !source.type.trim()) return [];
    const width = Math.max(1, Math.abs(finiteNumber(source.width, 300)));
    const height = Math.max(1, Math.abs(finiteNumber(source.height, 80)));
    const text = typeof source.text === 'string' ? source.text : '';
    const safe: Record<string, any> = {
      ...source,
      id: typeof source.id === 'string' && source.id.trim() ? source.id : createBoardElementId(),
      x: finiteNumber(source.x),
      y: finiteNumber(source.y),
      width,
      height,
      strokeColor: typeof source.strokeColor === 'string' && source.strokeColor.trim() ? source.strokeColor : DEFAULT_STROKE,
      backgroundColor: typeof source.backgroundColor === 'string' && source.backgroundColor.trim() ? source.backgroundColor : DEFAULT_BACKGROUND,
    };
    if (source.type === 'arrow' || source.type === 'line') {
      const points = Array.isArray(source.points)
        ? source.points.filter((point: unknown) => Array.isArray(point) && point.length >= 2
          && Number.isFinite(point[0]) && Number.isFinite(point[1]))
          .map((point: number[]) => [point[0], point[1]])
        : [];
      safe.points = points.length >= 2 ? points : [[0, 0], [width, height]];
    }
    if (source.type === 'text') {
      safe.text = text;
      safe.fontSize = 20;
      safe.autoResize = true;
    }
    return [safe];
  });
}

const SESSIONS_KEY = 'studysmartly_sessions';

function isBoardMessage(value: unknown): value is BoardMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return typeof message.question === 'string'
    && typeof message.answer === 'string'
    && Array.isArray(message.citations)
    && message.citations.every((citation) => typeof citation === 'string');
}

function readMessages(): BoardMessage[] {
  try {
    const value: unknown = load<unknown>('board-discussion', []);
    return Array.isArray(value) ? value.filter(isBoardMessage) : [];
  } catch {
    return [];
  }
}

function readBoardInitial() {
  try {
    const value: unknown = load<unknown>('whiteboard', null);
    if (!value || typeof value !== 'object') return null;
    const board = value as Record<string, unknown>;
    return Array.isArray(board.elements)
      ? { elements: board.elements, files: board.files && typeof board.files === 'object' ? board.files : {} }
      : null;
  } catch {
    return null;
  }
}

function readSessions(): BoardSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(SESSIONS_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .filter((item) => typeof item.id === 'string' && typeof item.title === 'string' && Array.isArray(item.messages) && item.messages.every(isBoardMessage))
      .map((item) => ({
        id: item.id as string,
        title: item.title as string,
        timestamp: typeof item.timestamp === 'string' ? item.timestamp : typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
        messages: item.messages.filter(isBoardMessage),
        board_elements: (Array.isArray(item.board_elements) ? item.board_elements : Array.isArray(item.boardElements) ? item.boardElements : []) as unknown[],
        board_files: item.board_files && typeof item.board_files === 'object' ? item.board_files as Record<string, any> : {},
        session_title: typeof item.session_title === 'string' ? item.session_title : item.title as string,
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
  const { focusMode, setFocusMode } = useFocusMode();
  const enterButtonRef = useRef<HTMLButtonElement | null>(null);
  const exitButtonRef = useRef<HTMLButtonElement | null>(null);
  const focusDidMountRef = useRef(false);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [prompt, setPrompt] = useState('');
  const [sources, setSources] = useState<SourceInput[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const handsFreeRef = useRef(false);
  const busyRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const pendingTranscriptRef = useRef('');
  const transcriptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState('');
  const [dark, setDark] = useState(false);
  const [messages, setMessages] = useState<BoardMessage[]>(readMessages);
  const [sessions, setSessions] = useState<BoardSession[]>(readSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    const lastMessage = messages.at(-1);
    if (!lastMessage) return null;
    return sessions.find((session) => session.messages.length === messages.length && session.messages.at(-1)?.question === lastMessage.question)?.id ?? null;
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const explain = useServerFn(explainBoard);
  const initial = useRef(readBoardInitial());
  const runRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cancelWaitsRef = useRef<(() => void)[]>([]);
  const sessionsRef = useRef(sessions);
  const messagesRef = useRef(messages);
  const activeSessionRef = useRef<string | null>(activeSessionId);
  const animatingRef = useRef(false);

  useEffect(() => {
    try {
      const handoff = window.sessionStorage.getItem('studysmartly_whiteboard_prompt');
      if (handoff) {
        setPrompt(handoff);
        window.sessionStorage.removeItem('studysmartly_whiteboard_prompt');
      }
    } catch (error) {
      console.warn('Could not read the flashcard Whiteboard handoff:', error);
    }
  }, []);

  useEffect(() => () => {
    setFocusMode(false);
    try { recognitionRef.current?.stop(); } catch { /* Speech recognition may already be stopped. */ }
    if (transcriptTimerRef.current) clearTimeout(transcriptTimerRef.current);
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    transcriptTimerRef.current = null;
    restartTimerRef.current = null;
    runRef.current += 1;
    timersRef.current.forEach(clearTimeout);
    cancelWaitsRef.current.forEach((cancel) => cancel());
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    } catch {
      /* Speech APIs may be unavailable in embedded browsers. */
    }
  }, []);

  useEffect(() => {
    if (!focusDidMountRef.current) {
      focusDidMountRef.current = true;
      if (!focusMode) return;
    }
    const frame = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      if (focusMode) exitButtonRef.current?.focus();
      else enterButtonRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusMode]);

  useEffect(() => {
    if (!focusMode) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== 'Escape') return;
      const target = event.target;
      if (target instanceof HTMLElement && (
        target.isContentEditable
        || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      )) return;
      const appState = api?.getAppState();
      if (appState && (
        appState.editingTextElement
        || Object.keys(appState.selectedElementIds).length > 0
        || appState.openMenu
        || appState.openDialog
      )) return;
      exitFocusMode();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusMode, api]);

  function enterFocusMode() {
    if (handsFreeRef.current) toggleHandsFree();
    setFocusMode(true);
  }

  function exitFocusMode() {
    setFocusMode(false);
  }

  function commitSessions(next: BoardSession[]) {
    sessionsRef.current = next;
    setSessions(next);
    try {
      window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(next));
    } catch {
      setError('Session storage is full. Your current lesson is still available until you leave this page.');
    }
  }

  function persistSession(nextMessages: BoardMessage[], elements: unknown[], preferredId = activeSessionRef.current, generatedTitle?: string, files: Record<string, any> = api?.getFiles() as Record<string, any> ?? {}) {
    const id = preferredId || createSessionId();
    const firstQuestion = nextMessages[0]?.question;
    const existing = sessionsRef.current.find((session) => session.id === id);
    const session: BoardSession = {
      id,
      title: generatedTitle || existing?.session_title || existing?.title || firstQuestion?.slice(0, 48) || 'New doubt session',
      session_title: generatedTitle || existing?.session_title || existing?.title || firstQuestion?.slice(0, 48) || 'New doubt session',
      timestamp: new Date().toISOString(),
      messages: nextMessages,
      board_elements: elements,
      board_files: files,
    };
    const next = [session, ...sessionsRef.current.filter((item) => item.id !== id)]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    activeSessionRef.current = id;
    setActiveSessionId(id);
    commitSessions(next);
  }

  // Persist manual canvas edits without scheduling React state updates from Excalidraw's onChange.
  // Updating sessions state here would re-render Excalidraw for every scene change and can
  // create a maximum-update-depth loop while updateScene() is applying AI elements.
  function persistSessionSnapshot(elements: unknown[], files: Record<string, any>) {
    const id = activeSessionRef.current;
    if (!id) return;
    const existing = sessionsRef.current.find((session) => session.id === id);
    if (!existing) return;
    const nextSession: BoardSession = {
      ...existing,
      timestamp: new Date().toISOString(),
      messages: messagesRef.current,
      board_elements: elements,
      board_files: files,
    };
    const next = [nextSession, ...sessionsRef.current.filter((session) => session.id !== id)]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    sessionsRef.current = next;
    try {
      window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(next));
    } catch (storageError) {
      console.error('Unable to persist whiteboard session snapshot:', storageError);
    }
  }

  function scheduleHandsFreeRestart() {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      startHandsFreeListening();
    }, 350);
  }

  function stopRecognition() {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
    if (transcriptTimerRef.current) clearTimeout(transcriptTimerRef.current);
    transcriptTimerRef.current = null;
    pendingTranscriptRef.current = '';
    try { recognitionRef.current?.stop(); } catch { /* Speech recognition may already be stopped. */ }
    recognitionRef.current = null;
    setIsListening(false);
  }

  function startHandsFreeListening() {
    if (typeof window === 'undefined' || !handsFreeRef.current || busyRef.current || recognitionRef.current) return;
    const SpeechRecognitionConstructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionConstructor) {
      setError('Hands-free voice input is not supported in this browser. Try Chrome or Edge.');
      setHandsFree(false);
      handsFreeRef.current = false;
      return;
    }
    const recognition = new SpeechRecognitionConstructor();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      for (let index = event.resultIndex ?? 0; index < (event.results?.length ?? 0); index += 1) {
        const result = event.results[index];
        if (result?.isFinal) {
          const phrase = String(result[0]?.transcript || '').trim();
          if (phrase) pendingTranscriptRef.current = `${pendingTranscriptRef.current} ${phrase}`.trim();
        }
      }
      if (pendingTranscriptRef.current) {
        if (transcriptTimerRef.current) clearTimeout(transcriptTimerRef.current);
        transcriptTimerRef.current = setTimeout(() => {
          const transcript = pendingTranscriptRef.current.trim();
          pendingTranscriptRef.current = '';
          transcriptTimerRef.current = null;
          if (transcript && handsFreeRef.current && !busyRef.current) {
            try { recognition.stop(); } catch { /* already stopped */ }
            setPrompt(transcript);
            void ask(transcript);
          }
        }, 1100);
      }
    };
    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        handsFreeRef.current = false;
        setHandsFree(false);
        setError('Microphone permission was denied. Allow microphone access in your browser settings, then enable Hands-free Mode again.');
        return;
      }
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(`Hands-free voice error: ${event.error}`);
      }
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsListening(false);
      const transcript = pendingTranscriptRef.current.trim();
      if (transcriptTimerRef.current) clearTimeout(transcriptTimerRef.current);
      transcriptTimerRef.current = null;
      pendingTranscriptRef.current = '';
      if (transcript && handsFreeRef.current && !busyRef.current) {
        setPrompt(transcript);
        void ask(transcript);
        return;
      }
      if (handsFreeRef.current && !busyRef.current) scheduleHandsFreeRestart();
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setError('Could not start the microphone. Check browser permissions and try again.');
    }
  }

  function toggleHandsFree() {
    const next = !handsFreeRef.current;
    handsFreeRef.current = next;
    setHandsFree(next);
    setError('');
    if (next) startHandsFreeListening();
    else stopRecognition();
  }

  function stopPlayback() {
    busyRef.current = false;
    runRef.current += 1;
    cancelWaitsRef.current.forEach((cancel) => cancel());
    cancelWaitsRef.current = [];
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    try {
      stopNeuralVoice();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    } catch {
      /* Speech APIs may be unavailable in embedded browsers. */
    }
    setIsSpeaking(false);
    setIsPaused(false);
    setBusy(false);
    animatingRef.current = false;
    if (handsFreeRef.current) scheduleHandsFreeRestart();
  }

  function pausePlayback() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && isSpeaking && !isPaused) {
      try {
        window.speechSynthesis.pause();
        setIsPaused(true);
      } catch {
        setIsSpeaking(false);
        setIsPaused(false);
      }
    }
  }

  function resumePlayback() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && isPaused) {
      try {
        window.speechSynthesis.resume();
        setIsPaused(false);
      } catch {
        setIsSpeaking(false);
        setIsPaused(false);
      }
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

  function startVoiceInput() {
    if (typeof window === 'undefined' || handsFreeRef.current || busyRef.current) return;
    if ('speechSynthesis' in window && (window.speechSynthesis.speaking || window.speechSynthesis.pending || isSpeaking || isPaused)) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
    }
    if (isListening) {
      stopRecognition();
      return;
    }
    const SpeechRecognitionConstructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionConstructor) {
      setError('Voice input is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    setError('');
    const recognition = new SpeechRecognitionConstructor();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      const transcript = String(event.results?.[0]?.[0]?.transcript || '').trim();
      if (transcript) {
        setPrompt(transcript);
        setIsListening(false);
        void ask(transcript);
      }
    };
    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error !== 'no-speech' && event.error !== 'aborted') setError(`Voice input error: ${event.error}`);
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsListening(false);
    };
    recognitionRef.current = recognition;
    try {
      setIsListening(true);
      recognition.start();
    } catch {
      setIsListening(false);
      setError('Could not start the microphone. Check browser permissions and try again.');
    }
  }

  async function ask(questionOverride?: string) {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    } catch (speechError) {
      console.error('Unable to clear speech synthesis before starting a new tutor request:', speechError);
    }
    const question = (questionOverride ?? prompt).trim();
    if (!api || !question) return;
    // Pause microphone capture before processing any spoken or typed question.
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
    recognitionRef.current = null;
    setIsListening(false);
    // A new doubt always interrupts the current voice and any in-progress drawing.
    stopPlayback();
    busyRef.current = true;
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
      if (result.success === false) throw new Error(result.error);
      const boardResult = result.data;
      if (run !== runRef.current) return;

      const ink = getComputedStyle(document.documentElement).getPropertyValue('--board-tutor').trim() || '#0f9f6e';
      const currentBottom = elements.reduce((bottom, element) => Math.max(bottom, element.y + element.height), 0);
      const hasDiagramImage = typeof boardResult.diagram_image_prompt === 'string' && boardResult.diagram_image_prompt.trim().length > 0;
      const firstY = elements.length === 0 ? 100 : currentBottom + 180;
      let normalized: Record<string, unknown>[];
      try {
        normalized = sanitizeBoardElements(boardResult.board_elements).map((element, index) => {
          const text = (typeof element.text === 'string' ? element.text : '').replace(/[$\\]/g, '').trim();
          const lineCount = Math.max(1, text.split(/\r?\n/).length);
          // Diagram labels stay compact and retain their AI-planned positions around
          // the illustration. Non-image lessons keep the established vertical layout.
          const width = hasDiagramImage
            ? Math.min(360, Math.max(180, text.length * 11, Math.abs(element.width)))
            : Math.max(450, text.length * 14, Math.abs(element.width));
          const height = Math.min(160, Math.max(72, lineCount * 28 + 28, Math.min(160, Math.abs(element.height))));
          return {
            ...element,
            id: typeof element.id === 'string' && element.id.trim() ? element.id : createBoardElementId(),
            type: element.type,
            x: hasDiagramImage ? Math.max(20, Math.min(1450, element.x)) : Math.max(100, element.x),
            y: hasDiagramImage ? Math.max(40, Math.min(1650, element.y)) : firstY + index * 180,
            width,
            height,
            strokeColor: ink,
            backgroundColor: typeof element.backgroundColor === 'string' ? element.backgroundColor : DEFAULT_BACKGROUND,
            ...(element.type === 'text'
              ? { text, fontSize: 20, autoResize: true, width }
              : element.type === 'rectangle' || element.type === 'ellipse'
                ? { label: { text, fontSize: 20, autoResize: true } }
                : {}),
            ...(element.type === 'arrow' || element.type === 'line'
              ? { points: [[0, 0], [Math.max(1, Math.abs(element.width)), Math.max(1, Math.abs(element.height))]] as [number, number][] }
              : {}),
          };
        });
      } catch (mappingError) {
        throw new Error(mappingError instanceof Error ? 'Could not prepare the tutor diagram: ' + mappingError.message : 'Could not prepare the tutor diagram.');
      }
      // Fetch a textbook-style illustration when the model requests one. If the
      // image service is unavailable, continue with the AI-generated board labels.
      let generatedImageElement: Record<string, any> | null = null;
      if (hasDiagramImage) {
        try {
          const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(boardResult.diagram_image_prompt.trim())}?width=800&height=600&nologo=true`;
          const response = await fetch(imageUrl);
          if (!response.ok) throw new Error(`Image service returned HTTP ${response.status}`);
          const blob = await response.blob();
          if (!blob.type.startsWith('image/')) throw new Error('Image service did not return an image.');
          const imageData = await dataURL(new File([blob], 'tutor-diagram.png', { type: blob.type }));
          const fileId = createBoardElementId();
          api.addFiles([{
            id: fileId,
            dataURL: imageData,
            mimeType: blob.type,
            created: Date.now(),
            lastRetrieved: Date.now(),
          }] as any);
          generatedImageElement = {
            id: createBoardElementId(),
            type: 'image',
            // Centered in the 1600 × 1800 tutor coordinate space.
            x: 550,
            y: 700,
            width: 500,
            height: 400,
            angle: 0,
            strokeColor: DEFAULT_STROKE,
            backgroundColor: DEFAULT_BACKGROUND,
            fillStyle: 'solid',
            strokeWidth: 1,
            strokeStyle: 'solid',
            roughness: 0,
            opacity: 100,
            groupIds: [],
            frameId: null,
            roundness: null,
            seed: Math.floor(Math.random() * 2147483647),
            version: 1,
            versionNonce: Math.floor(Math.random() * 2147483647),
            isDeleted: false,
            boundElements: null,
            updated: Date.now(),
            link: null,
            locked: false,
            fileId,
            status: 'saved',
            scale: [1, 1],
          };
        } catch (imageError) {
          console.error('Unable to generate textbook illustration; continuing with board labels:', imageError);
        }
      }
      // Speak the explanation while the board is being drawn.
      let drawingFinished = false;
      let speechFinished = true;
      const finishIfDone = () => {
        if (drawingFinished && speechFinished && run === runRef.current) {
          busyRef.current = false;
          setBusy(false);
          if (handsFreeRef.current) scheduleHandsFreeRestart();
        }
      };
      if (typeof window !== 'undefined' && 'speechSynthesis' in window && typeof result.spoken_script === 'string' && result.spoken_script.trim()) {
        try {
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
        speechFinished = false;
        } catch {
          speechFinished = true;
          setIsSpeaking(false);
          setIsPaused(false);
        }
      }

      animatingRef.current = true;
      let added: ReturnType<typeof convertToExcalidrawElements>;
      try {
        const safeInput = sanitizeBoardElements(normalized);
        added = sanitizeBoardElements(convertToExcalidrawElements(safeInput as any[])) as any;
        const all = [...elements];
        if (generatedImageElement) {
          all.push(generatedImageElement);
          api.updateScene({ elements: sanitizeBoardElements(all) as any });
          await wait(35, run);
        }
        if (!api) throw new Error('Whiteboard is not ready yet. Please wait a moment and try again.');
        for (const element of added) {
          if (run !== runRef.current) return;
          all.push(element);
          const safeScene = sanitizeBoardElements(all);
          api.updateScene({ elements: safeScene as any });
          await wait(35, run);
        }
        } catch (renderError) {
        console.error('Excalidraw rejected sanitized tutor board elements:', renderError);
        throw new Error(renderError instanceof Error ? 'The tutor diagram could not be drawn: ' + renderError.message : 'The tutor diagram could not be drawn.');
      }
      if (run !== runRef.current) return;
      if (!api) throw new Error('Whiteboard is no longer available. Please reopen the tutor.');
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
      if (!api) throw new Error('Whiteboard is no longer available. Please reopen the tutor.');
      const finalElements = api.getSceneElements();
      save('whiteboard', { elements: finalElements, files: api.getFiles() });
      persistSession(nextMessages, finalElements, activeSessionRef.current, result.session_title, api.getFiles() as Record<string, any>);
      setPrompt('');
      finishIfDone();
    } catch (cause) {
      if (run === runRef.current) {
        animatingRef.current = false;
        setError(cause instanceof Error ? cause.message : 'Could not explain this board.');
        busyRef.current = false;
        setBusy(false);
        if (handsFreeRef.current) scheduleHandsFreeRestart();
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
      if (!api) throw new Error('Whiteboard is still loading. Please wait a moment, then select the session again.');
      const safeElements = sanitizeBoardElements(session.board_elements);
      if (session.board_files && Object.keys(session.board_files).length) api.addFiles(Object.values(session.board_files) as any);
      api.updateScene({ elements: safeElements as any });
      save('whiteboard', { elements: safeElements, files: session.board_files || api.getFiles() });
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'Could not restore this session board.');
    }
    setPrompt('');
    setHistoryOpen(false);
  }

  return (
    <>
    <div className={focusMode ? 'learning-workspace learning-workspace--focus' : 'learning-workspace'}>
      <header className="learning-heading">
        <div><span className="workspace-eyebrow">EXPLORE / WHITEBOARD</span><h1>Visual Whiteboard</h1></div>
        <div className="flex gap-2">
          <Button ref={enterButtonRef} variant="outline" size="icon" aria-label="Enter Zen Focus Mode" title="Zen Focus Mode: full-screen canvas" onClick={enterFocusMode}><Maximize2 /></Button>
          <Button variant="outline" size="icon" aria-label="Toggle board theme" onClick={() => setDark(!dark)}>{dark ? <Sun /> : <Moon />}</Button>
          <Button variant="outline" size="icon" aria-label="Download board" onClick={async () => {
            if (!api) { setError('Whiteboard is still loading. Please try again in a moment.'); return; }
            try {
            const blob = await exportToBlob({ elements: api.getSceneElements(), appState: api.getAppState(), files: api.getFiles(), mimeType: 'image/png' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url; anchor.download = 'StudySmart-whiteboard.png'; anchor.click();
            URL.revokeObjectURL(url);
            } catch (downloadError) {
              setError(downloadError instanceof Error ? downloadError.message : 'Could not export the whiteboard.');
            }
          }}><Download /></Button>
          <Button variant="outline" size="icon" aria-label="New session" title="New session" onClick={() => {
            if (window.confirm('Start a new session? The current session will remain in Session History.')) {
              stopPlayback();
              activeSessionRef.current = null;
              setActiveSessionId(null);
              messagesRef.current = [];
              setMessages([]);
              api?.resetScene();
              save('board-discussion', []);
              save('whiteboard', { elements: [], files: {} });
            }
          }}><Plus /></Button>
        </div>
      </header>
      <div className={focusMode ? 'whiteboard-workspace whiteboard-workspace--focus' : 'whiteboard-workspace'}>
        <section className="drawing-surface" aria-label="Interactive whiteboard">
          <Excalidraw excalidrawAPI={setApi} initialData={initial.current} theme={dark ? 'dark' : 'light'}
            onChange={(elements, _state, files) => {
              // Keep this callback free of React state setters. Excalidraw calls onChange
              // during updateScene(), so setState here can feed back into another render.
              try {
                save('whiteboard', { elements, files });
                if (activeSessionRef.current && !animatingRef.current) {
                  persistSessionSnapshot(elements, files as Record<string, any>);
                }
              } catch (changeError) {
                console.error('Unable to save Excalidraw scene changes:', changeError);
              }
            }} />
        </section>
        <aside className="board-copilot" aria-hidden={focusMode}>
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
            {busy && <InteractiveLoader />}
          </div>
          <div className="board-composer">
            <textarea className="learning-input board-chat-input" rows={2} aria-label="Whiteboard question"
              placeholder="Ask a follow-up question…" value={prompt}
              onChange={(event) => { if (busy) stopPlayback(); setPrompt(event.target.value); }}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void ask(); } }} />
            <div className="board-actions">
              <Button type="button" variant={handsFree ? 'default' : 'outline'} className="board-voice" onClick={toggleHandsFree} aria-pressed={handsFree} aria-label={handsFree ? 'Turn off hands-free mode' : 'Turn on hands-free mode'}>
                <Mic size={16} /> {handsFree ? 'Hands-free On' : 'Hands-free'}
              </Button>
              <Button type="button" variant="outline" className="board-voice" disabled={handsFree || busy} onClick={startVoiceInput} aria-label={isListening ? 'Stop microphone input' : 'Speak a question'}>
                {isListening ? <MicOff size={16} /> : <Mic size={16} />} {isListening ? 'Listening…' : 'Mic'}
              </Button>
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
            {handsFree && <p className="board-options" role="status">Listening continuously. Pause speaking to send your question; the microphone pauses while the AI draws and explains.</p>}
            <details className="board-options">
              <summary>Sources and AI consent</summary>
              <SourcePicker sources={sources} onChange={setSources} />
              <AIConsent consent={consent} onConsent={setConsent} />
            </details>
            {error && <p role="alert" className="learning-error">{error}</p>}
          </div>
        </aside>
      {focusMode && typeof document !== 'undefined' && createPortal(
        <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2 animate-fadeIn max-sm:bottom-[max(5rem,env(safe-area-inset-bottom))]" role="group" aria-label="Focus mode controls">
          {error && <p role="alert" className="max-w-[min(90vw,28rem)] rounded-xl border border-red-300/30 bg-red-950/85 px-3 py-2 text-center text-xs text-red-100 shadow-lg backdrop-blur-md">{error}</p>}
          <div className="flex items-center gap-2">
            <button ref={exitButtonRef} type="button" onClick={exitFocusMode} aria-label="Exit Focus Mode" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-zinc-900/80 px-4 text-sm font-semibold text-white shadow-lg shadow-black/30 backdrop-blur-md transition-colors hover:bg-zinc-800/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300">
              <Minimize2 size={16} aria-hidden="true" /> Exit Focus Mode
            </button>
            {(busy || isSpeaking) && <button type="button" onClick={stopPlayback} aria-label="Stop the tutor" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-red-300/30 bg-red-950/80 px-4 text-sm font-semibold text-red-100 shadow-lg shadow-black/30 backdrop-blur-md transition-colors hover:bg-red-900/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300">
              <Square size={14} aria-hidden="true" /> Stop
            </button>}
          </div>
          <p role="status" className="sr-only">Zen Focus Mode on. Press Escape or use Exit Focus Mode to return.</p>
        </div>,
        document.body
      )}
    </>
  );
}