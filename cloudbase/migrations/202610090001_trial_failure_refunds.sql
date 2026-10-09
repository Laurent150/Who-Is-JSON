-- Customer trial credit is charged for a cloud-validated operation. Network
-- delivery alone cannot be proven by a client-supplied acknowledgement.
-- Provider costs are retained in charged for audit, including refunded failures.
begin;
create table public.fimi_ai_operations (
 id uuid primary key,
 subject text not null references public.fimi_ai_wallets(subject),
 state text not null default 'pending' check(state in ('pending','failed','succeeded','refunded')),
 created_at timestamptz not null default now(),
 finished_at timestamptz
);
alter table public.fimi_ai_operations enable row level security;
revoke all on public.fimi_ai_operations from public, anon, authenticated;
alter table public.fimi_ai_requests add column operation_id uuid references public.fimi_ai_operations(id);
alter table public.fimi_ai_requests add column refunded_at timestamptz;
create index fimi_ai_requests_operation on public.fimi_ai_requests(operation_id);

create function public.fimi_ai_refund_request(request_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.fimi_ai_requests;
begin
 perform 1 from public.fimi_ai_campaign where id for update;
 select * into r from public.fimi_ai_requests where id=request_id for update;
 if not found then raise exception 'Unknown request'; end if;
 if r.refunded_at is not null then return jsonb_build_object('ok',true,'state','refunded'); end if;
 update public.fimi_ai_wallets set
   held=held-case when r.charged is null then r.reserved else 0 end,
   spent=spent-coalesce(r.charged,0) where subject=r.subject;
 update public.fimi_ai_campaign set
   held=held-case when r.charged is null then r.reserved else 0 end,
   spent=spent-coalesce(r.charged,0) where id;
 update public.fimi_ai_requests set refunded_at=now() where id=request_id;
 return jsonb_build_object('ok',true,'state','refunded');
end $$;

create or replace function public.fimi_ai_settle(request_id uuid, cost bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.fimi_ai_requests;
begin
 perform 1 from public.fimi_ai_campaign where id for update;
 select * into r from public.fimi_ai_requests where id=request_id for update;
 if not found or cost is null or cost < 0 or cost > r.reserved then raise exception 'Invalid settlement'; end if;
 if exists(select from public.fimi_ai_operations where id=r.operation_id and state in ('failed','refunded')) and r.refunded_at is null then
  perform public.fimi_ai_refund_request(request_id);
  select * into r from public.fimi_ai_requests where id=request_id;
 end if;
 if r.refunded_at is not null then
  -- A late provider reply records its cost but cannot re-charge a refund.
  update public.fimi_ai_requests set charged=coalesce(charged,cost) where id=request_id;
  return jsonb_build_object('ok',true,'refunded',true);
 end if;
 if r.charged is not null then
  if r.charged <> cost then raise exception 'Settlement already recorded with a different cost'; end if;
  return jsonb_build_object('ok',true);
 end if;
 update public.fimi_ai_wallets set held=held-r.reserved,spent=spent+cost where subject=r.subject;
 update public.fimi_ai_campaign set held=held-r.reserved,spent=spent+cost where id;
 update public.fimi_ai_requests set charged=cost where id=request_id;
 return jsonb_build_object('ok',true);
end $$;

create function public.fimi_ai_complete(account_subject text, operation_id uuid, succeeded boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.fimi_ai_operations; r record;
begin
 if account_subject is null or char_length(account_subject) not between 1 and 255 or operation_id is null or succeeded is null then raise exception 'Invalid operation'; end if;
 perform 1 from public.fimi_ai_campaign where id for update;
 if succeeded and not exists(select from public.fimi_ai_operations where id=operation_id and subject=account_subject) then raise exception 'Unknown operation'; end if;
 insert into public.fimi_ai_wallets(subject) values(account_subject) on conflict do nothing;
 -- A refund that arrives before reservation creates a tombstone. A delayed
 -- request can therefore never reserve and charge this operation afterwards.
 insert into public.fimi_ai_operations(id,subject,state) values(operation_id,account_subject,'pending') on conflict do nothing;
 select * into o from public.fimi_ai_operations where id=operation_id for update;
 if o.subject <> account_subject then raise exception 'Invalid operation owner'; end if;
 if not succeeded then
  for r in select id from public.fimi_ai_requests where fimi_ai_requests.operation_id=o.id loop
   perform public.fimi_ai_refund_request(r.id);
  end loop;
  update public.fimi_ai_operations set state='refunded',finished_at=now() where id=o.id;
 elsif o.state = 'failed' then
  return jsonb_build_object('ok',true,'state','failed');
 elsif o.state <> 'refunded' then
  if exists(select from public.fimi_ai_requests where fimi_ai_requests.operation_id=o.id and charged is null) then raise exception 'Unsettled operation'; end if;
  update public.fimi_ai_operations set state='succeeded',finished_at=now() where id=o.id;
 end if;
 select * into o from public.fimi_ai_operations where id=operation_id;
 return jsonb_build_object('ok',true,'state',o.state);
end $$;

-- Only the trusted gateway calls this after observing an actual failure.
-- No public client-supplied success/failure flag may set this state.
create function public.fimi_ai_mark_failed(account_subject text, operation_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 perform 1 from public.fimi_ai_campaign where id for update;
 update public.fimi_ai_operations set state='failed' where id=operation_id and subject=account_subject and state='pending';
 return jsonb_build_object('ok',true);
end $$;

create function public.fimi_ai_operation_status(account_subject text, operation_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.fimi_ai_operations;
begin
 select * into o from public.fimi_ai_operations where id=operation_id and subject=account_subject;
 if not found then return jsonb_build_object('ok',true,'state','unknown'); end if;
 return jsonb_build_object('ok',true,'state',o.state);
end $$;

create function public.fimi_ai_reserve_operation(account_subject text, operation_id uuid, request_id uuid, amount bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o public.fimi_ai_operations; result jsonb;
begin
 if account_subject is null or char_length(account_subject) not between 1 and 255 or operation_id is null then raise exception 'Invalid operation'; end if;
 perform 1 from public.fimi_ai_campaign where id for update;
 insert into public.fimi_ai_wallets(subject) values(account_subject) on conflict do nothing;
 insert into public.fimi_ai_operations(id,subject) values(operation_id,account_subject) on conflict do nothing;
 select * into o from public.fimi_ai_operations where id=operation_id for update;
 if o.subject <> account_subject then raise exception 'Invalid operation owner'; end if;
 if o.state <> 'pending' or o.created_at < now()-interval '2 hours' then return jsonb_build_object('error','closed'); end if;
 if (select count(*) from public.fimi_ai_requests where fimi_ai_requests.operation_id=o.id) >= 16 then return jsonb_build_object('error','closed'); end if;
 result=public.fimi_ai_reserve(account_subject,request_id,amount);
 if result->>'ok'='true' then update public.fimi_ai_requests set operation_id=o.id where id=request_id; end if;
 return result;
end $$;

-- Recover only a durable, trusted failure. A client disappearing does not prove
-- failure and cannot turn a delivered answer into a free provider call.
create function public.fimi_ai_recover(account_subject text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare o record;
begin
 perform 1 from public.fimi_ai_campaign where id for update;
 for o in select id from public.fimi_ai_operations where subject=account_subject and state='failed' loop
  perform public.fimi_ai_complete(account_subject,o.id,false);
 end loop;
 return jsonb_build_object('ok',true);
end $$;
create or replace function public.fimi_ai_quota(account_subject text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.fimi_ai_campaign; w public.fimi_ai_wallets;
begin
 if account_subject is null or char_length(account_subject) not between 1 and 255 then raise exception 'Invalid identity'; end if;
 perform public.fimi_ai_recover(account_subject);
 select * into c from public.fimi_ai_campaign where id;
 insert into public.fimi_ai_wallets(subject) values(account_subject) on conflict do nothing;
 select * into w from public.fimi_ai_wallets where subject=account_subject;
 return jsonb_build_object('enabled',c.enabled,'remaining',2000000-w.spent-w.held,'held',w.held,'poolRemaining',null,'grant',2000000,'unlimitedPool',true,'billingVersion','failure-refund-v1');
end $$;
revoke all on function public.fimi_ai_refund_request(uuid), public.fimi_ai_complete(text,uuid,boolean), public.fimi_ai_reserve_operation(text,uuid,uuid,bigint), public.fimi_ai_recover(text), public.fimi_ai_mark_failed(text,uuid), public.fimi_ai_operation_status(text,uuid) from public, anon, authenticated;
grant execute on function public.fimi_ai_refund_request(uuid), public.fimi_ai_complete(text,uuid,boolean), public.fimi_ai_reserve_operation(text,uuid,uuid,bigint), public.fimi_ai_recover(text), public.fimi_ai_mark_failed(text,uuid), public.fimi_ai_operation_status(text,uuid) to service_role;
commit;
