begin;
-- Monetary units are millionths of CNY. No client can modify these ledgers.
create table public.who_ai_campaign (
 id boolean primary key default true check(id),
 enabled boolean not null default false,
 budget bigint not null default 15000000 check(budget between 0 and 15000000),
 spent bigint not null default 0 check(spent >= 0),
 held bigint not null default 0 check(held >= 0),
 check(spent + held <= budget)
);
insert into public.who_ai_campaign(id) values(true);
create table public.who_ai_wallets (
 github_id text primary key,
 spent bigint not null default 0 check(spent >= 0),
 held bigint not null default 0 check(held >= 0),
 last_request timestamptz,
 check(spent + held <= 1000000)
);
create table public.who_ai_requests (
 id uuid primary key,
 github_id text not null references public.who_ai_wallets(github_id),
 reserved bigint not null check(reserved between 1 and 1000000),
 charged bigint check(charged between 0 and reserved),
 created_at timestamptz not null default now()
);
alter table public.who_ai_campaign enable row level security;
alter table public.who_ai_wallets enable row level security;
alter table public.who_ai_requests enable row level security;
revoke all on public.who_ai_campaign, public.who_ai_wallets, public.who_ai_requests from public, anon, authenticated;

create function public.who_ai_quota(github_account text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.who_ai_campaign; w public.who_ai_wallets;
begin
 if github_account !~ '^[0-9]{1,24}$' or github_account is null then raise exception 'Invalid identity'; end if;
 select * into c from public.who_ai_campaign where id;
 insert into public.who_ai_wallets(github_id) values(github_account) on conflict do nothing;
 select * into w from public.who_ai_wallets where github_id = github_account;
 return jsonb_build_object('enabled',c.enabled,'remaining',1000000-w.spent-w.held,'held',w.held,'poolRemaining',c.budget-c.spent-c.held,'grant',1000000,'budget',c.budget);
end $$;

create function public.who_ai_reserve(github_account text, request_id uuid, amount bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.who_ai_campaign; w public.who_ai_wallets;
begin
 if github_account !~ '^[0-9]{1,24}$' or github_account is null or request_id is null or amount is null or amount not between 1 and 1000000 then raise exception 'Invalid reservation'; end if;
 -- Global lock first, then wallet lock: one ordering for all transactions.
 select * into c from public.who_ai_campaign where id for update;
 insert into public.who_ai_wallets(github_id) values(github_account) on conflict do nothing;
 select * into w from public.who_ai_wallets where github_id = github_account for update;
 if not c.enabled then return jsonb_build_object('error','disabled'); end if;
 if exists(select from public.who_ai_requests where id=request_id) then return jsonb_build_object('error','duplicate'); end if;
 if w.held > 0 then return jsonb_build_object('error','busy'); end if;
 if w.last_request > now()-interval '5 seconds' then return jsonb_build_object('error','rate'); end if;
 if w.spent+amount > 1000000 or c.spent+c.held+amount > c.budget then return jsonb_build_object('error','quota'); end if;
 insert into public.who_ai_requests(id,github_id,reserved) values(request_id,github_account,amount);
 update public.who_ai_wallets set held=held+amount,last_request=now() where github_id=github_account;
 update public.who_ai_campaign set held=held+amount where id;
 return jsonb_build_object('ok',true);
end $$;

create function public.who_ai_settle(request_id uuid, cost bigint) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.who_ai_requests;
begin
 perform 1 from public.who_ai_campaign where id for update;
 select * into r from public.who_ai_requests where id=request_id for update;
 if not found or cost is null or cost < 0 or cost > r.reserved then raise exception 'Invalid settlement'; end if;
 if r.charged is not null then return jsonb_build_object('ok',true); end if;
 update public.who_ai_wallets set held=held-r.reserved,spent=spent+cost where github_id=r.github_id;
 update public.who_ai_campaign set held=held-r.reserved,spent=spent+cost where id;
 update public.who_ai_requests set charged=cost where id=request_id;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.who_ai_quota(text), public.who_ai_reserve(text,uuid,bigint), public.who_ai_settle(uuid,bigint) from public, anon, authenticated;
grant execute on function public.who_ai_quota(text), public.who_ai_reserve(text,uuid,bigint), public.who_ai_settle(uuid,bigint) to service_role;
commit;
