import { createFileRoute } from '@tanstack/react-router';
import { generateImage } from '@/lib/image-gateway.server';
import { authorizeImage } from '@/lib/image-auth.server';
export const Route=createFileRoute('/api/generate-image')({server:{handlers:{POST:async({request})=>{
  const denied=await authorizeImage(request);if(denied)return denied;
  const body=await request.json() as {prompt?:string;consent?:boolean;stream?:boolean};
  if(!body.prompt?.trim()||body.prompt.length>10000||body.consent!==true)return new Response('A prompt and consent are required.',{status:400});
  const apiKey=process.env['OPENAI_API_KEY'];if(!apiKey)return new Response('AI image generation is not configured.',{status:503});
  const response=await generateImage({baseURL:'https://api.openai.com',apiKey,model:'gpt-image-1',format:'openai'},body.prompt,body.stream!==false);
  const headers=new Headers({'Content-Type':response.headers.get('content-type')??'application/json','Cache-Control':'no-store'});
  return new Response(response.body,{status:response.status,headers});
}}}});
