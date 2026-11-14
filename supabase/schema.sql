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
