import { useState } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { readSource } from '@/lib/source-files';
import type { SourceInput } from '@/lib/learning-models';

export function SourcePicker({ sources, onChange }: { sources: SourceInput[]; onChange: (sources: SourceInput[]) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <div className="space-y-2">
    <label className="source-upload"><Upload size={17} /> Add sources <input type="file" multiple accept=".pdf,.txt,.md,.csv,image/*" className="hidden" disabled={busy} onChange={async e => {
      setBusy(true); setError(''); try { const added = await Promise.all([...e.target.files ?? []].map(readSource)); onChange([...sources,...added]); } catch (err) { setError(err instanceof Error ? err.message : 'Could not read this source.'); } finally { setBusy(false); e.target.value = ''; }
    }} /></label>
    {busy && <p className="text-xs text-text-muted">Reading all pages and diagrams…</p>}
    {sources.map((s,i) => <div key={`${s.name}-${i}`} className="flex items-center gap-2 text-xs text-text-muted"><FileText size={14} /><span className="min-w-0 flex-1 truncate">{s.name}</span><Button variant="ghost" size="icon" aria-label={`Remove ${s.name}`} onClick={() => onChange(sources.filter((_,n) => n!==i))}><X /></Button></div>)}
    {error && <p role="alert" className="text-study-rose-500 text-xs">{error}</p>}
  </div>;
}