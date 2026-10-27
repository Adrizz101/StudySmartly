import { Button } from '@/components/ui/button';
import { useState, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Coffee, Brain } from 'lucide-react';
import { usePomodoro } from '@/lib/usePomodoro';

export function PomodoroTimer() {
  const pomo = usePomodoro();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => setOpen((o) => !o), []);

  const phaseColor = pomo.phase === 'focus' ? 'text-accent-500' : 'text-study-amber-500';
  const phaseIcon = pomo.phase === 'focus' ? <Brain size={14} /> : <Coffee size={14} />;

  return (
    <div className="relative" ref={ref}>
      <Button variant="source"
        onClick={toggle}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-hover hover:bg-surface-active transition-colors text-sm font-medium text-text"
      >
        {phaseIcon}
        <span className={phaseColor}>
          {String(pomo.minutes).padStart(2, '0')}:{String(pomo.seconds).padStart(2, '0')}
        </span>
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-2 w-72 glass rounded-2xl shadow-2xl p-5 z-40 animate-scaleIn">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text">Focus Timer</h3>
              <span className="text-xs text-text-dim">{pomo.completedCycles} cycles done</span>
            </div>

            <div className="relative w-40 h-40 mx-auto mb-4">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="var(--border)" strokeWidth="4" />
                <circle
                  cx="50" cy="50" r="45" fill="none"
                  stroke="var(--accent)" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 45}`}
                  strokeDashoffset={`${2 * Math.PI * 45 * (1 - pomo.progress / 100)}`}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-text tabular-nums">
                  {String(pomo.minutes).padStart(2, '0')}:{String(pomo.seconds).padStart(2, '0')}
                </span>
                <span className={`text-xs mt-1 capitalize flex items-center gap-1 ${phaseColor}`}>
                  {phaseIcon} {pomo.phase === 'shortBreak' ? 'Short Break' : pomo.phase === 'longBreak' ? 'Long Break' : 'Focus'}
                </span>
              </div>
            </div>

            <div className="flex justify-center gap-2 mb-3">
              <Button variant="source"
                onClick={() => pomo.switchPhase('focus')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  pomo.phase === 'focus' ? 'bg-accent-600 text-study-white' : 'bg-surface-hover text-text-muted hover:text-text'
                }`}
              >Focus</Button>
              <Button variant="source"
                onClick={() => pomo.switchPhase('shortBreak')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  pomo.phase === 'shortBreak' ? 'bg-study-amber-600 text-study-white' : 'bg-surface-hover text-text-muted hover:text-text'
                }`}
              >Short Break</Button>
              <Button variant="source"
                onClick={() => pomo.switchPhase('longBreak')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  pomo.phase === 'longBreak' ? 'bg-study-amber-600 text-study-white' : 'bg-surface-hover text-text-muted hover:text-text'
                }`}
              >Long Break</Button>
            </div>

            <div className="flex items-center justify-center gap-3">
              <Button variant="source"
                onClick={pomo.reset}
                className="p-2.5 rounded-xl bg-surface-hover hover:bg-surface-active text-text-muted transition-colors"
                title="Reset"
              >
                <RotateCcw size={18} />
              </Button>
              {pomo.isRunning ? (
                <Button variant="source"
                  onClick={pomo.pause}
                  className="p-3.5 rounded-xl bg-accent-600 hover:bg-accent-700 text-study-white transition-colors shadow-lg"
                  title="Pause"
                >
                  <Pause size={22} />
                </Button>
              ) : (
                <Button variant="source"
                  onClick={pomo.start}
                  className="p-3.5 rounded-xl bg-accent-600 hover:bg-accent-700 text-study-white transition-colors shadow-lg"
                  title="Start"
                >
                  <Play size={22} />
                </Button>
              )}
              <Button variant="source"
                onClick={pomo.skip}
                className="p-2.5 rounded-xl bg-surface-hover hover:bg-surface-active text-text-muted transition-colors"
                title="Skip"
              >
                <SkipForward size={18} />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
