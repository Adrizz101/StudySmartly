import { useState } from 'react';

const SCENE_URL = 'https://my.spline.design/studysmartlyneuralorbit-ArPKJbzsxtxEWpIfLfB0ifmI/';

export function SplineHero() {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative h-56 w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[.025] sm:h-72 lg:h-full lg:min-h-[330px]" aria-label="Interactive 3D neural orbit illustration">
      {!visible ? (
        <button type="button" onClick={() => setVisible(true)} className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-transparent text-sm text-text-muted hover:text-text">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/10 text-2xl text-emerald-200 shadow-[0_0_35px_rgba(16,185,129,.18)]">✦</span>
          <span>Load interactive 3D scene</span>
          <span className="text-xs text-text-dim">Loads only when requested</span>
        </button>
      ) : (
        <iframe className="spline-hero-frame" src={SCENE_URL} title="StudySmartly neural orbit 3D scene" loading="lazy" allow="autoplay; fullscreen; xr-spatial-tracking" />
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#09090b]/60 to-transparent" />
    </div>
  );
}
