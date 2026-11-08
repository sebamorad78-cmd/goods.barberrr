-- =====================================================================
-- GOODS — Una cuenta por barbero y quién ve qué
-- - Cuentas que NO están en la lista (ej. la del dueño): ven todo, como hoy.
-- - Socios: ven todo; el panel arranca mostrando lo suyo.
-- - Barbero (Lucho): solo sus turnos, su caja y sus avisos. Lo controla la base de datos.
-- Correr una vez en Supabase: SQL Editor → New query → pegar → Run
-- =====================================================================

create table if not exists public.staff (
  email     text primary key check (email = lower(email)),
  barber_id text not null,
  role      text not null check (role in ('socio', 'barbero'))
);
alter table public.staff enable row level security;
drop policy if exists staff_propio on public.staff;
create policy staff_propio on public.staff for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

insert into public.staff (email, barber_id, role) values
  ('nico.macchi19@gmail.com',    'nicolas', 'socio'),
  ('francottula2005@gmail.com',  'tula',    'socio'),
  ('ivanoliveraa29@gmail.com',   'chino',   'socio')
on conflict (email) do update set barber_id = excluded.barber_id, role = excluded.role;

-- Devuelve el barbero al que está limitada la cuenta (o null si ve todo)
create or replace function public.goods_my_barber()
returns text language sql stable security definer set search_path = '' as $$
  select s.barber_id from public.staff s
  where s.email = lower(coalesce(auth.jwt() ->> 'email', '')) and s.role = 'barbero';
$$;
revoke all on function public.goods_my_barber() from public, anon;
grant execute on function public.goods_my_barber() to authenticated;

-- Turnos
drop policy if exists dueno_ve_turnos on public.bookings;
drop policy if exists dueno_actualiza_turnos on public.bookings;
drop policy if exists dueno_carga_turnos on public.bookings;
drop policy if exists dueno_borra_turnos on public.bookings;
create policy dueno_ve_turnos on public.bookings for select to authenticated
  using (public.goods_my_barber() is null or barber_id = public.goods_my_barber());
create policy dueno_actualiza_turnos on public.bookings for update to authenticated
  using (public.goods_my_barber() is null or barber_id = public.goods_my_barber())
  with check (public.goods_my_barber() is null or barber_id = public.goods_my_barber());
create policy dueno_carga_turnos on public.bookings for insert to authenticated
  with check (status = 'confirmed' and (public.goods_my_barber() is null or barber_id = public.goods_my_barber()));
create policy dueno_borra_turnos on public.bookings for delete to authenticated
  using (public.goods_my_barber() is null);

-- Horarios y precios: solo quien ve todo
drop policy if exists settings_dueno_crea on public.goods_settings;
drop policy if exists settings_dueno_edita on public.goods_settings;
create policy settings_dueno_crea on public.goods_settings for insert to authenticated with check (public.goods_my_barber() is null);
create policy settings_dueno_edita on public.goods_settings for update to authenticated
  using (public.goods_my_barber() is null) with check (public.goods_my_barber() is null);
drop policy if exists money_crea on public.goods_money;
drop policy if exists money_edita on public.goods_money;
create policy money_crea on public.goods_money for insert to authenticated with check (public.goods_my_barber() is null);
create policy money_edita on public.goods_money for update to authenticated
  using (public.goods_my_barber() is null) with check (public.goods_my_barber() is null);

-- Días bloqueados: quien ve todo, o cada barbero los suyos
drop policy if exists bloqueos_dueno_crea on public.blocked_days;
drop policy if exists bloqueos_dueno_borra on public.blocked_days;
create policy bloqueos_dueno_crea on public.blocked_days for insert to authenticated
  with check (public.goods_my_barber() is null or barber_id = public.goods_my_barber());
create policy bloqueos_dueno_borra on public.blocked_days for delete to authenticated
  using (public.goods_my_barber() is null or barber_id = public.goods_my_barber());

-- Avisos: un barbero limitado solo puede anotarse para los suyos
drop policy if exists push_alta on public.push_subscriptions;
drop policy if exists push_cambio on public.push_subscriptions;
create policy push_alta on public.push_subscriptions for insert to authenticated
  with check (public.goods_my_barber() is null or barber_id = public.goods_my_barber());
create policy push_cambio on public.push_subscriptions for update to authenticated
  using (true) with check (public.goods_my_barber() is null or barber_id = public.goods_my_barber());

-- Para sumar a Lucho cuando esté su email (ejemplo):
--   insert into public.staff (email, barber_id, role) values ('su.email@gmail.com', 'lucho', 'barbero');
