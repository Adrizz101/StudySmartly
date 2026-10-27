## StudySmart source adaptation
- Keep the existing pinned TanStack runtime and file routes; source screens live in reusable study components so every section has a real URL.
- Mount the browser-state provider and study layout behind ClientOnly because the imported application initializes localStorage and time-dependent views during render.
- Preserve source browser storage and user-configured connectors during this source-replacement task; introducing accounts or Cloud storage is a separate change.
- Use the Button source variant for imported controls to preserve their original dimensions and interaction styling.
- Load bundled PDF libraries on export; html2canvas-pro supports the current Tailwind color syntax without relying on global CDN scripts.
