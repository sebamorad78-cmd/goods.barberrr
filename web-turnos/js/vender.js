/* Página comercial: renderiza planes, demos y datos del vendedor desde config.js */
(function () {
  "use strict";
  var C = window.__NEGOCIO__ || {}, V = C.vendedor || {};
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var wa = function (msg) { return "https://wa.me/" + (V.whatsapp || "") + "?text=" + encodeURIComponent(msg || V.mensaje || ""); };

  document.title = (V.nombre || "Turnos online") + " — Webs con turnos para tu local";
  $$('[data-v="nombre"]').forEach(function (e) { e.textContent = V.nombre || ""; });
  $$('[data-v="pin"]').forEach(function (e) { e.textContent = C.pinPanel || "1234"; });
  $$('[data-v="nota"]').forEach(function (e) { e.textContent = V.notaPlanes || ""; });
  $$("[data-wa]").forEach(function (a) { a.href = wa(); a.target = "_blank"; a.rel = "noopener"; });
  var mail = $("#mailLink"); if (mail && V.email) { mail.href = "mailto:" + V.email; mail.textContent = V.email; }
  $("#year").textContent = new Date().getFullYear();

  var ESTILOS = [
    { modo: "barberia", nombre: "Barbería", ejemplo: "Barbería Imperio", colores: ["#0e0d0b", "#c9a45c", "#f1ebe0"], texto: "Oscuro, clásico y masculino." },
    { modo: "salon", nombre: "Salón de belleza", ejemplo: "Maison Lumière", colores: ["#faf6f1", "#9b4560", "#2a1b20"], texto: "Luminoso, elegante y femenino." },
    { modo: "spa", nombre: "Spa & estética", ejemplo: "Salvia Spa", colores: ["#f1f2ec", "#4a6752", "#1d2822"], texto: "Sereno, natural y de bienestar." },
    { modo: "unas", nombre: "Nail bar", ejemplo: "Nude Nail Bar", colores: ["#131012", "#eaa8b6", "#f7ede9"], texto: "Moderno, chic y con onda." }
  ];

  $("#heroPhone").src = "barberia/?limpio=1";

  $("#demoCards").innerHTML = ESTILOS.map(function (e) {
    return '<article class="democard"><div class="democard__sw">' + e.colores.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join("") + "</div>" +
      "<h3>" + esc(e.nombre) + "</h3><p>" + esc(e.texto) + '</p><div class="democard__links">' +
      '<a class="btn btn--primary btn--sm" href="' + e.modo + '/?limpio=1" target="_blank" rel="noopener">Ver web</a>' +
      '<a class="btn btn--ghost btn--sm" href="admin.html?modo=' + e.modo + '" target="_blank" rel="noopener">Ver panel</a></div></article>';
  }).join("");

  var tryModes = $("#tryModes"), selected = "barberia";
  tryModes.innerHTML = ESTILOS.map(function (e) {
    return '<button type="button" data-mode="' + e.modo + '"' + (e.modo === selected ? ' class="is-active"' : "") + "><i style=\"background:" + e.colores[1] + '"></i>' + esc(e.nombre) + "</button>";
  }).join("");
  var form = $("#tryForm"), colorTouched = false;
  form.elements.color.addEventListener("input", function () { colorTouched = true; });
  tryModes.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-mode]"); if (!b) return;
    selected = b.getAttribute("data-mode");
    $$("#tryModes button").forEach(function (x) { x.classList.toggle("is-active", x === b); });
    if (!colorTouched) form.elements.color.value = ESTILOS.filter(function (e) { return e.modo === selected; })[0].colores[1];
  });
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var p = new URLSearchParams();
    p.set("nombre", form.elements.nombre.value.trim());
    if (colorTouched) p.set("color", form.elements.color.value.replace("#", ""));
    p.set("limpio", "1");
    window.open(selected + "/?" + p.toString(), "_blank", "noopener");
  });

  // Calculadora de turnos perdidos
  var fmt = function (n) { return "$" + Math.round(n).toLocaleString("es-AR"); };
  // Precio del abono en pesos (redondeado a $1.000) a partir de US$ y la cotización de config.js
  var abono = Math.round((V.precioUSD || 0) * (V.cotizacion || 0) / 1000) * 1000;
  var abonoTxt = fmt(abono);
  $$('[data-v="precio"]').forEach(function (e) { e.textContent = abonoTxt; });
  $$('[data-v="precio-usd"]').forEach(function (e) { e.textContent = "US$ " + V.precioUSD; });
  function calc() {
    var a = +$("#cAus").value, p = +$("#cPrecio").value, l = +$("#cPerdidos").value;
    $("#oAus").textContent = a; $("#oPrecio").textContent = fmt(p); $("#oPerdidos").textContent = l;
    var mes = (a + l) * p * 4.3;
    $("#cTotal").textContent = fmt(mes);
    var turnos = Math.ceil(abono / p);
    $("#cNota").textContent = "Recuperando solo la mitad, son " + fmt(mes / 2) + " por mes. El abono es de " + abonoTxt +
      ": se paga con " + turnos + " turno" + (turnos === 1 ? "" : "s") + " recuperado" + (turnos === 1 ? "" : "s") + " al mes.";
  }
  ["#cAus", "#cPrecio", "#cPerdidos"].forEach(function (id) { $(id).addEventListener("input", calc); });
  calc();

  var planes = V.planes || [];
  $("#plans").classList.toggle("plans--single", planes.length === 1);
  $("#plans").innerHTML = planes.map(function (pl) {
    var msg = "¡Hola Sebastian! Quiero la web con turnos para mi local" + (V.primerMesGratis ? " (con el primer mes sin cargo)." : ".");
    var single = planes.length === 1;
    var turnosRef = V.precioReferenciaServicio ? Math.ceil(abono / V.precioReferenciaServicio) : 0;
    var anual = V.mesesRegaloAnual ? abono * (12 - V.mesesRegaloAnual) : 0;
    var extras = [];
    if (V.instalacionGratis) extras.push("Instalación sin costo");
    extras.push("Sin permanencia: das de baja cuando quieras");
    if (anual) extras.push("Pagando el año: " + V.mesesRegaloAnual + " meses de regalo (" + fmt(anual) + " por 12 meses)");
    var items = pl.incluye.map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("");
    return '<article class="plan' + (pl.destacado ? " plan--feat" : "") + '">' + (pl.destacado && !single ? '<span class="plan__badge">Más elegido</span>' : "") +
      (single ? '<div class="plan__side">' : "") +
      "<h3>" + esc(pl.nombre) + "</h3>" +
      (V.primerMesGratis ? '<span class="plan__offer">Primer mes sin cargo</span>' : "") +
      '<p class="plan__price"><strong>' + abonoTxt + "</strong><span>" + esc(pl.periodo) + "</span></p>" +
      '<p class="plan__usd">US$ ' + esc(V.precioUSD) + " al " + esc(V.cotizacionFuente) + ". Se ajusta al tipo de cambio del día de pago.</p>" +
      (turnosRef ? '<p class="plan__roi">Se paga con <strong>' + turnosRef + " turnos al mes</strong> (con un servicio de " + fmt(V.precioReferenciaServicio) + ").</p>" : "") +
      (pl.resumen ? '<p class="plan__sum">' + esc(pl.resumen) + "</p>" : "") +
      (single ? '<a class="btn btn--primary btn--lg" target="_blank" rel="noopener" href="' + esc(wa(msg)) + '">' + (V.primerMesGratis ? "Quiero mi primer mes sin cargo" : "Quiero mi web") + "</a>" +
        '<ul class="plan__extras">' + extras.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>" : "") +
      "<ul>" + items + "</ul>" +
      (single ? "" : '<a class="btn ' + (pl.destacado ? "btn--primary" : "btn--ghost") + '" target="_blank" rel="noopener" href="' + esc(wa(msg)) + '">Quiero este plan</a>') +
      "</article>";
  }).join("");
})();
