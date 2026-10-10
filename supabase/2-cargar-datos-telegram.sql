-- =====================================================================
-- GOODS — Cargar el token del bot y los chats de cada barbero
-- =====================================================================
-- Reemplazá los valores entre comillas y corré esto en
-- Supabase → SQL Editor → Run. Se puede volver a correr para cambiarlos.
-- (Ver AVISOS-TELEGRAM.md para saber de dónde sale cada dato.)
-- =====================================================================

-- 1) Token que te da @BotFather
insert into goods_private.telegram_settings (id, bot_token)
values (true, 'PEGAR_ACA_EL_TOKEN_DEL_BOT')
on conflict (id) do update set bot_token = excluded.bot_token;

-- 2) Chat de cada barbero (y del dueño, para recibir copia de todos).
--    Si alguno todavía no lo tenés, borrá su línea y cargalo después.
insert into goods_private.telegram_recipients (destinatario, chat_id) values
  ('nicolas', 'CHAT_ID_DE_NICOLAS'),
  ('tula',    'CHAT_ID_DE_TULA'),
  ('chino',   'CHAT_ID_DE_CHINO'),
  ('dueno',   'CHAT_ID_DEL_DUENO')
on conflict (destinatario) do update set chat_id = excluded.chat_id, activo = true;

-- Para pausar los avisos de un barbero (ej. vacaciones):
--   update goods_private.telegram_recipients set activo = false where destinatario = 'tula';
