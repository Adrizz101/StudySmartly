import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getPwaInstallState,
  subscribePwaInstall,
  triggerPwaInstall,
} from "@/lib/pwa-install";

export function InstallAppButton({ compact = false }: { compact?: boolean }) {
  const [installState, setInstallState] = useState(getPwaInstallState);

  useEffect(
    () => subscribePwaInstall(() => setInstallState(getPwaInstallState())),
    [],
  );

  if (installState.installed || !installState.promptAvailable) return null;

  return (
    <Button
      type="button"
      variant="source"
      onClick={() => void triggerPwaInstall()}
      title={compact ? "Install StudySmartly App" : undefined}
      aria-label="Install StudySmartly App"
      className={`w-full flex items-center ${compact ? "justify-center px-2" : "gap-3 px-3"} py-2 rounded-xl text-sm text-text-muted hover:bg-surface-hover hover:text-text min-h-[44px]`}
    >
      <Download size={17} />
      {!compact && "Install StudySmartly App"}
    </Button>
  );
}
