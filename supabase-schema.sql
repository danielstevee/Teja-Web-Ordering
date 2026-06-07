create table if not exists public.orders (
  id text primary key,
  table_no text not null,
  customer_name text not null default 'Pelanggan',
  payment_method text not null default 'cash',
  payment_status text not null default 'pending',
  order_status text not null default 'baru',
  items jsonb not null default '[]'::jsonb,
  note text default '',
  total_amount integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders enable row level security;

drop policy if exists "orders can be read by app" on public.orders;
create policy "orders can be read by app"
on public.orders for select
to anon
using (true);

drop policy if exists "orders can be created by buyer" on public.orders;
create policy "orders can be created by buyer"
on public.orders for insert
to anon
with check (true);

drop policy if exists "orders can be updated by app" on public.orders;
create policy "orders can be updated by app"
on public.orders for update
to anon
using (true)
with check (true);

do $$
begin
  alter publication supabase_realtime add table public.orders;
exception
  when duplicate_object then null;
end $$;
