/* Aplica el tema del rubro antes de pintar: colores, color de marca y
   tipografía propia (se carga solo la fuente que usa ese rubro). */
(function () {
  "use strict";
  var C = window.__NEGOCIO__ || {}, r = document.documentElement;
  var modo = C.modo || "barberia";
  r.setAttribute("data-theme", modo);

  var FUENTES = {
    barberia: "Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..600",
    salon: "Playfair+Display:ital,wght@0,400..700;1,400..700",
    spa: "Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500",
    unas: "Instrument+Serif:ital@0;1"
  };
  var link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=" + (FUENTES[modo] || FUENTES.barberia) +
    "&family=Manrope:wght@400;500;600;700;800&display=swap";
  document.head.appendChild(link);

  if (C.color) {
    var h = C.color, n = parseInt(h.slice(1), 16), R = n >> 16, G = (n >> 8) & 255, B = n & 255;
    var mix = function (c, t) { return Math.round(c + (t - c) * 0.3); };
    var lum = (0.299 * R + 0.587 * G + 0.114 * B) / 255;
    r.style.setProperty("--accent", h);
    r.style.setProperty("--accent-2", "rgb(" + mix(R, 255) + "," + mix(G, 255) + "," + mix(B, 255) + ")");
    r.style.setProperty("--on-accent", lum > 0.6 ? "#14110b" : "#ffffff");
  }

  var meta = document.querySelector('meta[name="theme-color"]');
  var BG = { barberia: "#0e0d0b", salon: "#faf6f1", spa: "#f1f2ec", unas: "#131012" };
  if (meta) meta.setAttribute("content", BG[modo] || BG.barberia);
})();
