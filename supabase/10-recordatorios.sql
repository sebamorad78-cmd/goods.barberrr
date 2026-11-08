-- Goods · Recordatorios por WhatsApp desde el panel
-- Guarda cuándo se le mandó el recordatorio a cada cliente, así todos los
-- celulares del equipo ven que ya se envió y nadie le escribe dos veces.
-- No dispara avisos (esos solo saltan al cambiar el estado del turno) ni toca la caja.
alter table public.bookings add column if not exists reminded_at timestamptz;
comment on column public.bookings.reminded_at is 'Cuándo se le mandó el recordatorio por WhatsApp al cliente (desde el panel).';
