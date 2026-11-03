type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

interface PwaInstallState {
  installed: boolean;
  promptAvailable: boolean;
}

let deferredPrompt: InstallPromptEvent | null = null;
let state: PwaInstallState = { installed: false, promptAvailable: false };
let initialized = false;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function initializePwaInstall() {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;

  const displayMode = window.matchMedia("(display-mode: standalone)");
  state = {
    installed: displayMode.matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
    promptAvailable: false,
  };

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as InstallPromptEvent;
    state = { ...state, promptAvailable: true };
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    state = { installed: true, promptAvailable: false };
    notify();
  });

  displayMode.addEventListener("change", () => {
    if (displayMode.matches) {
      deferredPrompt = null;
      state = { installed: true, promptAvailable: false };
      notify();
    }
  });
}

export function getPwaInstallState() {
  return state;
}

export function subscribePwaInstall(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function triggerPwaInstall() {
  if (!deferredPrompt) return;

  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  state = { ...state, promptAvailable: false };
  notify();

  await promptEvent.prompt();
  const choice = await promptEvent.userChoice;
  if (choice.outcome === "accepted") {
    state = { installed: true, promptAvailable: false };
    notify();
  }
}
