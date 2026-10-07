-- CloudBase only: each verified email subject receives CNY 2 once.
-- No shared spending cap, as requested. Starts disabled until deployment is ready.
-- Execute as administrator; only the deployed trusted gateway gets service_role.
begin;
-- Monetary units are millionths of CNY. No client can modify these ledgers.
create table public.fimi_ai_campaign (
 id boolean primary key default true check(id),
 enabled boolean not null default false,
 spent bigint not null default 0 check(spent >= 0),
 held bigint not null default 0 check(held >= 0)
);
insert into public.fimi_ai_campaign(id) values(true);
create table public.fimi_ai_wallets (
 subject text primary key check(char_length(subject) between 1 and 255),
 spent bigint not null default 0 check(spent >= 0),
 held bigint not null default 0 check(held >= 0),
 last_request timestamptz,
 check(spent + held <= 2000000)
);
create table public.fimi_ai_requests (
 id uuid primary key,
 subject text not null references public.fimi_ai_wallets(subject),
 reserved bigint not null check(reserved between 1 and 2000000),
 charged bigint check(charged between 0 and reserved),
 created_at timestamptz not null default now()
);
alter table public.fimi_ai_campaign enable row level security;
alter table public.fimi_ai_wallets enable row level security;
alter table public.fimi_ai_requests enable row level security;
revoke all on public.fimi_ai_campaign, public.fimi_ai_wallets, public.fimi_ai_requests from public, anon, authenticated;

create function public.fimi_ai_quota(account_subject text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.fimi_ai_campaign; w public.fimi_ai_wallets;
begin
 if account_subject is null or char_length(account_subject) not between 1 and 255 then raise exception 'Invalid identity'; end if;
 select * into c from public.fimi_ai_campaign where id;
 insert into public.fimi_ai_wallets(subject) values(account_subject) on conflict do nothing;
 select * into w from public.fimi_ai_wallets where subject = account_subject;
 return jsonb_build_object('enabled',c.enabled,'remaining',2000000-w.spent-w.held,'held',w.held,'poolRemaining',null,'grant',2000000,'unlimitedPool',true);
end $$;

create function public.fimi_ai_reserve(account_subject text, request_id uuid, amount bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.fimi_ai_campaign; w public.fimi_ai_wallets;
begin
 if account_subject is null or char_length(account_subject) not between 1 and 255 or request_id is null or amount is null or amount not between 1 and 2000000 then raise exception 'Invalid reservation'; end if;
 -- Global lock first, then wallet lock: one ordering for all transactions.
 select * into c from public.fimi_ai_campaign where id for update;
 insert into public.fimi_ai_wallets(subject) values(account_subject) on conflict do nothing;
 select * into w from public.fimi_ai_wallets where subject = account_subject for update;
 if not c.enabled then return jsonb_build_object('error','disabled'); end if;
 if exists(select from public.fimi_ai_requests where id=request_id) then return jsonb_build_object('error','duplicate'); end if;
 if w.held > 0 then return jsonb_build_object('error','busy'); end if;
 if w.last_request > now()-interval '5 seconds' then return jsonb_build_object('error','rate'); end if;
 if w.spent+amount > 2000000 then return jsonb_build_object('error','quota'); end if;
 insert into public.fimi_ai_requests(id,subject,reserved) values(request_id,account_subject,amount);
 update public.fimi_ai_wallets set held=held+amount,last_request=now() where subject=account_subject;
 update public.fimi_ai_campaign set held=held+amount where id;
 return jsonb_build_object('ok',true);
end $$;

create function public.fimi_ai_settle(request_id uuid, cost bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.fimi_ai_requests;
begin
 perform 1 from public.fimi_ai_campaign where id for update;
 select * into r from public.fimi_ai_requests where id=request_id for update;
 if not found or cost is null or cost < 0 or cost > r.reserved then raise exception 'Invalid settlement'; end if;
 if r.charged is not null then
  if r.charged <> cost then raise exception 'Settlement already recorded with a different cost'; end if;
  return jsonb_build_object('ok',true);
 end if;
 update public.fimi_ai_wallets set held=held-r.reserved,spent=spent+cost where subject=r.subject;
 update public.fimi_ai_campaign set held=held-r.reserved,spent=spent+cost where id;
 update public.fimi_ai_requests set charged=cost where id=request_id;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.fimi_ai_quota(text), public.fimi_ai_reserve(text,uuid,bigint), public.fimi_ai_settle(uuid,bigint) from public, anon, authenticated;
grant execute on function public.fimi_ai_quota(text), public.fimi_ai_reserve(text,uuid,bigint), public.fimi_ai_settle(uuid,bigint) to service_role;
commit;
