-- Bền Bỉ Tối Cùng · Supabase schema
-- Chạy toàn bộ tệp này trong Supabase Dashboard → SQL Editor → New query → Run.
-- Mỗi tài khoản có đúng một hàng; tác vụ, phiên tập trung, nhật ký thói quen,
-- tombstone (bản ghi đã xóa) và cài đặt nằm trong cột data (jsonb).

create table if not exists public.benbi_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  constraint benbi_state_data_is_object check (jsonb_typeof(data) = 'object'),
  constraint benbi_state_data_size check (pg_column_size(data) < 4000000)
);

comment on table public.benbi_state is
  'Dữ liệu Bền Bỉ của từng tài khoản. Mỗi hàng thuộc về auth.uid(); revision tăng mỗi lần ghi để phát hiện ghi đè đồng thời.';

alter table public.benbi_state
  add column if not exists task_count integer
    generated always as (coalesce(jsonb_array_length(data -> 'tasks'), 0)) stored,
  add column if not exists session_count integer
    generated always as (coalesce(jsonb_array_length(data -> 'sessions'), 0)) stored;

revoke all on public.benbi_state from anon;
revoke all on public.benbi_state from public;
grant select, insert, update, delete on public.benbi_state to authenticated;

alter table public.benbi_state enable row level security;
alter table public.benbi_state force row level security;

drop policy if exists "benbi_state_select_own" on public.benbi_state;
create policy "benbi_state_select_own"
  on public.benbi_state for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "benbi_state_insert_own" on public.benbi_state;
create policy "benbi_state_insert_own"
  on public.benbi_state for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "benbi_state_update_own" on public.benbi_state;
create policy "benbi_state_update_own"
  on public.benbi_state for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "benbi_state_delete_own" on public.benbi_state;
create policy "benbi_state_delete_own"
  on public.benbi_state for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- revision và updated_at luôn do máy chủ đặt, không tin giá trị từ thiết bị.
create or replace function public.touch_benbi_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.revision = 1;
  else
    new.user_id = old.user_id;
    new.revision = old.revision + 1;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists benbi_state_touch on public.benbi_state;
create trigger benbi_state_touch
  before insert or update on public.benbi_state
  for each row execute function public.touch_benbi_state();

-- ---------------------------------------------------------------------------
-- Web Push: đăng ký thiết bị nhận nhắc nhở hằng ngày (Edge Function push-reminders)
-- Mỗi trình duyệt/thiết bị là một hàng; endpoint là duy nhất thực tế.
-- ---------------------------------------------------------------------------

create table if not exists public.benbi_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh_key text not null,
  auth_key text not null,
  time_zone text not null default 'Asia/Ho_Chi_Minh',
  reminder_hour smallint not null default 20,
  last_sent_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint benbi_push_endpoint_https check (endpoint ~ '^https://'),
  constraint benbi_push_reminder_hour check (reminder_hour between 0 and 23),
  unique (user_id, endpoint)
);

comment on table public.benbi_push_subscriptions is
  'Đăng ký Web Push của từng thiết bị. Chỉ ghi qua RPC benbi_register_push_subscription; Edge Function dùng service_role để đọc và gửi nhắc lúc reminder_hour theo time_zone.';

revoke all on public.benbi_push_subscriptions from anon;
revoke all on public.benbi_push_subscriptions from public;
grant select, delete on public.benbi_push_subscriptions to authenticated;

alter table public.benbi_push_subscriptions enable row level security;
alter table public.benbi_push_subscriptions force row level security;

drop policy if exists "benbi_push_select_own" on public.benbi_push_subscriptions;
create policy "benbi_push_select_own"
  on public.benbi_push_subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "benbi_push_delete_own" on public.benbi_push_subscriptions;
create policy "benbi_push_delete_own"
  on public.benbi_push_subscriptions for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Ghi đăng ký qua RPC: dọn hàng trùng endpoint của tài khoản cũ trên cùng thiết bị rồi upsert.
create or replace function public.benbi_register_push_subscription(
  endpoint_in text,
  p256dh_in text,
  auth_in text,
  time_zone_in text default 'Asia/Ho_Chi_Minh',
  reminder_hour_in smallint default 20
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  if endpoint_in is null or endpoint_in !~ '^https://' or length(endpoint_in) > 2048 then
    raise exception 'invalid endpoint';
  end if;
  if p256dh_in is null or auth_in is null or length(p256dh_in) > 512 or length(auth_in) > 512 then
    raise exception 'invalid keys';
  end if;

  delete from public.benbi_push_subscriptions
  where endpoint = endpoint_in and user_id <> uid;

  insert into public.benbi_push_subscriptions (user_id, endpoint, p256dh_key, auth_key, time_zone, reminder_hour)
  values (uid, endpoint_in, p256dh_in, auth_in, coalesce(nullif(time_zone_in, ''), 'Asia/Ho_Chi_Minh'), coalesce(reminder_hour_in, 20))
  on conflict (user_id, endpoint) do update
    set p256dh_key = excluded.p256dh_key,
        auth_key = excluded.auth_key,
        time_zone = excluded.time_zone,
        reminder_hour = excluded.reminder_hour,
        updated_at = now();
end;
$$;

revoke all on function public.benbi_register_push_subscription(text, text, text, text, smallint) from anon;
revoke all on function public.benbi_register_push_subscription(text, text, text, text, smallint) from public;
grant execute on function public.benbi_register_push_subscription(text, text, text, text, smallint) to authenticated;

-- Lịch gửi nhắc (chạy sau khi deploy Edge Function push-reminders):
-- 1) Database → Extensions: bật pg_cron và pg_net.
-- 2) Thay <PROJECT_REF> và <PUSH_CRON_SECRET> rồi chạy khối dưới (mỗi giờ một lần).
--
-- select cron.schedule(
--   'benbi-push-hourly',
--   '5 * * * *',
--   $$
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/push-reminders',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', '<PUSH_CRON_SECRET>'),
--     body := '{}'::jsonb
--   );
--   $$
-- );

