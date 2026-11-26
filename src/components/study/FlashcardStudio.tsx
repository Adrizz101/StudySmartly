import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { BookOpen, Brain, Check, ChevronLeft, ChevronRight, RotateCcw, Sparkles, UploadCloud, Layers3, PencilRuler } from 'lucide-react';
import { createEmptyCard, fsrs, Rating, generatorParameters } from 'ts-fsrs';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { generateFlashcards } from '@/lib/flashcards-ai.functions';
import InteractiveLoader from '@/components/ui/InteractiveLoader';
import { AIConsent, requireAISession } from '@/components/learning/AIConsent';
import { SourcePicker } from '@/components/learning/SourcePicker';
import type { SourceInput } from '@/lib/learning-models';
import type { Attempt } from '@/lib/learning-models';
import { load } from '@/lib/storage';

type Deck = { id:string; title:string; subject:string; source:string; created_at:string };
type Card = { id:string; deck_id:string; question:string; answer:string; explanation:string; subject:string; topic:string; type:'basic'|'mcq'; options:string[]; correct_option_index:number|null; difficulty:'easy'|'normal'|'hard'; due_at:string; interval_days:number; ease_factor:number; repetitions:number; lapses:number; last_reviewed_at?:string|null; fsrs_card?:Record<string,unknown>|null };
type ReviewRating = 'again'|'hard'|'good'|'easy';
type FSRSCard = ReturnType<typeof createEmptyCard>;
const nowIso = () => new Date().toISOString();
const f = fsrs(generatorParameters({ enable_fuzz: true }));
const fsrsRatings: Record<ReviewRating, Rating> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

function getFSRSCard(card: Card, now: Date): FSRSCard {
  const saved = card.fsrs_card;
  if (saved && typeof saved === 'object' && typeof saved.due === 'string') {
    const due = new Date(saved.due);
    const lastReview = typeof saved.last_review === 'string' ? new Date(saved.last_review) : undefined;
    if (!Number.isNaN(due.getTime()) && (!lastReview || !Number.isNaN(lastReview.getTime()))) {
      return {
        ...saved,
        due,
        last_review: lastReview,
      } as FSRSCard;
    }
  }

  // Cards created before FSRS adoption start with a clean scheduler state.
  return createEmptyCard(now);
}

function serializeFSRSCard(card: FSRSCard) {
  return {
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review?.toISOString() ?? null,
  };
}

function getMistakeSource() {
  const attempts = load<Attempt[]>('exam-attempts', []);
  const lines = attempts.flatMap((attempt) => attempt.exam.questions.flatMap((question, index) => {
    const answer = attempt.answers[index];
    if (!question.verified || question.correct === null || answer === undefined || answer === question.correct) return [];
    return [
      `Exam: ${attempt.exam.title}`,
      `Subject: ${question.subject}; Chapter: ${question.chapter}; Concept: ${question.concept}`,
      `Question: ${question.question}`,
      `Student selected: ${question.options[answer] ?? 'Unknown'}`,
      `Correct answer: ${question.options[question.correct]}`,
      `Solution: ${question.steps.join(' ')}`,
      `Common distractor reasoning: ${question.distractors.join(' ')}`,
      '',
    ];
  }));
  return lines.join('\n').trim();
}

export default function FlashcardStudio(){
 const navigate=useNavigate();
 const [decks,setDecks]=useState<Deck[]>([]),[cards,setCards]=useState<Card[]>([]),[selected,setSelected]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [title,setTitle]=useState(''),[subject,setSubject]=useState('General'),[sourceText,setSourceText]=useState(''),[sources,setSources]=useState<SourceInput[]>([]),[mistakeText,setMistakeText]=useState(''),[count,setCount]=useState(12),[consent,setConsent]=useState(false),[revealed,setRevealed]=useState(false),[index,setIndex]=useState(0),[reviewTopic,setReviewTopic]=useState(''),[selectedOption,setSelectedOption]=useState<number|null>(null);
 const generate=useServerFn(generateFlashcards);
 const loadDecks=useCallback(async()=>{
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
 useEffect(()=>{void loadDecks();},[loadDecks]);
 useEffect(()=>{
   try {
     const raw=window.sessionStorage.getItem('studysmartly_flashcard_handoff');
     if(!raw)return;
     const handoff=JSON.parse(raw) as {title?:string;subject?:string;sourceText?:string;deckId?:string;topic?:string};
     let consumed = false;
     if(typeof handoff.deckId==='string'&&handoff.deckId){
       setSelected(handoff.deckId);
       setReviewTopic(typeof handoff.topic==='string'?handoff.topic:'');
       setSubject(typeof handoff.subject==='string'&&handoff.subject.trim()?handoff.subject:'General');
       setNotice('Your ' + (handoff.topic || handoff.subject || 'selected') + ' review session is ready.');
       consumed = true;
     }
     if(typeof handoff.sourceText==='string'&&handoff.sourceText.trim()){
       setTitle(typeof handoff.title==='string'&&handoff.title.trim()?handoff.title:'Lecture revision');
       setSubject(typeof handoff.subject==='string'&&handoff.subject.trim()?handoff.subject:'General');
       setSourceText(handoff.sourceText);
       setNotice('Lecture transcript loaded. Review the source and generate your Phase 3 flashcard deck.');
       consumed = true;
     }
     if(consumed) window.sessionStorage.removeItem('studysmartly_flashcard_handoff');
   } catch {
     setError('Could not load the lecture transcript. Paste it into the source notes field.');
   }
 },[]);
 const selectedDeck=decks.find(d=>d.id===selected);
 const due=useMemo(()=>cards.filter(c=>c.deck_id===selected&&new Date(c.due_at)<=new Date()&&(!reviewTopic||(c.topic||c.subject||'General')===reviewTopic)).sort((a,b)=>a.due_at.localeCompare(b.due_at)),[cards,selected,reviewTopic]);
 const current=due[index];

 async function createDeck(){
   setError('');setNotice('');setBusy(true);
   try{
     if(!title.trim())throw new Error('Enter a deck topic first.');
     if(!sourceText.trim()&&!sources.length&&!mistakeText)throw new Error('Paste notes, upload a PDF, or load mistakes from a completed Exam Arena test.');
     if(!consent)throw new Error('Confirm AI processing consent before generating cards.');
     await requireAISession();
     const combinedText=[sourceText.trim(),mistakeText].filter(Boolean).join('\n\nEXAM MISTAKE ANALYSIS\n');
     const result=await generate({data:{topic:title.trim(),subject:subject.trim()||'General',sourceText:combinedText,sources,count,consent:true}});
      if(result.success===false){setError(result.error);return;}
      const generated=result.data;
     const {data:auth}=await supabase.auth.getUser();if(!auth.user)throw new Error('Sign in again to save this deck.');
     const source=mistakeText?'mistake_analyzer':'ai_generated';
     const {data:deck,error:deckError}=await supabase.from('flashcard_decks').insert({user_id:auth.user.id,title:title.trim(),subject:subject.trim()||'General',source}).select('*').single();
     if(deckError)throw deckError;
     const rows=generated.cards.map(c=>({question:c.question,answer:c.answer,explanation:c.explanation,topic:c.topic,type:c.type,options:c.options,correct_option_index:c.correctOptionIndex,difficulty:c.difficulty,deck_id:deck.id,user_id:auth.user!.id,subject:subject.trim()||'General',due_at:nowIso(),interval_days:0,ease_factor:2.5,repetitions:0,lapses:0}));
     const {data:saved,error:saveError}=await supabase.from('flashcards').insert(rows).select('*');
     if(saveError){await supabase.from('flashcard_decks').delete().eq('id',deck.id).eq('user_id',auth.user.id);throw saveError;}
     setDecks(prev=>[deck as Deck,...prev]);setCards(prev=>[...(saved as Card[]),...prev]);setSelected(deck.id);setIndex(0);setRevealed(false);setTitle('');setSourceText('');setSources([]);setMistakeText('');setNotice(`Created ${saved.length} cards. Your first review is ready.`);
   }catch(e){setError(e instanceof Error?e.message:'Could not create flashcards.');}
   finally{setBusy(false);}
 }

 async function review(rating:ReviewRating){
   if(!current)return;setBusy(true);setError('');
   const now = new Date();
   const fsrsRating = fsrsRatings[rating];
   const previousFSRSCard = getFSRSCard(current, now);
   const nextFSRSCard = f.repeat(previousFSRSCard, now)[fsrsRating].card;
   const next = {
     due_at: nextFSRSCard.due.toISOString(),
     interval_days: nextFSRSCard.scheduled_days,
     repetitions: nextFSRSCard.reps,
     lapses: nextFSRSCard.lapses,
     fsrs_card: serializeFSRSCard(nextFSRSCard),
     last_reviewed_at: now.toISOString(),
     updated_at: now.toISOString(),
   };
   try{
     const {data:auth}=await supabase.auth.getUser();if(!auth.user)throw new Error('Sign in again to save this review.');
     const {data:reviewRow,error:reviewError}=await supabase.from('flashcard_reviews').insert({card_id:current.id,user_id:auth.user.id,rating:fsrsRating - 1,previous_interval_days:current.interval_days,next_interval_days:next.interval_days}).select('id').single();
     if(reviewError)throw reviewError;
     const {error:updateError}=await supabase.from('flashcards').update(next).eq('id',current.id).eq('user_id',auth.user.id);
     if(updateError){if(reviewRow?.id)await supabase.from('flashcard_reviews').delete().eq('id',reviewRow.id).eq('user_id',auth.user.id);throw updateError;}
     setCards(prev=>prev.map(c=>c.id===current.id?{...c,...next}:c));setRevealed(false);setSelectedOption(null);setIndex(i=>rating==='again'?Math.min(i+1,Math.max(0,due.length-1)):Math.min(i,Math.max(0,due.length-2)));
     setNotice(rating==='again'?'Marked Again · this card stays due for another attempt in this session.':`Reviewed · next review in ${next.interval_days} day${next.interval_days===1?'':'s'}.`);
   }catch(e){setError(e instanceof Error?e.message:'Could not save review.');}
   finally{setBusy(false);}
 }
 function explainWithAITutor(){
   if(!current)return;
   const prompt=`Explain this flashcard clearly, step by step, clearly, step by step.\nQuestion: ${current.question}\nAnswer: ${current.answer}\nAdditional explanation: ${current.explanation}\nSubject: ${current.subject}\nTopic: ${current.topic}`;
   try{window.sessionStorage.setItem('studysmartly_tutor_prompt',prompt);}catch{/* Navigation still works; user can paste the prompt manually. */}
   void navigate({to:'/tutor'});
 }
 const totalDue=cards.filter(c=>new Date(c.due_at)<=new Date()).length;
 return <div className="learning-workspace min-w-0 w-full">
  <header className="learning-heading min-w-0"><div className="min-w-0"><span className="workspace-eyebrow">LEARN / RETAIN</span><h1>Spaced Repetition Studio</h1><p className="text-sm text-text-muted mt-1">Build recall strength with short, scheduled reviews.</p></div><div className="rounded-xl border border-border bg-surface px-4 py-3 text-right shrink-0"><strong className="text-2xl tabular-nums">{totalDue}</strong><p className="text-xs text-text-muted">Due today</p></div></header>
  {error&&<div role="alert" className="learning-error break-words">{error}</div>}{notice&&<div role="status" className="rounded-xl bg-accent-500/10 text-accent-400 p-3 text-sm break-words">{notice}</div>}
  <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] gap-4 min-w-0">
   <div className="glass rounded-2xl p-4 sm:p-6 min-w-0 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 min-w-0"><h2 className="font-semibold flex items-center gap-2"><Brain size={18}/> Review session</h2>{selectedDeck&&<span className="text-xs text-text-muted break-words">{selectedDeck.title}{reviewTopic?' · '+reviewTopic:''}</span>}</div>
    {!selectedDeck?<p className="text-sm text-text-muted py-8 text-center">Create a deck to begin your first review.</p>:!current?<div className="text-center py-10"><Check className="mx-auto text-accent-400 mb-3" size={32}/><h3 className="font-semibold">You’re clear for now</h3><p className="text-sm text-text-muted mt-1">No cards from this deck are due. Come back when the next review is scheduled.</p></div>:<div className="space-y-5 min-w-0">
      <div className="flex flex-wrap justify-between gap-2 text-xs text-text-muted"><span>Card {index+1} of {due.length}</span><span>{current.topic||current.subject}</span></div>
      <div className="w-full min-h-56 sm:min-h-64 rounded-2xl border border-border bg-surface-hover/70 p-5 sm:p-8 flex flex-col justify-center text-center">
       <p className="text-xs uppercase tracking-wider text-accent-400 mb-4">{revealed?'BACK · ANSWER':'FRONT · QUESTION'}</p>
       <p className="text-lg sm:text-2xl font-semibold whitespace-pre-wrap break-words">{current.question}</p>
       {!revealed && current.type==='mcq' && <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">{(current.options||[]).map((option, optionIndex)=><Button key={optionIndex} type="button" variant="outline" disabled={busy} onClick={()=>{setSelectedOption(optionIndex);setRevealed(true);}} className="h-auto min-h-11 whitespace-normal text-left justify-start">{String.fromCharCode(65+optionIndex)}. {option}</Button>)}</div>}
       {!revealed && current.type!=='mcq' && <Button className="mt-5 w-full" onClick={()=>setRevealed(true)}>Reveal answer</Button>}
       {revealed && current.type==='mcq' && selectedOption!==null && <p role="status" className={selectedOption===current.correct_option_index?'mt-4 text-sm font-semibold text-emerald-400':'mt-4 text-sm font-semibold text-amber-400'}>{selectedOption===current.correct_option_index?'Correct answer.':'Not quite. The correct option is '+String.fromCharCode(65+(current.correct_option_index??0))+'.'}</p>}
       {revealed && <p className="mt-5 text-base sm:text-xl font-semibold whitespace-pre-wrap break-words">{current.answer}</p>}
       {revealed && current.explanation && <p className="text-sm text-text-muted mt-4 whitespace-pre-wrap break-words">{current.explanation}</p>}
      </div>
      {!revealed?<></>:<div className="space-y-3">
        <Button variant="outline" className="w-full" onClick={explainWithAITutor}><PencilRuler size={16}/>Explain with AI Tutor</Button>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button variant="outline" disabled={busy} onClick={()=>void review('again')} className="min-w-0">Again</Button>
          <Button variant="outline" disabled={busy} onClick={()=>void review('hard')} className="min-w-0">Hard</Button>
          <Button variant="outline" disabled={busy} onClick={()=>void review('good')} className="min-w-0">Good</Button>
          <Button variant="outline" disabled={busy} onClick={()=>void review('easy')} className="min-w-0">Easy</Button>
        </div>
      </div>}
      <div className="flex items-center justify-between gap-2"><Button variant="ghost" size="sm" disabled={index===0} onClick={()=>{setIndex(i=>i-1);setRevealed(false);setSelectedOption(null)}}><ChevronLeft size={16}/>Previous</Button><Button variant="ghost" size="sm" disabled={index>=due.length-1} onClick={()=>{setIndex(i=>i+1);setRevealed(false);setSelectedOption(null)}}>Next<ChevronRight size={16}/></Button></div>
    </div>}
   </div>
   <aside className="space-y-4 min-w-0">
    <div className="glass rounded-2xl p-4 sm:p-5 space-y-3 min-w-0"><h2 className="font-semibold flex items-center gap-2"><Sparkles size={18}/> Generate with AI</h2><input className="learning-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Deck topic (e.g. Cell division)"/><input className="learning-input" value={subject} onChange={e=>setSubject(e.target.value)} placeholder="Subject"/>
      <label className="block text-xs text-text-muted">Paste notes or textbook extracts<textarea className="learning-input mt-1 min-h-28" value={sourceText} onChange={e=>setSourceText(e.target.value)} placeholder="Paste source text to ground your flashcards."/></label>
      <div className="rounded-xl border border-border p-3 space-y-2"><p className="text-xs font-medium flex items-center gap-2"><UploadCloud size={15}/> Upload a PDF or study source</p><SourcePicker sources={sources} onChange={setSources}/></div>
      <div className="rounded-xl border border-border p-3 space-y-2"><p className="text-xs font-medium flex items-center gap-2"><Layers3 size={15}/> Use Exam Arena mistakes</p><p className="text-xs text-text-muted">Turn verified incorrect answers from saved Exam Arena attempts into revision cards.</p><Button type="button" variant="outline" className="w-full" onClick={()=>{const text=getMistakeSource();setMistakeText(text);if(text&&!title.trim())setTitle('Exam mistake revision');setNotice(text?'Loaded verified mistakes from your saved exams.':'No verified incorrect answers found in saved exam attempts.');}}><Brain size={15}/>Load my exam mistakes</Button>{mistakeText&&<p className="text-xs text-accent-400">Exam mistake source loaded.</p>}</div>
      <label className="block text-xs text-text-muted">Cards to generate<input className="learning-input mt-1" type="number" min="5" max="40" value={count} onChange={e=>setCount(Math.max(5,Math.min(40,Number(e.target.value)||5)))}/></label>
      <AIConsent consent={consent} onConsent={setConsent}/><Button className="w-full" disabled={busy||!title.trim()||(!sourceText.trim()&&!sources.length&&!mistakeText)} onClick={()=>void createDeck()}><Sparkles size={16}/>Generate deck</Button>{busy&&<InteractiveLoader/>}
    </div>
    <div className="glass rounded-2xl p-4 sm:p-5 min-w-0"><div className="flex items-center justify-between gap-2 mb-3"><h2 className="font-semibold flex items-center gap-2"><BookOpen size={18}/> Your decks</h2><Button variant="ghost" size="sm" onClick={()=>void loadDecks()}><RotateCcw size={15}/></Button></div>{loading?<p className="text-sm text-text-muted">Loading…</p>:decks.length===0?<p className="text-sm text-text-muted">No decks yet.</p>:<div className="space-y-2">{decks.map(d=><button key={d.id} onClick={()=>{setSelected(d.id);setIndex(0);setRevealed(false);setSelectedOption(null)}} className={`w-full min-w-0 text-left p-3 rounded-xl border break-words ${selected===d.id?'border-accent-500 bg-accent-500/10':'border-border hover:bg-surface-hover'}`}><span className="block text-sm font-medium break-words">{d.title}</span><span className="text-xs text-text-muted">{d.subject} · {cards.filter(c=>c.deck_id===d.id).length} cards</span></button>)}</div>}</div>
   </aside>
  </section>
 </div>;
}
