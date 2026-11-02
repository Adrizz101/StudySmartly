import { Button } from '@/components/ui/button';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '@/store';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { generateRevisionPackage } from '@/lib/learning-ai.functions';
import type { RevisionPackage } from '@/lib/learning-models';
import { AIConsent } from '@/components/learning/AIConsent';
import { Transcription } from '@/types';
import {
  Mic, Square, Download, Trash2, Plus, FileAudio,
  Volume2, Clock, Pause, Play, AlertCircle, Copy, Check, BookOpen, Sparkles, Layers3,
} from 'lucide-react';

export default function Transcriber() {
  const { transcriptions, setTranscriptions } = useApp();
  const navigate = useNavigate();
  const generateRevision = useServerFn(generateRevisionPackage);
  const [revisionTarget, setRevisionTarget] = useState('');
  const [revisionTitle, setRevisionTitle] = useState('');
  const [revisionPackage, setRevisionPackage] = useState<RevisionPackage | null>(null);
  const [revisionBusy, setRevisionBusy] = useState(false);
  const [revisionError, setRevisionError] = useState('');
  const [aiConsent, setAiConsent] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [title, setTitle] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(32).fill(0));
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [supported, setSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finalTextRef = useRef('');

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setSupported(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startVisualizer = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const update = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        const levels = Array.from(data.slice(0, 32)).map((v) => (v / 255) * 100);
        setAudioLevels(levels);
        animRef.current = requestAnimationFrame(update);
      };
      update();
    } catch {
      setError('Microphone access denied. Please allow microphone permissions.');
    }
  }, []);

  const stopVisualizer = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevels(new Array(32).fill(0));
  }, []);

  const startRecording = useCallback(async () => {
    setError('');
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError('Speech recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = finalTextRef.current;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript + ' ';
        } else {
          interim += transcript;
        }
      }
      finalTextRef.current = final;
      setCurrentText(final + interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      setError(`Recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      if (isRecording && !isPaused) {
        try { recognition.start(); } catch { /* already running */ }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      await startVisualizer();
      setIsRecording(true);
      setIsPaused(false);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      setError('Failed to start recognition. Please try again.');
    }
  }, [isRecording, isPaused, startVisualizer]);

  const pauseRecording = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* */ }
    }
    setIsPaused(true);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const resumeRecording = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.start(); } catch { /* */ }
    }
    setIsPaused(false);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* */ }
    }
    if (timerRef.current) clearInterval(timerRef.current);
    stopVisualizer();
    setIsRecording(false);
    setIsPaused(false);

    const finalText = finalTextRef.current.trim();
    if (finalText.length > 0) {
      const lectureTitle = title.trim() || `Lecture ${new Date().toLocaleDateString()}`;
      setRevisionTarget(finalText);
      setRevisionTitle(lectureTitle);
      setRevisionPackage(null);
      setRevisionError('');
      const t: Transcription = {
        id: crypto.randomUUID(),
        title: lectureTitle,
        text: finalText,
        createdAt: Date.now(),
        duration: elapsed,
      };
      setTranscriptions((prev) => [t, ...prev]);
    }
    setCurrentText('');
    finalTextRef.current = '';
    setTitle('');
    setElapsed(0);
  }, [title, elapsed, setTranscriptions, stopVisualizer]);

  const deleteTranscription = useCallback((id: string) => {
    setTranscriptions((prev) => prev.filter((t) => t.id !== id));
  }, [setTranscriptions]);

  const downloadText = useCallback((t: Transcription) => {
    const blob = new Blob([`${t.title}\n${'='.repeat(t.title.length)}\nRecorded: ${new Date(t.createdAt).toLocaleString()}\nDuration: ${formatDuration(t.duration)}\n\n${t.text}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${t.title.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const copyText = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  async function createRevisionPackage(text = revisionTarget, lectureTitle = revisionTitle) {
    if (!text.trim()) return;
    setRevisionBusy(true);
    setRevisionError('');
    try {
      if (!aiConsent) throw new Error('Confirm AI processing consent before generating revision notes.');
      const result = await generateRevision({
        data: { title: lectureTitle || 'Lecture notes', transcript: text, consent: true },
      });
      setRevisionPackage(result);
    } catch (cause) {
      setRevisionError(cause instanceof Error ? cause.message : 'Could not generate the revision package.');
    } finally {
      setRevisionBusy(false);
    }
  }

  function openFlashcards() {
    if (!revisionTarget.trim()) return;
    try {
      window.sessionStorage.setItem('studysmartly_flashcard_handoff', JSON.stringify({
        title: revisionTitle || 'Lecture revision',
        subject: 'General',
        sourceText: revisionTarget,
      }));
    } catch {
      setRevisionError('Could not pass the transcript to Flashcards. Copy the transcript and paste it there instead.');
    }
    void navigate({ to: '/flashcards' });
  }

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Recorder */}
      <div className="glass rounded-2xl p-6 surface-elevated">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 className="font-semibold text-text text-lg">Lecture Transcriber</h3>
            <p className="text-sm text-text-muted mt-0.5">Live speech-to-text capture with audio visualization</p>
          </div>
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-study-rose-500/15">
              <span className="w-2 h-2 rounded-full bg-study-rose-500 animate-pulse" />
              <span className="text-xs font-medium text-study-rose-500">{isPaused ? 'Paused' : 'Recording'}</span>
              <span className="text-xs text-text-muted tabular-nums">{formatDuration(elapsed)}</span>
            </div>
          )}
        </div>

        {!supported && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-study-amber-500/10 text-study-amber-500 text-sm mb-4">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>Speech recognition isn't available in this browser. Use Chrome or Edge for live transcription.</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-study-rose-500/10 text-study-rose-500 text-sm mb-4">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Visualizer */}
        <div className="h-32 rounded-xl bg-surface-hover/50 flex items-center justify-center gap-1 px-4 mb-4 overflow-hidden">
          {audioLevels.map((level, i) => (
            <div
              key={i}
              className="flex-1 rounded-full transition-all duration-75"
              style={{
                height: `${Math.max(4, level)}%`,
                background: isRecording && !isPaused
                  ? `linear-gradient(to top, var(--accent-600), var(--accent-400))`
                  : 'var(--border)',
                opacity: isRecording && !isPaused ? 1 : 0.3,
              }}
            />
          ))}
        </div>

        {/* Title input */}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Lecture title (e.g. BIO 201 — Cell Structure)"
          disabled={isRecording}
          className="w-full px-3.5 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500 mb-3 disabled:opacity-50"
        />

        {/* Live text */}
        <div className="min-h-[100px] max-h-[200px] overflow-y-auto p-4 rounded-xl bg-surface-hover/50 border border-border mb-4">
          {currentText ? (
            <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{currentText}</p>
          ) : (
            <p className="text-sm text-text-dim italic">
              {isRecording ? 'Listening... Speak into your microphone.' : 'Press record to start transcribing.'}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          {!isRecording ? (
            <Button variant="source"
              onClick={startRecording}
              disabled={!supported}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-accent-600 hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed text-study-white font-medium text-sm shadow-lg transition-all"
            >
              <Mic size={20} /> Start Recording
            </Button>
          ) : (
            <>
              {isPaused ? (
                <Button variant="source"
                  onClick={resumeRecording}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-accent-600 hover:bg-accent-700 text-study-white font-medium text-sm transition-all"
                >
                  <Play size={18} /> Resume
                </Button>
              ) : (
                <Button variant="source"
                  onClick={pauseRecording}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-study-amber-600 hover:bg-study-amber-700 text-study-white font-medium text-sm transition-all"
                >
                  <Pause size={18} /> Pause
                </Button>
              )}
              <Button variant="source"
                onClick={stopRecording}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-study-rose-600 hover:bg-study-rose-700 text-study-white font-medium text-sm transition-all"
              >
                <Square size={18} /> Stop & Save
              </Button>
            </>
          )}
        </div>
      </div>

      {revisionTarget && (
        <section className="glass rounded-2xl p-5 sm:p-6 space-y-4 min-w-0 w-full">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-text text-lg">Lecture revision studio</h3>
              <p className="text-sm text-text-muted mt-1 break-words">{revisionTitle}</p>
            </div>
            <span className="text-xs text-accent-400">Transcript ready</span>
          </div>
          <AIConsent consent={aiConsent} onConsent={setAiConsent} />
          <div className="flex flex-wrap gap-2">
            <Button variant="source" disabled={revisionBusy || !aiConsent} onClick={() => void createRevisionPackage()}>
              <Sparkles size={16} /> {revisionBusy ? 'Generating…' : 'Generate Revision Package'}
            </Button>
            <Button variant="outline" disabled={!revisionTarget.trim()} onClick={openFlashcards}>
              <Layers3 size={16} /> Generate Flashcards
            </Button>
          </div>
          {revisionError && <p role="alert" className="text-sm text-study-rose-500 break-words">{revisionError}</p>}
          {revisionPackage && (
            <div className="space-y-4 border-t border-border pt-4">
              <section>
                <h4 className="font-semibold text-text flex items-center gap-2"><BookOpen size={16}/> Summary notes</h4>
                <p className="text-sm text-text-muted leading-relaxed whitespace-pre-wrap mt-2">{revisionPackage.summary}</p>
              </section>
              <section>
                <h4 className="font-semibold text-text">Important definitions</h4>
                <dl className="space-y-3 mt-2">
                  {revisionPackage.definitions.map((item, index) => (
                    <div key={index} className="rounded-xl border border-border p-3">
                      <dt className="font-medium text-sm text-text">{item.term}</dt>
                      <dd className="text-sm text-text-muted mt-1">{item.definition}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              <section>
                <h4 className="font-semibold text-text">Practice MCQs</h4>
                <div className="space-y-3 mt-2">
                  {revisionPackage.mcqs.map((item, index) => (
                    <article key={index} className="rounded-xl border border-border p-3">
                      <p className="font-medium text-sm text-text">{index + 1}. {item.question}</p>
                      <ol className="list-[upper-alpha] pl-5 mt-2 space-y-1 text-sm text-text-muted">
                        {item.options.map((option, optionIndex) => (
                          <li key={optionIndex} className={optionIndex === item.correctIndex ? 'text-accent-400 font-medium' : ''}>{option}</li>
                        ))}
                      </ol>
                      <p className="text-xs text-text-muted mt-2">{item.explanation}</p>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}
        </section>
      )}

      {/* Saved transcriptions */}
      {transcriptions.length > 0 && (
        <div>
          <h3 className="font-semibold text-text-muted text-sm uppercase tracking-wide mb-3">Saved Transcriptions</h3>
          <div className="space-y-3">
            {transcriptions.map((t) => (
              <div key={t.id} className="group glass rounded-xl p-4 surface-elevated">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileAudio size={18} className="text-accent-500 shrink-0" />
                    <h4 className="font-semibold text-text text-sm truncate">{t.title}</h4>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="source"
                      onClick={() => copyText(t.text)}
                      className="p-2 rounded-lg hover:bg-surface-hover text-text-dim hover:text-text transition-colors"
                      title="Copy"
                    >
                      {copied ? <Check size={14} className="text-accent-500" /> : <Copy size={14} />}
                    </Button>
                    <Button variant="source"
                      onClick={() => downloadText(t)}
                      className="p-2 rounded-lg hover:bg-surface-hover text-text-dim hover:text-text transition-colors"
                      title="Download"
                    >
                      <Download size={14} />
                    </Button>
                    <Button variant="source"
                      onClick={() => deleteTranscription(t.id)}
                      className="p-2 rounded-lg hover:bg-surface-hover text-text-dim hover:text-study-rose-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    setRevisionTarget(t.text);
                    setRevisionTitle(t.title);
                    setRevisionPackage(null);
                    setRevisionError('');
                  }}>Use for revision</Button>
                </div>
                <div className="flex items-center gap-3 text-xs text-text-dim mb-2">
                  <span className="flex items-center gap-1"><Clock size={11} /> {formatDuration(t.duration)}</span>
                  <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-text-muted leading-relaxed line-clamp-3">{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
