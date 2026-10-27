import { AccentKey, ACCENTS } from '@/types';

export function applyTheme(mode: 'dark' | 'light', accent: AccentKey): void {
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  root.classList.add(mode);
  const a = ACCENTS[accent];
  Object.entries(a.scale).forEach(([shade, hex]) => {
    root.style.setProperty(`--accent-${shade}`, hex);
  });
  root.style.setProperty('--accent', a.hex);
}
