import type { Slide, SlideDocument } from '@/types';

export function DeckCanvas({ slide, document, index, onEdit }: { slide: Slide; document: SlideDocument; index: number; onEdit?: (patch: Partial<Slide>) => void }) {
  const editable = (field: 'heading' | 'body') => ({ contentEditable: Boolean(onEdit), suppressContentEditableWarning: true, onBlur: (e: React.FocusEvent<HTMLElement>) => onEdit?.({ [field]: e.currentTarget.textContent ?? '' }) });
  const cards = slide.cards?.length ? slide.cards : slide.bullets.map((text,i) => ({ title: '', text, value: String(i+1).padStart(2,'0') }));
  const hasImage = Boolean(slide.image);
  const layoutType = slide.layoutType ?? slide.layout;
  const isTitleSlide = layoutType === 'title';
  return <article className={`deck-canvas aspect-video overflow-hidden min-w-0 deck-theme-${document.theme ?? 'editorial'} deck-layout-${layoutType}${hasImage ? ' deck-has-image' : ''}`}>
    {slide.image && <div className={`deck-image-frame overflow-hidden min-w-0 min-h-0 ${isTitleSlide ? 'deck-image-frame-title absolute inset-0 h-full w-full' : 'deck-image-frame-split h-full max-h-[400px] w-[40%] flex-[0_1_40%]'}`}>
      <div className="relative h-full w-full">
        <img className="w-full h-full object-cover rounded-lg" src={slide.image} alt={slide.imageAlt || slide.heading} />
        {isTitleSlide && <div className="absolute inset-0 bg-black/60 z-0" aria-hidden="true" />}
      </div>
    </div>}
    <div className={`deck-content${isTitleSlide && hasImage ? ' relative z-10' : ''}`}>
      <div className="deck-eyebrow">{slide.category || document.subject}</div>
      <h2 {...editable('heading')}>{slide.heading}</h2>
      <p className="deck-body" {...editable('body')}>{slide.body}</p>
      {cards.length > 0 && <div className="deck-cards">{cards.map((card,i) => <section key={i} className="deck-card">
        {card.value && <div className="deck-value">{card.value}</div>}
        <h3 contentEditable={Boolean(onEdit)} suppressContentEditableWarning onBlur={e => onEdit?.({ cards: cards.map((c,n) => n===i ? {...c,title:e.currentTarget.textContent ?? ''} : c) })}>{card.title}</h3>
        <p contentEditable={Boolean(onEdit)} suppressContentEditableWarning onBlur={e => onEdit?.({ cards: cards.map((c,n) => n===i ? {...c,text:e.currentTarget.textContent ?? ''} : c) })}>{card.text}</p>
      </section>)}</div>}
      {slide.layout === 'title' && document.student && <div className="deck-attribution">{document.student}</div>}
    </div>
    <footer className="deck-footer"><span>{slide.citations?.join(' · ') || 'General knowledge · verify important claims'}{slide.imageSource === 'openverse-or-wikimedia' && <> · Image from <a href="https://openverse.org/" target="_blank" rel="noreferrer">Openverse</a> / <a href="https://commons.wikimedia.org/" target="_blank" rel="noreferrer">Wikimedia Commons</a></>}</span><span>{String(index+1).padStart(2,'0')}</span></footer>
  </article>;
}