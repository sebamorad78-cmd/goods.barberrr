-- =====================================================================
-- GOODS — Permiso para cargar turnos a mano desde el panel del dueño
-- =====================================================================
-- Solo hace falta si al tocar "Guardar turno" en el panel aparece el
-- error "No se pudo guardar el turno". Pasa cuando las reglas de
-- seguridad de Supabase dejan reservar a los visitantes de la página,
-- pero no a la cuenta del dueño.
--
-- Pegalo en Supabase → SQL Editor → Run. Se puede correr más de una vez.
--
-- IMPORTANTE: este permiso es para cuentas con usuario y contraseña.
-- Revisá que en Supabase → Authentication → Sign In / Providers esté
-- DESACTIVADO "Allow new users to sign up", así la única cuenta que
-- existe es la tuya.
-- =====================================================================
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bookings'
      and policyname = 'Dueño puede cargar turnos desde el panel'
  ) then
    create policy "Dueño puede cargar turnos desde el panel"
      on public.bookings for insert to authenticated with check (true);
  end if;
end $$;
