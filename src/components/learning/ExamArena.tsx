import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { Sparkles, Clock, Flag, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { prepareExam, analyzeExamMistakes } from '@/lib/learning-ai.functions';
import { type Exam, type Attempt, type SourceInput, type MistakeAnalysis, canGrade, scoreExam, diagnose } from '@/lib/learning-models';
import { load, save } from '@/lib/storage';
import { AIConsent, requireAISession } from './AIConsent';
import { SourcePicker } from './SourcePicker';
import InteractiveLoader from '@/components/ui/InteractiveLoader';

const letters=['A','B','C','D'];
export default function ExamArena(){
  const [sources,setSources]=useState<SourceInput[]>([]),[prompt,setPrompt]=useState(''),[key,setKey]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [exam,setExam]=useState<Exam|null>(null),[answers,setAnswers]=useState<Record<number,number>>({}),[index,setIndex]=useState(0),[review,setReview]=useState<number[]>([]),[result,setResult]=useState<Attempt|null>(null);
  const [analysis,setAnalysis]=useState<MistakeAnalysis|null>(null),[analysisBusy,setAnalysisBusy]=useState(false),[analysisError,setAnalysisError]=useState('');
  const [minutes,setMinutes]=useState(30),[deadline,setDeadline]=useState<number|null>(null),[seconds,setSeconds]=useState(0),[attempts,setAttempts]=useState<Attempt[]>(()=>load('exam-attempts',[]));
  const prepare=useServerFn(prepareExam),analyze=useServerFn(analyzeExamMistakes),navigate=useNavigate();
  function submit(){if(!exam||result)return;const a={id:crypto.randomUUID(),exam,answers,submittedAt:Date.now()};setResult(a);setDeadline(null);setAttempts(prev=>{const next=[a,...prev];save('exam-attempts',next);return next;});}
  useEffect(()=>{if(!deadline)return;const tick=()=>{const left=Math.max(0,Math.ceil((deadline-Date.now())/1000));setSeconds(left);if(!left)submit();};tick();const t=setInterval(tick,1000);return()=>clearInterval(t);},[deadline,answers,exam,result]);
  async function create(){setError('');setBusy(true);try{if(!consent)throw new Error('Consent to AI processing before continuing.');await requireAISession();const r=await prepare({data:{prompt:prompt||'Extract the MCQ past-paper questions from my uploaded sources.',sources,key,consent:true}});if(!r.questions.some(canGrade))throw new Error('No questions passed verification. Add a clearer paper or an answer key.');setExam(r);setAnswers({});setIndex(0);setReview([]);setResult(null);setDeadline(null);}catch(e){setError(e instanceof Error?e.message:'Could not prepare this test.');}finally{setBusy(false);}}


  async function runMistakeAnalysis(){
    if(!result)return;
    setAnalysisError('');setAnalysisBusy(true);
    try{
      if(!consent)throw new Error('Parent/guardian consent is required before sending study content to AI.');
      await requireAISession();
      const answers=Object.fromEntries(Object.entries(result.answers).map(([k,v])=>[String(k),v]));
      const report=await analyze({data:{prompt:'Analyse my exam mistakes',sources:[],consent:true,attempt:{exam:result.exam,answers}}});
      setAnalysis(report);
    }catch(e){setAnalysisError(e instanceof Error?e.message:'Could not analyse this attempt.');}
    finally{setAnalysisBusy(false);}
  }
  const score=result?scoreExam(result.exam,result.answers):null,q=exam?.questions[index], weaknesses=diagnose(attempts);
  return <div className="learning-workspace motion-stagger"><header className="learning-heading"><div><span className="workspace-eyebrow">PRACTISE / EXAM ARENA</span><h1>PYQ Exam Arena</h1></div>{exam&&<Button variant="outline" onClick={()=>{if(!deadline||window.confirm('Leave this test?')){setExam(null);setResult(null);setDeadline(null);}}}>New test</Button>}</header>
    {error&&<div role="alert" className="learning-error">{error}</div>}
    {(busy||analysisBusy)&&<InteractiveLoader />}
    {!exam?<div className="exam-setup motion-card"><div className="space-y-4"><h2 className="text-lg font-semibold">Create a past-paper test</h2><SourcePicker sources={sources} onChange={setSources}/><textarea className="learning-input min-h-28" aria-label="Past paper questions" placeholder="Paste MCQs, or add a past-paper PDF above…" value={prompt} onChange={e=>setPrompt(e.target.value)}/><textarea className="learning-input" aria-label="Official answer key" placeholder="Answer key (optional): 1-B, 2-D… Include the paper/year." value={key} onChange={e=>setKey(e.target.value)}/><label className="block text-xs text-text-muted">Test duration (minutes)<input className="learning-input mt-1" type="number" min="1" aria-label="Test duration" value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/></label><AIConsent consent={consent} onConsent={setConsent}/><Button disabled={busy||(!prompt.trim()&&!sources.length)} onClick={create}><Sparkles/>{busy?'Solving and independently verifying…':'Prepare verified MCQs'}</Button></div><div className="subject-diagnostics motion-card"><h2 className="text-lg font-semibold mb-4">Subject insights</h2>{attempts.length===0?<p className="text-text-muted text-sm">No submitted tests yet.</p>:weaknesses.map((w,i)=><div className="diagnostic-row" key={i}><strong>{w.subject} / {w.concept}</strong><p>{w.chapter} · {w.correct}/{w.total} correct · {w.total<3?'Limited evidence':w.correct/w.total<.6?'Needs revision':'Developing mastery'}</p></div>)}{attempts.map(a=><Button className="motion-card" key={a.id} variant="ghost" className="w-full justify-between mt-3" onClick={()=>{setExam(a.exam);setAnswers(a.answers);setResult(a);setIndex(0);}}>{a.exam.title}<span>{scoreExam(a.exam,a.answers).percentage}%</span></Button>)}</div></div>:<>
    <div className="exam-bar"><h2>{exam.title}</h2>{deadline?<span className="flex items-center gap-2"><Clock size={17}/>{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</span>:!result&&<Button disabled={!Number.isFinite(minutes)||minutes<1} onClick={()=>setDeadline(Date.now()+minutes*60000)}>Start timed test</Button>}{!result&&deadline&&<Button onClick={()=>{if(window.confirm('Submit your answers?'))submit();}}><Check/>Submit test</Button>}</div>
    {!deadline&&!result?<div className="py-6"><p className="text-sm text-text-muted">{exam.questions.filter(canGrade).length} verified questions · {exam.questions.filter(q=>!canGrade(q)).length} excluded from scoring</p></div>:<div className="exam-body"><aside className="question-palette">{exam.questions.map((question,i)=><Button key={i} variant="outline" className={`${i===index?'selected':''} ${answers[i]!==undefined?'answered':''}`} onClick={()=>setIndex(i)} aria-label={`Question ${i+1}`}>{i+1}{review.includes(i)&&<Flag size={10}/>}</Button>)}</aside><div className="question-sheet">{q&&<><div className="flex items-center justify-between text-xs text-text-muted"><span>{q.subject} / {q.chapter} / {q.concept}</span><span>{index+1} / {exam.questions.length}</span></div><h3 className="text-xl font-semibold my-6 whitespace-pre-wrap">{q.question}</h3>{!canGrade(q)&&<p className="learning-error">Uncertain answer — excluded from scoring.</p>}<div className="space-y-3">{q.options.map((option,i)=><label key={i} className={`exam-option ${answers[index]===i?'marked':''} ${result&&q.correct===i&&canGrade(q)?'correct':''}`}><input type="radio" name={`question-${index}`} checked={answers[index]===i} disabled={Boolean(result)||!canGrade(q)} onChange={()=>setAnswers({...answers,[index]:i})}/><span className="option-letter">{letters[i]}</span><span>{option}</span></label>)}</div>
    {result?<section className="solution"><div className="flex gap-6 text-sm"><strong>Correct: {canGrade(q)?letters[q.correct??0]:'Unverified'}</strong><span>Your answer: {answers[index]===undefined?'Unattempted':letters[answers[index]??0]}</span></div><h4 className="font-semibold mt-4">Solution</h4><ol className="list-decimal pl-5 mt-2 space-y-2">{q.steps.map((s,i)=><li key={i}>{s}</li>)}</ol><h4 className="font-semibold mt-4">Option analysis</h4>{q.distractors.map((d,i)=><p key={i} className="text-sm mt-2">{d}</p>)}<p className="text-xs text-text-muted mt-4">Evidence: {q.evidence}</p></section>:<Button variant="ghost" className="mt-4" onClick={()=>setReview(review.includes(index)?review.filter(i=>i!==index):[...review,index])}><Flag/>{review.includes(index)?'Remove review flag':'Mark for review'}</Button>}
    <div className="flex justify-between mt-6"><Button variant="outline" disabled={!index} onClick={()=>setIndex(index-1)}><ChevronLeft/>Previous</Button><Button variant="outline" disabled={index===exam.questions.length-1} onClick={()=>setIndex(index+1)}>Next<ChevronRight/></Button></div></>}</div></div>}
    {score&&<section className="exam-results motion-card"><h2 className="text-2xl font-semibold">{score.percentage}% <span className="text-base text-text-muted">/ {score.correct} of {score.total} correct</span></h2><p className="text-sm text-text-muted mt-2">{score.incorrect} incorrect · {score.unattempted} unattempted · {score.excluded} unverified, excluded</p><h3 className="text-lg font-semibold mt-8">Subject-by-subject weak points</h3>{diagnose([result as Attempt]).map((w,i)=><div className="diagnostic-row" key={i}><div><strong>{w.subject} · {w.concept}</strong><p>{w.chapter} — {w.correct}/{w.total} correct. {w.total<3?'Too few questions for a reliable mastery estimate.':''}</p>{w.wrong.length>0&&<p className="mt-2">Revise: {w.wrong[0]}</p>}</div><div className="flex gap-2 mt-3"><Button variant="outline" size="sm" onClick={()=>{save('learning-bridge',{topic:`Explain ${w.concept} in ${w.subject}`});navigate({to:'/tutor'});}}>Explain on whiteboard</Button><Button variant="outline" size="sm" onClick={()=>{save('learning-bridge',{topic:`Create a presentation on ${w.concept} in ${w.subject}`});navigate({to:'/studio'});}}>Create revision deck</Button></div></div>)}</section>}

    {score&&<section className="exam-results mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="text-lg font-semibold">AI mistake analysis</h3><p className="text-sm text-text-muted">Identify patterns behind incorrect answers and get targeted practice.</p></div><AIConsent consent={consent} onConsent={setConsent}/>
        <Button onClick={runMistakeAnalysis} disabled={analysisBusy||score.incorrect===0}><Sparkles/>{analysisBusy?'Analysing…':analysis?'Refresh analysis':'Analyse my mistakes'}</Button>
      </div>
      {!consent&&<p className="text-xs text-text-muted mt-2">AI analysis requires the consent checkbox above. If you are under 18, parent/guardian consent is required.</p>}
      {analysisError&&<p role="alert" className="learning-error mt-3">{analysisError}</p>}
      {analysis&&<div className="mt-5 space-y-5">
        <p>{analysis.summary}</p>
        {analysis.strengths.length>0&&<div><h4 className="font-semibold">What went well</h4><ul className="list-disc pl-5 mt-2">{analysis.strengths.map((s,i)=><li key={i}>{s}</li>)}</ul></div>}
        {analysis.findings.map((f,i)=><article className="diagnostic-row" key={i}>
          <div className="flex flex-wrap items-center justify-between gap-2"><strong>{f.subject} · {f.concept}</strong><span className="text-xs text-text-muted">{f.chapter} · {f.pattern.replaceAll('_',' ')}</span></div>
          <p className="text-sm mt-2">{f.evidence}</p><p className="mt-2">{f.explanation}</p>
          <h5 className="font-semibold mt-3">Next steps</h5><ol className="list-decimal pl-5 mt-1">{f.next_steps.map((step,j)=><li key={j}>{step}</li>)}</ol>
        </article>)}
        {analysis.practice.length>0&&<div><h4 className="font-semibold">Targeted practice</h4>{analysis.practice.map((p,i)=><article className="diagnostic-row mt-3" key={i}><strong>{i+1}. {p.question}</strong><p className="text-xs text-text-muted mt-1">{p.concept}</p><ol className="list-[upper-alpha] pl-5 mt-2">{p.options.map((o,j)=><li key={j}>{o}</li>)}</ol><details className="mt-3"><summary className="cursor-pointer text-sm font-medium">Show answer and explanation</summary><p className="mt-2 text-sm">Answer: {['A','B','C','D'][p.correct]}. {p.explanation}</p></details></article>)}</div>}
      </div>}
    </section>}
    </>}
  </div>;
}