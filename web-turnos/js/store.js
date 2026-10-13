/* =====================================================================
   DATOS DE TURNOS — compartidos entre la web pública y el panel del dueño.
   Dos modos con la misma interfaz:
   - DEMO (sin backend en config.js): todo en el navegador, con datos de ejemplo.
   - REAL (backend.slug configurado): reservas en Supabase, compartidas entre
     la web y el panel, sin choques de horarios.
   ===================================================================== */
(function () {
  "use strict";
  var C = window.__NEGOCIO__;
  if (!C) return;

  var KEY = "turnos-" + C.modo;
  var SEED_KEY = "turnos-seed-v2-" + C.modo;

  var pad = function (n) { return String(n).padStart(2, "0"); };
  var dateKey = function (d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  var toMin = function (h) { var p = h.split(":"); return +p[0] * 60 + +p[1]; };
  var toHHMM = function (m) { return pad(Math.floor(m / 60)) + ":" + pad(m % 60); };

  function all() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  }
  function code() { return Math.random().toString(36).slice(2, 7).toUpperCase(); }

  function active(b) { return b.estado !== "cancelado"; }

  function isProFree(proId, dk, start, dur, ignoreCode) {
    return !all().some(function (b) {
      if (!active(b) || b.pro !== proId || b.date !== dk || b.code === ignoreCode) return false;
      var bs = toMin(b.time), be = bs + b.dur;
      return start < be && start + dur > bs;
    });
  }

  /* --------- Datos de ejemplo para que la demo se vea "viva" --------- */
  var NOMBRES = {
    barberia: ["Juan Pérez", "Matías Gómez", "Lucas Fernández", "Santiago Díaz", "Federico Ruiz", "Joaquín Torres", "Bruno Romero", "Facundo Sosa", "Agustín Álvarez", "Tomás Benítez", "Ignacio Medina", "Franco Herrera", "Gonzalo Castro", "Ezequiel Ríos", "Nahuel Molina"],
    otros: ["Lucía Martínez", "Sofía García", "Valentina López", "Camila Rodríguez", "Martina Sánchez", "Julieta Romero", "Agustina Díaz", "Florencia Acosta", "Micaela Ruiz", "Carolina Vega", "Paula Morales", "Antonella Ortiz", "Rocío Silva", "Daniela Navarro", "Belén Castro"]
  };

  function rng(seed) {
    var s = seed % 2147483647; if (s <= 0) s += 2147483646;
    return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
  }

  function seed(force) {
    if (!C.esDemo) return;
    // Los datos de ejemplo se regeneran si tienen más de 2 días, así la demo
    // siempre muestra turnos futuros y horarios "Ocupado" aunque la abran semanas después.
    var done = null, hoyKey = dateKey(new Date());
    try { done = localStorage.getItem(SEED_KEY); } catch (e) {}
    if (!force && done && /^\d{4}-\d{2}-\d{2}$/.test(done) && (new Date(hoyKey) - new Date(done)) / 86400000 < 2) return;

    var list = force ? [] : all().filter(function (b) { return !b.demo; });
    var names = C.modo === "barberia" ? NOMBRES.barberia : NOMBRES.otros;
    var clients = names.map(function (n, i) { return { nombre: n, telefono: "11 " + (4000 + i * 137) + " " + (1000 + i * 791) % 9000 }; });
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    var r = rng(C.modo.length * 7919 + today.getMonth() * 31 + today.getDate());

    for (var off = -35; off <= 10; off++) {
      var d = new Date(today); d.setDate(d.getDate() + off);
      var dk = dateKey(d);
      if (C.diasCerrados.indexOf(dk) >= 0) continue;
      var shifts = C.horarios[d.getDay()] || [];
      var density = off < 0 ? 0.62 : off === 0 ? 0.55 : Math.max(0.12, 0.42 - off * 0.03);

      C.equipo.forEach(function (p) {
        var svcs = C.servicios.filter(function (s) { return p.servicios === "todos" || p.servicios.indexOf(s.id) >= 0; });
        shifts.forEach(function (sh) {
          var t = toMin(sh[0]), end = toMin(sh[1]);
          while (t < end) {
            var s = svcs[Math.floor(r() * svcs.length)];
            if (!s || t + s.duracion > end) break;
            if (r() < density) {
              var cl = clients[Math.floor(r() * clients.length)];
              var past = off < 0 || (off === 0 && t + s.duracion <= nowMin);
              var estado = past ? (r() < 0.9 ? "atendido" : "ausente") : "confirmado";
              list.push({
                code: code(), svcs: [s.id], pro: p.id, date: dk, time: toHHMM(t), dur: s.duracion, total: s.precio,
                nombre: cl.nombre, telefono: cl.telefono, email: "", nota: "",
                estado: estado, origen: r() < 0.7 ? "web" : "local",
                sena: C.sena && C.sena.activa && r() < 0.8 ? Math.round(s.precio * C.sena.porcentaje / 100) : 0,
                demo: true, creado: new Date(d.getTime() - 86400000 * 2).toISOString()
              });
              t += s.duracion;
            } else {
              t += C.intervaloTurnos;
            }
          }
        });
      });
    }
    save(list);
    try { localStorage.setItem(SEED_KEY, hoyKey); } catch (e) {}
  }

  var util = { pad: pad, dateKey: dateKey, toMin: toMin, toHHMM: toHHMM };
  var choca = function (list, proId, dk, start, dur, ignoreCode) {
    return list.some(function (b) {
      if (b.estado === "cancelado" || b.pro !== proId || b.date !== dk || (ignoreCode && b.code === ignoreCode)) return false;
      var bs = toMin(b.time), be = bs + b.dur;
      return start < be && start + dur > bs;
    });
  };

  if (!C.backend) {
    /* ------------------------------ MODO DEMO ------------------------------ */
    var listeners = [];
    window.addEventListener("storage", function (e) {
      if (e.key !== KEY) return;
      var prev = JSON.parse(e.oldValue || "[]"), next = JSON.parse(e.newValue || "[]");
      var ids = prev.map(function (b) { return b.code; });
      var nuevos = next.filter(function (b) { return ids.indexOf(b.code) < 0; });
      listeners.forEach(function (fn) { fn(nuevos); });
    });
    window.__TURNOS__ = {
      remoto: false,
      ready: Promise.resolve(),
      refresh: function () { return Promise.resolve(); },
      all: all,
      save: save,
      code: code,
      isProFree: isProFree,
      reservar: function (b) { b.code = b.code || code(); var l = all(); l.push(b); save(l); return Promise.resolve(b.code); },
      mine: function () { return all().filter(function (b) { return b.propio; }); },
      cancelar: function (c) { save(all().map(function (b) { return b.code === c ? Object.assign({}, b, { estado: "cancelado", canceladoPor: "cliente" }) : b; })); return Promise.resolve(true); },
      add: function (b) { var l = all(); l.push(b); save(l); return Promise.resolve(); },
      update: function (c, patch) {
        save(all().map(function (b) { return b.code === c ? Object.assign({}, b, patch) : b; }));
        return Promise.resolve();
      },
      remove: function (c) { save(all().filter(function (b) { return b.code !== c; })); return Promise.resolve(); },
      // Panel del dueño (en la demo se entra con el PIN de config.js)
      hasSession: function () { try { return !!sessionStorage.getItem("panel-ok"); } catch (e) { return false; } },
      login: function (pin) {
        if (String(pin) !== String(C.pinPanel)) return Promise.reject(new Error("PIN incorrecto."));
        try { sessionStorage.setItem("panel-ok", "1"); } catch (e) {}
        return Promise.resolve();
      },
      logout: function () { try { sessionStorage.removeItem("panel-ok"); } catch (e) {} return Promise.resolve(); },
      load: function () { return Promise.resolve(); },
      onChange: function (fn) { listeners.push(fn); },
      seed: seed,
      resetDemo: function () { seed(true); },
      util: util
    };
    seed(false);
    return;
  }

  /* ------------------------------ MODO REAL ------------------------------ */
  var B = C.backend;
  var MINE_KEY = "mis-turnos-" + B.slug, SES_KEY = "sesion-panel-" + B.slug;
  var cache = [], negocioId = null, session = null, cbs = [];
  try { session = JSON.parse(localStorage.getItem(SES_KEY) || "null"); } catch (e) {}

  var MENSAJES = {
    OCUPADO: "Ese horario se acaba de ocupar. Elegí otro.",
    FECHA_INVALIDA: "Ese horario ya pasó. Elegí otro.",
    DATOS_INVALIDOS: "Revisá tu nombre y teléfono.",
    LIMITE_TURNOS: "Ya tenés varios turnos reservados. Escribinos por WhatsApp.",
    NEGOCIO_INEXISTENTE: "Las reservas online no están disponibles en este momento."
  };
  function error(msg, codigo) { var e = new Error(msg); e.codigo = codigo; return e; }
  function traducir(j, status) {
    var m = (j && (j.message || j.msg || j.error_description || j.error)) || "";
    if (MENSAJES[m]) return error(MENSAJES[m], m);
    if (j && j.code === "23P01") return error(MENSAJES.OCUPADO, "OCUPADO");
    if (/invalid login credentials/i.test(m)) return error("Email o contraseña incorrectos.", "LOGIN");
    if (/email not confirmed/i.test(m)) return error("Falta confirmar el email del usuario.", "LOGIN");
    if (status === 401 || /jwt/i.test(m)) return error("Tu sesión venció. Volvé a entrar.", "SESION");
    return error("No pudimos completar la operación. Probá de nuevo en unos segundos.", "ERROR");
  }
  function req(method, path, body, conSesion) {
    var h = { apikey: B.key, "Content-Type": "application/json" };
    if (conSesion && session) h.Authorization = "Bearer " + session.access_token;
    if (method !== "GET") h.Prefer = "return=representation";
    return fetch(B.url + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined })
      .catch(function () { throw error("Sin conexión. Revisá internet y probá de nuevo.", "RED"); })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
          if (!r.ok) throw traducir(j, r.status);
          return j;
        });
      });
  }
  var rpc = function (fn, args) { return req("POST", "/rest/v1/rpc/" + fn, args, !!session); };

  var hoy = function () { var d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  var masDias = function (n) { var d = hoy(); d.setDate(d.getDate() + n); return dateKey(d); };
  function deFila(r) {
    return {
      id: r.id, code: r.code || "", tipo: r.tipo || "turno", svcs: r.svcs || [], pro: r.pro, date: r.fecha,
      time: String(r.hora).slice(0, 5), dur: r.dur, total: r.total || 0, sena: r.sena || 0,
      nombre: r.nombre || "", telefono: r.telefono || "", email: r.email || "", nota: r.nota || "",
      estado: r.estado || "confirmado", origen: r.origen || "web", canceladoPor: r.cancelado_por || null, creado: r.creado
    };
  }
  function mineAll() { try { return JSON.parse(localStorage.getItem(MINE_KEY) || "[]"); } catch (e) { return []; } }
  function mineSave(l) { try { localStorage.setItem(MINE_KEY, JSON.stringify(l)); } catch (e) {} }

  // Sesión del dueño (Supabase Auth, email + contraseña)
  function guardarSesion(j) {
    session = j ? { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || (Date.now() / 1000 + (j.expires_in || 3600)) } : null;
    try { if (session) localStorage.setItem(SES_KEY, JSON.stringify(session)); else localStorage.removeItem(SES_KEY); } catch (e) {}
  }
  function asegurarSesion() {
    if (!session) return Promise.reject(error("Iniciá sesión.", "SESION"));
    if (session.expires_at * 1000 - 60000 > Date.now()) return Promise.resolve();
    return req("POST", "/auth/v1/token?grant_type=refresh_token", { refresh_token: session.refresh_token })
      .then(guardarSesion, function (e) { guardarSesion(null); throw e; });
  }

  var publico = {
    // Horarios ocupados (sin datos personales) para calcular disponibilidad
    refresh: function () {
      return rpc("ocupados", { p_slug: B.slug, p_desde: masDias(0), p_hasta: masDias((C.diasReservables || 30) + 1) })
        .then(function (rows) {
          cache = (rows || []).map(function (r) { return { pro: r.pro, date: r.fecha, time: String(r.hora).slice(0, 5), dur: r.dur, estado: "confirmado" }; });
        });
    },
    reservar: function (b) {
      return rpc("reservar", {
        p_slug: B.slug, p_svcs: b.svcs, p_pro: b.pro, p_fecha: b.date, p_hora: b.time, p_dur: b.dur,
        p_total: b.total, p_sena: b.sena || 0, p_nombre: b.nombre, p_telefono: b.telefono, p_email: b.email || "", p_nota: b.nota || ""
      }).then(function (code) {
        b.code = code;
        cache.push({ pro: b.pro, date: b.date, time: b.time, dur: b.dur, estado: "confirmado" });
        var l = mineAll(); l.push(b); mineSave(l);
        return code;
      });
    },
    mine: mineAll,
    cancelar: function (c, tel) {
      var b = mineAll().filter(function (x) { return x.code === c; })[0];
      return rpc("cancelar_turno", { p_slug: B.slug, p_code: c, p_telefono: tel || (b && b.telefono) || "" }).then(function (ok) {
        if (!ok) throw error("No pudimos cancelar ese turno. Escribinos por WhatsApp.", "CANCELAR");
        mineSave(mineAll().map(function (x) { return x.code === c ? Object.assign({}, x, { estado: "cancelado" }) : x; }));
        return publico.refresh();
      });
    }
  };

  var panel = {
    hasSession: function () { return !!session; },
    login: function (email, password) {
      return req("POST", "/auth/v1/token?grant_type=password", { email: email, password: password }).then(guardarSesion);
    },
    logout: function () {
      var s = session; guardarSesion(null);
      if (!s) return Promise.resolve();
      return fetch(B.url + "/auth/v1/logout", { method: "POST", headers: { apikey: B.key, Authorization: "Bearer " + s.access_token } }).catch(function () {});
    },
    // Carga el local del dueño y sus turnos (desde 60 días atrás hasta lo reservable)
    load: function () {
      return asegurarSesion().then(function () {
        return req("GET", "/rest/v1/negocios?select=id,nombre&slug=eq." + encodeURIComponent(B.slug), null, true);
      }).then(function (rows) {
        if (!rows || !rows.length) throw error("Tu usuario no tiene acceso a este local.", "PERMISO");
        negocioId = rows[0].id;
        return req("GET", "/rest/v1/turnos?select=*&negocio_id=eq." + negocioId + "&fecha=gte." + masDias(-60) +
          "&fecha=lte." + masDias(Math.max(C.diasReservables || 30, 30) + 30) + "&order=fecha,hora&limit=5000", null, true);
      }).then(function (rows) { cache = (rows || []).map(deFila); return cache; });
    },
    add: function (b) {
      return asegurarSesion().then(function () {
        return req("POST", "/rest/v1/turnos", {
          negocio_id: negocioId, code: b.code, tipo: b.tipo || "turno", svcs: b.svcs || [], pro: b.pro, fecha: b.date, hora: b.time,
          dur: b.dur, total: b.total || 0, sena: b.sena || 0, nombre: b.nombre || "", telefono: b.telefono || "",
          email: b.email || "", nota: b.nota || "", estado: b.estado || "confirmado", origen: b.origen || "local"
        }, true);
      }).then(function (rows) { cache.push(deFila(rows[0])); });
    },
    update: function (c, patch) {
      var b = cache.filter(function (x) { return x.code === c; })[0];
      if (!b) return Promise.reject(error("No encontramos ese turno.", "ERROR"));
      var body = {};
      if (patch.estado) body.estado = patch.estado;
      if (patch.estado === "cancelado") body.cancelado_por = patch.canceladoPor || "local";
      return asegurarSesion().then(function () {
        return req("PATCH", "/rest/v1/turnos?id=eq." + b.id, body, true);
      }).then(function (rows) {
        var n = deFila(rows[0]);
        cache = cache.map(function (x) { return x.id === n.id ? n : x; });
      });
    },
    remove: function (c) {
      var b = cache.filter(function (x) { return x.code === c; })[0];
      if (!b) return Promise.resolve();
      return asegurarSesion().then(function () { return req("DELETE", "/rest/v1/turnos?id=eq." + b.id, null, true); })
        .then(function () { cache = cache.filter(function (x) { return x.id !== b.id; }); });
    },
    // Revisa cada 30 s si entraron turnos nuevos desde la web
    onChange: function (fn) {
      cbs.push(fn);
      if (cbs.length > 1) return;
      setInterval(function () {
        if (!session || document.hidden) return;
        var antes = cache.map(function (x) { return x.id; });
        panel.load().then(function () {
          var nuevos = cache.filter(function (x) { return antes.indexOf(x.id) < 0; });
          cbs.forEach(function (f) { f(nuevos); });
        }).catch(function () {});
      }, 30000);
    }
  };

  window.__TURNOS__ = Object.assign({
    remoto: true,
    all: function () { return cache; },
    save: function () {},
    code: code,
    isProFree: function (proId, dk, start, dur, ignoreCode) { return !choca(cache, proId, dk, start, dur, ignoreCode); },
    seed: function () {},
    resetDemo: function () {},
    util: util
  }, publico, panel);
  // En la web pública se cargan los horarios ocupados apenas abre la página (el panel carga los suyos al entrar)
  window.__TURNOS__.ready = /admin\.html$/.test(location.pathname) ? Promise.resolve()
    : publico.refresh().catch(function (e) { window.__TURNOS__.error = e; });
})();
