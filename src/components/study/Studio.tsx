import { Button } from '@/components/ui/button';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '@/store';
import { Slide, SlideDocument, SlidePalette, SLIDE_PALETTES } from '@/types';
import { isApiKeyConfigured, callOpenAI } from '@/lib/socratic';
import { getTopicImages, getFallbackImage } from '@/lib/connectors';
import { exportSlidesToPDF, exportGuideToPDF, exportAsHTML, exportAsText } from '@/lib/export';
import { Modal } from '@/components/Modal';
import {
  Plus, Trash2, FileText, Presentation, Download, Sparkles, ChevronLeft, ChevronRight,
  Edit3, Wand2, X, Check, FileDown, Palette as PaletteIcon, Layout, RefreshCw,
  BookOpen, BarChart3, Image as ImageIcon, AlertCircle, FileJson,
} from 'lucide-react';

const PALETTE_KEYS = Object.keys(SLIDE_PALETTES) as SlidePalette[];

const LAYOUTS: { key: Slide['layout']; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'content', label: 'Content' },
  { key: 'split', label: 'Split' },
  { key: 'stats', label: 'Stats' },
  { key: 'summary', label: 'Summary' },
];

const STUDIO_SYSTEM = `You are an expert academic content designer. Generate well-structured educational content. For slide decks, create slides with clear headings, concise bullet points, and logical flow. For study guides, create comprehensive sections with explanations. Always format output as valid JSON matching the requested structure.`;

const TEMPLATE_PROMPTS = [
  'Create a 6-slide presentation on photosynthesis for high school biology',
  'Make a study guide on World War II causes and major events',
  'Generate slides explaining Newton\'s three laws of motion',
  'Build a 5-slide deck on the French Revolution',
];

export default function Studio() {
  const { settings, documents, setDocuments } = useApp();
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'present'>('grid');
  const [presentIndex, setPresentIndex] = useState(0);
  const [exportError, setExportError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const slideRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const guideRef = useRef<HTMLDivElement | null>(null);

  const activeDoc = documents.find((d) => d.id === activeDocId) || null;

  const updateDoc = useCallback((id: string, updater: (d: SlideDocument) => SlideDocument) => {
    setDocuments((prev) => prev.map((d) => (d.id === id ? updater(d) : d)));
  }, [setDocuments]);

  const generateContent = useCallback(async (userPrompt: string, format: 'slides' | 'guide') => {
    setIsGenerating(true);
    const slideCount = parseInt(userPrompt.match(/(\d+)\s*slide/i)?.[1] || '6');
    const isSlides = format === 'slides';

    const instruction = isSlides
      ? `Create ${slideCount} educational slides about: ${userPrompt}. Respond as JSON: {"slides":[{"heading":"","body":"","bullets":["",""],"layout":"content","category":"","stats":[{"label":"","value":""}]}]}. Use layouts: "title" for the first, "summary" for the last, "content","split","stats" for middle. Include a "category" string like "CHAPTER 1 • BIOLOGY".`
      : `Create a comprehensive study guide about: ${userPrompt}. Respond as JSON: {"slides":[{"heading":"Section Title","body":"Detailed explanation paragraph","bullets":["Key point 1","Key point 2"],"layout":"content","category":""}]}.`;

    let generatedSlides: Slide[] = [];

    if (isApiKeyConfigured(settings.aiApiKey)) {
      try {
        const response = await callOpenAI(settings.aiBaseUrl, settings.aiApiKey, settings.aiModel, [
          { role: 'system', content: STUDIO_SYSTEM },
          { role: 'user', content: instruction },
        ]);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          generatedSlides = (parsed.slides || []).map((s: Record<string, unknown>) => ({
            id: crypto.randomUUID(),
            heading: String(s['heading'] || ''),
            body: String(s['body'] || ''),
            bullets: Array.isArray(s['bullets']) ? s['bullets'].map(String) : [],
            layout: (s['layout'] as Slide['layout']) || 'content',
            category: s['category'] ? String(s['category']) : undefined,
            stats: Array.isArray(s['stats']) ? s['stats'].map((st: Record<string, unknown>) => ({ id: crypto.randomUUID(), label: String(st['label'] || ''), value: String(st['value'] || '') })) : undefined,
          }));
        }
      } catch {
        /* fall through to simulated */
      }
    }

    if (generatedSlides.length === 0) {
      await new Promise((r) => setTimeout(r, 1200));
      generatedSlides = generateSimulatedSlides(userPrompt, isSlides, slideCount);
    }

    const doc: SlideDocument = {
      id: crypto.randomUUID(),
      title: userPrompt.slice(0, 60),
      subject: 'General',
      slides: generatedSlides,
      updatedAt: Date.now(),
      format,
    };
    setDocuments((prev) => [doc, ...prev]);
    setActiveDocId(doc.id);
    setIsGenerating(false);
  }, [settings, setDocuments]);

  const updateSlide = useCallback((slideId: string, partial: Partial<Slide>) => {
    if (!activeDocId) return;
    updateDoc(activeDocId, (d) => ({
      ...d,
      slides: d.slides.map((s) => (s.id === slideId ? { ...s, ...partial } : s)),
      updatedAt: Date.now(),
    }));
  }, [activeDocId, updateDoc]);

  const addSlide = useCallback(() => {
    if (!activeDocId) return;
    const palette = PALETTE_KEYS[Math.floor(Math.random() * PALETTE_KEYS.length)];
    updateDoc(activeDocId, (d) => ({
      ...d,
      slides: [...d.slides, {
        id: crypto.randomUUID(),
        heading: 'New Slide',
        body: '',
        bullets: [],
        layout: 'content',
        palette,
      }],
      updatedAt: Date.now(),
    }));
  }, [activeDocId, updateDoc]);

  const deleteSlide = useCallback((slideId: string) => {
    if (!activeDocId) return;
    updateDoc(activeDocId, (d) => ({
      ...d,
      slides: d.slides.filter((s) => s.id !== slideId),
      updatedAt: Date.now(),
    }));
  }, [activeDocId, updateDoc]);

  const deleteDoc = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    if (activeDocId === id) setActiveDocId(null);
  }, [setDocuments, activeDocId]);

  const swapPalette = useCallback((slideId: string) => {
    if (!activeDoc) return;
    const slide = activeDoc.slides.find((s) => s.id === slideId);
    if (!slide) return;
    const currentPalette = slide.palette || 'emerald-dark';
    const currentIdx = PALETTE_KEYS.indexOf(currentPalette);
    const nextPalette = PALETTE_KEYS[(currentIdx + 1) % PALETTE_KEYS.length];
    updateSlide(slideId, { palette: nextPalette });
  }, [activeDoc, updateSlide]);

  const swapLayout = useCallback((slideId: string) => {
    if (!activeDoc) return;
    const slide = activeDoc.slides.find((s) => s.id === slideId);
    if (!slide) return;
    const layouts: Slide['layout'][] = ['title', 'content', 'split', 'stats', 'summary'];
    const currentIdx = layouts.indexOf(slide.layout);
    const nextLayout = layouts[(currentIdx + 1) % layouts.length] ?? 'content';
    updateSlide(slideId, { layout: nextLayout });
  }, [activeDoc, updateSlide]);

  const regenerateGraphics = useCallback((slideId: string) => {
    if (!activeDoc) return;
    const slide = activeDoc.slides.find((s) => s.id === slideId);
    if (!slide) return;
    const topic = activeDoc.title || 'study';
    const seed = `${topic}-${slideId.slice(0, 4)}-${Math.floor(Math.random() * 999)}`;
    updateSlide(slideId, { image: getFallbackImage(seed) });
  }, [activeDoc, updateSlide]);

  const handleExportPDF = useCallback(async () => {
    if (!activeDoc) return;
    setIsExporting(true);
    setExportError('');
    try {
      if (activeDoc.format === 'slides') {
        const elements = activeDoc.slides
          .map((s) => slideRefs.current[s.id])
          .filter((el): el is HTMLDivElement => !!el);
        await exportSlidesToPDF(elements, `${activeDoc.title.replace(/\s+/g, '_')}.pdf`);
      } else {
        if (!guideRef.current) throw new Error('Guide element not found');
        await exportGuideToPDF(guideRef.current, `${activeDoc.title.replace(/\s+/g, '_')}.pdf`);
      }
    } catch (err) {
      setExportError((err as Error).message);
    }
    setIsExporting(false);
  }, [activeDoc]);

  const handleExportHTML = useCallback(() => {
    if (!activeDoc) return;
    const html = exportAsHTML(activeDoc);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDoc.title.replace(/\s+/g, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeDoc]);

  const handleExportText = useCallback(() => {
    if (!activeDoc) return;
    const text = exportAsText(activeDoc);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDoc.title.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeDoc]);

  const handleExportJSON = useCallback(() => {
    if (!activeDoc) return;
    const json = JSON.stringify(activeDoc, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDoc.title.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeDoc]);

  // Presentation mode keyboard nav
  useEffect(() => {
    if (viewMode !== 'present' || !activeDoc) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') setPresentIndex((i) => Math.min(i + 1, activeDoc.slides.length - 1));
      if (e.key === 'ArrowLeft') setPresentIndex((i) => Math.max(i - 1, 0));
      if (e.key === 'Escape') setViewMode('grid');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [viewMode, activeDoc]);

  // Presentation mode
  if (viewMode === 'present' && activeDoc) {
    const slide = activeDoc.slides[presentIndex];
    if (slide) {
      return (
        <div className="fixed inset-0 z-50 bg-study-black flex items-center justify-center" onClick={() => setViewMode('grid')}>
          <div className="relative w-full max-w-5xl aspect-video p-4 flex" onClick={(e) => e.stopPropagation()}>
            <SlideCard slide={slide} large />
          </div>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 text-study-white/80" onClick={(e) => e.stopPropagation()}>
            <Button variant="source" onClick={() => setPresentIndex((i) => Math.max(i - 1, 0))} className="p-3 rounded-lg hover:bg-study-white/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
              <ChevronLeft size={24} />
            </Button>
            <span className="text-sm font-medium">{presentIndex + 1} / {activeDoc.slides.length}</span>
            <Button variant="source" onClick={() => setPresentIndex((i) => Math.min(i + 1, activeDoc.slides.length - 1))} className="p-3 rounded-lg hover:bg-study-white/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
              <ChevronRight size={24} />
            </Button>
          </div>
          <Button variant="source" onClick={() => setViewMode('grid')} className="absolute top-6 right-6 p-3 rounded-lg text-study-white/60 hover:text-study-white hover:bg-study-white/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X size={24} />
          </Button>
        </div>
      );
    }
  }

  return (
    <div className="space-y-6">
      {/* Document list / Studio */}
      {!activeDoc ? (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-semibold text-text text-lg">Document & Slide Studio</h3>
              <p className="text-sm text-text-muted mt-0.5">Generate professional, media-rich slides and study guides with AI</p>
            </div>
            <Button variant="source"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-600 hover:bg-accent-700 text-study-white text-sm font-medium shadow-md transition-all min-h-[44px]"
            >
              <Plus size={16} /> Create New
            </Button>
          </div>

          <div className="glass rounded-xl p-5 surface-elevated">
            <h4 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">Quick Start Prompts</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TEMPLATE_PROMPTS.map((tp) => (
                <Button variant="source"
                  key={tp}
                  onClick={() => { setPrompt(tp); setShowCreateModal(true); }}
                  className="flex items-start gap-2.5 p-3 rounded-xl border border-border hover:border-accent-500 hover:bg-surface-hover text-left text-sm text-text-muted transition-all min-h-[44px]"
                >
                  <Wand2 size={16} className="text-accent-500 shrink-0 mt-0.5" />
                  {tp}
                </Button>
              ))}
            </div>
          </div>

          {documents.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">Your Documents</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="group glass rounded-xl p-4 surface-elevated cursor-pointer hover:scale-[1.02] transition-all border border-border hover:border-border-light"
                    onClick={() => setActiveDocId(doc.id)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-accent-600/15 flex items-center justify-center">
                        {doc.format === 'slides' ? <Presentation size={20} className="text-accent-500" /> : <FileText size={20} className="text-accent-500" />}
                      </div>
                      <Button variant="source"
                        onClick={(e) => { e.stopPropagation(); deleteDoc(doc.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-text-dim hover:text-study-rose-500 transition-all min-w-[36px] min-h-[36px] flex items-center justify-center"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                    <h4 className="font-semibold text-text text-sm leading-snug mb-1">{doc.title}</h4>
                    <p className="text-xs text-text-dim">{doc.slides.length} {doc.format === 'slides' ? 'slides' : 'sections'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Editor toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Button variant="source" onClick={() => setActiveDocId(null)} className="p-2.5 rounded-lg hover:bg-surface-hover text-text-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
                <ChevronLeft size={20} />
              </Button>
              <div>
                <h3 className="font-semibold text-text text-lg">{activeDoc.title}</h3>
                <p className="text-xs text-text-dim">{activeDoc.slides.length} {activeDoc.format === 'slides' ? 'slides' : 'sections'} · {activeDoc.format}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {activeDoc.format === 'slides' && (
                <Button variant="source"
                  onClick={() => { setPresentIndex(0); setViewMode('present'); }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl glass hover:surface-elevated text-sm font-medium text-text transition-all min-h-[44px]"
                >
                  <Presentation size={16} /> Present
                </Button>
              )}
              <Button variant="source"
                onClick={handleExportPDF}
                disabled={isExporting}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-study-white text-sm font-medium transition-all min-h-[44px]"
              >
                {isExporting ? <><div className="w-4 h-4 border-2 border-study-white border-t-transparent rounded-full animate-spin" /> Exporting...</> : <><FileDown size={16} /> Export PDF</>}
              </Button>
              <Button variant="source" onClick={handleExportHTML} className="flex items-center gap-2 px-3 py-2.5 rounded-xl glass hover:surface-elevated text-sm font-medium text-text transition-all min-h-[44px]">
                <FileText size={16} /> HTML
              </Button>
              <Button variant="source" onClick={handleExportText} className="flex items-center gap-2 px-3 py-2.5 rounded-xl glass hover:surface-elevated text-sm font-medium text-text transition-all min-h-[44px]">
                <Download size={16} /> Text
              </Button>
              <Button variant="source" onClick={handleExportJSON} className="flex items-center gap-2 px-3 py-2.5 rounded-xl glass hover:surface-elevated text-sm font-medium text-text transition-all min-h-[44px]">
                <FileJson size={16} /> JSON
              </Button>
            </div>
          </div>

          {exportError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-study-rose-500/10 text-study-rose-500 text-sm">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{exportError}</span>
            </div>
          )}

          {/* Slides grid or guide view */}
          {activeDoc.format === 'slides' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {activeDoc.slides.map((slide, idx) => (
                <div key={slide.id} className="group relative">
                  <div
                    ref={(el) => { slideRefs.current[slide.id] = el; }}
                    className="glass rounded-xl overflow-hidden surface-elevated border border-border"
                  >
                    <div className="aspect-video relative">
                      <SlideCard slide={slide} />
                    </div>
                    <SlideToolbar
                      onSwapPalette={() => swapPalette(slide.id)}
                      onSwapLayout={() => swapLayout(slide.id)}
                      onRegenGraphics={() => regenerateGraphics(slide.id)}
                      onEdit={() => setEditingSlideId(slide.id)}
                      onDelete={() => deleteSlide(slide.id)}
                      index={idx}
                    />
                  </div>
                </div>
              ))}
              <Button variant="source"
                onClick={addSlide}
                className="aspect-video glass rounded-xl border-2 border-dashed border-border hover:border-accent-500 flex items-center justify-center text-text-dim hover:text-accent-500 transition-all min-h-[180px]"
              >
                <div className="text-center">
                  <Plus size={24} className="mx-auto mb-2" />
                  <span className="text-sm font-medium">Add Slide</span>
                </div>
              </Button>
            </div>
          ) : (
            <div
              ref={guideRef}
              className="glass rounded-2xl p-8 lg:p-12 surface-elevated"
              style={{ background: 'var(--source-31)' }}
            >
              <GuideView doc={activeDoc} />
            </div>
          )}
        </>
      )}

      {/* Create modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Generate Document" maxWidth="max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-text-muted block mb-2">Describe what you want to create</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="e.g. Create a 6-slide presentation on photosynthesis for high school biology"
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="source"
              onClick={() => { generateContent(prompt || 'Create a presentation', 'slides'); setPrompt(''); setShowCreateModal(false); }}
              disabled={isGenerating || !prompt.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-accent-600 hover:bg-accent-700 disabled:opacity-50 disabled:cursor-not-allowed text-study-white font-medium text-sm transition-colors min-h-[44px]"
            >
              {isGenerating ? <><div className="w-4 h-4 border-2 border-study-white border-t-transparent rounded-full animate-spin" /> Generating...</> : <><Presentation size={16} /> Slide Deck</>}
            </Button>
            <Button variant="source"
              onClick={() => { generateContent(prompt || 'Create a study guide', 'guide'); setPrompt(''); setShowCreateModal(false); }}
              disabled={isGenerating || !prompt.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl glass hover:surface-elevated disabled:opacity-50 text-text font-medium text-sm transition-colors min-h-[44px]"
            >
              <FileText size={16} /> Study Guide
            </Button>
          </div>
          {!isApiKeyConfigured(settings.aiApiKey) && (
            <p className="text-xs text-text-dim flex items-center gap-1.5">
              <Sparkles size={12} /> Using built-in AI simulation with rich templates. Add an API key in Settings for live AI generation.
            </p>
          )}
        </div>
      </Modal>

      {/* Edit slide modal */}
      <EditSlideModal
        slide={activeDoc?.slides.find((s) => s.id === editingSlideId) || null}
        open={!!editingSlideId}
        onClose={() => setEditingSlideId(null)}
        onSave={(updated) => { if (editingSlideId) updateSlide(editingSlideId, updated); setEditingSlideId(null); }}
      />
    </div>
  );
}

// --- Slide Card with rich visual rendering ---
const SlideCard = ({ slide, large = false }: { slide: Slide; large?: boolean }) => {
  const palette = SLIDE_PALETTES[slide.palette || 'emerald-dark'];
  const topic = slide.heading || 'study';
  const imageUrl = slide.image || getFallbackImage(topic);

  const headingClass = large ? 'text-4xl font-bold' : 'text-lg font-bold';
  const bodyClass = large ? 'text-lg' : 'text-xs';
  const tagClass = large ? 'text-xs px-3 py-1.5' : 'text-[10px] px-2.5 py-1';

  return (
    <div
      className="absolute inset-0 rounded-xl overflow-hidden flex flex-col p-5"
      style={{ background: palette.bg }}
    >
      {/* Category Tag */}
      {slide.category && (
        <div className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap mb-3 self-start ${tagClass}`}
          style={{ backgroundColor: palette.card, color: palette.accent }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: palette.accent }} />
          {slide.category}
        </div>
      )}

      {slide.layout === 'title' && (
        <div className="flex-1 flex flex-col justify-center items-center text-center">
          <h2 className={`${headingClass} mb-2`} style={{ color: palette.text }}>{slide.heading}</h2>
          {slide.body && <p className={`${bodyClass} max-w-md`} style={{ color: palette.muted }}>{slide.body}</p>}
          <div className="w-12 h-0.5 rounded-full mt-4" style={{ backgroundColor: palette.accent }} />
        </div>
      )}

      {slide.layout === 'split' && (
        <div className="flex-1 flex flex-col">
          <h2 className={`${headingClass} mb-3`} style={{ color: palette.text }}>{slide.heading}</h2>
          <div className="flex-1 grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              {slide.body && <p className={`${bodyClass} leading-relaxed`} style={{ color: palette.muted }}>{slide.body}</p>}
              {slide.bullets.length > 0 && (
                <div className="space-y-1.5 mt-3">
                  {slide.bullets.map((b, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <Check size={large ? 18 : 12} className="shrink-0 mt-1" style={{ color: palette.accent }} />
                      <span className={bodyClass} style={{ color: palette.muted }}>{b}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="relative rounded-lg overflow-hidden" style={{ backgroundColor: palette.card }}>
              <img src={imageUrl} alt="" className="w-full h-full object-cover" loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).src = getFallbackImage('fallback-' + slide.id); }} />
            </div>
          </div>
        </div>
      )}

      {slide.layout === 'stats' && (
        <div className="flex-1 flex flex-col">
          <h2 className={`${headingClass} mb-3`} style={{ color: palette.text }}>{slide.heading}</h2>
          {slide.body && <p className={`${bodyClass} mb-3 leading-relaxed`} style={{ color: palette.muted }}>{slide.body}</p>}
          <div className="grid grid-cols-3 gap-2 flex-1">
            {(slide.stats || []).map((stat, i) => (
              <div key={stat.id} className="rounded-xl p-3 flex flex-col justify-center" style={{ backgroundColor: palette.card, backdropFilter: 'blur(8px)' }}>
                <div className={large ? 'text-2xl font-bold' : 'text-base font-bold'} style={{ color: palette.accent }}>{stat.value}</div>
                <div className={`${large ? 'text-xs' : 'text-[10px]'} mt-1`} style={{ color: palette.muted }}>{stat.label}</div>
              </div>
            ))}
          </div>
          {slide.bullets.length > 0 && (
            <div className="space-y-1.5 mt-3">
              {slide.bullets.map((b, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <BarChart3 size={large ? 18 : 12} className="shrink-0 mt-1" style={{ color: palette.accent }} />
                  <span className={bodyClass} style={{ color: palette.muted }}>{b}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {slide.layout === 'summary' && (
        <div className="flex-1 flex flex-col">
          <div className="text-sm font-semibold mb-2" style={{ color: palette.accent }}>Key Takeaways</div>
          <h2 className={`${headingClass} mb-3`} style={{ color: palette.text }}>{slide.heading}</h2>
          <div className="space-y-2 flex-1">
            {slide.bullets.map((b, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg p-2" style={{ backgroundColor: palette.card }}>
                <Check size={large ? 20 : 14} className="shrink-0 mt-1" style={{ color: palette.accent }} />
                <span className={bodyClass} style={{ color: palette.text }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {slide.layout === 'content' && (
        <div className="flex-1 flex flex-col">
          <h2 className={`${headingClass} mb-2`} style={{ color: palette.text }}>{slide.heading}</h2>
          {slide.body && <p className={`${bodyClass} mb-3 leading-relaxed`} style={{ color: palette.muted }}>{slide.body}</p>}
          {slide.image && (
            <div className="relative rounded-lg overflow-hidden mb-3 h-24" style={{ backgroundColor: palette.card }}>
              <img src={imageUrl} alt="" className="w-full h-full object-cover" loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).src = getFallbackImage('fallback-' + slide.id); }} />
            </div>
          )}
          <div className="space-y-1.5 flex-1">
            {slide.bullets.map((b, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: palette.accent }} />
                <span className={bodyClass} style={{ color: palette.muted }}>{b}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Slide Toolbar (per slide) ---
function SlideToolbar({
  onSwapPalette, onSwapLayout, onRegenGraphics, onEdit, onDelete, index,
}: {
  onSwapPalette: () => void;
  onSwapLayout: () => void;
  onRegenGraphics: () => void;
  onEdit: () => void;
  onDelete: () => void;
  index: number;
}) {
  return (
    <div className="px-3 py-2 border-t border-border flex items-center justify-between bg-surface-hover/50">
      <span className="text-xs text-text-dim font-medium">Slide {index + 1}</span>
      <div className="flex items-center gap-1">
        <Button variant="source" onClick={onSwapPalette} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-dim hover:text-accent-500 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center" title="Change Palette">
          <PaletteIcon size={14} />
        </Button>
        <Button variant="source" onClick={onSwapLayout} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-dim hover:text-accent-500 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center" title="Swap Layout">
          <Layout size={14} />
        </Button>
        <Button variant="source" onClick={onRegenGraphics} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-dim hover:text-accent-500 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center" title="Regenerate Graphics">
          <RefreshCw size={14} />
        </Button>
        <Button variant="source" onClick={onEdit} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-dim hover:text-text transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center" title="Edit">
          <Edit3 size={14} />
        </Button>
        <Button variant="source" onClick={onDelete} className="p-1.5 rounded-lg hover:bg-surface-hover text-text-dim hover:text-study-rose-500 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center" title="Delete">
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}

// --- Guide View (A4-style document) ---
function GuideView({ doc }: { doc: SlideDocument }) {
  return (
    <div style={{ color: 'var(--text)' }}>
      <div className="border-b border-study-white/10 pb-4 mb-6">
        <h1 className="text-3xl font-bold text-study-white mb-2">{doc.title}</h1>
        <p className="text-sm text-study-slate-400">{doc.slides.length} sections · Generated by StudySmart · {new Date(doc.updatedAt).toLocaleDateString()}</p>
      </div>
      {doc.slides.map((s, i) => (
        <div key={s.id} className="mb-8 pb-6 border-b border-study-white/5">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-8 h-8 rounded-lg bg-study-emerald-500/15 flex items-center justify-center text-sm font-bold text-study-emerald-400 shrink-0">{i + 1}</span>
            <div>
              {s['category'] && <span className="text-xs font-semibold text-study-emerald-400 uppercase tracking-wide">{s['category']}</span>}
              <h2 className="text-xl font-semibold text-study-white">{s['heading']}</h2>
            </div>
          </div>
          {s['body'] && <p className="text-sm text-study-slate-300 leading-relaxed mb-3">{s['body']}</p>}
          {s['bullets'].length > 0 && (
            <div className="space-y-1.5">
              {s['bullets'].map((b, j) => (
                <div key={j} className="flex items-start gap-2 text-sm text-study-slate-300">
                  <span className="text-study-emerald-400 mt-0.5">▸</span>
                  {b}
                </div>
              ))}
            </div>
          )}
          {s['stats'] && s['stats'].length > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-4">
              {s['stats'].map((st) => (
                <div key={st.id} className="rounded-lg p-3" style={{ background: 'var(--source-32)', backdropFilter: 'blur(8px)' }}>
                  <div className="text-lg font-bold text-study-emerald-400">{st.value}</div>
                  <div className="text-xs text-study-slate-400 mt-0.5">{st.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// --- Edit slide modal ---
function EditSlideModal({ slide, open, onClose, onSave }: {
  slide: Slide | null;
  open: boolean;
  onClose: () => void;
  onSave: (s: Partial<Slide>) => void;
}) {
  const [heading, setHeading] = useState('');
  const [body, setBody] = useState('');
  const [bullets, setBullets] = useState<string[]>([]);
  const [layout, setLayout] = useState<Slide['layout']>('content');
  const [category, setCategory] = useState('');
  const [palette, setPalette] = useState<SlidePalette>('emerald-dark');

  useEffect(() => {
    if (slide) {
      setHeading(slide.heading);
      setBody(slide.body);
      setBullets(slide.bullets.length > 0 ? slide.bullets : ['']);
      setLayout(slide.layout);
      setCategory(slide.category || '');
      setPalette(slide.palette || 'emerald-dark');
    }
  }, [slide]);

  if (!slide) return null;

  return (
    <Modal open={open} onClose={onClose} title="Edit Slide" maxWidth="max-w-lg">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-text-muted block mb-1.5">Layout</label>
          <div className="flex gap-2 flex-wrap">
            {LAYOUTS.map((l) => (
              <Button variant="source" key={l.key} onClick={() => setLayout(l.key)}
                className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-all min-h-[36px] ${
                  layout === l.key ? 'border-accent-500 bg-accent-50/10 text-accent-500' : 'border-border text-text-muted hover:bg-surface-hover'
                }`}>
                {l.label}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-text-muted block mb-1.5">Palette</label>
          <div className="flex gap-2 flex-wrap">
            {PALETTE_KEYS.map((pk) => (
              <Button variant="source" key={pk} onClick={() => setPalette(pk)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all min-h-[36px] ${
                  palette === pk ? 'border-accent-500 text-accent-500' : 'border-border text-text-muted hover:bg-surface-hover'
                }`}>
                {SLIDE_PALETTES[pk].name}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-text-muted block mb-1.5">Category Tag</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. CHAPTER 3 • PHYSICS"
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500" />
        </div>
        <div>
          <label className="text-sm font-medium text-text-muted block mb-1.5">Heading</label>
          <input value={heading} onChange={(e) => setHeading(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500" />
        </div>
        <div>
          <label className="text-sm font-medium text-text-muted block mb-1.5">Body Text</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3}
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500 resize-none" />
        </div>
        <div>
          <label className="text-sm font-medium text-text-muted block mb-1.5">Bullet Points</label>
          <div className="space-y-2">
            {bullets.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={b} onChange={(e) => setBullets((prev) => prev.map((x, idx) => idx === i ? e.target.value : x))}
                  className="flex-1 px-3 py-2 rounded-lg bg-surface-hover border border-border text-text text-sm focus:outline-none focus:border-accent-500" />
                <Button variant="source" onClick={() => setBullets((prev) => prev.filter((_, idx) => idx !== i))}
                  className="p-2 rounded-lg hover:bg-surface-hover text-text-dim hover:text-study-rose-500 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center">
                  <X size={14} />
                </Button>
              </div>
            ))}
            <Button variant="source" onClick={() => setBullets((prev) => [...prev, ''])}
              className="flex items-center gap-1.5 text-sm text-accent-500 hover:text-accent-400 font-medium min-h-[36px]">
              <Plus size={14} /> Add bullet
            </Button>
          </div>
        </div>
        <Button variant="source" onClick={() => onSave({ heading, body, bullets: bullets.filter((b) => b.trim()), layout, category: category || undefined, palette })}
          className="w-full py-2.5 rounded-xl bg-accent-600 hover:bg-accent-700 text-study-white font-medium text-sm transition-colors min-h-[44px]">
          Save Changes
        </Button>
      </div>
    </Modal>
  );
}

// --- Simulated content generator with rich templates ---
function generateSimulatedSlides(prompt: string, isSlides: boolean, count: number): Slide[] {
  const topic = prompt.replace(/^(create|make|generate|build)\s+(a\s+)?(\d+\s*slide\s*)?(presentation|study guide|slides|deck)\s*(on|about|for)?/i, '').trim() || prompt;
  const capTopic = topic.charAt(0).toUpperCase() + topic.slice(1);
  const images = getTopicImages(topic, count);
  const palettes: SlidePalette[] = ['emerald-dark', 'indigo-dark', 'slate-dark', 'bronze-dark', 'teal-dark', 'rose-dark'];

  const slides: Slide[] = [
    {
      id: crypto.randomUUID(),
      heading: capTopic,
      body: `An overview designed for academic study`,
      bullets: [],
      layout: 'title',
      category: 'STUDY GUIDE',
      palette: 'emerald-dark',
      image: images[0],
    },
    {
      id: crypto.randomUUID(),
      heading: 'Introduction',
      body: `This section introduces the fundamental concepts of ${topic}. Understanding these basics provides a foundation for the more advanced material that follows.`,
      bullets: ['Definition and scope of the topic', 'Historical context and development', 'Why this topic matters in your studies'],
      layout: 'split',
      category: 'CHAPTER 1 • INTRODUCTION',
      palette: 'indigo-dark',
      image: images[1 % images.length],
    },
    {
      id: crypto.randomUUID(),
      heading: 'Key Concepts & Data',
      body: '',
      bullets: ['The foundational principle that underpins the entire subject area', 'How different elements interact and relate to each other'],
      layout: 'stats',
      category: 'CHAPTER 2 • CORE CONCEPTS',
      palette: 'slate-dark',
      image: images[2 % images.length],
      stats: [
        { id: crypto.randomUUID(), label: 'Key Principles', value: '3' },
        { id: crypto.randomUUID(), label: 'Real-world Cases', value: '12+' },
        { id: crypto.randomUUID(), label: 'Study Hours Est.', value: '4h' },
      ],
    },
    {
      id: crypto.randomUUID(),
      heading: 'Detailed Analysis',
      body: `The analysis of ${topic} reveals several interconnected layers. By examining each component carefully, we build a comprehensive understanding of how the system works as a whole.`,
      bullets: ['Component breakdown and structure', 'Interrelationships between elements', 'Common misconceptions to avoid'],
      layout: 'content',
      category: 'CHAPTER 3 • ANALYSIS',
      palette: 'bronze-dark',
      image: images[3 % images.length],
    },
    {
      id: crypto.randomUUID(),
      heading: 'Applications & Examples',
      body: 'Practical examples help solidify theoretical understanding through real-world application.',
      bullets: [
        'Example 1: A straightforward application in everyday scenarios',
        'Example 2: A more complex, multi-step scenario',
        'Example 3: Edge cases and notable exceptions',
      ],
      layout: 'split',
      category: 'CHAPTER 4 • APPLICATIONS',
      palette: 'teal-dark',
      image: images[4 % images.length],
    },
    {
      id: crypto.randomUUID(),
      heading: 'Key Takeaways',
      body: '',
      bullets: [
        `Master the fundamentals of ${topic} before advancing to complex topics`,
        'Connect theory to practice through regular example-based study',
        'Review key concepts frequently to reinforce long-term retention',
      ],
      layout: 'summary',
      category: 'SUMMARY',
      palette: 'emerald-dark',
    },
  ];

  if (!isSlides) {
    slides.forEach((s) => { if (s['layout'] === 'title') s['layout'] = 'content'; });
  }

  return slides.slice(0, Math.max(count + 1, 4));
}
