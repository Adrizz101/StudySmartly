import { createClient } from '@supabase/supabase-js';
export async function authorizeImage(request: Request) {
  const url=process.env['SUPABASE_URL'], key=process.env['SUPABASE_PUBLISHABLE_KEY'];
  const token=request.headers.get('authorization')?.replace(/^Bearer /,'');
  if(!url||!key||!token)return new Response('Sign in before generating images.',{status:401});
  const client=createClient(url,key,{auth:{persistSession:false},global:{fetch:(input,init)=>{const headers=new Headers(init?.headers);if(key.startsWith('sb_'))headers.delete('Authorization');headers.set('apikey',key);return fetch(input,{...init,headers});}}});
  const {data,error}=await client.auth.getUser(token);
  if(error||!data.user)return new Response('Your session has expired. Sign in again.',{status:401});
  return null;
}