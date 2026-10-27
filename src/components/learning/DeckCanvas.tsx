import type { Slide, SlideDocument } from '@/types';

export function DeckCanvas({ slide, document, index, onEdit }: { slide: Slide; document: SlideDocument; index: number; onEdit?: (patch: Partial<Slide>) => void }) {
  const editable = (field: 'heading' | 'body') => ({ contentEditable: Boolean(onEdit), suppressContentEditableWarning: true, onBlur: (e: React.FocusEvent<HTMLElement>) => onEdit?.({ [field]: e.currentTarget.textContent ?? '' }) });
  const cards = slide.cards?.length ? slide.cards : slide.bullets.map((text,i) => ({ title: '', text, value: String(i+1).padStart(2,'0') }));
  return <article className={`deck-canvas deck-theme-${document.theme ?? 'editorial'} deck-layout-${slide.layout}`}>
    {slide.image && <img className="deck-image" src={slide.image} alt={slide.imageAlt || slide.heading} />}
    <div className="deck-content">
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
    <footer className="deck-footer"><span>{slide.citations?.join(' · ') || 'General knowledge · verify important claims'}</span><span>{String(index+1).padStart(2,'0')}</span></footer>
  </article>;
}