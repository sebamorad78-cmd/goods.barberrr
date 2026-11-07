-- =====================================================================
-- GOODS — Avisos de turnos al celular (sin Telegram)
-- Agregado: no borra ni cambia nada existente. Si los avisos fallan, el turno se guarda igual.
-- Correr una vez en Supabase: SQL Editor → New query → pegar → Run.
-- Las claves NO están acá: se cargan aparte, directo en la base.
-- =====================================================================
create extension if not exists pg_net;

-- Celulares que activaron los avisos (cada uno elige de qué barbero, o "todos")
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  barber_id  text not null,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_lectura on public.push_subscriptions;
drop policy if exists push_alta on public.push_subscriptions;
drop policy if exists push_cambio on public.push_subscriptions;
drop policy if exists push_baja on public.push_subscriptions;
create policy push_lectura on public.push_subscriptions for select to authenticated using (true);
create policy push_alta   on public.push_subscriptions for insert to authenticated with check (true);
create policy push_cambio on public.push_subscriptions for update to authenticated using (true) with check (true);
create policy push_baja   on public.push_subscriptions for delete to authenticated using (true);

-- Configuración privada (claves): fuera de la API pública
create schema if not exists goods_private;
revoke all on schema goods_private from public, anon, authenticated;
create table if not exists goods_private.push_config (
  id            boolean primary key default true check (id),
  function_url  text not null,
  hook_secret   text not null,
  vapid_public  text not null,
  vapid_private text not null,
  vapid_subject text not null
);
alter table goods_private.push_config enable row level security; -- protección extra (aplicada así el 7/11)
revoke all on all tables in schema goods_private from public, anon, authenticated;

-- La función de avisos lee la configuración con esto (solo el servidor puede usarla)
create or replace function public.goods_push_config()
returns json language sql security definer set search_path = '' as $$
  select json_build_object('hook_secret', hook_secret, 'vapid_public', vapid_public,
    'vapid_private', vapid_private, 'vapid_subject', vapid_subject)
  from goods_private.push_config where id;
$$;
revoke all on function public.goods_push_config() from public, anon, authenticated;
grant execute on function public.goods_push_config() to service_role;

-- Turno nuevo o cancelado → aviso. Todo protegido: si falla, el turno se guarda igual.
create or replace function goods_private.notify_push()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_kind text;
  c record;
begin
  if tg_op = 'INSERT' and new.status = 'confirmed' then v_kind := 'nuevo';
  elsif tg_op = 'UPDATE' and new.status = 'cancelled' and old.status is distinct from 'cancelled' then v_kind := 'cancelado';
  else return new;
  end if;
  begin
    select function_url, hook_secret into c from goods_private.push_config where id;
    if c.function_url is null then return new; end if;
    perform net.http_post(
      url     := c.function_url,
      body    := jsonb_build_object('kind', v_kind, 'id', new.id, 'barber_id', new.barber_id, 'barber_name', new.barber_name,
                   'date', new.date, 'date_label', new.date_label, 'time', new.time,
                   'customer_name', new.customer_name, 'note', new.note),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-goods-secret', c.hook_secret)
    );
  exception when others then
    raise warning 'Goods: no se pudo enviar el aviso al celular: %', sqlerrm;
  end;
  return new;
end;
$$;
revoke all on function goods_private.notify_push() from public, anon, authenticated;
drop trigger if exists goods_notify_push on public.bookings;
create trigger goods_notify_push after insert or update of status on public.bookings
  for each row execute function goods_private.notify_push();

-- Para desactivar los avisos sin tocar nada más:
--   drop trigger if exists goods_notify_push on public.bookings;
