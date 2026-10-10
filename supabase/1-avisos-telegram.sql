-- =====================================================================
-- GOODS BARBER STUDIO — Avisos de turnos nuevos por Telegram
-- =====================================================================
-- Qué hace: cada vez que entra un turno nuevo en la tabla "bookings",
-- le manda un mensaje de Telegram al barbero elegido (y una copia al
-- dueño, si está cargado).
--
-- Qué NO hace: no cambia la página, no cambia la tabla "bookings" ni sus
-- reglas de seguridad. Si Telegram falla o no está configurado, el turno
-- se guarda igual que siempre.
--
-- Cómo se usa: pegar TODO este archivo en Supabase → SQL Editor → Run.
-- Se puede correr más de una vez sin problema.
-- =====================================================================

-- Extensión de Supabase para hacer pedidos HTTP desde la base de datos.
-- Los pedidos se mandan en segundo plano: no demoran la reserva.
create extension if not exists pg_net;

-- Esquema privado: NO queda expuesto en la API pública de Supabase,
-- así que nadie desde la página puede leer el token del bot.
create schema if not exists goods_private;
revoke all on schema goods_private from public, anon, authenticated;

-- Token del bot de Telegram (una sola fila).
create table if not exists goods_private.telegram_settings (
  id boolean primary key default true check (id),
  bot_token text not null
);

-- A quién avisar. "destinatario" es el id del barbero tal como lo guarda
-- la página (nicolas, tula, chino) o "dueno" para recibir todos los turnos.
create table if not exists goods_private.telegram_recipients (
  destinatario text primary key,
  chat_id text not null,
  activo boolean not null default true
);

revoke all on all tables in schema goods_private from public, anon, authenticated;

create or replace function goods_private.notify_new_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_text  text;
  r       record;
begin
  -- Todo va dentro de un bloque protegido: pase lo que pase acá,
  -- el turno se guarda igual.
  begin
    select bot_token into v_token from goods_private.telegram_settings where id;
    if v_token is null or v_token = '' then
      return new;
    end if;

    v_text := '💈 Nuevo turno en Goods' || chr(10) || chr(10)
      || 'Barbero: ' || coalesce(new.barber_name, new.barber_id::text) || chr(10)
      || 'Día: '     || coalesce(new.date_label, new.date::text)          || chr(10)
      || 'Hora: '    || coalesce(new.time::text, '-')                    || chr(10)
      || 'Cliente: ' || coalesce(new.customer_name, '-')                 || chr(10)
      || 'Teléfono: '|| coalesce(new.phone, '-')
      || case when coalesce(trim(new.note), '') <> ''
              then chr(10) || 'Nota: ' || new.note else '' end
      || case when new.ticket_num is not null
              then chr(10) || 'Ticket: #' || new.ticket_num::text else '' end;

    for r in
      select chat_id
      from goods_private.telegram_recipients
      where activo
        and (destinatario = new.barber_id::text or destinatario = 'dueno')
    loop
      perform net.http_post(
        url     := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
        body    := jsonb_build_object('chat_id', r.chat_id, 'text', v_text),
        headers := '{"Content-Type": "application/json"}'::jsonb
      );
    end loop;
  exception when others then
    raise warning 'Goods: no se pudo enviar el aviso de Telegram: %', sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function goods_private.notify_new_booking() from public, anon, authenticated;

drop trigger if exists goods_notify_new_booking on public.bookings;
create trigger goods_notify_new_booking
  after insert on public.bookings
  for each row
  execute function goods_private.notify_new_booking();

-- ---------------------------------------------------------------------
-- PARA DESACTIVAR LOS AVISOS (sin tocar nada más), correr solo esto:
--   drop trigger if exists goods_notify_new_booking on public.bookings;
-- ---------------------------------------------------------------------
