import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

export function InstallAppButton({ compact = false }: { compact?: boolean }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const isInstalled = () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    setInstalled(isInstalled());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    const displayMode = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = () => {
      if (isInstalled()) setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    displayMode.addEventListener("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      displayMode.removeEventListener("change", handleDisplayModeChange);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt) return;

    const promptEvent = installPrompt;
    setInstallPrompt(null);
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
  };

  if (installed || !installPrompt) return null;

  return (
    <Button
      type="button"
      variant="source"
      onClick={() => void installApp()}
      title={compact ? "Install StudySmartly App" : undefined}
      aria-label="Install StudySmartly App"
      className={`w-full flex items-center ${compact ? "justify-center px-2" : "gap-3 px-3"} py-2 rounded-xl text-sm text-text-muted hover:bg-surface-hover hover:text-text min-h-[44px]`}
    >
      <Download size={17} />
      {!compact && "Install StudySmartly App"}
    </Button>
  );
}
