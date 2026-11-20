-- Additive production migration. Never run schema.sql on production.
-- First set kcars.bootstrap_admin_email to an existing, confirmed owner's Auth email.
-- No CRM records are removed. Any error rolls back the migration.
begin;
create schema if not exists kcars_private;
revoke all on schema kcars_private from public, anon, authenticated;
create table if not exists public.crm_members (
  user_id uuid primary key references auth.users(id),
  username text unique not null check (username ~ '^[a-z0-9_]{3,32}$'),
  role text not null check (role in ('admin','operator')),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists kcars_private.permission_backup (
  captured_at timestamptz default now(), kind text, object_name text, definition jsonb
);
create table if not exists kcars_private.import_snapshots (
  id uuid primary key default gen_random_uuid(), batch_id uuid not null,
  created_at timestamptz not null default now(), data jsonb not null
);
create table if not exists kcars_private.login_attempts (
  username text not null, attempted_at timestamptz not null default now()
);
create index if not exists login_attempts_lookup on kcars_private.login_attempts(username,attempted_at);
create table if not exists public.crm_import_batches (
  id uuid primary key, created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), last_committed_at timestamptz,
  files jsonb not null, excluded_rows integer not null default 0,
  status text not null default 'draft' check (status in ('draft','partial','complete'))
);
create table if not exists public.crm_import_entries (
  id uuid primary key default gen_random_uuid(), batch_id uuid not null references public.crm_import_batches(id),
  source text not null check (source in ('kcars','oneworld')), invoice_no text not null,
  payload jsonb not null, car_plate text not null default '',
  status text not null check (status in ('ready','hold','duplicate','imported')),
  issues text[] not null default '{}', total numeric not null, line_count integer not null,
  invoice_id uuid references public.invoices(id), plate_corrected_by uuid references auth.users(id),
  unique(batch_id,invoice_no)
);
create table if not exists public.crm_import_events (
  id uuid primary key default gen_random_uuid(), batch_id uuid references public.crm_import_batches(id),
  actor uuid not null references auth.users(id), created_at timestamptz not null default now(),
  action text not null, detail jsonb not null
);
create index if not exists crm_import_entries_batch on public.crm_import_entries(batch_id);
create index if not exists crm_import_batches_created on public.crm_import_batches(created_at desc);

-- Bootstrap refuses a guessed identity and requires the owner's existing Auth account.
do $$ declare owner_id uuid; begin
  if not exists (select 1 from public.crm_members where role='admin' and enabled) then
    select id into owner_id from auth.users
    where lower(email)=lower(current_setting('kcars.bootstrap_admin_email',true)) and email_confirmed_at is not null;
    if owner_id is null then raise exception 'Set kcars.bootstrap_admin_email to the confirmed owner Auth email before running this migration'; end if;
    insert into public.crm_members(user_id,username,role) values(owner_id,'owner','admin');
  end if;
end $$;

create or replace function public.crm_my_role() returns text
language sql stable security definer set search_path='' as $$
  select role from public.crm_members where user_id=auth.uid() and enabled;
$$;
create or replace function public.crm_my_profile() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('username',username,'role',role) from public.crm_members where user_id=auth.uid() and enabled;
$$;
create or replace function kcars_private.require_member() returns void
language plpgsql security definer set search_path='' as $$ begin
  if public.crm_my_role() is null then raise exception '账号未获授权或已停用' using errcode='42501'; end if;
end $$;
create or replace function kcars_private.require_batch(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$ begin
  perform kcars_private.require_member();
  if not exists(select 1 from public.crm_import_batches where id=p_id and (created_by=auth.uid() or public.crm_my_role()='admin')) then
    raise exception '没有权限操作这个导入批次' using errcode='42501';
  end if;
end $$;
create or replace function kcars_private.plate(p text) returns text
language sql immutable set search_path='' as $$ select upper(regexp_replace(coalesce(p,''),'[^A-Za-z0-9]','','g')); $$;

create or replace function kcars_private.refresh_entry(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare e public.crm_import_entries; problems text[]:='{}'; r jsonb; v_count integer; c_count integer; existing_id uuid;
begin
  select * into strict e from public.crm_import_entries where id=p_id for update;
  if e.status='imported' then return; end if;
  select id into existing_id from public.invoices where invoice_no=e.invoice_no;
  if existing_id is not null then
    update public.crm_import_entries set status='duplicate',invoice_id=existing_id,issues=array['已存在，保留原记录'] where id=p_id;
    return;
  end if;
  if e.car_plate='' then problems:=array_append(problems,'缺少车牌');
  elsif e.car_plate !~ '^[A-Z0-9]{3,14}$' then problems:=array_append(problems,'车牌格式异常'); end if;
  if exists(select 1 from jsonb_array_elements(e.payload) x where coalesce(trim(x->>'customer'),'')='') then problems:=array_append(problems,'缺少客户名称'); end if;
  if (select count(distinct x->>'source') from jsonb_array_elements(e.payload) x)>1
     or (select count(distinct x->>'date') from jsonb_array_elements(e.payload) x)>1
     or (select count(distinct x->>'customer') from jsonb_array_elements(e.payload) x)>1
     or (select count(distinct x->>'plate') from jsonb_array_elements(e.payload) x)>1
     or (select count(distinct x->>'advisor') from jsonb_array_elements(e.payload) x)>1
     or (select count(distinct x->>'mechanic') from jsonb_array_elements(e.payload) x)>1
  then problems:=array_append(problems,'同一发票的基本信息不一致'); end if;
  if (select count(distinct x->>'sheet') from jsonb_array_elements(e.payload) x)>1 then problems:=array_append(problems,'同一发票出现在多个工作表，请检查重复导出'); end if;
  for r in select value from jsonb_array_elements(e.payload) loop
    if jsonb_typeof(r->'qty') is distinct from 'number' or jsonb_typeof(r->'unit_price') is distinct from 'number' or jsonb_typeof(r->'amount') is distinct from 'number' then
      problems:=array_append(problems,'缺少数量、单价或金额');
    elsif abs((r->>'qty')::numeric*(r->>'unit_price')::numeric-(r->>'amount')::numeric)>0.01 then
      problems:=array_append(problems,'数量乘单价与金额不符');
    elsif (r->>'amount')::numeric<>round((r->>'amount')::numeric,2) then
      problems:=array_append(problems,'金额小数位超过两位');
    end if;
  end loop;
  select count(*) into v_count from public.vehicles where kcars_private.plate(car_plate)=e.car_plate and e.car_plate<>'';
  select count(*) into c_count from public.customers where kcars_private.plate(car_plate)=e.car_plate and e.car_plate<>'';
  if v_count>1 or c_count>1 or exists(
    select 1 from public.vehicles v join public.customers c on kcars_private.plate(v.car_plate)=kcars_private.plate(c.car_plate)
    where kcars_private.plate(v.car_plate)=e.car_plate and v.customer_id<>c.id
  ) then problems:=array_append(problems,'车牌存在多个或冲突的客户关联，需要管理员处理'); end if;
  update public.crm_import_entries set issues=array(select distinct unnest(problems)),status=case when cardinality(problems)>0 then 'hold' else 'ready' end where id=p_id;
end $$;

create or replace function public.crm_prepare_import(p_id uuid,p_files jsonb,p_rows jsonb,p_excluded integer default 0) returns uuid
language plpgsql security definer set search_path='' as $$
declare f jsonb; r jsonb; entry_id uuid; file_path text; n integer;
begin
  perform kcars_private.require_member();
  if exists(select 1 from public.crm_import_batches where id=p_id) then perform kcars_private.require_batch(p_id); return p_id; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) not between 1 and 20000 or octet_length(p_rows::text)>15000000 then raise exception '导入数据大小不合法'; end if;
  if jsonb_typeof(p_files) is distinct from 'array' or jsonb_array_length(p_files)<>2 or p_excluded not between 0 and 20000 then raise exception '请上传两份原始工作簿'; end if;
  if (select count(distinct value->>'source') from jsonb_array_elements(p_files))<>2 then raise exception '每个来源只能上传一份工作簿'; end if;
  for f in select value from jsonb_array_elements(p_files) loop
    file_path:=auth.uid()::text||'/'||p_id::text||'/'||(f->>'source')||'.xlsx';
    if coalesce(f->>'source','') not in ('kcars','oneworld') or coalesce(f->>'path','')<>file_path or coalesce(f->>'sha256','') !~ '^[0-9a-f]{64}$' or length(f->>'name')>255 then raise exception '原始文件信息无效'; end if;
    if not exists(select 1 from storage.objects where bucket_id='crm-imports' and name=file_path) then raise exception '原始工作簿尚未保存，请重新上传'; end if;
  end loop;
  for r in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(r)<>'object' or coalesce(r->>'source','') not in ('kcars','oneworld') or length(trim(coalesce(r->>'invoice_no',''))) not between 1 and 100
       or length(trim(coalesce(r->>'description',''))) not between 1 and 2000
       or coalesce(r->>'date','') !~ '^\d{4}-\d{2}-\d{2}$'
       or (r->>'date')::date not between date '1990-01-01' and current_date+1
       or length(coalesce(r->>'customer',''))>500 or length(coalesce(r->>'make',''))>100 or length(coalesce(r->>'model',''))>200
       or length(coalesce(r->>'advisor',''))>100 or length(coalesce(r->>'mechanic',''))>100
       or length(coalesce(r->>'sheet','')) not between 1 and 255 or (r->>'row')::integer not between 2 and 10001
    then raise exception '发票字段不合法，请重新从 AutoCount 导出'; end if;
    foreach file_path in array array['qty','unit_price','amount'] loop
      if jsonb_typeof(r->file_path) not in ('number','null') or (jsonb_typeof(r->file_path)='number' and abs((r->>file_path)::numeric)>100000000) then raise exception '金额或数量超出范围'; end if;
    end loop;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_rows) x group by x->>'source',x->>'sheet',x->>'row' having count(*)>1) then raise exception '同一来源行重复出现'; end if;
  insert into public.crm_import_batches(id,created_by,files,excluded_rows) values(p_id,auth.uid(),p_files,p_excluded);
  for entry_id in
    insert into public.crm_import_entries(batch_id,source,invoice_no,payload,car_plate,status,total,line_count)
    select p_id,min(t.r->>'source'),trim(t.r->>'invoice_no'),jsonb_agg(t.r order by t.ord),kcars_private.plate(min(t.r->>'plate')),'hold',
      coalesce(sum((t.r->>'amount')::numeric),0),count(*)
    from jsonb_array_elements(p_rows) with ordinality t(r,ord) group by trim(t.r->>'invoice_no') returning id
  loop perform kcars_private.refresh_entry(entry_id); end loop;
  insert into public.crm_import_events(batch_id,actor,action,detail) values(p_id,auth.uid(),'prepared',jsonb_build_object('rows',jsonb_array_length(p_rows),'excluded',p_excluded));
  return p_id;
end $$;

create or replace function public.crm_fix_import_plate(p_entry uuid,p_plate text) returns void
language plpgsql security definer set search_path='' as $$ declare e public.crm_import_entries; plate text; begin
  select * into strict e from public.crm_import_entries where id=p_entry for update;
  perform kcars_private.require_batch(e.batch_id);
  if e.status<>'hold' or e.car_plate<>'' then raise exception '只能补充尚未导入的缺失车牌'; end if;
  plate:=kcars_private.plate(p_plate);
  if plate !~ '^[A-Z0-9]{3,14}$' then raise exception '请填写有效车牌'; end if;
  update public.crm_import_entries set car_plate=plate,plate_corrected_by=auth.uid() where id=p_entry;
  perform kcars_private.refresh_entry(p_entry);
  insert into public.crm_import_events(batch_id,actor,action,detail) values(e.batch_id,auth.uid(),'plate_supplied',jsonb_build_object('invoice_no',e.invoice_no,'plate',plate));
end $$;

create or replace function public.crm_commit_import(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.crm_import_entries; first_line jsonb; r jsonb; cid uuid; vid uuid; iid uuid;
  imported integer:=0; line_total integer:=0; batch_total numeric:=0; nth integer; description_all text; inv_type text; result jsonb;
begin
  perform kcars_private.require_batch(p_id);
  -- Serialize imports and manual writes; duplicates are rechecked inside this transaction.
  lock table public.customers,public.vehicles,public.invoices,public.invoice_items in share row exclusive mode;
  perform 1 from public.crm_import_batches where id=p_id for update;
  for e in select * from public.crm_import_entries where batch_id=p_id and status<>'imported' order by invoice_no for update loop
    perform kcars_private.refresh_entry(e.id);
  end loop;
  insert into kcars_private.import_snapshots(batch_id,data)
  select p_id,jsonb_build_object(
    'customers',coalesce((select jsonb_agg(to_jsonb(c)) from public.customers c where exists(select 1 from public.crm_import_entries s where s.batch_id=p_id and kcars_private.plate(c.car_plate)=s.car_plate)),'[]'::jsonb),
    'vehicles',coalesce((select jsonb_agg(to_jsonb(v)) from public.vehicles v where exists(select 1 from public.crm_import_entries s where s.batch_id=p_id and kcars_private.plate(v.car_plate)=s.car_plate)),'[]'::jsonb),
    'existing_invoices',coalesce((select jsonb_agg(to_jsonb(i)) from public.invoices i where exists(select 1 from public.crm_import_entries s where s.batch_id=p_id and i.invoice_no=s.invoice_no)),'[]'::jsonb)
  ) where exists(select 1 from public.crm_import_entries where batch_id=p_id and status='ready');
  for e in select * from public.crm_import_entries where batch_id=p_id and status='ready' order by invoice_no for update loop
    first_line:=e.payload->0; cid:=null;vid:=null;
    select id,customer_id into vid,cid from public.vehicles where kcars_private.plate(car_plate)=e.car_plate;
    if cid is null then select id into cid from public.customers where kcars_private.plate(car_plate)=e.car_plate; end if;
    if cid is null and upper(trim(first_line->>'customer')) not in ('CASH','WALK IN','WALK-IN','CUSTOMER','PRIVATE','OWNER') then
      if (select count(*) from public.customers where upper(trim(name))=upper(trim(first_line->>'customer')))=1 then
        select id into cid from public.customers where upper(trim(name))=upper(trim(first_line->>'customer'));
      end if;
    end if;
    if cid is null then
      insert into public.customers(name,car_plate,car_make,car_model,customer_type,notes)
      values(first_line->>'customer',e.car_plate,first_line->>'make',first_line->>'model','individual','Created by monthly import '||p_id) returning id into cid;
    end if;
    if vid is null then
      insert into public.vehicles(customer_id,car_plate,car_make,car_model,is_primary,notes)
      values(cid,e.car_plate,first_line->>'make',first_line->>'model',false,'Created by monthly import '||p_id) returning id into vid;
    end if;
    select string_agg(lower(value->>'description'),' ') into description_all from jsonb_array_elements(e.payload);
    inv_type:=case when e.source='oneworld' then 'onew' when description_all ~ 'gearbox|transmission' then 'kc_gearbox'
      when description_all like '%engine%' and description_all ~ 'overhaul|repair' then 'kc_engine' else 'onew' end;
    insert into public.invoices(customer_id,vehicle_id,invoice_no,date,advisor,mechanic,status,work_status,invoice_type,subtotal,discount,total,notes,arrived_at,completed_at)
    values(cid,vid,e.invoice_no,(first_line->>'date')::date,nullif(first_line->>'advisor',''),nullif(first_line->>'mechanic',''),
      'confirmed','completed',inv_type,e.total,0,e.total,'Monthly import '||p_id,
      (first_line->>'date')::timestamp at time zone 'Asia/Singapore',(first_line->>'date')::timestamp at time zone 'Asia/Singapore') returning id into iid;
    nth:=0;
    for r in select value from jsonb_array_elements(e.payload) loop
      nth:=nth+1;
      insert into public.invoice_items(invoice_id,description,category,qty,unit_price,amount,sort_order,item_type)
      values(iid,r->>'description',case when (r->>'amount')::numeric<0 then 'discount' else 'legacy' end,
        (r->>'qty')::numeric,(r->>'unit_price')::numeric,(r->>'amount')::numeric,nth,case when (r->>'amount')::numeric<0 then 'discount' else 'legacy' end);
    end loop;
    if (select count(*) from public.invoice_items where invoice_id=iid)<>e.line_count or (select sum(amount) from public.invoice_items where invoice_id=iid)<>e.total then raise exception '明细核对失败，本次导入已全部回滚'; end if;
    update public.invoices set status='paid',work_status='paid' where id=iid;
    update public.crm_import_entries set status='imported',invoice_id=iid,issues='{}' where id=e.id;
    imported:=imported+1;line_total:=line_total+e.line_count;batch_total:=batch_total+e.total;
  end loop;
  update public.crm_import_batches set last_committed_at=now(),status=case when exists(select 1 from public.crm_import_entries where batch_id=p_id and status='hold') then 'partial' else 'complete' end where id=p_id;
  result:=jsonb_build_object('invoices',imported,'items',line_total,'total',batch_total,'held',(select count(*) from public.crm_import_entries where batch_id=p_id and status='hold'));
  insert into public.crm_import_events(batch_id,actor,action,detail) values(p_id,auth.uid(),'committed',result);
  return result;
end $$;

create or replace function public.crm_set_member(p_user uuid,p_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$ begin
  if public.crm_my_role() is distinct from 'admin' then raise exception '仅管理员可管理账号' using errcode='42501'; end if;
  if p_user=auth.uid() or exists(select 1 from public.crm_members where user_id=p_user and role='admin') then raise exception '此入口只能启用或停用同事账号'; end if;
  update public.crm_members set enabled=p_enabled where user_id=p_user and role='operator';
  insert into public.crm_import_events(actor,action,detail) values(auth.uid(),'member_access_changed',jsonb_build_object('user_id',p_user,'enabled',p_enabled));
end $$;

create or replace function public.crm_allow_login(p_username text) returns boolean
language plpgsql security definer set search_path='' as $$ begin
  if p_username !~ '^[a-z0-9_]{3,32}$' then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('crm-login:'||p_username,0));
  delete from kcars_private.login_attempts where attempted_at<now()-interval '1 day';
  if (select count(*) from kcars_private.login_attempts where username=p_username and attempted_at>now()-interval '15 minutes')>=20 then return false; end if;
  insert into kcars_private.login_attempts(username) values(p_username);
  return true;
end $$;

-- Capture old policies/grants for administrator review before replacing access rules.
insert into kcars_private.permission_backup(kind,object_name,definition)
select 'policy',schemaname||'.'||tablename,to_jsonb(p) from pg_policies p where schemaname='public';
insert into kcars_private.permission_backup(kind,object_name,definition)
select 'grant',table_schema||'.'||table_name,to_jsonb(g) from information_schema.role_table_grants g where table_schema='public';
insert into kcars_private.permission_backup(kind,object_name,definition)
select 'function_acl',p.oid::regprocedure::text,jsonb_build_object('acl',p.proacl,'owner',pg_get_userbyid(p.proowner))
from pg_proc p where p.pronamespace='public'::regnamespace and p.prosecdef;
insert into kcars_private.permission_backup(kind,object_name,definition)
select 'view_options',c.relname,jsonb_build_object('options',c.reloptions,'definition',pg_get_viewdef(c.oid),'acl',c.relacl)
from pg_class c where c.relnamespace='public'::regnamespace and c.relkind in ('v','m');

do $$ declare t text; p record; f record; begin
  foreach t in array array['customers','vehicles','invoices','invoice_items','invoice_parts_pending','customer_activities','customer_notes','customer_tasks','parts_library','part_aliases','service_catalog','crm_members','crm_import_batches','crm_import_entries','crm_import_events'] loop
    if to_regclass('public.'||t) is null then continue; end if;
    execute format('alter table public.%I enable row level security',t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop execute format('drop policy %I on public.%I',p.policyname,t); end loop;
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    if t='crm_members' then
      execute format('create policy member_read on public.%I for select to authenticated using (public.crm_my_role()=''admin'' or (user_id=auth.uid() and enabled))',t);
    elsif t like 'crm_import_%' then
      execute format('create policy member_read on public.%I for select to authenticated using (public.crm_my_role() is not null)',t);
    else
      execute format('create policy member_read on public.%I for select to authenticated using (public.crm_my_role() is not null)',t);
      execute format('grant insert,update,delete on public.%I to authenticated',t);
      execute format('create policy admin_write on public.%I for all to authenticated using (public.crm_my_role()=''admin'') with check (public.crm_my_role()=''admin'')',t);
    end if;
  end loop;
  -- Public historical backup/staging tables must not leak data after the live tables are secured.
  for p in select tablename from pg_tables where schemaname='public' and (tablename like 'backup_%' or tablename like '%_backup_%' or tablename like 'import_autocount_%') loop
    execute format('revoke all on public.%I from public,anon,authenticated',p.tablename);
    execute format('alter table public.%I enable row level security',p.tablename);
  end loop;
  for p in select viewname from pg_views where schemaname='public' loop
    execute format('revoke all on public.%I from public,anon,authenticated',p.viewname);
    if p.viewname in ('part_price_history','part_price_recent') then
      execute format('alter view public.%I set (security_invoker=true)',p.viewname);
      execute format('grant select on public.%I to authenticated',p.viewname);
    end if;
  end loop;
  for p in select matviewname from pg_matviews where schemaname='public' loop
    execute format('revoke all on public.%I from public,anon,authenticated',p.matviewname);
  end loop;
  -- Old privileged RPCs can bypass RLS; retain their definitions but remove client execution.
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and prosecdef loop
    execute format('revoke execute on function %s from public,anon,authenticated',f.signature);
  end loop;
end $$;
revoke all on all functions in schema kcars_private from public,anon,authenticated;
revoke execute on function public.crm_my_role(),public.crm_my_profile(),public.crm_prepare_import(uuid,jsonb,jsonb,integer),public.crm_fix_import_plate(uuid,text),public.crm_commit_import(uuid),public.crm_set_member(uuid,boolean) from public,anon;
grant execute on function public.crm_my_role(),public.crm_my_profile(),public.crm_prepare_import(uuid,jsonb,jsonb,integer),public.crm_fix_import_plate(uuid,text),public.crm_commit_import(uuid),public.crm_set_member(uuid,boolean) to authenticated;
grant all on public.crm_members,public.crm_import_events to service_role;
grant execute on function public.crm_allow_login(text) to service_role;

-- Immutable originals: authenticated importers can add their own XLSX files, never replace/delete them.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('crm-imports','crm-imports',false,5242880,array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists crm_import_upload on storage.objects;
drop policy if exists crm_import_download on storage.objects;
drop policy if exists crm_import_restrict on storage.objects;
drop policy if exists crm_import_no_update on storage.objects;
drop policy if exists crm_import_no_delete on storage.objects;
-- Restrictive policy also protects this bucket from any older permissive storage policies.
create policy crm_import_restrict on storage.objects as restrictive for all to public
using (bucket_id<>'crm-imports' or (public.crm_my_role() is not null and (split_part(name,'/',1)=auth.uid()::text or public.crm_my_role()='admin')))
with check (bucket_id<>'crm-imports' or (public.crm_my_role() is not null and split_part(name,'/',1)=auth.uid()::text));
create policy crm_import_upload on storage.objects for insert to authenticated
with check (bucket_id='crm-imports' and public.crm_my_role() is not null and split_part(name,'/',1)=auth.uid()::text and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/(kcars|oneworld)\.xlsx$');
create policy crm_import_download on storage.objects for select to authenticated
using(bucket_id='crm-imports' and public.crm_my_role() is not null and (split_part(name,'/',1)=auth.uid()::text or public.crm_my_role()='admin'));
create policy crm_import_no_update on storage.objects as restrictive for update to public using(bucket_id<>'crm-imports') with check(bucket_id<>'crm-imports');
create policy crm_import_no_delete on storage.objects as restrictive for delete to public using(bucket_id<>'crm-imports');
notify pgrst,'reload schema';
commit;
