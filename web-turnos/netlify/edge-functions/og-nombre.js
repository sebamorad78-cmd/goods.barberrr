// Tarjeta de WhatsApp con el nombre del local.
// Cuando el link de una demo trae ?nombre=Barbería%20Don%20Carlos, esta función
// reescribe el título y la descripción de la vista previa (og:) antes de servir
// la página. WhatsApp no ejecuta JavaScript, por eso tiene que hacerse acá.
// Solo funciona publicando desde GitHub (Netlify Drop no ejecuta funciones).

const RUBRO = {
  barberia: "barbería", salon: "salón de belleza", spa: "spa", unas: "nail bar",
};

const escapar = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function personalizar(html, nombreCrudo, modo) {
  const nombre = escapar(String(nombreCrudo).replace(/\s+/g, " ").trim().slice(0, 60));
  if (!nombre) return html;
  const tipo = RUBRO[modo] || "local";
  const titulo = `${nombre}: así se vería tu web con turnos online`;
  const desc = `Demo en vivo de la web de ${nombre}: tus clientes eligen servicio, día y horario y reservan en un minuto, con seña y recordatorios por WhatsApp. Tocá y probá tu ${tipo}.`;
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${titulo}</title>`)
    .replace(/(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*(")/g, `$1${titulo}$2`)
    .replace(/(<meta (?:property="og:description"|name="twitter:description"|name="description") content=")[^"]*(")/g, `$1${desc}$2`);
}

export default async (request, context) => {
  const url = new URL(request.url);
  const nombre = url.searchParams.get("nombre");
  const res = await context.next();
  if (!nombre || !(res.headers.get("content-type") || "").includes("text/html")) return res;
  const modo = url.pathname.split("/").filter(Boolean)[0];
  const html = personalizar(await res.text(), nombre, modo);
  const headers = new Headers(res.headers);
  headers.delete("content-length");
  headers.set("cache-control", "no-cache");
  return new Response(html, { status: res.status, headers });
};

export const config = {
  path: ["/barberia/", "/salon/", "/spa/", "/unas/", "/barberia/index.html", "/salon/index.html", "/spa/index.html", "/unas/index.html"],
};
