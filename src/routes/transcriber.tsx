import { createFileRoute } from '@tanstack/react-router';
import Transcriber from '@/components/study/Transcriber';
export const Route = createFileRoute('/transcriber')({
  head: () => ({ meta: [
    { title: 'StudySmart — Lecture Transcriber' },
    { name: 'description', content: 'Capture and save lecture transcriptions.' },
    { property: 'og:title', content: 'StudySmart — Lecture Transcriber' },
    { property: 'og:description', content: 'Capture and save lecture transcriptions.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Page,
});
function Page() {
  return <Transcriber />;
}
