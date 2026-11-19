import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
const admin='00000000-0000-4000-8000-000000000001',operator='00000000-0000-4000-8000-000000000002',outsider='00000000-0000-4000-8000-000000000003'
const db=new PGlite()
const role=async(user=operator,dbRole='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec(`set role ${dbRole}`)}
const rpc=async(name,args=[])=>{const {rows}=await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args);return rows[0].result}
const line=(no='TEST001',patch={})=>({source:'kcars',file:'K Cars.xlsx',sheet:'October',row:2,invoice_no:no,date:'2026-10-01',customer:'Test Customer',plate:'SAA1234Z',make:'Toyota',model:'WISH',advisor:'JON',mechanic:'TAO',description:'Gearbox overhaul',qty:1,unit_price:2000,amount:2000,...patch})
const batchFiles=id=>['kcars','oneworld'].map(source=>({source,name:source+'.xlsx',path:`${operator}/${id}/${source}.xlsx`,sha256:'a'.repeat(64)}))
async function prepare(lines){
  const id=crypto.randomUUID(),files=batchFiles(id)
  await role(operator)
  for(const f of files)await db.query("insert into storage.objects(bucket_id,name) values('crm-imports',$1)",[f.path])
  await rpc('crm_prepare_import',[id,JSON.stringify(files),JSON.stringify(lines),0]);return id
}
test('handover permissions and transactional imports',async t=>{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
    create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text unique);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated;grant all on storage.objects to anon,authenticated;
    create policy legacy_storage_open on storage.objects for all using(true) with check(true);
    insert into auth.users values('${admin}','owner@test.invalid',now()),('${operator}','operator@test.invalid',now()),('${outsider}','outsider@test.invalid',now());`)
  await db.exec(await fs.readFile(new URL('./fixtures/crm-schema.sql',import.meta.url),'utf8'))
  await db.exec(`create policy old_open on public.invoices for all using(true) with check(true);
    grant all on all tables in schema public to anon,authenticated;
    create table public.backup_invoices_old as table public.invoices;grant all on public.backup_invoices_old to anon,authenticated;
    create view public.old_unprotected_view as select * from public.customers;grant all on public.old_unprotected_view to anon,authenticated;
    create function public.old_dangerous_rpc() returns void language sql security definer as $$ delete from public.customers $$;
    grant execute on function public.old_dangerous_rpc() to anon,authenticated;
    select set_config('kcars.bootstrap_admin_email','owner@test.invalid',false);`)
  await db.exec(await fs.readFile(new URL('../supabase/migrations/20261119_handover.sql',import.meta.url),'utf8'))
  await db.exec(`insert into public.crm_members(user_id,username,role) values('${operator}','operator','operator');
    create function public.lock_paid_lines_test() returns trigger language plpgsql as $$ begin
      if exists(select 1 from public.invoices where id=new.invoice_id and status='paid') then raise exception 'Paid invoice lines are locked';end if;return new;end $$;
    create trigger lock_paid_test before insert on public.invoice_items for each row execute function public.lock_paid_lines_test();`)
  await t.test('anonymous and unassigned accounts cannot read, import or invoke old privileged RPCs',async()=>{
    await role(outsider,'anon');await assert.rejects(db.query('select * from public.invoices'),/permission denied/)
    await assert.rejects(rpc('crm_commit_import',[crypto.randomUUID()]),/permission denied/)
    await role(outsider);assert.equal(await rpc('crm_my_role'),null)
    assert.equal((await db.query('select * from public.invoices')).rows.length,0)
    await assert.rejects(rpc('crm_commit_import',[crypto.randomUUID()]),/未获授权/)
    await assert.rejects(rpc('old_dangerous_rpc'),/permission denied/)
    await assert.rejects(db.query('select * from public.backup_invoices_old'),/permission denied/)
    await assert.rejects(db.query('select * from public.old_unprotected_view'),/permission denied/)
  })
  let id
  await t.test('discount, zero-price lines and missing plates persist in preview; confirmation imports atomically',async()=>{
    id=await prepare([line(),line('TEST001',{row:3,description:'Discount',unit_price:-100,amount:-100}),line('TEST001',{row:4,description:'Alignment FOC',unit_price:0,amount:0}),line('TEST002',{row:5,plate:''})])
    assert.equal((await db.query('select * from public.invoices')).rows.length,0)
    const preview=(await db.query('select status from public.crm_import_entries order by invoice_no')).rows
    assert.deepEqual(preview.map(x=>x.status),['ready','hold'])
    const result=await rpc('crm_commit_import',[id]);assert.deepEqual(result,{invoices:1,items:3,total:1900,held:1})
    const invoice=(await db.query("select * from public.invoices where invoice_no='TEST001'")).rows[0]
    assert.equal(invoice.status,'paid');assert.equal(invoice.work_status,'paid');assert.equal(Number(invoice.total),1900)
    assert.ok(invoice.customer_id&&invoice.vehicle_id)
  })
  await t.test('operator cannot directly change CRM, batches, roles, history, original files or account access',async()=>{
    await role(operator)
    await assert.rejects(db.query("insert into public.customers(name,car_plate) values('Bad','BAD1')"),/row-level security/)
    assert.equal((await db.query("update public.invoices set total=1 returning id")).rows.length,0)
    assert.equal((await db.query('delete from public.invoice_items returning id')).rows.length,0)
    await assert.rejects(db.query("update public.crm_members set role='admin'"),/permission denied/)
    await assert.rejects(db.query("update public.crm_import_entries set status='ready'"),/permission denied/)
    await assert.rejects(db.query('delete from public.crm_import_events'),/permission denied/)
    await assert.rejects(rpc('crm_set_member',[admin,false]),/仅管理员/)
    assert.equal((await db.query("delete from storage.objects where bucket_id='crm-imports' returning name")).rows.length,0)
    assert.equal((await db.query("update storage.objects set name='changed' where bucket_id='crm-imports' returning name")).rows.length,0)
  })
  await t.test('repeated confirmation and repeated uploads never duplicate invoices or items',async()=>{
    assert.equal((await rpc('crm_commit_import',[id])).invoices,0)
    const repeat=await prepare([line()]);assert.equal((await rpc('crm_commit_import',[repeat])).invoices,0)
    assert.equal((await db.query('select count(*)::int as n from public.invoice_items')).rows[0].n,3)
  })
  await t.test('missing plate can be completed later without overwriting an imported entry',async()=>{
    const entry=(await db.query("select id from public.crm_import_entries where invoice_no='TEST002'")).rows[0].id
    await rpc('crm_fix_import_plate',[entry,' SBB 1234 Z ']);assert.equal((await rpc('crm_commit_import',[id])).invoices,1)
    await assert.rejects(rpc('crm_fix_import_plate',[entry,'SCC1234Z']),/只能补充/)
  })
  await t.test('malformed inputs, amount inconsistencies and cross-sheet duplication cannot silently import',async()=>{
    const bad=await prepare([line('BAD001',{amount:1}),line('BAD002',{row:3,qty:null}),line('BAD003',{row:4}),line('BAD003',{sheet:'Another',row:2})])
    assert.equal((await rpc('crm_commit_import',[bad])).invoices,0)
    await assert.rejects(prepare([line('BADDATE',{date:'2026-02-31'})]),/date|日期|不合法/)
    await assert.rejects(prepare([line('BADLIMIT',{amount:100000001})]),/范围/)
  })
  await t.test('another importer cannot commit a batch belonging to someone else',async()=>{
    await role(admin);await db.exec('reset role');await db.query("insert into public.crm_members(user_id,username,role) values($1,'other','operator')",[outsider]);await role(outsider)
    await assert.rejects(rpc('crm_commit_import',[id]),/没有权限/)
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('crm-imports',$1)",[`${operator}/${crypto.randomUUID()}/kcars.xlsx`]),/row-level security/)
  })
  await t.test('revoking access takes effect on subsequent API calls even with an existing login',async()=>{
    await role(admin);await rpc('crm_set_member',[operator,false]);await role(operator)
    assert.equal(await rpc('crm_my_role'),null);assert.equal((await db.query('select * from public.invoices')).rows.length,0)
    await assert.rejects(rpc('crm_commit_import',[id]),/未获授权/)
    await role(admin);await rpc('crm_set_member',[operator,true])
  })
  await t.test('a failure after parent writes rolls back every row, then retry succeeds',async()=>{
    const failBatch=await prepare([line('ROLLBACK',{plate:'SCC9999Z',customer:'Rollback customer'})])
    await db.exec('reset role');await db.exec("alter table public.invoice_items add constraint test_failure check(description<>'Gearbox overhaul') not valid");await role(operator)
    const before=(await db.query('select count(*)::int as n from public.customers')).rows[0].n
    await assert.rejects(rpc('crm_commit_import',[failBatch]),/test_failure/)
    assert.equal((await db.query("select * from public.invoices where invoice_no='ROLLBACK'")).rows.length,0)
    assert.equal((await db.query('select count(*)::int as n from public.customers')).rows[0].n,before)
    await db.exec('reset role');await db.exec('alter table public.invoice_items drop constraint test_failure');await role(operator)
    assert.equal((await rpc('crm_commit_import',[failBatch])).invoices,1)
  })
  await db.close()
})
