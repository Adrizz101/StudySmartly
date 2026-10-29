import { useState, useRef } from 'react';
import { Excalidraw, convertToExcalidrawElements, exportToBlob } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { useServerFn } from '@tanstack/react-start';
import { Sparkles, Download, Moon, Sun, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { explainBoard } from '@/lib/learning-ai.functions';
import { load, save } from '@/lib/storage';
import { dataURL } from '@/lib/source-files';
import type { SourceInput } from '@/lib/learning-models';
import { AIConsent, requireAISession } from './AIConsent';
import { SourcePicker } from './SourcePicker';

export default function DrawingBoard() {
  const [api,setApi] = useState<ExcalidrawImperativeAPI|null>(null), [prompt,setPrompt] = useState('');
  const [sources,setSources] = useState<SourceInput[]>([]), [consent,setConsent] = useState(false), [busy,setBusy] = useState(false), [error,setError] = useState('');
  const [dark,setDark] = useState(false), [messages,setMessages] = useState<{question:string;answer:string;citations:string[]}[]>(()=>load('board-discussion',[]));
  const explain=useServerFn(explainBoard), initial=useRef(load('whiteboard',null));
  async function ask() {
    if(!api || !prompt.trim())return; setError('');setBusy(true);
    try {
      if(!consent)throw new Error('Consent to AI processing before continuing.');await requireAISession();
      const elements=api.getSceneElements(), selected=api.getAppState().selectedElementIds;
      const selection=elements.filter(e=>selected[e.id]);
      const blob=await exportToBlob({elements,appState:{...api.getAppState(),exportBackground:true},files:api.getFiles(),mimeType:'image/png'});
      const image=await dataURL(new File([blob],'student-board.png',{type:'image/png'}));
      const result=await explain({data:{prompt,board:JSON.stringify(selection.length?selection:elements),history:messages.slice(-6).map(m=>`${m.question}\n${m.answer}`).join('\n'),sources:[...sources,{name:'Student whiteboard',text:'Student drawing; inspect selected objects and image.',images:[image]}],consent:true}});
      const offset=selection.length?0:Math.max(0,...elements.map(e=>e.y+e.height))+60;
      const ink=getComputedStyle(document.documentElement).getPropertyValue('--board-tutor').trim();
      const added=convertToExcalidrawElements(result.elements.map((e):any=>{const text=e.type==='text'?e.text.replace(/[$\\]/g,'').replace(/\\\\?\((.*?)\\\\?\)/g,'$1').trim():'';const lineCount=Math.max(1,Math.ceil(text.length/28));const textWidth=Math.min(520,Math.max(180,Math.min(28,text.length)*10+36));const textHeight=Math.max(48,lineCount*28+20);return {type:e.type,x:e.x,y:e.y+offset,width:e.type==='text'?textWidth:Math.max(1,Math.abs(e.width)),height:e.type==='text'?textHeight:Math.max(1,Math.abs(e.height)),strokeColor:ink,...(e.type==='text'?{text,fontSize:20,autoResize:true}:{ }),...(e.type==='arrow'||e.type==='line'?{points:[[0,0],[e.width,e.height]] as [number,number][]}:{})};}));
      const all=[...elements];
      for(const element of added) {
        all.push(element);api.updateScene({elements:[...all]});
        await new Promise(resolve=>setTimeout(resolve,window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:80));
      }
      api.scrollToContent(added,{fitToContent:true});
      const next=[...messages,{question:prompt,answer:result.explanation,citations:result.citations}];setMessages(next);save('board-discussion',next);setPrompt('');
    } catch(e){setError(e instanceof Error?e.message:'Could not explain this board.');}finally{setBusy(false);}
  }
  return <div className="learning-workspace"><header className="learning-heading"><div><span className="workspace-eyebrow">EXPLORE / WHITEBOARD</span><h1>Visual Whiteboard</h1></div><div className="flex gap-2"><Button variant="outline" size="icon" aria-label="Toggle board theme" onClick={()=>setDark(!dark)}>{dark?<Sun/>:<Moon/>}</Button><Button variant="outline" size="icon" aria-label="Download board" onClick={async()=>{if(!api)return;const b=await exportToBlob({elements:api.getSceneElements(),appState:api.getAppState(),files:api.getFiles(),mimeType:'image/png'});const url=URL.createObjectURL(b),a=document.createElement('a');a.href=url;a.download='StudySmart-whiteboard.png';a.click();URL.revokeObjectURL(url);}}><Download/></Button><Button variant="outline" size="icon" aria-label="Clear board" onClick={()=>{if(window.confirm('Clear the entire board and chat?')){api?.resetScene();setMessages([]);localStorage.removeItem('studysmart:board-discussion');}}}><Trash2/></Button></div></header>
    <div className="whiteboard-workspace"><div className="drawing-surface"><Excalidraw excalidrawAPI={setApi} initialData={initial.current} theme={dark?'dark':'light'} onChange={(elements,_state,files)=>save('whiteboard',{elements,files})} /></div><aside className="board-copilot"><div className="flex gap-2 items-center text-sm font-semibold"><Sparkles size={17}/>Visual tutor</div><div className="board-discussion">{messages.map((m,i)=><div key={i} className="board-message"><strong>{m.question}</strong><p className="whitespace-pre-wrap">{m.answer}</p>{m.citations.length>0&&<small>{m.citations.join(' · ')}</small>}</div>)}</div><textarea className="learning-input min-h-24" aria-label="Whiteboard question" placeholder="Explain a topic, my drawing, or a selected step…" value={prompt} onChange={e=>setPrompt(e.target.value)}/><Button className="w-full mt-2" disabled={busy||!prompt.trim()} onClick={ask}><Sparkles/>{busy?'Drawing explanation…':'Explain on board'}</Button><div className="mt-4"><SourcePicker sources={sources} onChange={setSources}/></div><AIConsent consent={consent} onConsent={setConsent}/>{error&&<p role="alert" className="learning-error">{error}</p>}</aside></div>
  </div>;
}
