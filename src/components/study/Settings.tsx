import { Button } from '@/components/ui/button';
import { useState } from 'react';
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
