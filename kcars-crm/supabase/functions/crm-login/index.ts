import { createClient } from 'npm:@supabase/supabase-js@2.105.4'
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}
const response=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}})
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return response(405,{error:'Method not allowed'})
  if(Number(req.headers.get('content-length')||0)>4096)return response(413,{error:'请求过大'})
  let body
  try{const text=await req.text();if(text.length>4096)return response(413,{error:'请求过大'});body=JSON.parse(text)}catch{return response(400,{error:'请求格式错误'})}
  if(!body||typeof body!=='object'||Array.isArray(body))return response(400,{error:'请求格式错误'})
  const username=String(body.username||'').trim().toLowerCase(),password=body.password
  const denied=()=>response(401,{error:'用户名或密码不正确，或账号已停用'})
  if(!/^[a-z0-9_]{3,32}$/.test(username)||typeof password!=='string'||password.length>128)return denied()
  const url=Deno.env.get('SUPABASE_URL')!
  const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:allowed,error:limitError}=await service.rpc('crm_allow_login',{p_username:username})
  if(limitError)return response(503,{error:'登录暂时不可用，请稍后重试'})
  if(!allowed)return response(429,{error:'尝试次数过多，请 15 分钟后再试'})
  const {data:member}=await service.from('crm_members').select('user_id').eq('username',username).eq('enabled',true).maybeSingle()
  if(!member)return denied()
  const {data:{user},error}=await service.auth.admin.getUserById(member.user_id)
  if(error||!user?.email)return denied()
  const auth=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data,error:loginError}=await auth.auth.signInWithPassword({email:user.email,password})
  if(loginError||!data.session)return denied()
  return response(200,{access_token:data.session.access_token,refresh_token:data.session.refresh_token})
})
