import { useCallback, useEffect, useMemo, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { BookOpen, Brain, Check, ChevronLeft, ChevronRight, Clock3, Plus, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { generateFlashcards } from '@/lib/flashcards-ai.functions';
import InteractiveLoader from '@/components/ui/InteractiveLoader';
import { AIConsent, requireAISession } from '@/components/learning/AIConsent';

type Deck = { id:string; title:string; subject:string; source:string; created_at:string };
type Card = { id:string; deck_id:string; question:string; answer:string; explanation:string; subject:string; topic:string; difficulty:'easy'|'normal'|'hard'; due_at:string; interval_days:number; ease_factor:number; repetitions:number; lapses:number };
type Rating = 0|1|2|3;
const today = () => new Date().toISOString();
function schedule(card:Card, rating:Rating) {
  let repetitions=card.repetitions, lapses=card.lapses, ease=card.ease_factor, interval=card.interval_days;
  if(rating===0){ repetitions=0; lapses+=1; interval=0; ease=Math.max(1.3,ease-0.2); }
  else {
    repetitions+=1;
    if(rating===1) interval=Math.max(1,Math.round(Math.max(1,interval)*1.2));
    if(rating===2) interval=repetitions===1?1:repetitions===2?3:Math.max(1,Math.round(Math.max(1,interval)*ease));
    if(rating===3){ ease=Math.min(3.5,ease+0.15); interval=repetitions===1?2:repetitions===2?5:Math.max(2,Math.round(Math.max(1,interval)*ease*1.25)); }
    if(rating===1) ease=Math.max(1.3,ease-0.15);
  }
  return { repetitions,lapses,ease_factor:Number(ease.toFixed(2)),interval_days:interval,due_at:new Date(Date.now()+interval*86400000).toISOString(),last_reviewed_at:today(),updated_at:today() };
}
export default function FlashcardStudio(){
 const [decks,setDecks]=useState<Deck[]>([]),[cards,setCards]=useState<Card[]>([]),[selected,setSelected]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [title,setTitle]=useState(''),[subject,setSubject]=useState('General'),[sourceText,setSourceText]=useState(''),[count,setCount]=useState(12),[consent,setConsent]=useState(false),[revealed,setRevealed]=useState(false),[index,setIndex]=useState(0);
 const generate=useServerFn(generateFlashcards);
 const load=useCallback(async()=>{
   setLoading(true);setError('');
   try{
     const [d,c]=await Promise.all([
       supabase.from('flashcard_decks').select('id,title,subject,source,created_at').order('created_at',{ascending:false}),
       supabase.from('flashcards').select('*').order('due_at',{ascending:true}).limit(500),
     ]);
     if(d.error)throw d.error;if(c.error)throw c.error;
     setDecks((d.data||[]) as Deck[]);setCards((c.data||[]) as Card[]);
     setSelected(current=>current||d.data?.[0]?.id||'');
   }catch(e){setError(e instanceof Error?e.message:'Could not load flashcards.');}
   finally{setLoading(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 const selectedDeck=decks.find(d=>d.id===selected);
 const due=useMemo(()=>cards.filter(c=>c.deck_id===selected&&new Date(c.due_at)<=new Date()).sort((a,b)=>a.due_at.localeCompare(b.due_at)),[cards,selected]);
 const current=due[index];
 async function createDeck(){
   setError('');setNotice('');setBusy(true);
   try{
     if(!title.trim())throw new Error('Enter a deck topic first.');
     if(!consent)throw new Error('Confirm AI processing consent before generating cards.');
     await requireAISession();
     const result=await generate({data:{topic:title.trim(),subject:subject.trim()||'General',sourceText,count,consent:true}});
     const {data:auth}=await supabase.auth.getUser();if(!auth.user)throw new Error('Sign in again to save this deck.');
     const {data:deck,error:deckError}=await supabase.from('flashcard_decks').insert({user_id:auth.user.id,title:title.trim(),subject:subject.trim()||'General',source:'ai_generated'}).select('*').single();
     if(deckError)throw deckError;
     const rows=result.cards.map(c=>({...c,deck_id:deck.id,user_id:auth.user!.id,subject:subject.trim()||'General',due_at:today(),interval_days:0,ease_factor:2.5,repetitions:0,lapses:0}));
     const {data:saved,error:saveError}=await supabase.from('flashcards').insert(rows).select('*');
     if(saveError){await supabase.from('flashcard_decks').delete().eq('id',deck.id);throw saveError;}
     setDecks(prev=>[deck as Deck,...prev]);setCards(prev=>[...(saved as Card[]),...prev]);setSelected(deck.id);setIndex(0);setRevealed(false);setTitle('');setSourceText('');setNotice(`Created ${saved.length} cards.`);
   }catch(e){setError(e instanceof Error?e.message:'Could not create flashcards.');}
   finally{setBusy(false);}
 }
 async function review(rating:Rating){
   if(!current)return;setBusy(true);setError('');
   const next=schedule(current,rating);
   try{
     const {data:auth}=await supabase.auth.getUser();if(!auth.user)throw new Error('Sign in again to save this review.');
     const {error:updateError}=await supabase.from('flashcards').update(next).eq('id',current.id).eq('user_id',auth.user.id);
     if(updateError)throw updateError;
     const {error:reviewError}=await supabase.from('flashcard_reviews').insert({card_id:current.id,user_id:auth.user.id,rating,previous_interval_days:current.interval_days,next_interval_days:next.interval_days});
     if(reviewError)throw reviewError;
     setCards(prev=>prev.map(c=>c.id===current.id?{...c,...next}:c));setRevealed(false);setIndex(i=>Math.min(i,due.length-2));
   }catch(e){setError(e instanceof Error?e.message:'Could not save review.');}
   finally{setBusy(false);}
 }
 const totalDue=cards.filter(c=>new Date(c.due_at)<=new Date()).length;
 return <div className="learning-workspace min-w-0">
  <header className="learning-heading"><div><span className="workspace-eyebrow">LEARN / RETAIN</span><h1>Spaced Repetition Studio</h1><p className="text-sm text-text-muted mt-1">Build recall strength with short, scheduled reviews.</p></div><div className="rounded-xl border border-border bg-surface px-4 py-3 text-right"><strong className="text-2xl tabular-nums">{totalDue}</strong><p className="text-xs text-text-muted">Due today</p></div></header>
  {error&&<div role="alert" className="learning-error">{error}</div>}{notice&&<div role="status" className="rounded-xl bg-accent-500/10 text-accent-400 p-3 text-sm">{notice}</div>}
  <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] gap-4">
   <div className="glass rounded-2xl p-4 sm:p-6 min-w-0 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold flex items-center gap-2"><Brain size={18}/> Review session</h2>{selectedDeck&&<span className="text-xs text-text-muted">{selectedDeck.title}</span>}</div>
    {!selectedDeck?<p className="text-sm text-text-muted py-8 text-center">Create a deck to begin your first review.</p>:!current?<div className="text-center py-10"><Check className="mx-auto text-accent-400 mb-3" size={32}/><h3 className="font-semibold">You’re clear for now</h3><p className="text-sm text-text-muted mt-1">No cards from this deck are due. Come back when the next review is scheduled.</p></div>:<div className="space-y-5">
      <div className="flex justify-between text-xs text-text-muted"><span>Card {index+1} of {due.length}</span><span>{current.topic||current.subject}</span></div>
      <div className="min-h-56 sm:min-h-64 rounded-2xl border border-border bg-surface-hover/70 p-5 sm:p-8 flex flex-col justify-center text-center">
       <p className="text-xs uppercase tracking-wider text-accent-400 mb-4">{revealed?'Answer':'Recall the answer'}</p><h3 className="text-lg sm:text-2xl font-semibold whitespace-pre-wrap break-words">{revealed?current.answer:current.question}</h3>
       {revealed&&current.explanation&&<p className="text-sm text-text-muted mt-5">{current.explanation}</p>}
      </div>
      {!revealed?<Button className="w-full" onClick={()=>setRevealed(true)}>Reveal answer</Button>:<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{(['Again','Hard','Good','Easy'] as const).map((label,i)=><Button key={label} variant="outline" disabled={busy} onClick={()=>void review(i as Rating)} className="min-w-0">{label}</Button>)}</div>}
      <div className="flex items-center justify-between"><Button variant="ghost" size="sm" disabled={index===0} onClick={()=>{setIndex(i=>i-1);setRevealed(false)}}><ChevronLeft size={16}/>Previous</Button><Button variant="ghost" size="sm" disabled={index>=due.length-1} onClick={()=>{setIndex(i=>i+1);setRevealed(false)}}>Next<ChevronRight size={16}/></Button></div>
    </div>}
   </div>
   <aside className="space-y-4 min-w-0">
    <div className="glass rounded-2xl p-4 sm:p-5 space-y-3"><h2 className="font-semibold flex items-center gap-2"><Sparkles size={18}/> Generate with AI</h2><input className="learning-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Topic (e.g. Cell division)"/><input className="learning-input" value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Subject"/><textarea className="learning-input min-h-28" value={sourceText} onChange={e=>setSourceText(e.target.value)} placeholder="Optional: paste notes or textbook extracts to ground the cards."/><label className="text-xs text-text-muted">Cards to generate<input className="learning-input mt-1" type="number" min="5" max="40" value={count} onChange={e=>setCount(Math.max(5,Math.min(40,Number(e.target.value)||5)))}/></label><AIConsent consent={consent} onConsent={setConsent}/><Button className="w-full" disabled={busy||!title.trim()} onClick={()=>void createDeck()}><Sparkles size={16}/>Generate deck</Button>{busy&&<InteractiveLoader/>}</div>
    <div className="glass rounded-2xl p-4 sm:p-5"><div className="flex items-center justify-between gap-2 mb-3"><h2 className="font-semibold flex items-center gap-2"><BookOpen size={18}/> Your decks</h2><Button variant="ghost" size="sm" onClick={()=>void load()}><RotateCcw size={15}/></Button></div>{loading?<p className="text-sm text-text-muted">Loading…</p>:decks.length===0?<p className="text-sm text-text-muted">No decks yet.</p>:<div className="space-y-2">{decks.map(d=><button key={d.id} onClick={()=>{setSelected(d.id);setIndex(0);setRevealed(false)}} className={`w-full text-left p-3 rounded-xl border ${selected===d.id?'border-accent-500 bg-accent-500/10':'border-border hover:bg-surface-hover'}`}><span className="block text-sm font-medium break-words">{d.title}</span><span className="text-xs text-text-muted">{d.subject} · {cards.filter(c=>c.deck_id===d.id).length} cards</span></button>)}</div>}</div>
   </aside>
  </section>
 </div>;
}
