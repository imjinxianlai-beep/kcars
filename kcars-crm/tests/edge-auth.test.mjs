import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
async function handler(name,createClient){
  const source=await fs.readFile(new URL(`../supabase/functions/${name}/index.ts`,import.meta.url),'utf8')
  let handle
  const Deno={env:{get:key=>key==='SUPABASE_URL'?'https://example.invalid':key},serve:fn=>{handle=fn}}
  new Function('Deno','createClient',stripTypeScriptTypes(source.replace(/^import .*\n/,'')))(Deno,createClient)
  return body=>handle(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer test-only','Content-Type':'application/json'},body:JSON.stringify(body)}))
}
const accountClient=(role='admin',memberError=null)=>{
  const calls=[]
  const client={auth:{getUser:async()=>({data:{user:{id:'owner'}},error:null}),admin:{
    createUser:async input=>{calls.push(['create',input.email]);return {data:{user:{id:'new-operator'}}}},
    deleteUser:async id=>{calls.push(['delete',id]);return {error:null}}
  }},rpc:async()=>({data:role}),from:table=>({insert:async input=>{calls.push([table,input]);return {error:table==='crm_members'?memberError:null}}})}
  return {client,calls}
}
test('account endpoint rejects an operator even with a valid auth token',async()=>{
  const {client,calls}=accountClient('operator');const run=await handler('crm-account',()=>client)
  assert.equal((await run({username:'someone',password:'test-only-password'})).status,403);assert.equal(calls.length,0)
})
test('account endpoint assigns only operator role and never records passwords in membership',async()=>{
  const {client,calls}=accountClient();const run=await handler('crm-account',()=>client)
  assert.equal((await run({username:'Someone',password:'test-only-password',role:'admin'})).status,200)
  assert.equal(calls.find(c=>c[0]==='crm_members')[1].role,'operator')
  assert.equal(JSON.stringify(calls).includes('test-only-password'),false)
})
test('account failure removes the newly created orphan identity',async()=>{
  const {client,calls}=accountClient('admin',{message:'database error'});const run=await handler('crm-account',()=>client)
  assert.equal((await run({username:'someone',password:'test-only-password'})).status,500)
  assert.deepEqual(calls.find(c=>c[0]==='delete'),['delete','new-operator'])
})
const loginClient=({enabled=true,allowed=true}={})=>{
  const calls=[]
  const chain={select(){return this},eq(){return this},async maybeSingle(){return {data:enabled?{user_id:'owner'}:null}}}
  const client={rpc:async()=>({data:allowed}),from:()=>chain,auth:{admin:{getUserById:async()=>({data:{user:{email:'owner@example.invalid'}}})},signInWithPassword:async input=>{calls.push(input.email);return {data:{session:{access_token:'test-access',refresh_token:'test-refresh'}}}}}}
  return {client,calls}
}
test('username login maps owner to existing auth identity without a second password store',async()=>{
  const {client,calls}=loginClient();const run=await handler('crm-login',()=>client)
  const res=await run({username:'OWNER',password:'test-only-password'})
  assert.equal(res.status,200);assert.deepEqual(await res.json(),{access_token:'test-access',refresh_token:'test-refresh'});assert.deepEqual(calls,['owner@example.invalid'])
})
test('disabled accounts and rate-limited usernames cannot attempt auth',async()=>{
  for(const [options,status] of [[{enabled:false},401],[{allowed:false},429]]){
    const {client,calls}=loginClient(options);const run=await handler('crm-login',()=>client)
    assert.equal((await run({username:'someone',password:'test-only-password'})).status,status);assert.equal(calls.length,0)
  }
})
test('malformed JSON shapes return a controlled error',async()=>{
  const {client}=accountClient();for(const name of ['crm-account','crm-login']){
    const run=await handler(name,()=>client);assert.equal((await run(null)).status,400);assert.equal((await run([])).status,400)
  }
})
