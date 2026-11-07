// Goods · avisar-turno
// La base de datos llama a esta función cuando entra o se cancela un turno.
// Manda una notificación al celular del barbero de ese turno (y a quien eligió "Todos").
// Las claves viven en la base (goods_private.push_config), nunca en el código.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  try {
    const { data: cfg, error: cfgErr } = await sb.rpc("goods_push_config");
    if (cfgErr || !cfg) return new Response("sin configuración", { status: 503 });
    if (req.headers.get("x-goods-secret") !== cfg.hook_secret) return new Response("no autorizado", { status: 401 });

    const b = await req.json();
    const barberId = String(b.barber_id || "");
    const nuevo = b.kind === "nuevo";
    const nombre = String(b.customer_name || "").trim().split(/\s+/)[0] || "Cliente";
    const dia = b.date_label || b.date || "";
    const payload = JSON.stringify({
      title: nuevo ? "Nuevo turno · " + (b.barber_name || "") : "Turno cancelado · " + (b.barber_name || ""),
      body: dia + " · " + (b.time || "") + " · " + nombre + (b.note ? " · " + b.note : ""),
      tag: "turno-" + (b.id || barberId + dia + b.time),
      url: "/panel",
    });

    webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);
    const { data: subs } = await sb.from("push_subscriptions").select("endpoint,p256dh,auth")
      .in("barber_id", [barberId, "todos"]);

    let enviados = 0;
    await Promise.all((subs || []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload,
          { TTL: 6 * 3600, urgency: "high" });
        enviados++;
      } catch (e) {
        // el celular desactivó los avisos o borró la app: se limpia esa suscripción
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }));
    return Response.json({ enviados });
  } catch (_e) {
    return new Response("error", { status: 500 });
  }
});
