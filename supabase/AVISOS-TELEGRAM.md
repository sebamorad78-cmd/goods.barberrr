# Avisos de turnos por Telegram — paso a paso

Cuando alguien reserva en la página, el barbero elegido recibe al instante un
mensaje así:

```
💈 Nuevo turno en Goods

Barbero: Tula
Día: Lun 12 oct
Hora: 10:30
Cliente: Juan
Teléfono: 2235551234
Nota: Degradé
Ticket: #4821
```

No se toca la página ni la forma en que se guardan los turnos. Si Telegram
falla, el turno se guarda igual.

---

## Paso 1 — Crear el bot (5 minutos, una sola vez)

1. En Telegram, buscá **@BotFather** y escribile `/newbot`.
2. Ponele un nombre (ej. `Goods Turnos`) y un usuario que termine en `bot`
   (ej. `goods_turnos_bot`).
3. BotFather te devuelve un **token** parecido a
   `7412345678:AAH...xyz`. Guardalo: es la "llave" del bot, no lo compartas.

## Paso 2 — Que cada barbero le escriba al bot

1. Nicolás, Tula, Chino (y vos, si querés copia de todos) buscan el bot por
   su usuario (ej. `@goods_turnos_bot`), tocan **Iniciar** y le mandan
   cualquier mensaje, ej. "hola".
2. Abrí en el navegador (cambiando `TOKEN` por el tuyo):
   `https://api.telegram.org/botTOKEN/getUpdates`
3. Vas a ver un texto con cada mensaje. Para cada persona buscá
   `"chat":{"id":123456789,"first_name":"Tula"...` — ese número es su
   **chat_id**. Anotá el de cada uno.

## Paso 3 — Activar los avisos en Supabase

1. Entrá a supabase.com → tu proyecto de Goods → **SQL Editor** → New query.
2. Pegá todo el contenido de `1-avisos-telegram.sql` y tocá **Run**.
3. Nueva query: pegá `2-cargar-datos-telegram.sql`, reemplazá el token y los
   chat_id por los reales, y tocá **Run**.

## Paso 4 — Probar

Hacé una reserva de prueba en la página. En segundos le tiene que llegar el
mensaje al barbero elegido (y a vos). Después cancelala desde el panel como
siempre.

---

## Si algo no llega

- Revisá que esa persona le haya escrito primero al bot (Telegram no deja
  que un bot escriba a alguien que nunca le habló).
- En SQL Editor podés ver los últimos envíos y su respuesta:
  `select status_code, content from net._http_response order by created desc limit 5;`
- Para apagar todos los avisos sin tocar nada más:
  `drop trigger if exists goods_notify_new_booking on public.bookings;`
