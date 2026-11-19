import { createClient } from 'npm:@supabase/supabase-js@2.105.4'

const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS' }
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {status,headers:{...cors,'Content-Type':'application/json'}})
Deno.serve(async req => {
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return reply(405,{error:'Method not allowed'})
  const authorization=req.headers.get('Authorization')||''
  if(!authorization.startsWith('Bearer '))return reply(401,{error:'请先登录'})
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!
  const caller=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}})
  const {data:{user},error:authError}=await caller.auth.getUser()
  if(authError||!user)return reply(401,{error:'登录已过期'})
  const {data:role,error:roleError}=await caller.rpc('crm_my_role')
  if(roleError||role!=='admin')return reply(403,{error:'仅管理员可创建账号'})
  if(Number(req.headers.get('content-length')||0)>4096)return reply(413,{error:'请求过大'})
  let payload
  try { const body=await req.text();if(body.length>4096)return reply(413,{error:'请求过大'});payload=JSON.parse(body) }
  catch { return reply(400,{error:'请求格式错误'}) }
  if(!payload||typeof payload!=='object'||Array.isArray(payload))return reply(400,{error:'请求格式错误'})
  const username=String(payload.username||'').trim().toLowerCase(),password=payload.password
  if(!/^[a-z0-9_]{3,32}$/.test(username)||typeof password!=='string'||password.length<8||password.length>128)return reply(400,{error:'请检查用户名和密码长度'})
  const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})
  // No password is logged or persisted by application code. Auth stores its hash.
  const {data,error}=await admin.auth.admin.createUser({email:`${username}@users.kcars.invalid`,password,email_confirm:true})
  if(error||!data.user)return reply(400,{error:'账号未创建，用户名可能已存在'})
  const {error:memberError}=await admin.from('crm_members').insert({user_id:data.user.id,username,role:'operator'})
  if(memberError){await admin.auth.admin.deleteUser(data.user.id);return reply(500,{error:'账号权限保存失败，请稍后重试'})}
  await admin.from('crm_import_events').insert({actor:user.id,action:'member_created',detail:{user_id:data.user.id,username,role:'operator'}})
  return reply(200,{username,role:'operator'})
})
