-- Goods · Atendido automático
-- Cada 5 minutos, los turnos confirmados cuya hora pasó hace 1 hora o más se marcan solos
-- como "atendidos". El precio lo completa el trigger bookings_monto_al_atender (las tinturas,
-- sin precio fijo, quedan sin monto y el panel pide cargarlo).
-- Si el cliente no vino, en el panel se toca "No vino" (antes o después) y no se cuenta en la caja.
-- Solo mira turnos de hoy y de ayer: nunca toca turnos viejos.
-- No manda notificaciones (los avisos al celular solo salen por turnos nuevos o cancelados).

create extension if not exists pg_cron;

create or replace function goods_private.auto_atender()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
  ahora timestamp := now() at time zone 'America/Argentina/Buenos_Aires';
begin
  update public.bookings b
     set status = 'done'
   where b.status = 'confirmed'
     and b.time ~ '^[0-9]{1,2}:[0-9]{2}$'
     and b.date >= (ahora::date - 1)
     and (b.date + b.time::time + interval '60 minutes') <= ahora;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function goods_private.auto_atender() from public, anon, authenticated;

-- cada 5 minutos (si ya existía, se reemplaza)
select cron.unschedule(jobid) from cron.job where jobname = 'goods-atendido-automatico';
select cron.schedule('goods-atendido-automatico', '*/5 * * * *', $cron$select goods_private.auto_atender()$cron$);
