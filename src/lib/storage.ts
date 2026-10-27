import { Settings, DEFAULT_SETTINGS, Connectors } from '@/types';

const PREFIX = 'studysmart:';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable */
  }
}

export function loadSettings(): Settings {
  const s = load<Partial<Settings>>('settings', {});
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    pomodoro: { ...DEFAULT_SETTINGS.pomodoro, ...(s.pomodoro || {}) },
  };
}

export function saveSettings(s: Settings): void {
  save('settings', s);
}

const DEFAULT_CONNECTORS: Connectors = {
  aiApiKey: '',
  aiBaseUrl: 'https://api.openai.com/v1',
  aiModel: 'gpt-4o-mini',
  imageApiKey: '',
};

export function loadConnectors(): Connectors {
  return load<Connectors>('connectors', DEFAULT_CONNECTORS);
}

export function saveConnectors(c: Connectors): void {
  save('connectors', c);
}
