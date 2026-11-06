import { Button } from '@/components/ui/button';
import BYOKSettings from './BYOKSettings';
import { useState, type FormEvent, type ChangeEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent } from '@/lib/analytics';
import { useApp } from '@/store';
import { AccentKey, ACCENTS, Mode } from '@/types';
import { requestNotificationPermission } from '@/lib/audio';
import { getConnectorStatus } from '@/lib/connectors';
import {
  Sun, Moon, Palette, Clock, Key, Shield, User, Check,
  Bell, Volume2, Brain, Coffee, RotateCcw, Eye, EyeOff,
  AlertCircle, Scale, FileText, Image as ImageIcon, Plug,
  Wifi, WifiOff, Github, Cpu, PenTool, Server, CalendarClock, AudioLines, Gauge, Layers, Sparkles,
} from 'lucide-react';

const NEURAL_VOICE_REFERENCE_KEY = 'studysmartly_neural_voice_reference';

export default function Settings() {
  const { settings, updateSettings, setMode, setAccent } = useApp();
  const reduceMotion = useReducedMotion();
  const [showAiKey, setShowAiKey] = useState(false);
  const [showImageKey, setShowImageKey] = useState(false);
  const [requestedFeature, setRequestedFeature] = useState('');
  const [requestCategory, setRequestCategory] = useState('Study Tools');
  const [feedbackFeature, setFeedbackFeature] = useState('AI Whiteboard');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackType, setFeedbackType] = useState('Suggestion');
  const [submissionNotice, setSubmissionNotice] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [voiceCloneSaved, setVoiceCloneSaved] = useState(() => {
    try {
      return typeof window !== 'undefined' && Boolean(window.localStorage.getItem(NEURAL_VOICE_REFERENCE_KEY));
    } catch {
      return false;
    }
  });
  const [voiceCloneConfirmed, setVoiceCloneConfirmed] = useState(false);
  const [voiceCloneNotice, setVoiceCloneNotice] = useState('');

  const handleVoiceReferenceUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!voiceCloneConfirmed) {
      setVoiceCloneNotice('Confirm that this is your own voice before saving a reference clip.');
      return;
    }
    if (!file.type.startsWith('audio/')) {
      setVoiceCloneNotice('Choose a supported audio file.');
      return;
    }
    if (file.size > 2.5 * 1024 * 1024) {
      setVoiceCloneNotice('The audio file must be 2.5 MB or smaller.');
      return;
    }

    let audioContext: AudioContext | null = null;
    try {
      audioContext = new AudioContext();
      const decoded = await audioContext.decodeAudioData(await file.arrayBuffer());
      if (decoded.duration < 1 || decoded.duration > 10) {
        setVoiceCloneNotice('Use a clear audio clip between 1 and 10 seconds.');
        return;
      }
    } catch {
      setVoiceCloneNotice('This audio file could not be decoded. Try another audio format.');
      return;
    } finally {
      await audioContext?.close().catch(() => undefined);
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (typeof reader.result !== 'string') throw new Error('Invalid audio data');
        window.localStorage.setItem(NEURAL_VOICE_REFERENCE_KEY, reader.result);
        setVoiceCloneSaved(true);
        setVoiceCloneNotice('Voice reference saved in this browser only. It is not uploaded to StudySmartly.');
      } catch {
        setVoiceCloneNotice('The clip could not be saved. Browser storage may be full.');
      }
    };
    reader.onerror = () => setVoiceCloneNotice('Could not read the selected audio file.');
    reader.readAsDataURL(file);
  };

  const removeVoiceReference = () => {
    try {
      window.localStorage.removeItem(NEURAL_VOICE_REFERENCE_KEY);
      setVoiceCloneSaved(false);
      setVoiceCloneNotice('Saved voice reference removed from this browser.');
    } catch {
      setVoiceCloneNotice('Could not remove the saved voice reference.');
    }
  };

  const updateAccountPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordNotice(null);

    if (newPassword.length < 8) {
      setPasswordNotice({ type: 'error', message: 'Password must be at least 8 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordNotice({ type: 'error', message: 'The passwords do not match.' });
      return;
    }

    setPasswordBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      setPasswordNotice({ type: 'success', message: 'Password updated successfully!' });
    } catch (error) {
      setPasswordNotice({
        type: 'error',
        message: error instanceof Error ? error.message : 'Could not update your password. Please try again.',
      });
    } finally {
      setPasswordBusy(false);
    }
  };

  const submitFeatureRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requestedFeature.trim()) return;
    trackEvent('feature_request_submitted', {
      requested_feature_category: requestCategory,
    });
    setRequestedFeature('');
    setSubmissionNotice('Feature request metadata submitted. Your written description is not collected by analytics.');
  };

  const submitFeedback = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!feedbackText.trim()) return;
    trackEvent('feature_feedback_submitted', {
      feature_name: feedbackFeature,
      feedback_type: feedbackType,
    });
    setFeedbackText('');
    setSubmissionNotice('Feedback metadata submitted. Your written feedback is not collected by analytics.');
  };

  const updatePomodoro = (key: keyof typeof settings.pomodoro, value: number | boolean) => {
    updateSettings({ pomodoro: { ...settings.pomodoro, [key]: value } });
  };

  const aiStatus = getConnectorStatus(settings.aiApiKey);
  const imageStatus = getConnectorStatus(settings.imageApiKey);

  return (
    <div className="space-y-6 max-w-3xl">
      <SettingsCard icon={Sparkles} title="StudySmartly Academy">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm leading-6 text-text-muted">
            Explore the dashboard, study tools, exam practice, and AI key settings in an interactive guided tour.
          </p>
          <Button type="button" onClick={() => window.dispatchEvent(new Event('studysmartly:open-academy'))} className="min-h-11 shrink-0">
            <Sparkles size={16} className="mr-2" /> Open StudySmartly Academy
          </Button>
        </div>
      </SettingsCard>

      {/* Profile */}
      <SettingsCard icon={User} title="Profile">
        <div>
          <label className="text-sm text-text-muted block mb-1.5">Display Name</label>
          <input
            value={settings.userName}
            onChange={(e) => updateSettings({ userName: e.target.value })}
            placeholder="Your name"
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500 transition-colors"
          />
        </div>
      </SettingsCard>

      {/* Account Security */}
      <SettingsCard icon={Shield} title="Account Security">
        <form onSubmit={updateAccountPassword} className="space-y-3">
          <div>
            <label htmlFor="new-account-password" className="text-sm text-text-muted block mb-1.5">New Password</label>
            <input
              id="new-account-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="At least 8 characters"
              disabled={passwordBusy}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="confirm-account-password" className="text-sm text-text-muted block mb-1.5">Confirm Password</label>
            <input
              id="confirm-account-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter your new password"
              disabled={passwordBusy}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500 transition-colors"
            />
          </div>
          <Button type="submit" disabled={passwordBusy || !newPassword || !confirmPassword}>
            {passwordBusy ? 'Updating…' : 'Update Password'}
          </Button>
          {passwordNotice && (
            <p role={passwordNotice.type === 'error' ? 'alert' : 'status'}
              className={`text-sm ${passwordNotice.type === 'success' ? 'text-study-emerald-500' : 'text-study-rose-500'}`}>
              {passwordNotice.message}
            </p>
          )}
          <p className="text-xs text-text-dim">
            Set a password after signing in with your email code. You can then use either sign-in method.
          </p>
        </form>
      </SettingsCard>

      {/* Appearance */}
      <SettingsCard icon={Palette} title="Appearance">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-text-muted block mb-2">Theme Mode</label>
            <div className="flex gap-3">
              {(['dark', 'light'] as Mode[]).map((m) => {
                const Icon = m === 'dark' ? Moon : Sun;
                return (
                  <Button variant="source"
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                      settings.mode === m
                        ? 'bg-accent-600 text-study-white shadow-md'
                        : 'glass hover:bg-surface-hover text-text-muted'
                    }`}
                  >
                    <Icon size={16} /> {m === 'dark' ? 'Dark' : 'Light'}
                  </Button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-sm text-text-muted block mb-2">Accent Color</label>
            <div className="flex gap-3 flex-wrap">
              {(Object.keys(ACCENTS) as AccentKey[]).map((key) => {
                const accent = ACCENTS[key];
                return (
                  <Button variant="source"
                    key={key}
                    onClick={() => setAccent(key)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border-2 min-h-[44px] ${
                      settings.accent === key
                        ? 'border-accent-500 bg-accent-50/10 text-accent-500'
                        : 'border-border hover:bg-surface-hover text-text-muted'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full" style={{ backgroundColor: accent.hex }} />
                    {accent.name}
                    {settings.accent === key && <Check size={14} />}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* Pomodoro */}
      <SettingsCard icon={Clock} title="Pomodoro Timer">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-text-muted block mb-1.5 flex items-center gap-1.5">
                <Brain size={14} /> Focus (min)
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={settings.pomodoro.focus}
                onChange={(e) => updatePomodoro('focus', Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500"
              />
            </div>
            <div>
              <label className="text-sm text-text-muted block mb-1.5 flex items-center gap-1.5">
                <Coffee size={14} /> Short Break
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.pomodoro.shortBreak}
                onChange={(e) => updatePomodoro('shortBreak', Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500"
              />
            </div>
            <div>
              <label className="text-sm text-text-muted block mb-1.5 flex items-center gap-1.5">
                <Coffee size={14} /> Long Break
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.pomodoro.longBreak}
                onChange={(e) => updatePomodoro('longBreak', Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500"
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-text-muted block mb-1.5">Long Break Interval (cycles)</label>
            <input
              type="number"
              min="2"
              max="10"
              value={settings.pomodoro.longBreakInterval}
              onChange={(e) => updatePomodoro('longBreakInterval', Math.max(2, Number(e.target.value)))}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500"
            />
          </div>
          <div className="space-y-3">
            <ToggleRow icon={RotateCcw} label="Auto-start next phase" checked={settings.pomodoro.autoStart} onChange={(v) => updatePomodoro('autoStart', v)} />
            <ToggleRow icon={Volume2} label="Sound chime on completion" checked={settings.pomodoro.sound} onChange={(v) => updatePomodoro('sound', v)} />
            <ToggleRow
              icon={Bell}
              label="Browser notifications"
              checked={settings.pomodoro.notifications}
              onChange={(v) => { updatePomodoro('notifications', v); if (v) requestNotificationPermission(); }}
            />
          </div>
        </div>
      </SettingsCard>

      <BYOKSettings />

      <SettingsCard icon={Plug} title="Legacy OpenAI-Compatible Connector">
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm font-medium text-text"><Key size={15} className="text-accent-500" /> OpenAI-Compatible API Key</label>
              <StatusBadge status={aiStatus} />
            </div>
            <div className="relative">
              <input
                type={showAiKey ? 'text' : 'password'}
                value={settings.aiApiKey}
                onChange={(event) => updateSettings({ aiApiKey: event.target.value })}
                placeholder="Optional legacy connector key"
                autoComplete="off"
                className="w-full rounded-xl border border-border bg-surface-hover px-3.5 py-2.5 pr-10 font-mono text-sm text-text focus:border-accent-500 focus:outline-none"
              />
              <Button variant="source" onClick={() => setShowAiKey(!showAiKey)} className="absolute right-3 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center text-text-dim">
                {showAiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-text-muted">API Base URL</label>
                <input value={settings.aiBaseUrl} onChange={(event) => updateSettings({ aiBaseUrl: event.target.value })} placeholder="https://api.openai.com/v1" className="w-full rounded-lg border border-border bg-surface-hover px-3 py-2 font-mono text-xs text-text focus:border-accent-500 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-text-muted">Model</label>
                <input value={settings.aiModel} onChange={(event) => updateSettings({ aiModel: event.target.value })} placeholder="gpt-4o-mini" className="w-full rounded-lg border border-border bg-surface-hover px-3 py-2 font-mono text-xs text-text focus:border-accent-500 focus:outline-none" />
              </div>
            </div>
            <p className="mt-2 text-xs leading-5 text-text-dim">This legacy connector is stored in this browser and is separate from the encrypted Gemini/OpenRouter BYOK keys used by server AI features.</p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard icon={ImageIcon} title="Image Connector">
        <div className="space-y-5">
          {/* Image provider key remains an optional local browser setting. */}
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-text flex items-center gap-2">
                <ImageIcon size={15} className="text-accent-500" />
                Unsplash / Pexels API Key
              </label>
              <StatusBadge status={imageStatus} />
            </div>
            <div className="relative">
              <input
                type={showImageKey ? 'text' : 'password'}
                value={settings.imageApiKey}
                onChange={(e) => updateSettings({ imageApiKey: e.target.value })}
                placeholder="Optional — for high-res images in slides"
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500 font-mono"
              />
              <Button variant="source"
                onClick={() => setShowImageKey(!showImageKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-dim hover:text-text transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                {showImageKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>
            </div>
            <p className="text-xs text-text-dim mt-1.5">
              Without a key, slides use free public images from Picsum CDN automatically.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-text-dim pt-2 border-t border-border">
            <Shield size={13} />
            The optional image-provider key is stored in this browser. AI tutor keys are encrypted server-side in your account.
          </div>
        </div>
      </SettingsCard>

      {/* Feedback and feature requests */}
      <SettingsCard icon={FileText} title="Feedback & Feature Requests">
        <div className="space-y-6">
          <form onSubmit={submitFeatureRequest} className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-text">Request a Feature</h4>
              <p className="text-xs text-text-dim mt-1">Suggest a feature you would like to see.</p>
            </div>
            <Input
              value={requestedFeature}
              onChange={(event) => setRequestedFeature(event.target.value)}
              placeholder="Feature name"
              maxLength={100}
              required
              aria-label="Requested feature name"
            />
            <Select value={requestCategory} onValueChange={setRequestCategory}>
              <SelectTrigger aria-label="Feature request category"><SelectValue placeholder="Choose a category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UI">UI</SelectItem>
                <SelectItem value="AI">AI</SelectItem>
                <SelectItem value="Study Tools">Study Tools</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit">Submit Feature Request</Button>
          </form>

          <div className="border-t border-border" />

          <form onSubmit={submitFeedback} className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-text">Submit Feedback</h4>
              <p className="text-xs text-text-dim mt-1">Choose the area and type of feedback.</p>
            </div>
            <Select value={feedbackFeature} onValueChange={setFeedbackFeature}>
              <SelectTrigger aria-label="Feedback feature"><SelectValue placeholder="Choose a feature" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AI Whiteboard">AI Whiteboard</SelectItem>
                <SelectItem value="Presentation Studio">Presentation Studio</SelectItem>
                <SelectItem value="PYQ Exam Arena">PYQ Exam Arena</SelectItem>
                <SelectItem value="Smart Schedule">Smart Schedule</SelectItem>
                <SelectItem value="Lecture Transcriber">Lecture Transcriber</SelectItem>
                <SelectItem value="Dashboard">Dashboard</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={feedbackText}
              onChange={(event) => setFeedbackText(event.target.value)}
              placeholder="Describe your feedback"
              maxLength={1000}
              required
              aria-label="Feedback text"
            />
            <Select value={feedbackType} onValueChange={setFeedbackType}>
              <SelectTrigger aria-label="Feedback type"><SelectValue placeholder="Choose feedback type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Bug">Bug</SelectItem>
                <SelectItem value="Suggestion">Suggestion</SelectItem>
                <SelectItem value="Compliment">Compliment</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit">Submit Feedback</Button>
          </form>

          {submissionNotice && <p role="status" className="text-xs text-text-muted">{submissionNotice}</p>}
          <p className="text-xs text-text-dim leading-relaxed">
            Analytics records only event metadata for signed-in accounts. Written feedback and feature descriptions are not included in analytics.
          </p>
        </div>
      </SettingsCard>

      {/* Built-in Connectors Info */}
      <SettingsCard icon={Wifi} title="Built-in Free Connectors">
        <div className="space-y-2">
          {[
            { name: 'Web Speech API', desc: 'Browser-native microphone transcription', active: true },
            { name: 'Web Audio API', desc: 'Synthesizer timer chimes & waveform visualization', active: true },
            { name: 'Picsum CDN', desc: 'Free public images for slide graphics', active: true },
            { name: 'html2canvas + jsPDF', desc: 'Client-side PDF & slide export', active: true },
          ].map((c) => (
            <div key={c.name} className="flex items-center justify-between p-3 rounded-xl bg-surface-hover/50">
              <div>
                <div className="text-sm font-medium text-text">{c.name}</div>
                <div className="text-xs text-text-dim mt-0.5">{c.desc}</div>
              </div>
              <span className="flex items-center gap-1.5 text-xs font-medium text-study-emerald-500 shrink-0">
                <Wifi size={14} /> Active
              </span>
            </div>
          ))}
        </div>
      </SettingsCard>

      {/* Legal */}
      <SettingsCard icon={Scale} title="Legal & Disclaimers">
        <div className="space-y-3 text-sm text-text-muted leading-relaxed">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-study-amber-500 shrink-0 mt-0.5" />
            <p>
              <strong className="text-text">Study Companion Only.</strong> StudySmart is a study companion and Socratic guide, not an authoritative source. AI-generated content may contain errors or "hallucinations." Always verify with your instructor or textbook.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <FileText size={16} className="text-accent-500 shrink-0 mt-0.5" />
            <p>
              <strong className="text-text">Academic Integrity.</strong> Use StudySmart to guide your understanding, not to replace your own work. Submitting AI-generated content as your own may violate your institution's policy.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Shield size={16} className="text-study-blue-500 shrink-0 mt-0.5" />
            <p>
              <strong className="text-text">Limitation of Liability.</strong> StudySmart is provided "as is" without warranties. Not liable for damages arising from use, including incorrect AI responses or data loss.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Scale size={16} className="text-study-purple-500 shrink-0 mt-0.5" />
            <p>
              <strong className="text-text">Safe Harbor & Indemnification.</strong> Users are solely responsible for content they generate. By using StudySmart, you agree to indemnify the platform against claims from your use of AI-generated content.
            </p>
          </div>
        </div>
      </SettingsCard>

      {/* About StudySmartly */}
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-lg sm:p-7">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="relative space-y-7">
          <div className="flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">The people and engineering behind the platform</p>
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Architected &amp; Engineered by Adrizz101</h2>
              <p className="mt-2 text-sm text-slate-400">Student Systems Architect &amp; Full-Stack Developer</p>
            </div>
            <a
              href="https://github.com/Adrizz101"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-300 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-950/20 transition-all hover:-translate-y-0.5 hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <Github size={18} /> Explore GitHub
            </a>
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950/45 p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              <Cpu size={15} /> Engineering vision
            </div>
            <p className="max-w-4xl text-sm leading-7 text-slate-300 sm:text-base">
              StudySmartly is a testament to zero-cost, high-availability software engineering. It was designed to prove that enterprise-grade AI educational tools can be built entirely on free-tier infrastructure without sacrificing performance, security, or user experience.
            </p>
          </div>

          <section className="rounded-2xl border border-emerald-300/20 bg-slate-950/55 p-5 sm:p-6 shadow-xl shadow-black/10">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">
                <AudioLines size={21} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-white">Neural Voice Engine (Beta)</h3>
                  <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">Beta</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Pocket TTS runs locally in your browser. The first model download needs an internet connection; downloaded model assets are cached for later offline use. If the model fails to load, StudySmartly falls back to your browser's speech engine.
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  Voice reference clips are stored as browser-local data and are not uploaded to StudySmartly. Only use a recording of your own voice; do not upload someone else's voice.
                </p>
                <label className="mt-4 flex items-start gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={voiceCloneConfirmed} onChange={(event) => setVoiceCloneConfirmed(event.target.checked)} className="mt-1 accent-emerald-400" />
                  <span>I confirm the reference clip is my own voice.</span>
                </label>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-300/15">
                    <AudioLines size={16} />
                    {voiceCloneSaved ? 'Replace voice clip' : 'Upload voice clip'}
                    <input type="file" accept="audio/*" onChange={(event) => void handleVoiceReferenceUpload(event)} disabled={!voiceCloneConfirmed} className="sr-only" />
                  </label>
                  {voiceCloneSaved && <Button type="button" variant="outline" onClick={removeVoiceReference}>Remove saved voice</Button>}
                  <span className="text-xs text-slate-500">1–10 seconds · up to 2.5 MB</span>
                </div>
                {voiceCloneNotice && <p role="status" className="mt-3 text-xs text-emerald-200">{voiceCloneNotice}</p>}
                {voiceCloneSaved && <p className="mt-2 text-xs text-slate-400">A local voice reference is saved in this browser.</p>}
              </div>
            </div>
          </section>

          <div>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Under the hood</p>
                <h3 className="mt-1 text-xl font-bold text-white">Technical Architecture</h3>
              </div>
              <span className="text-xs text-slate-500">System design / implementation notes</span>
            </div>
            <motion.div
              className="grid grid-cols-1 gap-3 md:grid-cols-2"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.07 } },
              }}
            >
              {[
                {
                  icon: Cpu,
                  title: 'Fault-Tolerant AI Routing',
                  body: 'Uses a provider waterfall (Google Gemini → OpenRouter) through the Vercel AI SDK, with Groq intentionally disabled until paid usage is approved. Structured responses are constrained by Zod schemas, and provider attempts use the SDK retry setting before failing over to the next configured provider.',
                  tag: 'Provider failover · Structured output',
                },
                {
                  icon: PenTool,
                  title: 'Imperative Canvas Rendering',
                  body: 'Integrates Excalidraw through its imperative API. AI-generated element data is converted, sanitized, and applied with updateScene(), while canvas persistence is kept separate from React state updates to avoid render feedback loops during scene changes.',
                  tag: 'Excalidraw API · Scene sanitization',
                },
                {
                  icon: Server,
                  title: 'Serverless Application Architecture',
                  body: 'Built with TanStack Start and deployed on Vercel, with Supabase PostgreSQL for persistent user data. Authenticated data access is protected by Row-Level Security policies, while server functions isolate AI-provider credentials from the browser.',
                  tag: 'SSR routing · PostgreSQL · RLS',
                },
                {
                  icon: CalendarClock,
                  title: 'Algorithmic Spaced Repetition',
                  body: 'A deterministic planner turns structured learning topics, mastery levels, priorities, availability preferences, and existing calendar events into scheduled revision sessions. Completion updates topic mastery and schedules a follow-up review three days later.',
                  tag: 'Scheduling · Mastery tracking',
                },
                {
                  icon: AudioLines,
                  title: 'Neural Voice Engine (Beta)',
                  body: 'Runs Pocket TTS locally in the browser using ONNX Runtime Web and WebAssembly. Model assets are cached after the first download; browser speech synthesis remains the fallback when local inference cannot start.',
                  tag: 'Pocket TTS · Local inference · Native fallback',
                },
                {
                  icon: Gauge,
                  title: 'High-FPS UI System',
                  body: 'Combines React 19, Tailwind CSS, and Framer Motion for responsive interface transitions and interactive states. Motion-sensitive experiences respect prefers-reduced-motion, while optimistic updates keep key study workflows responsive.',
                  tag: 'React 19 · Motion · Accessibility',
                },
              ].map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.article
                    key={item.title}
                    variants={{
                      hidden: { opacity: 0, y: reduceMotion ? 0 : 14 },
                      visible: { opacity: 1, y: 0, transition: { duration: reduceMotion ? 0 : 0.32 } },
                    }}
                    whileHover={reduceMotion ? undefined : { scale: 1.02 }}
                    className="group rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-lg transition-colors hover:border-emerald-300/25 hover:bg-white/[0.07] sm:p-5"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-300/15 bg-emerald-300/10 text-emerald-300">
                        <Icon size={19} />
                      </div>
                      <span className="font-mono text-[10px] text-slate-600">{String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <h4 className="text-base font-semibold text-white">{item.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item.body}</p>
                    <p className="mt-4 border-t border-white/10 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300/80">{item.tag}</p>
                  </motion.article>
                );
              })}
            </motion.div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <Layers size={16} className="text-emerald-300" />
              <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-white">Core Technology Stack</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {['React 19', 'TanStack Start', 'TypeScript', 'Tailwind CSS', 'Framer Motion', 'Supabase', 'Vercel', 'Vercel AI SDK', 'Excalidraw', 'Zod', 'Node.js'].map((tech) => (
                <span key={tech} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 shadow-sm shadow-black/10">
                  {tech}
                </span>
              ))}
            </div>
          </div>
          <p className="border-t border-white/10 pt-4 text-center text-[11px] text-slate-500">
            Designed and built with a focus on accessible learning workflows, transparent system behavior, and maintainable engineering.
          </p>
        </div>
      </section>

      <p className="text-xs text-text-dim text-center">Preferences save automatically in this browser. Gemini and OpenRouter BYOK credentials are encrypted and saved to your account.</p>
    </div>
  );
}

function SettingsCard({ icon: Icon, title, children }: { icon: typeof Sun; title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-5 surface-elevated">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-accent-600/15 flex items-center justify-center">
          <Icon size={18} className="text-accent-500" />
        </div>
        <h3 className="font-semibold text-text">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: 'connected' | 'fallback' }) {
  if (status === 'connected') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-study-emerald-500/15 text-study-emerald-500 whitespace-nowrap">
        <Wifi size={12} /> Connected
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-study-amber-500/15 text-study-amber-500 whitespace-nowrap">
      <WifiOff size={12} /> Fallback Active
    </span>
  );
}

function ToggleRow({ icon: Icon, label, checked, onChange }: {
  icon: typeof Sun;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-surface-hover/50">
      <div className="flex items-center gap-2.5">
        <Icon size={16} className="text-text-muted" />
        <span className="text-sm text-text">{label}</span>
      </div>
      <Button variant="source"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
          checked ? 'bg-accent-600' : 'bg-border-light'
        }`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-study-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </Button>
    </div>
  );
}
