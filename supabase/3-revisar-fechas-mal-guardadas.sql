-- =====================================================================
-- GOODS — Revisar turnos guardados con la fecha corrida un día
-- =====================================================================
-- La página vieja guardaba mal la fecha de las reservas hechas después
-- de las 21 h: el turno del martes 13 quedaba guardado como 14 (aunque
-- el texto "Mar 13 oct" estaba bien). La página nueva ya no lo hace.
--
-- PASO 1 — Solo mirar (no cambia nada). Pegalo en Supabase → SQL Editor → Run.
-- Muestra los turnos cuyo día guardado no coincide con el día del texto.
select id, barber_name, date_label, date as fecha_guardada,
       (date::date - 1) as fecha_correcta, time, customer_name, status
from public.bookings
where split_part(date_label, ' ', 2) ~ '^[0-9]+$'
  and split_part(date_label, ' ', 2)::int <> extract(day from date::date)
order by date, time;

-- PASO 2 — Corregirlos. Solo si el paso 1 mostró turnos y la columna
-- "fecha_correcta" coincide con el texto de "date_label". Para correrlo,
-- sacá los dos guiones del comienzo de las 4 líneas de abajo.
-- update public.bookings
-- set date = (date::date - 1)
-- where split_part(date_label, ' ', 2) ~ '^[0-9]+$'
--   and split_part(date_label, ' ', 2)::int = extract(day from (date::date - 1));
