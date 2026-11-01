import { Button } from '@/components/ui/button';
import { useState, type FormEvent } from 'react';
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
  Wifi, WifiOff,
} from 'lucide-react';

export default function Settings() {
  const { settings, updateSettings, setMode, setAccent } = useApp();
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

  const getAccountId = async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('[ANALYTICS] Could not retrieve the signed-in account:', error);
        return null;
      }
      return data.session?.user?.id ?? null;
    } catch (error) {
      console.warn('[ANALYTICS] Session lookup failed:', error);
      return null;
    }
  };

  const submitFeatureRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requestedFeature.trim()) return;
    const accountId = await getAccountId();
    trackEvent('feature_request_submitted', {
      account_id: accountId,
      student_segment: 'high_school_student',
      requested_feature_category: requestCategory,
    });
    setRequestedFeature('');
    setSubmissionNotice('Request metadata recorded in the local analytics console. The feature description is not transmitted or stored.');
  };

  const submitFeedback = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!feedbackText.trim()) return;
    const accountId = await getAccountId();
    trackEvent('feature_feedback_submitted', {
      account_id: accountId,
      student_segment: 'high_school_student',
      feature_name: feedbackFeature,
      feedback_type: feedbackType,
    });
    setFeedbackText('');
    setSubmissionNotice('Feedback metadata recorded in the local analytics console. Your written feedback is not transmitted or stored.');
  };

  const updatePomodoro = (key: keyof typeof settings.pomodoro, value: number | boolean) => {
    updateSettings({ pomodoro: { ...settings.pomodoro, [key]: value } });
  };

  const aiStatus = getConnectorStatus(settings.aiApiKey);
  const imageStatus = getConnectorStatus(settings.imageApiKey);

  return (
    <div className="space-y-6 max-w-3xl">
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

      {/* API Connectors */}
      <SettingsCard icon={Plug} title="API Connectors">
        <div className="space-y-5">
          {/* AI Connector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-text flex items-center gap-2">
                <Key size={15} className="text-accent-500" />
                OpenAI / OpenRouter API Key
              </label>
              <StatusBadge status={aiStatus} />
            </div>
            <div className="relative">
              <input
                type={showAiKey ? 'text' : 'password'}
                value={settings.aiApiKey}
                onChange={(e) => updateSettings({ aiApiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500 font-mono"
              />
              <Button variant="source"
                onClick={() => setShowAiKey(!showAiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-dim hover:text-text transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                {showAiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <label className="text-xs text-text-muted block mb-1">API Base URL</label>
                <input
                  value={settings.aiBaseUrl}
                  onChange={(e) => updateSettings({ aiBaseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="w-full px-3 py-2 rounded-lg bg-surface-hover border border-border text-text text-xs focus:outline-none focus:border-accent-500 font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted block mb-1">Model</label>
                <input
                  value={settings.aiModel}
                  onChange={(e) => updateSettings({ aiModel: e.target.value })}
                  placeholder="gpt-4o-mini"
                  className="w-full px-3 py-2 rounded-lg bg-surface-hover border border-border text-text text-xs focus:outline-none focus:border-accent-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Image Connector */}
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
            All keys are stored locally in your browser under localStorage and never sent to any server except the provider you configure.
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
            Privacy notice: this prototype logs only event metadata to the browser console. Written descriptions are not sent to a server or saved. Account IDs are included only when a Supabase session is available.
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

      <p className="text-xs text-text-dim text-center">Settings save automatically to your browser.</p>
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
