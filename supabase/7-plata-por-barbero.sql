-- =====================================================================
-- GOODS — Plata por barbero (agregado; no borra ni cambia nada existente)
-- Correr una sola vez en Supabase: SQL Editor → New query → pegar → Run
-- =====================================================================

-- Monto cobrado y momento en que se marcó atendido
alter table public.bookings add column if not exists amount integer check (amount is null or amount >= 0);
alter table public.bookings add column if not exists done_at timestamptz;

-- Precios y porcentajes: privados (solo cuentas con sesión iniciada)
create table if not exists public.goods_money (
  id boolean primary key default true check (id),
  prices jsonb not null default '{}'::jsonb,
  shares jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.goods_money enable row level security;
drop policy if exists money_lectura on public.goods_money;
drop policy if exists money_crea on public.goods_money;
drop policy if exists money_edita on public.goods_money;
create policy money_lectura on public.goods_money for select to authenticated using (true);
create policy money_crea on public.goods_money for insert to authenticated with check (true);
create policy money_edita on public.goods_money for update to authenticated using (true) with check (true);
insert into public.goods_money (id, prices)
values (true, '{"Corte":20000,"Corte + Barba":22000,"Barba":14000,"Tintura":null}'::jsonb)
on conflict (id) do nothing;

-- Al marcar atendido: se guarda el momento y, si no se cargó un monto, el precio del servicio.
-- Si se deshace o se cancela, el monto se limpia (no cuenta).
create or replace function public.bookings_monto_al_atender()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'done' then
    if old.status is distinct from 'done' then
      new.done_at := now();
    end if;
    if new.amount is null then
      select nullif(m.prices ->> coalesce(new.note, ''), '')::integer into new.amount
      from public.goods_money m limit 1;
    end if;
  else
    new.amount := null;
    new.done_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists bookings_monto_al_atender on public.bookings;
create trigger bookings_monto_al_atender before update on public.bookings
for each row execute function public.bookings_monto_al_atender();
