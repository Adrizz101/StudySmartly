export function playChime(): void {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.6);
    });
  } catch {
    /* AudioContext unavailable */
  }
}

export function notify(title: string, body: string): void {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body });
    } catch {
      /* notification failed */
    }
  }
}

export async function requestNotificationPermission(): Promise<void> {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}
