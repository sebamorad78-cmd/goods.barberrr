/* =====================================================================
   PANEL DEL LOCAL — agenda, turnos, clientes y estadísticas
   ===================================================================== */
(function () {
  "use strict";

  var C = window.__NEGOCIO__, T = window.__TURNOS__;
  if (!C || !T) return;

  /* ---------------- Utilidades ---------------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var U = T.util, dateKey = U.dateKey, toMin = U.toMin, toHHMM = U.toHHMM;
  var money = function (n) { return C.moneda + Math.round(n).toLocaleString("es-AR"); };
  var parseKey = function (k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
  var addDays = function (d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; };
  var today = function () { var d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  var DIAS_L = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  var MESES_L = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var fmtDia = function (d) { return DIAS_L[d.getDay()] + " " + d.getDate() + " de " + MESES_L[d.getMonth()]; };
  var fmtCorto = function (k) { return parseKey(k).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" }); };
  var cap = function (s) { return s.charAt(0).toUpperCase() + s.slice(1); };
  var svcById = function (id) { return C.servicios.filter(function (s) { return s.id === id; })[0]; };
  var proById = function (id) { return C.equipo.filter(function (p) { return p.id === id; })[0]; };
  var svcNames = function (b) { return b.svcs.map(function (id) { var s = svcById(id); return s ? s.nombre : id; }).join(" + "); };
  var phoneDigits = function (t) {
    var d = String(t || "").replace(/\D/g, "");
    if (d.length === 10) d = "549" + d;            // número local argentino
    return d;
  };
  var wa = function (tel, msg) { return "https://wa.me/" + phoneDigits(tel) + "?text=" + encodeURIComponent(msg); };
  var ESTADOS = { confirmado: "Confirmado", atendido: "Atendido", ausente: "No vino", cancelado: "Cancelado", bloqueo: "Bloqueado" };
  var toastTimer;
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("is-on");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("is-on"); }, 3200);
  }
  var turnos = function () { return T.all().filter(function (b) { return b.tipo !== "bloqueo"; }); };

  /* ---------------- Login ---------------- */
  $$("[data-bind=nombre]").forEach(function (el) { el.textContent = C.nombre; });
  document.title = "Panel · " + C.nombre;
  $("#logoMark").textContent = C.nombre.replace(/^(barber[ií]a|sal[oó]n|estudio|spa)\s+/i, "").charAt(0).toUpperCase();
  // Volver a la página del rubro (/unas/, /spa/…) conservando la personalización
  var webQs = new URLSearchParams(location.search); webQs.delete("modo");
  var webUrl = C.modo + "/" + (webQs.toString() ? "?" + webQs.toString() : "");
  $("#backLink").href = webUrl;
  $("#webLink").href = webUrl;
  if (C.esDemo) {
    $("#pinHint").textContent = "Demo: el PIN es " + C.pinPanel;
    $("#demoBadge").hidden = false;
  } else {
    $("#resetDemo").hidden = true;
  }
  // Reservas reales: se entra con el email y la contraseña del dueño (Supabase)
  if (T.remoto) {
    $("#pinField").hidden = true; $("#emailField").hidden = false; $("#passField").hidden = false;
  }

  function enter() {
    $("#login").hidden = true; $("#app").hidden = false;
    render();
  }
  function cargarYEntrar() {
    return T.load().then(enter);
  }
  $("#loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = this, btn = $("button[type=submit]", f);
    btn.disabled = true;
    var p = T.remoto ? T.login(f.elements.email.value.trim(), f.elements.password.value) : T.login(f.elements.pin.value);
    p.then(cargarYEntrar).catch(function (err) {
      toast(err.message || "No pudimos entrar.");
      if (T.remoto && err.codigo === "PERMISO") T.logout();
      f.elements.pin.value = ""; f.elements.password.value = "";
    }).then(function () { btn.disabled = false; });
  });
  $("#logout").addEventListener("click", function () {
    T.logout().then(function () { location.reload(); });
  });
  // Ejecuta un cambio (en la demo es inmediato; con reservas reales va a la base)
  function guardar(promesa, okMsg) {
    return promesa.then(function () { if (okMsg) toast(okMsg); render(); }, function (err) {
      toast(err.message || "No se pudo guardar.");
      if (err.codigo === "SESION") location.reload();
      throw err;
    });
  }

  /* ---------------- Estado ---------------- */
  var view = "agenda", day = today();
  // Si hoy el local está cerrado, la agenda arranca en el próximo día abierto
  for (var i = 0; i < 7 && (!(C.horarios[day.getDay()] || []).length || C.diasCerrados.indexOf(dateKey(day)) >= 0); i++) day = addDays(day, 1);
  var filters = { turnos: "hoy", clientes: "todos" };

  $("#sideNav").addEventListener("click", function (e) {
    var b = e.target.closest("[data-view]"); if (!b) return;
    view = b.getAttribute("data-view");
    $$("#sideNav button").forEach(function (x) { x.classList.toggle("is-active", x === b); });
    $$(".view").forEach(function (v) { v.classList.toggle("is-active", v.getAttribute("data-view") === view); });
    render();
  });

  function render() {
    var titles = { agenda: "Agenda", turnos: "Turnos", clientes: "Clientes", stats: "Estadísticas" };
    $("#viewTitle").textContent = titles[view];
    $("#viewSub").textContent = cap(fmtDia(new Date())) + " · " + C.tipo;
    renderKpis();
    if (view === "agenda") renderAgenda();
    if (view === "turnos") renderTurnos();
    if (view === "clientes") renderClientes();
    if (view === "stats") renderStats();
  }

  /* ---------------- KPIs ---------------- */
  function renderKpis() {
    var tk = dateKey(today()), list = turnos().filter(function (b) { return b.estado !== "cancelado"; });
    var hoy = list.filter(function (b) { return b.date === tk; });
    var monthStart = dateKey(new Date(today().getFullYear(), today().getMonth(), 1));
    var desde30 = dateKey(addDays(today(), -30));
    var mes = list.filter(function (b) { return b.date >= monthStart && b.date <= tk && b.estado === "atendido"; });
    var ult30 = list.filter(function (b) { return b.date >= desde30 && b.date < tk; });
    var aus = ult30.filter(function (b) { return b.estado === "ausente"; }).length;
    var proximos = list.filter(function (b) { return b.date > tk; }).length;
    var senas = list.filter(function (b) { return b.date >= tk && b.sena; }).reduce(function (a, b) { return a + b.sena; }, 0);
    var k = [
      { l: "Turnos hoy", v: hoy.length, s: hoy.filter(function (b) { return b.estado === "atendido"; }).length + " atendidos" },
      { l: "Facturación hoy", v: money(hoy.reduce(function (a, b) { return a + b.total; }, 0)), s: "estimada" },
      { l: "Facturado este mes", v: money(mes.reduce(function (a, b) { return a + b.total; }, 0)), s: mes.length + " servicios" },
      { l: "Próximos turnos", v: proximos, s: "señas cobradas " + money(senas) },
      { l: "Ausencias (30 días)", v: ult30.length ? Math.round(aus / ult30.length * 100) + "%" : "0%", s: aus + " turnos perdidos" }
    ];
    $("#kpis").innerHTML = k.map(function (x) {
      return '<article class="kpi"><span>' + x.l + "</span><strong>" + x.v + "</strong><small>" + x.s + "</small></article>";
    }).join("");
  }

  /* ---------------- Agenda ---------------- */
  var ROW = 34; // alto en px de cada bloque de intervalo

  function dayRange(d) {
    var h = C.horarios[d.getDay()] || [];
    if (!h.length) return null;
    var a = Math.min.apply(null, h.map(function (r) { return toMin(r[0]); }));
    var b = Math.max.apply(null, h.map(function (r) { return toMin(r[1]); }));
    return [a, b];
  }

  function renderAgenda() {
    $("#dayLabel").textContent = cap(fmtDia(day));
    var el = $("#agenda"), dk = dateKey(day), range = dayRange(day);
    if (!range || C.diasCerrados.indexOf(dk) >= 0) {
      el.style.removeProperty("--cols");
      el.innerHTML = '<div class="empty">El local está cerrado este día.</div>';
      return;
    }
    var start = range[0], end = range[1], step = C.intervaloTurnos;
    var rows = (end - start) / step;
    var items = T.all().filter(function (b) { return b.date === dk && b.estado !== "cancelado"; });
    el.style.setProperty("--cols", C.equipo.length);

    var html = '<div class="ag-corner"></div>';
    C.equipo.forEach(function (p) {
      var n = items.filter(function (b) { return b.pro === p.id && b.tipo !== "bloqueo"; }).length;
      html += '<div class="ag-head"><span class="ag-av"><img src="' + esc(p.foto) + '" alt="" onerror="this.remove()">' + esc(p.nombre.charAt(0)) + "</span><div><strong>" + esc(p.nombre) + "</strong><small>" + n + " turnos</small></div></div>";
    });
    html += '<div class="ag-times">';
    for (var i = 0; i < rows; i++) {
      var m = start + i * step;
      html += '<div class="ag-time" style="height:' + ROW + 'px">' + (m % 60 === 0 ? toHHMM(m) : "") + "</div>";
    }
    html += "</div>";

    var nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    var isToday = dk === dateKey(today());

    C.equipo.forEach(function (p) {
      html += '<div class="ag-col" data-pro="' + esc(p.id) + '" style="height:' + rows * ROW + 'px">';
      for (var j = 0; j < rows; j++) {
        var mm = start + j * step;
        var open = (C.horarios[day.getDay()] || []).some(function (r) { return mm >= toMin(r[0]) && mm < toMin(r[1]); });
        html += '<button type="button" class="ag-slot' + (open ? "" : " is-off") + '" data-time="' + toHHMM(mm) + '" style="top:' + j * ROW + "px;height:" + ROW + 'px" aria-label="Nuevo turno ' + toHHMM(mm) + '"></button>';
      }
      items.filter(function (b) { return b.pro === p.id; }).forEach(function (b) {
        var top = (toMin(b.time) - start) / step * ROW, h = b.dur / step * ROW;
        var cls = b.tipo === "bloqueo" ? "bloqueo" : b.estado;
        html += '<button type="button" class="ag-ev st-' + cls + (h < ROW * 1.6 ? " is-short" : "") + '" data-code="' + esc(b.code) + '" style="top:' + (top + 1) + "px;height:" + (h - 2) + 'px">' +
          "<strong>" + esc(b.tipo === "bloqueo" ? (b.nota || "Bloqueado") : b.nombre) + "</strong>" +
          "<span>" + esc(b.time) + " · " + esc(b.tipo === "bloqueo" ? "Sin turnos" : svcNames(b)) + "</span>" +
          (b.origen === "web" && b.tipo !== "bloqueo" ? '<em title="Reservado online">web</em>' : "") + "</button>";
      });
      if (isToday && nowMin > start && nowMin < end) {
        html += '<div class="ag-now" style="top:' + (nowMin - start) / step * ROW + 'px"></div>';
      }
      html += "</div>";
    });
    el.innerHTML = html;
  }

  $(".daybar__nav").addEventListener("click", function (e) {
    var b = e.target.closest("[data-day]"); if (!b) return;
    var n = +b.getAttribute("data-day");
    day = n === 0 ? today() : addDays(day, n);
    renderAgenda();
  });
  $("#agenda").addEventListener("click", function (e) {
    var ev = e.target.closest(".ag-ev");
    if (ev) return openDetail(ev.getAttribute("data-code"));
    var sl = e.target.closest(".ag-slot");
    if (sl && !sl.classList.contains("is-off")) {
      openNew({ pro: sl.closest(".ag-col").getAttribute("data-pro"), date: dateKey(day), time: sl.getAttribute("data-time") });
    }
  });

  /* ---------------- Modal ---------------- */
  function openModal(title, body) {
    $("#modalTitle").textContent = title;
    $("#modalBody").innerHTML = body;
    $("#modal").hidden = false;
    var f = $("#modalBody input, #modalBody select"); if (f) f.focus();
  }
  function closeModal() { $("#modal").hidden = true; }
  $("#modal").addEventListener("click", function (e) { if (e.target.id === "modal" || e.target.closest("[data-close]")) closeModal(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("#modal").hidden) closeModal(); });

  function openDetail(code) {
    var b = T.all().filter(function (x) { return x.code === code; })[0]; if (!b) return;
    var p = proById(b.pro) || { nombre: "—" };
    if (b.tipo === "bloqueo") {
      openModal("Horario bloqueado",
        '<dl class="dl"><div><dt>Profesional</dt><dd>' + esc(p.nombre) + "</dd></div><div><dt>Fecha</dt><dd>" + esc(cap(fmtDia(parseKey(b.date)))) + "</dd></div>" +
        "<div><dt>Horario</dt><dd>" + esc(b.time) + " – " + toHHMM(toMin(b.time) + b.dur) + "</dd></div><div><dt>Motivo</dt><dd>" + esc(b.nota || "—") + "</dd></div></dl>" +
        '<div class="modal__actions"><button class="btn btn--ghost btn--sm danger" data-act="del" data-code="' + esc(code) + '">Quitar bloqueo</button></div>');
      return;
    }
    var fecha = cap(fmtDia(parseKey(b.date)));
    var rec = "¡Hola " + b.nombre.split(" ")[0] + "! Te recordamos tu turno en " + C.nombre + " el " + fmtDia(parseKey(b.date)) + " a las " + b.time + " (" + svcNames(b) + " con " + p.nombre + "). ¿Nos confirmás? 🙌";
    var post = "¡Gracias por venir a " + C.nombre + ", " + b.nombre.split(" ")[0] + "! Si te gustó, nos ayudás mucho con una reseña en Google ⭐";
    openModal(b.nombre,
      '<span class="pill st-' + esc(b.estado) + '">' + esc(ESTADOS[b.estado] || b.estado) + "</span>" +
      '<dl class="dl"><div><dt>Servicio</dt><dd>' + esc(svcNames(b)) + "</dd></div>" +
      "<div><dt>Profesional</dt><dd>" + esc(p.nombre) + "</dd></div>" +
      "<div><dt>Fecha</dt><dd>" + esc(fecha) + " · " + esc(b.time) + " (" + b.dur + " min)</dd></div>" +
      "<div><dt>Teléfono</dt><dd>" + esc(b.telefono) + "</dd></div>" +
      (b.email ? "<div><dt>Email</dt><dd>" + esc(b.email) + "</dd></div>" : "") +
      "<div><dt>Total</dt><dd>" + money(b.total) + (b.sena ? " · seña " + money(b.sena) : "") + "</dd></div>" +
      "<div><dt>Origen</dt><dd>" + (b.origen === "web" ? "Reserva online" : "Cargado en el local") + " · código " + esc(b.code) + "</dd></div>" +
      (b.nota ? "<div><dt>Nota</dt><dd>" + esc(b.nota) + "</dd></div>" : "") + "</dl>" +
      '<div class="modal__actions">' +
      '<a class="btn btn--primary btn--sm" target="_blank" rel="noopener" href="' + esc(wa(b.telefono, b.estado === "atendido" ? post : rec)) + '">' + (b.estado === "atendido" ? "Pedir reseña por WhatsApp" : "Enviar recordatorio") + "</a>" +
      (b.estado !== "atendido" ? '<button class="btn btn--ghost btn--sm" data-act="atendido" data-code="' + esc(code) + '">Marcar atendido</button>' : "") +
      (b.estado !== "ausente" ? '<button class="btn btn--ghost btn--sm" data-act="ausente" data-code="' + esc(code) + '">No vino</button>' : "") +
      (b.estado !== "confirmado" ? '<button class="btn btn--ghost btn--sm" data-act="confirmado" data-code="' + esc(code) + '">Volver a confirmado</button>' : "") +
      '<button class="btn btn--ghost btn--sm danger" data-act="cancelado" data-code="' + esc(code) + '">Cancelar turno</button></div>');
  }

  $("#modalBody").addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var act = b.getAttribute("data-act"), code = b.getAttribute("data-code");
    if (act === "del") { closeModal(); guardar(T.remove(code), "Bloqueo eliminado.").catch(function () {}); return; }
    if (act === "cancelado" && !window.confirm("¿Cancelar este turno? El horario queda libre.")) return;
    closeModal();
    guardar(T.update(code, { estado: act, canceladoPor: "local" }),
      { atendido: "Marcado como atendido.", ausente: "Marcado como ausente.", confirmado: "Turno confirmado.", cancelado: "Turno cancelado." }[act]).catch(function () {});
  });

  /* Nuevo turno manual */
  function proOptions(sel, svcId) {
    return C.equipo.filter(function (p) { return !svcId || p.servicios === "todos" || p.servicios.indexOf(svcId) >= 0; })
      .map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === sel ? " selected" : "") + ">" + esc(p.nombre) + "</option>"; }).join("");
  }
  function freeTimes(proId, dk, dur) {
    var d = parseKey(dk), out = [];
    (C.horarios[d.getDay()] || []).forEach(function (r) {
      for (var t = toMin(r[0]); t + dur <= toMin(r[1]); t += C.intervaloTurnos) {
        if (T.isProFree(proId, dk, t, dur)) out.push(toHHMM(t));
      }
    });
    return out;
  }

  function openNew(pre) {
    pre = pre || {};
    var svc0 = C.servicios.filter(function (s) {
      var p = pre.pro && proById(pre.pro);
      return !p || p.servicios === "todos" || p.servicios.indexOf(s.id) >= 0;
    })[0] || C.servicios[0];
    openModal("Nuevo turno",
      '<form class="mform" id="newForm">' +
      '<label class="field"><span>Cliente *</span><input name="nombre" required placeholder="Nombre y apellido"></label>' +
      '<label class="field"><span>Teléfono *</span><input name="telefono" type="tel" required placeholder="11 2345 6789"></label>' +
      '<label class="field field--full"><span>Servicio</span><select name="svc">' + C.servicios.map(function (s) {
        return '<option value="' + esc(s.id) + '"' + (s.id === svc0.id ? " selected" : "") + ">" + esc(s.nombre) + " · " + money(s.precio) + "</option>";
      }).join("") + "</select></label>" +
      '<label class="field"><span>Profesional</span><select name="pro">' + proOptions(pre.pro, svc0.id) + "</select></label>" +
      '<label class="field"><span>Fecha</span><input name="date" type="date" value="' + esc(pre.date || dateKey(day)) + '"></label>' +
      '<label class="field field--full"><span>Horario disponible</span><select name="time"></select></label>' +
      '<label class="field field--full"><span>Nota</span><input name="nota" placeholder="Opcional"></label>' +
      '<div class="modal__actions field--full"><button class="btn btn--primary btn--sm" type="submit">Guardar turno</button><button class="btn btn--ghost btn--sm" type="button" data-close>Cancelar</button></div></form>');
    var f = $("#newForm");
    function refreshTimes() {
      var s = svcById(f.elements.svc.value);
      var opts = freeTimes(f.elements.pro.value, f.elements.date.value, s.duracion);
      f.elements.time.innerHTML = opts.length ? opts.map(function (t) {
        return '<option' + (t === pre.time ? " selected" : "") + ">" + t + "</option>";
      }).join("") : '<option value="">Sin horarios libres</option>';
    }
    f.elements.svc.addEventListener("change", function () {
      var cur = f.elements.pro.value;
      f.elements.pro.innerHTML = proOptions(cur, f.elements.svc.value);
      refreshTimes();
    });
    f.elements.pro.addEventListener("change", refreshTimes);
    f.elements.date.addEventListener("change", refreshTimes);
    refreshTimes();
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var s = svcById(f.elements.svc.value);
      if (!f.elements.time.value) return toast("No hay horario libre para esa combinación.");
      if (f.elements.nombre.value.trim().length < 2 || f.elements.telefono.value.replace(/\D/g, "").length < 6) return toast("Completá nombre y teléfono.");
      var fecha = f.elements.date.value;
      guardar(T.add({
        code: T.code(), svcs: [s.id], pro: f.elements.pro.value, date: fecha, time: f.elements.time.value,
        dur: s.duracion, total: s.precio, nombre: f.elements.nombre.value.trim(), telefono: f.elements.telefono.value.trim(),
        email: "", nota: f.elements.nota.value.trim(), estado: "confirmado", origen: "local", sena: 0, creado: new Date().toISOString()
      }).then(function () { closeModal(); day = parseKey(fecha); }), "Turno guardado.").catch(function () {});
    });
  }
  $("#newBtn").addEventListener("click", function () { openNew({}); });

  /* Bloquear horario */
  $("#blockBtn").addEventListener("click", function () {
    var range = dayRange(day) || [600, 1200];
    openModal("Bloquear horario",
      '<form class="mform" id="blockForm">' +
      '<label class="field field--full"><span>Profesional</span><select name="pro"><option value="*">Todo el equipo</option>' + proOptions(null) + "</select></label>" +
      '<label class="field field--full"><span>Fecha</span><input name="date" type="date" value="' + dateKey(day) + '"></label>' +
      '<label class="field"><span>Desde</span><input name="from" type="time" step="1800" value="' + toHHMM(range[0]) + '"></label>' +
      '<label class="field"><span>Hasta</span><input name="to" type="time" step="1800" value="' + toHHMM(Math.min(range[0] + 120, range[1])) + '"></label>' +
      '<label class="field field--full"><span>Motivo</span><input name="nota" placeholder="Ej: Trámite, almuerzo, capacitación"></label>' +
      '<div class="modal__actions field--full"><button class="btn btn--primary btn--sm" type="submit">Bloquear</button><button class="btn btn--ghost btn--sm" type="button" data-close>Cancelar</button></div></form>');
    $("#blockForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = this, a = toMin(f.elements.from.value), b = toMin(f.elements.to.value);
      if (!(b > a)) return toast("El horario 'hasta' debe ser mayor.");
      var pros = f.elements.pro.value === "*" ? C.equipo.map(function (p) { return p.id; }) : [f.elements.pro.value];
      var fecha = f.elements.date.value, fallidos = [];
      // Un bloqueo no puede pisar turnos ya tomados: esos profesionales se informan
      var tareas = pros.map(function (pid) {
        return T.add({ code: T.code(), tipo: "bloqueo", svcs: [], pro: pid, date: fecha, time: toHHMM(a), dur: b - a, total: 0,
          nombre: "Bloqueado", telefono: "", nota: f.elements.nota.value.trim(), estado: "confirmado", origen: "local", creado: new Date().toISOString() })
          .catch(function () { fallidos.push((proById(pid) || {}).nombre || pid); });
      });
      Promise.all(tareas).then(function () {
        closeModal(); day = parseKey(fecha); render();
        toast(fallidos.length ? "No se bloqueó a " + fallidos.join(", ") + ": ya tiene turnos en ese horario." : "Horario bloqueado: ya no se puede reservar online.");
      });
    });
  });

  /* ---------------- Turnos (lista) ---------------- */
  function segInit(id, key, fn) {
    $(id).addEventListener("click", function (e) {
      var b = e.target.closest("[data-f]"); if (!b) return;
      filters[key] = b.getAttribute("data-f");
      $$(id + " button").forEach(function (x) { x.classList.toggle("is-active", x === b); });
      fn();
    });
  }
  segInit("#turnosFilter", "turnos", renderTurnos);
  segInit("#clientesFilter", "clientes", renderClientes);
  $("#turnosSearch").addEventListener("input", renderTurnos);
  $("#clientesSearch").addEventListener("input", renderClientes);

  function renderTurnos() {
    var tk = dateKey(today()), f = filters.turnos, q = $("#turnosSearch").value.trim().toLowerCase();
    var list = turnos().filter(function (b) {
      if (f === "cancelados") return b.estado === "cancelado";
      if (b.estado === "cancelado") return false;
      if (f === "hoy") return b.date === tk;
      if (f === "proximos") return b.date > tk;
      return b.date < tk;
    }).filter(function (b) {
      return !q || (b.nombre + " " + b.code + " " + b.telefono).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) {
      var k = (a.date + a.time).localeCompare(b.date + b.time);
      return f === "pasados" ? -k : k;
    }).slice(0, 200);

    $("#turnosTable").innerHTML = "<thead><tr><th>Fecha</th><th>Cliente</th><th>Servicio</th><th>Profesional</th><th>Total</th><th>Estado</th></tr></thead><tbody>" +
      (list.length ? list.map(function (b) {
        return '<tr data-code="' + esc(b.code) + '"><td>' + esc(cap(fmtCorto(b.date))) + " · <strong>" + esc(b.time) + "</strong></td><td>" + esc(b.nombre) +
          (b.origen === "web" ? ' <em class="tag">web</em>' : "") + "</td><td>" + esc(svcNames(b)) + "</td><td>" + esc((proById(b.pro) || {}).nombre || "") +
          "</td><td>" + money(b.total) + '</td><td><span class="pill st-' + esc(b.estado) + '">' + esc(ESTADOS[b.estado]) + "</span></td></tr>";
      }).join("") : '<tr><td colspan="6" class="empty">No hay turnos para mostrar.</td></tr>') + "</tbody>";
  }
  $("#turnosTable").addEventListener("click", function (e) {
    var tr = e.target.closest("tr[data-code]"); if (tr) openDetail(tr.getAttribute("data-code"));
  });

  /* ---------------- Clientes ---------------- */
  function clientes() {
    var map = {};
    turnos().forEach(function (b) {
      if (b.estado === "cancelado") return;
      var k = phoneDigits(b.telefono) || b.nombre;
      var c = map[k] || (map[k] = { nombre: b.nombre, telefono: b.telefono, visitas: 0, gastado: 0, ultima: "", ausencias: 0, proximo: "" });
      var tk = dateKey(today());
      if (b.estado === "atendido") { c.visitas++; c.gastado += b.total; if (b.date > c.ultima) c.ultima = b.date; }
      if (b.estado === "ausente") c.ausencias++;
      if (b.estado === "confirmado" && b.date >= tk && (!c.proximo || b.date < c.proximo)) c.proximo = b.date;
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }
  function renderClientes() {
    var f = filters.clientes, q = $("#clientesSearch").value.trim().toLowerCase(), lim = dateKey(addDays(today(), -30));
    var list = clientes().filter(function (c) {
      if (f === "frecuentes") return c.visitas >= 3;
      if (f === "inactivos") return c.ultima && c.ultima < lim && !c.proximo;
      return true;
    }).filter(function (c) { return !q || (c.nombre + c.telefono).toLowerCase().indexOf(q) >= 0; })
      .sort(function (a, b) { return b.gastado - a.gastado; });
    $("#clientesTable").innerHTML = "<thead><tr><th>Cliente</th><th>Visitas</th><th>Total gastado</th><th>Última visita</th><th>Próximo turno</th><th></th></tr></thead><tbody>" +
      (list.length ? list.map(function (c) {
        var msg = c.proximo ? "¡Hola " + c.nombre.split(" ")[0] + "! Te escribimos de " + C.nombre + "."
          : "¡Hola " + c.nombre.split(" ")[0] + "! Te extrañamos en " + C.nombre + (C.modo === "barberia" ? " 💈" : " ✨") + " ¿Te reservamos un turno esta semana?";
        return "<tr><td><strong>" + esc(c.nombre) + '</strong><br><small class="muted">' + esc(c.telefono) + "</small></td><td>" + c.visitas +
          (c.ausencias ? ' <small class="muted">(' + c.ausencias + " ausencias)</small>" : "") + "</td><td>" + money(c.gastado) + "</td><td>" +
          (c.ultima ? esc(cap(fmtCorto(c.ultima))) : "—") + "</td><td>" + (c.proximo ? esc(cap(fmtCorto(c.proximo))) : "—") + "</td>" +
          '<td><a class="wa-mini" target="_blank" rel="noopener" href="' + esc(wa(c.telefono, msg)) + '">WhatsApp</a></td></tr>';
      }).join("") : '<tr><td colspan="6" class="empty">No hay clientes para mostrar.</td></tr>') + "</tbody>";
  }

  /* ---------------- Estadísticas ---------------- */
  function bars(rows, fmt) {
    var max = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
    return '<ul class="bars">' + rows.map(function (r) {
      return '<li><span class="bars__l">' + esc(r.l) + '</span><span class="bars__t"><i style="width:' + (r.v / max * 100).toFixed(1) + '%"></i></span><span class="bars__v">' + (fmt ? fmt(r.v) : r.v) + "</span></li>";
    }).join("") + "</ul>";
  }
  function renderStats() {
    var tk = dateKey(today()), desde = dateKey(addDays(today(), -28));
    var list = turnos().filter(function (b) { return b.date >= desde && b.date < tk && b.estado !== "cancelado"; });
    var att = list.filter(function (b) { return b.estado === "atendido"; });

    // Ingresos por semana (4 semanas)
    var weeks = [3, 2, 1, 0].map(function (w) {
      var a = dateKey(addDays(today(), -7 * (w + 1))), b = dateKey(addDays(today(), -7 * w));
      return { l: w === 0 ? "Últimos 7 días" : "Hace " + (w + 1) + " semanas", v: att.filter(function (x) { return x.date >= a && x.date < b; }).reduce(function (s, x) { return s + x.total; }, 0) };
    });
    // Servicios
    var bySvc = {};
    att.forEach(function (b) { b.svcs.forEach(function (id) { bySvc[id] = (bySvc[id] || 0) + 1; }); });
    var svcRows = Object.keys(bySvc).map(function (id) { return { l: (svcById(id) || {}).nombre || id, v: bySvc[id] }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 6);
    // Profesionales
    var proRows = C.equipo.map(function (p) {
      return { l: p.nombre, v: att.filter(function (b) { return b.pro === p.id; }).reduce(function (s, b) { return s + b.total; }, 0) };
    });
    // Días de la semana
    var dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"], byDow = [0, 0, 0, 0, 0, 0, 0];
    list.forEach(function (b) { byDow[parseKey(b.date).getDay()]++; });
    var dowRows = [1, 2, 3, 4, 5, 6, 0].map(function (d) { return { l: dias[d], v: byDow[d] }; });

    var web = list.filter(function (b) { return b.origen === "web"; }).length;
    var aus = list.filter(function (b) { return b.estado === "ausente"; }).length;
    var ticket = att.length ? att.reduce(function (s, b) { return s + b.total; }, 0) / att.length : 0;

    $("#stats").innerHTML =
      '<article class="card card--wide"><h3>Facturación por semana</h3><p class="muted">Servicios atendidos, últimas 4 semanas</p>' + bars(weeks, money) + "</article>" +
      '<article class="card"><h3>Resumen 28 días</h3><dl class="mini">' +
      "<div><dt>Turnos</dt><dd>" + list.length + "</dd></div>" +
      "<div><dt>Ticket promedio</dt><dd>" + money(ticket) + "</dd></div>" +
      "<div><dt>Reservas online</dt><dd>" + (list.length ? Math.round(web / list.length * 100) : 0) + "%</dd></div>" +
      "<div><dt>Ausencias</dt><dd>" + (list.length ? Math.round(aus / list.length * 100) : 0) + "%</dd></div></dl>" +
      '<p class="hint">' + (C.sena && C.sena.activa ? "Con seña activa, las ausencias suelen bajar a menos de la mitad." : "Activá la seña para reducir las ausencias.") + "</p></article>" +
      '<article class="card"><h3>Servicios más pedidos</h3>' + bars(svcRows) + "</article>" +
      '<article class="card"><h3>Facturación por profesional</h3>' + bars(proRows, money) + "</article>" +
      '<article class="card"><h3>Días con más movimiento</h3>' + bars(dowRows) + "</article>";
  }

  /* ---------------- Otros ---------------- */
  $("#resetDemo").addEventListener("click", function () {
    if (!window.confirm("¿Regenerar los datos de ejemplo? Se borran los turnos cargados.")) return;
    T.resetDemo(); toast("Datos de demo regenerados."); render();
  });

  // Turnos nuevos desde la web: en la demo al instante (otra pestaña), con reservas reales cada 30 s
  T.onChange(function (nuevos) {
    if ($("#app").hidden) return;
    var b = nuevos.filter(function (x) { return x.tipo !== "bloqueo" && x.origen === "web"; }).pop();
    if (b) toast("🔔 Nuevo turno: " + b.nombre + " · " + fmtCorto(b.date) + " " + b.time);
    render();
  });
  setInterval(function () { if (!$("#app").hidden && view === "agenda") renderAgenda(); }, 60000);

  if (T.hasSession()) cargarYEntrar().catch(function (err) { toast(err.message); T.logout(); });
})();
