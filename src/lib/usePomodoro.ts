import { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '@/store';
import { playChime, notify, requestNotificationPermission } from '@/lib/audio';

type Phase = 'focus' | 'shortBreak' | 'longBreak';

export function usePomodoro() {
  const { settings } = useApp();
  const pomo = settings.pomodoro;
  const [phase, setPhase] = useState<Phase>('focus');
  const [timeLeft, setTimeLeft] = useState(pomo.focus * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedCycles, setCompletedCycles] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          handlePhaseComplete();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning]);

  const handlePhaseComplete = useCallback(() => {
    if (pomo.sound) playChime();
    if (pomo.notifications) {
      const msg = phase === 'focus'
        ? 'Focus session complete! Time for a break.'
        : 'Break over — ready to focus again?';
      notify('StudySmart Pomodoro', msg);
    }
    setIsRunning(false);

    if (phase === 'focus') {
      const newCycles = completedCycles + 1;
      setCompletedCycles(newCycles);
      const nextPhase: Phase = newCycles % pomo.longBreakInterval === 0 ? 'longBreak' : 'shortBreak';
      setPhase(nextPhase);
      const nextDuration = nextPhase === 'longBreak' ? pomo.longBreak : pomo.shortBreak;
      setTimeLeft(nextDuration * 60);
      if (pomo.autoStart) setTimeout(() => setIsRunning(true), 500);
    } else {
      setPhase('focus');
      setTimeLeft(pomo.focus * 60);
      if (pomo.autoStart) setTimeout(() => setIsRunning(true), 500);
    }
  }, [phase, completedCycles, pomo]);

  const start = useCallback(() => {
    requestNotificationPermission();
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(() => {
    setIsRunning(false);
    setPhase('focus');
    setTimeLeft(pomo.focus * 60);
    setCompletedCycles(0);
  }, [pomo.focus]);

  const skip = useCallback(() => {
    handlePhaseComplete();
  }, [handlePhaseComplete]);

  const switchPhase = useCallback((p: Phase) => {
    setIsRunning(false);
    setPhase(p);
    setTimeLeft((p === 'focus' ? pomo.focus : p === 'shortBreak' ? pomo.shortBreak : pomo.longBreak) * 60);
  }, [pomo.focus, pomo.shortBreak, pomo.longBreak]);

  useEffect(() => {
    if (!isRunning) {
      const dur = phase === 'focus' ? pomo.focus : phase === 'shortBreak' ? pomo.shortBreak : pomo.longBreak;
      setTimeLeft(dur * 60);
    }
  }, [pomo.focus, pomo.shortBreak, pomo.longBreak]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const totalTime = phase === 'focus' ? pomo.focus * 60 : phase === 'shortBreak' ? pomo.shortBreak * 60 : pomo.longBreak * 60;
  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;

  return {
    phase, timeLeft, minutes, seconds, isRunning,
    completedCycles, progress,
    start, pause, reset, skip, switchPhase,
  };
}

export type { Phase as PomodoroPhase };
