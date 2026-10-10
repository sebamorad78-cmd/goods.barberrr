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
