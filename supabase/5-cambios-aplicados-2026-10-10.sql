-- =====================================================================
-- GOODS — Cambios aplicados en Supabase el 10/10/2026 (ya están hechos;
-- este archivo queda como registro, no hace falta volver a correrlo)
-- =====================================================================

-- 1) El dueño puede cargar turnos a mano desde el panel
create policy dueno_carga_turnos
  on public.bookings for insert to authenticated
  with check (status = 'confirmed');

-- 2) La vista de horarios ocupados queda SOLO DE LECTURA.
--    Antes cualquier visitante podía borrar o modificar turnos a través de ella.
revoke insert, update, delete, truncate, references, trigger on public.bookings_public from anon, authenticated;
grant select on public.bookings_public to anon, authenticated;

-- 3) Se corrigieron 4 turnos guardados con la fecha corrida un día
--    (reservados entre las 21 h y la medianoche):
--    Nicolás Vie 21 ago 14:30 · Chino Sáb 26 sept 17:00 (cancelado)
--    Chino Sáb 3 oct 15:00 (cancelado) · Chino Sáb 10 oct 17:00
-- update public.bookings set date = date - 1 where id in (...4 ids...);

-- 4) Rechazar turnos nuevos para horarios que ya pasaron (hora de Argentina).
--    Clientes: el horario no tiene que haber empezado. Dueño (panel): se
--    permite el turno en curso, no uno que ya terminó.
create or replace function public.bookings_bloquear_horarios_pasados()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_inicio timestamp := new.date + new.time::time;
  v_ahora  timestamp := now() at time zone 'America/Argentina/Buenos_Aires';
  v_rol    text := auth.role();
begin
  if v_rol = 'anon' and v_inicio <= v_ahora then
    raise exception 'Ese horario ya pasó' using errcode = 'check_violation';
  elsif v_rol = 'authenticated' and v_inicio + interval '30 minutes' <= v_ahora then
    raise exception 'Ese horario ya pasó' using errcode = 'check_violation';
  end if;
  return new;
end; $$;
revoke all on function public.bookings_bloquear_horarios_pasados() from public, anon, authenticated;
create trigger bookings_bloquear_horarios_pasados
  before insert on public.bookings
  for each row execute function public.bookings_bloquear_horarios_pasados();
-- Para quitarlo: drop trigger bookings_bloquear_horarios_pasados on public.bookings;
