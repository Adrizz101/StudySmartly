import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Button } from '@/components/ui/button';
import { getUserAIKeyStatus, saveUserAIKeys } from '@/lib/user-ai-keys.functions';
import { KeyRound, ShieldCheck, ExternalLink, Eye, EyeOff, ChevronDown } from 'lucide-react';

type KeyStatus = { gemini: boolean; openrouter: boolean };

export default function BYOKSettings() {
  const loadStatus = useServerFn(getUserAIKeyStatus);
  const saveKeys = useServerFn(saveUserAIKeys);
  const [status, setStatus] = useState<KeyStatus>({ gemini: false, openrouter: false });
  const [geminiKey, setGeminiKey] = useState('');
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [showGemini, setShowGemini] = useState(false);
  const [showOpenRouter, setShowOpenRouter] = useState(false);
  const [removeGemini, setRemoveGemini] = useState(false);
  const [removeOpenRouter, setRemoveOpenRouter] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    loadStatus().then((result) => {
      if (!active) return;
      if (result.success === false) setNotice({ type: 'error', text: result.error });
      else setStatus(result.data);
    }).catch(() => {
      if (active) setNotice({ type: 'error', text: 'Could not load your saved key status. Please refresh and try again.' });
    });
    return () => { active = false; };
  }, [loadStatus]);

  async function save() {
    setBusy(true);
    setNotice(null);
    try {
      const saved = await saveKeys({ data: {
        geminiKey,
        openRouterKey,
        removeGemini,
        removeOpenRouter,
      } });
      if (saved.success === false) { setNotice({ type: 'error', text: saved.error }); return; }
      const next = await loadStatus();
      if (next.success === false) { setNotice({ type: 'error', text: next.error }); return; }
      setStatus(next.data);
      setGeminiKey('');
      setOpenRouterKey('');
      setRemoveGemini(false);
      setRemoveOpenRouter(false);
      setNotice({ type: 'success', text: 'Your AI key settings have been updated securely.' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Could not save your API keys.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass surface-elevated relative overflow-hidden rounded-2xl border border-accent-500/25 p-5 shadow-xl shadow-black/10">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent-500/10 blur-3xl" />
      <div className="relative space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/15 text-accent-500"><KeyRound size={19} /></div>
            <div>
              <h3 className="font-semibold text-text">Bring Your Own Key (Unlimited AI)</h3>
              <p className="mt-0.5 text-xs text-text-muted">Use your own provider quota instead of the shared daily allowance.</p>
            </div>
          </div>
          <ShieldCheck size={19} className="shrink-0 text-study-emerald-500" />
        </div>

        <div className="rounded-xl border border-border bg-surface-hover/60 p-3 text-sm leading-6 text-text-muted">
          Shared system keys allow up to <strong className="text-text">15 AI requests per day</strong> per account. Saving your own Gemini or OpenRouter key bypasses that shared limit. Your key is encrypted on the server and is never sent back to your browser after saving.
        </div>

        <div className="space-y-3">
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label htmlFor="byok-gemini" className="text-sm font-medium text-text">Gemini API Key</label>
              <span className="text-xs text-study-emerald-500">{status.gemini ? 'Saved securely' : 'Not connected'}</span>
            </div>
            <div className="relative">
              <input id="byok-gemini" type={showGemini ? 'text' : 'password'} autoComplete="off" value={geminiKey} onChange={(event) => setGeminiKey(event.target.value)} placeholder={status.gemini ? 'Enter a new key to replace the saved key' : 'Paste your Gemini API key'} className="w-full rounded-xl border border-border bg-surface-hover px-3.5 py-3 pr-12 font-mono text-sm text-text focus:border-accent-500 focus:outline-none" />
              <button type="button" onClick={() => setShowGemini((value) => !value)} aria-label={showGemini ? 'Hide Gemini key' : 'Show Gemini key'} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover">{showGemini ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
            {status.gemini && <label className="mt-2 flex items-center gap-2 text-xs text-text-muted"><input type="checkbox" checked={removeGemini} onChange={(event) => setRemoveGemini(event.target.checked)} /> Remove saved Gemini key</label>}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label htmlFor="byok-openrouter" className="text-sm font-medium text-text">OpenRouter API Key</label>
              <span className="text-xs text-study-emerald-500">{status.openrouter ? 'Saved securely' : 'Not connected'}</span>
            </div>
            <div className="relative">
              <input id="byok-openrouter" type={showOpenRouter ? 'text' : 'password'} autoComplete="off" value={openRouterKey} onChange={(event) => setOpenRouterKey(event.target.value)} placeholder={status.openrouter ? 'Enter a new key to replace the saved key' : 'Paste your OpenRouter API key'} className="w-full rounded-xl border border-border bg-surface-hover px-3.5 py-3 pr-12 font-mono text-sm text-text focus:border-accent-500 focus:outline-none" />
              <button type="button" onClick={() => setShowOpenRouter((value) => !value)} aria-label={showOpenRouter ? 'Hide OpenRouter key' : 'Show OpenRouter key'} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover">{showOpenRouter ? <EyeOff size={16} /> : <Eye size={16} />}</button>
            </div>
            {status.openrouter && <label className="mt-2 flex items-center gap-2 text-xs text-text-muted"><input type="checkbox" checked={removeOpenRouter} onChange={(event) => setRemoveOpenRouter(event.target.checked)} /> Remove saved OpenRouter key</label>}
          </div>
        </div>

        <Button type="button" disabled={busy || (!geminiKey.trim() && !openRouterKey.trim() && !removeGemini && !removeOpenRouter)} onClick={save} className="w-full sm:w-auto">
          {busy ? 'Saving securely…' : 'Save API key settings'}
        </Button>
        {notice && <p role={notice.type === 'error' ? 'alert' : 'status'} className={`text-sm ${notice.type === 'error' ? 'text-study-rose-500' : 'text-study-emerald-500'}`}>{notice.text}</p>}

        <details className="group rounded-xl border border-border bg-surface-hover/40 p-3">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-text">
            How to get your free API keys
            <ChevronDown size={16} className="shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 space-y-4 border-t border-border pt-3 text-sm leading-6 text-text-muted">
            <div>
              <p className="font-semibold text-text">Google Gemini (Google AI Studio)</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                <li>Open <a className="text-accent-500 underline" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">Google AI Studio API keys <ExternalLink size={11} className="inline" /></a> and sign in with your Google account.</li>
                <li>Select “Create API key”, choose a Google Cloud project if prompted, and copy the generated key.</li>
                <li>Paste it into the Gemini field above and save. Check Google's current free-tier availability and usage terms for your account.</li>
              </ol>
            </div>
            <div>
              <p className="font-semibold text-text">OpenRouter</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                <li>Open <a className="text-accent-500 underline" href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">OpenRouter API keys <ExternalLink size={11} className="inline" /></a> and create an account.</li>
                <li>Create a key from the Keys page and copy it once.</li>
                <li>Paste it into the OpenRouter field above and save. Choose models marked free in OpenRouter; model availability and free limits can change.</li>
              </ol>
            </div>
            <p className="text-xs">Never share your API keys or paste them into chats, source code, or public repositories. Provider free tiers have their own quotas and policies; “unlimited” here means StudySmartly does not apply its shared 15-request cap when your key is active.</p>
          </div>
        </details>
      </div>
    </section>
  );
}
