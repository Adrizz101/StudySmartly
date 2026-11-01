import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { Brain, Sparkles, Atom } from 'lucide-react';

type LoaderMode = 'standard' | 'game';
const PREFERENCE_KEY = 'studysmartly_loader_pref';
const STATUS_MESSAGES = [
  'Analyzing request...',
  'Consulting AI tutor...',
  'Preparing response...',
];
const ATOMS = ['∑', 'π', '√', '∫', '∞', 'Δ', 'λ', 'E=mc²', 'H₂O', 'Na⁺', 'x²', 'θ'];

type GameAtom = { id: string; symbol: string; top: number; left: number; isPopping: boolean };

function readPreference(): LoaderMode {
  if (typeof window === 'undefined') return 'standard';
  try {
    return window.localStorage.getItem(PREFERENCE_KEY) === 'game' ? 'game' : 'standard';
  } catch {
    return 'standard';
  }
}

function savePreference(mode: LoaderMode) {
  try {
    window.localStorage.setItem(PREFERENCE_KEY, mode);
  } catch {
    // The loading experience still works when browser storage is unavailable.
  }
}

export default function InteractiveLoader() {
  const [mode, setMode] = useState<LoaderMode>(readPreference);
  const [messageIndex, setMessageIndex] = useState(0);
  const [typedMessage, setTypedMessage] = useState(STATUS_MESSAGES[0]);
  const [brainPower, setBrainPower] = useState(0);
  const [atoms, setAtoms] = useState<GameAtom[]>(() =>
    ATOMS.map((symbol, index) => ({ id: `${symbol}-${index}`, symbol, top: 50, left: 50, isPopping: false })),
  );

  useEffect(() => {
    setAtoms((current) => current.map((atom) => ({
      ...atom,
      top: 14 + Math.random() * 68,
      left: 4 + Math.random() * 88,
    })));
  }, []);

  useEffect(() => {
    const message = STATUS_MESSAGES[messageIndex];
    let cursor = 0;
    setTypedMessage('');
    const typing = window.setInterval(() => {
      cursor += 1;
      setTypedMessage(message.slice(0, cursor));
      if (cursor >= message.length) window.clearInterval(typing);
    }, 38);
    const advance = window.setTimeout(() => {
      setMessageIndex((current) => (current + 1) % STATUS_MESSAGES.length);
    }, 2600);
    return () => {
      window.clearInterval(typing);
      window.clearTimeout(advance);
    };
  }, [messageIndex]);

  function changeMode(next: LoaderMode) {
    setMode(next);
    savePreference(next);
  }

  return (
    <section className="interactive-loader" role="status" aria-live="polite" aria-label="AI is working">
      <style>{`
        @keyframes loader-pulse { 0%,100% { transform:scale(1); opacity:.8 } 50% { transform:scale(1.12); opacity:1 } }
        @keyframes loader-orbit { from { transform:rotate(0deg) translateX(34px) rotate(0deg) } to { transform:rotate(360deg) translateX(34px) rotate(-360deg) } }
        @keyframes atom-rise { from { transform:translateY(115px) scale(.78); opacity:0 } 12% { opacity:1 } 88% { opacity:1 } to { transform:translateY(-260px) scale(1.08); opacity:0 } }
        .interactive-loader { width:100%; min-height:260px; display:flex; align-items:center; justify-content:center; padding:28px 16px; }
        .interactive-loader-card { position:relative; width:min(100%,520px); min-height:218px; display:flex; flex-direction:column; align-items:center; justify-content:center; overflow:hidden; border:1px solid hsl(var(--border)); border-radius:22px; padding:28px 20px 20px; background:linear-gradient(145deg,hsl(var(--card)),hsl(var(--background))); box-shadow:0 18px 55px rgba(0,0,0,.08); text-align:center; }
        .interactive-loader-icon { display:grid; place-items:center; width:68px; height:68px; margin-bottom:20px; border-radius:22px; color:hsl(var(--primary)); background:hsl(var(--primary)/.1); animation:loader-pulse 2s ease-in-out infinite; }
        .interactive-loader-orbit { position:absolute; top:38px; left:calc(50% - 5px); width:9px; height:9px; border-radius:50%; background:hsl(var(--primary)); animation:loader-orbit 3s linear infinite; }
        .interactive-loader-message { min-height:25px; font-size:15px; font-weight:600; letter-spacing:.01em; color:hsl(var(--foreground)); }
        .interactive-loader-cursor { display:inline-block; width:1px; height:1em; margin-left:2px; vertical-align:-2px; background:currentColor; animation:loader-pulse .8s steps(2) infinite; }
        .interactive-loader-subtle { margin-top:8px; color:hsl(var(--muted-foreground)); font-size:12px; }
        .interactive-loader-switch { margin-top:23px; border:1px solid hsl(var(--border)); border-radius:999px; padding:8px 13px; background:transparent; color:hsl(var(--muted-foreground)); font-size:12px; transition:background .2s,color .2s,border-color .2s; }
        .interactive-loader-switch:hover { background:hsl(var(--accent)); color:hsl(var(--foreground)); border-color:hsl(var(--primary)/.35); }
        .atom-game-area { position:relative; width:100%; height:190px; margin-top:8px; overflow:hidden; border-radius:16px; background:radial-gradient(ellipse at center,hsl(var(--primary)/.11),transparent 70%); }
        .atom-game-score { position:absolute; z-index:2; top:10px; left:12px; border:1px solid hsl(var(--border)); border-radius:999px; padding:6px 10px; background:hsl(var(--card)/.88); font-size:12px; font-weight:700; }
        .atom-game-pop { position:absolute; z-index:3; top:8px; right:10px; border:1px solid hsl(var(--border)); border-radius:999px; padding:6px 10px; background:hsl(var(--card)/.88); color:hsl(var(--muted-foreground)); font-size:11px; }
        .atom-bubble { position:absolute; display:grid; place-items:center; width:42px; height:42px; border:1px solid hsl(var(--primary)/.35); border-radius:50%; background:hsl(var(--card)/.92); color:hsl(var(--primary)); font-size:13px; font-weight:700; box-shadow:0 5px 18px hsl(var(--primary)/.12); cursor:pointer; animation:atom-rise var(--rise-duration) linear var(--rise-delay) infinite; }
        .atom-bubble.is-popping { animation:none; opacity:0; transform:scale(0); transition:transform 300ms ease,opacity 300ms ease; pointer-events:none; }
        .atom-bubble:focus-visible { outline:2px solid hsl(var(--ring)); outline-offset:3px; }
        @media (prefers-reduced-motion: reduce) { .interactive-loader-icon,.interactive-loader-orbit,.interactive-loader-cursor,.atom-bubble { animation:none; } }
      `}</style>
      <div className="interactive-loader-card">
        {mode === 'standard' ? (
          <>
            <div className="interactive-loader-icon">
              <Brain size={34} strokeWidth={1.7} />
              <Sparkles size={15} className="absolute -right-1 -top-1" />
              <span className="interactive-loader-orbit" />
            </div>
            <div className="interactive-loader-message">{typedMessage}<span className="interactive-loader-cursor" /></div>
            <p className="interactive-loader-subtle">Please wait while your learning response is prepared.</p>
            <button type="button" className="interactive-loader-switch" onClick={() => changeMode('game')}>
              Play a brain game while you wait 🎮
            </button>
          </>
        ) : (
          <>
            <div className="flex w-full items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold"><Atom size={18} /> Atom Popper</div>
              <button type="button" className="interactive-loader-switch !mt-0" onClick={() => changeMode('standard')}>
                Back to loading screen
              </button>
            </div>
            <div className="atom-game-area" aria-label="Pop the floating science and maths symbols">
              <div className="atom-game-score">⚡ Brain Power: {brainPower}</div>
              <div className="atom-game-pop">Tap atoms to pop</div>
              {atoms.map((atom, index) => (
                <button
                  type="button"
                  key={atom.id}
                  className={`atom-bubble${atom.isPopping ? ' is-popping' : ''}`}
                  aria-label={`Pop ${atom.symbol}`}
                  disabled={atom.isPopping}
                  onClick={() => {
                    if (atom.isPopping) return;
                    setBrainPower((score) => score + 1);
                    setAtoms((current) => current.map((item) =>
                      item.id === atom.id ? { ...item, isPopping: true } : item,
                    ));
                    window.setTimeout(() => {
                      setAtoms((current) => current.filter((item) => item.id !== atom.id));
                    }, 300);
                  }}
                  style={{
                    top: `${atom.top}%`,
                    left: `${atom.left}%`,
                    animationDelay: `${(index % 6) * -0.65}s`,
                    animationDuration: `${5.5 + (index % 4) * 0.8}s`,
                    ['--rise-duration' as string]: `${5.5 + (index % 4) * 0.8}s`,
                    ['--rise-delay' as string]: `${(index % 6) * -0.65}s`,
                  } as CSSProperties}
                >
                  {atom.symbol}
                </button>
              ))}
            </div>
            <p className="interactive-loader-subtle">Pop as many floating atoms as you can. Your score resets when this wait ends.</p>
          </>
        )}
      </div>
    </section>
  );
}
